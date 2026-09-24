"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, HelpCircle, Send } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePodeEnviarSgg } from "@/lib/hooks/useUsuario";
import type { SggEnvio, Setor } from "@/lib/supabase/types";

/**
 * Botão "Enviar Riscos para SGG" (SGG-RISCOS-01 fase 3).
 *
 * Substitui a transcrição manual que o administrativo faz hoje. Regras que o
 * componente NÃO pode relaxar, porque o SGG não tem DELETE:
 *  - o "enviar todos" roda em laço FOR sequencial: o serviço do host serializa
 *    por base e o segundo envio simultâneo toma 429;
 *  - `indeterminado` NÃO ganha botão de reenviar — reenviar é a única forma de
 *    duplicar uma avaliação lá dentro;
 *  - 422 lista o agente de cada risco sem tempo de exposição (D3.3): bloqueio
 *    sem dizer o que falta vira beco sem saída.
 */

type Impedimento = { id_risco: string; agente: string; motivo: string };
type Resposta = {
  ok?: boolean;
  status?: string;
  resultado?: string;
  erro?: string;
  codigo?: string;
  msg?: string;
  sgg_id?: string | null;
  impedimentos?: Impedimento[];
};

/** Traduz o código do SGG para algo acionável. Ver contrato na wiki. */
function explicar(r: Resposta): string {
  switch (r.codigo) {
    case "D40027":
      return `O agente "${r.msg ?? ""}" não existe no catálogo do SGG desta unidade. Cadastre-o no SGG ou ajuste o nome no painel.`;
    case "D40082":
      return "Um rótulo de probabilidade/efeito não existe na matriz do SGG — o de-para precisa de ajuste.";
    case "D40086":
      return "A combinação de probabilidade e efeito não resolve nenhum nível na matriz do SGG. Revise os dois critérios do risco.";
    case "D40017":
      return "Este setor já tem avaliação no SGG nesta data.";
    case "D40016":
      return "Setor GHE: o SGG exige todos os cargos do setor. Confira o cadastro no SGG.";
    case "D40012":
      return "Um cargo não pertence a este setor no SGG.";
    default:
      return r.erro ?? r.msg ?? "Não foi possível enviar.";
  }
}

