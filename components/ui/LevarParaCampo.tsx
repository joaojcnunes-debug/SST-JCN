"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, RefreshCw, WifiOff } from "lucide-react";
import toast from "react-hot-toast";
import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
import { offlineDisponivel } from "@/lib/offline/db";

/**
 * "Levar para o campo" — copia o documento aberto para o aparelho.
 *
 * POR QUE UM BOTÃO, E NÃO CACHE AUTOMÁTICO. Cache que se enche sozinho dá a
 * ilusão de cobertura: o técnico sai da base achando que está coberto e descobre
 * no cliente que a tela de que precisa nunca foi aberta. Uma ação consciente
 * antes de sair vale mais que um cache silencioso que talvez tenha pegado o que
 * importa.
 *
 * É a mesma lição que a Frota aprendeu e escreveu em `db.ts`: a regra "faça
 * login e abra a frota ANTES de sair" não é burocracia, é o momento em que o
 * aparelho copia o que vai precisar depois. Aqui a diferença é que o momento
 * virou um botão, em vez de uma instrução que alguém precisa lembrar.
 *
 * NÃO BAIXA NADA SOZINHO DA REDE: recebe o pacote que a tela já carregou. Uma
 * segunda ida ao banco só para guardar seria consulta repetida — e pior, poderia
 * guardar um estado diferente do que o técnico está vendo na tela.
 */
export function LevarParaCampo({
  idDocumento,
  dados,
  rotulo = "Inspeção",
}: {
  idDocumento: string;
  /**
   * O pacote que a tela já carregou. `unknown` de propósito: o componente não
   * precisa entender o conteúdo, só guardá-lo — e tipá-lo por módulo obrigaria
   * a mexer aqui a cada módulo novo.
   */
  dados: unknown;
  /** Como o técnico chama isto: "Inspeção", "Relatório". Entra nas frases. */
  rotulo?: string;
}) {
  const [baixadoEm, setBaixadoEm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") setOnline(navigator.onLine);
    const aoVoltar = () => setOnline(true);
    const aoCair = () => setOnline(false);
    window.addEventListener("online", aoVoltar);
    window.addEventListener("offline", aoCair);
    return () => {
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("offline", aoCair);
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    void lerDocumentoCache(idDocumento).then((c) => {
      if (vivo) setBaixadoEm(c?.baixado_em ?? null);
    });
    return () => {
      vivo = false;
    };
  }, [idDocumento]);

  const levar = useCallback(async () => {
    if (!dados) return;
    setSalvando(true);
    try {
      await guardarDocumentoCache(idDocumento, dados);
      const agora = new Date().toISOString();
      setBaixadoEm(agora);
      toast.success(`${rotulo} guardado no aparelho`);
    } catch {
      // `guardarDocumentoCache` engole a própria falha (cache é conforto, não
      // contrato), então só chega aqui erro de verdade. Avisar importa: o
      // técnico não pode sair achando que levou algo que não foi.
      toast.error("Não foi possível guardar no aparelho");
    } finally {
      setSalvando(false);
    }
  }, [dados, idDocumento, rotulo]);

  // Sem IndexedDB não há offline nenhum, e um botão que não faz nada é pior que
  // botão nenhum — some inteiro.
  if (!offlineDisponivel()) return null;

  const jaBaixada = baixadoEm !== null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            {jaBaixada ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <Download className="size-4 text-gray-400" />
            )}
            {jaBaixada ? "Disponível sem internet" : "Levar para o campo"}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {jaBaixada
              ? `Copiado para o aparelho em ${new Date(baixadoEm).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}. Atualize antes de sair se alguém mexeu depois disso.`
              : `Guarda ${rotulo.toLowerCase()} no celular para você conseguir trabalhar sem sinal.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void levar()}
          disabled={salvando || !dados || (!online && !jaBaixada)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {salvando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : jaBaixada ? (
            <RefreshCw className="size-4" />
          ) : (
            <Download className="size-4" />
          )}
          {jaBaixada ? "Atualizar cópia" : "Levar para o campo"}
        </button>
      </div>

      {/* Sem rede não dá para atualizar: o que está guardado é o que existe.
          Dizer isso evita o técnico ficar tocando num botão que não responde. */}
      {!online && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500">
          <WifiOff className="size-3.5" />
          Sem rede — a cópia guardada continua valendo, mas não dá para atualizar agora.
        </p>
      )}
    </div>
  );
}