function Selo({ envio }: { envio?: SggEnvio }) {
  if (!envio) return <span className="text-xs text-gray-400">não enviado</span>;
  const mapa: Record<string, { txt: string; cls: string }> = {
    enviado: { txt: "enviado", cls: "bg-green-50 text-green-700 ring-green-200" },
    duplicado: { txt: "já existia no SGG", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
    erro: { txt: "erro", cls: "bg-red-50 text-red-700 ring-red-200" },
    indeterminado: { txt: "confira no SGG", cls: "bg-gray-100 text-gray-700 ring-gray-300" },
    pendente: { txt: "em andamento", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    // "erro" fica reenviável: a rota reaproveita a linha quando o SGG recusou
    // com código (nada foi criado lá).
  };
  const m = mapa[envio.status] ?? mapa.pendente;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m.cls}`}>
      {envio.status === "enviado" && <CheckCircle2 className="size-3" />}
      {envio.status === "indeterminado" && <HelpCircle className="size-3" />}
      {m.txt}
      {envio.sgg_id_avaliacao ? ` (${envio.sgg_id_avaliacao})` : ""}
    </span>
  );
}

export default function EnviarRiscosSgg({
  idInspecao,
  setores,
}: {
  idInspecao: string;
  setores: Setor[];
}) {
  const pode = usePodeEnviarSgg();
  const [envios, setEnvios] = useState<Record<string, SggEnvio>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [impedimentos, setImpedimentos] = useState<{ setor: string; itens: Impedimento[] } | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("sgg_envios")
      .select("*")
      .eq("id_inspecao", idInspecao);
    const porSetor: Record<string, SggEnvio> = {};
    for (const e of (data ?? []) as SggEnvio[]) porSetor[e.id_setor] = e;
    setEnvios(porSetor);
  }, [idInspecao]);

  useEffect(() => {
    if (pode) void carregar();
  }, [pode, carregar]);

  const enviarSetor = useCallback(
    async (setor: Setor): Promise<boolean> => {
      setOcupado(setor.id_setor);
      setImpedimentos(null);
      try {
        const res = await fetch("/api/sgg/enviar-riscos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_inspecao: idInspecao, id_setor: setor.id_setor }),
        });
        const r = (await res.json()) as Resposta;

        if (res.status === 422 && r.impedimentos?.length) {
          setImpedimentos({ setor: setor.setor_ghe, itens: r.impedimentos });
          toast.error(`${setor.setor_ghe}: corrija os riscos antes de enviar.`);
          return false;
        }
        await carregar();
        if (r.ok) {
          toast.success(`${setor.setor_ghe}: enviado ao SGG.`);
          return true;
        }
        // "duplicado" só é aceitável quando o setor REALMENTE está no SGG. A rota
        // só devolve isso depois de ler o status da linha anterior — antes ela
        // respondia "duplicado" para tentativa falha, e o setor ficava fora do
        // SGG com a UI dizendo que estava lá.
        if (r.resultado === "duplicado") {
          toast(`${setor.setor_ghe}: já existia no SGG.`);
          return true;
        }
        if (r.resultado === "em_andamento") {
          toast(`${setor.setor_ghe}: envio em andamento, aguarde.`);
          return false;
        }
        if (r.resultado === "indeterminado") {
          toast.error(`${setor.setor_ghe}: ${r.erro ?? "confira no SGG antes de reenviar."}`, { duration: 8000 });
          return false;
        }
        toast.error(`${setor.setor_ghe}: ${explicar(r)}`);
        return false;
      } catch {
        toast.error(`${setor.setor_ghe}: falha de rede. Confira no SGG antes de tentar de novo.`);
        return false;
      } finally {
        setOcupado(null);
      }
    },
    [idInspecao, carregar]
  );

  const pendentes = useMemo(
    () => setores.filter((s) => !["enviado", "duplicado"].includes(envios[s.id_setor]?.status ?? "")),
    [setores, envios]
  );

  const enviarTodos = useCallback(async () => {
    // FOR sequencial de propósito: o serviço serializa por base e o segundo
    // simultâneo toma 429. Nada de Promise.all/forEach async aqui.
    for (const s of pendentes) {
      const ok = await enviarSetor(s);
      if (!ok) break;
    }
  }, [enviarSetor, pendentes]);

  if (!pode) return null;

  return (
    <div className="no-print mt-4 border-t border-gray-100 pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800">Riscos no SGG</p>
        <button
          type="button"
          onClick={() => void enviarTodos()}
          disabled={ocupado !== null || pendentes.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Send className="size-4" />
          Enviar todos os setores ({pendentes.length})
        </button>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        Os riscos entram no SGG com data 01/01/2000 (vencidos) — o administrativo ajusta a validade lá.
      </p>

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {setores.map((s) => (
          <li key={s.id_setor} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-gray-800">{s.setor_ghe}</p>
              <Selo envio={envios[s.id_setor]} />
            </div>
            <button
              type="button"
              onClick={() => void enviarSetor(s)}
              disabled={ocupado !== null || ["enviado", "duplicado"].includes(envios[s.id_setor]?.status ?? "")}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              {ocupado === s.id_setor ? "Enviando…" : "Enviar"}
            </button>
          </li>
        ))}
      </ul>

      {impedimentos && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <AlertTriangle className="size-4" />
            Corrija antes de enviar — {impedimentos.setor}
          </p>
          <ul className="mt-1.5 list-disc pl-5 text-sm text-amber-900">
            {impedimentos.itens.map((i) => (
              <li key={i.id_risco}>
                <span className="font-medium">{i.agente}</span>: {i.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
