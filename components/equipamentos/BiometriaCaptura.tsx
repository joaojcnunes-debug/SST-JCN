"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { capturarDigitalWeb, diagnosticarLeitor, type DiagnosticoLeitor } from "@/lib/epi/digitalPersonaWeb";

/**
 * Bloco de captura de digital, compartilhado pelo cadastro e pela assinatura.
 *
 * Duas regras que vêm de medição, não de gosto:
 *
 * 1) **A captura só dispara por clique.** É a única condição em que o Chrome mostra o
 *    pedido de permissão de rede local; em aba de segundo plano ele não pergunta e a
 *    chamada fica pendurada para sempre.
 * 2) **O diagnóstico roda antes e a mensagem diz o que fazer.** "Tempo esgotado —
 *    encoste o dedo" quando o problema é permissão manda a pessoa para o lado errado.
 */
export default function BiometriaCaptura({
  rotulo,
  onCapturado,
  ocupado = false,
  descricao,
}: {
  rotulo: string;
  onCapturado: (imagemBase64: string) => void | Promise<void>;
  ocupado?: boolean;
  descricao?: string;
}) {
  const [fase, setFase] = useState<"parado" | "checando" | "aguardando" | "erro" | "ok">("parado");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (ocupado) return;
    if (fase === "ok") {
      const t = setTimeout(() => setFase("parado"), 2500);
      return () => clearTimeout(t);
    }
  }, [fase, ocupado]);

  const capturar = useCallback(async () => {
    setFase("checando");
    setMsg("Conferindo o leitor…");
    const diag: DiagnosticoLeitor = await diagnosticarLeitor();
    if (diag.estado !== "ok") {
      setFase("erro");
      setMsg(diag.mensagem);
      return;
    }

    setFase("aguardando");
    setMsg("Encoste o dedo no leitor.");
    const r = await capturarDigitalWeb(20000);
    if (!r.ok || !r.imagem) {
      setFase("erro");
      setMsg(r.erro ?? "Não consegui ler a digital.");
      return;
    }
    setFase("ok");
    setMsg("Digital lida.");
    await onCapturado(r.imagem);
  }, [onCapturado]);

  const lendo = fase === "checando" || fase === "aguardando";

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{rotulo}</p>
          {descricao ? <p className="truncate text-xs text-slate-500">{descricao}</p> : null}
        </div>
        <button
          type="button"
          onClick={capturar}
          disabled={lendo || ocupado}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
          {lendo ? "Lendo…" : "Ler digital"}
        </button>
      </div>

      {msg ? (
        <p
          className={
            "mt-2 flex items-start gap-2 text-xs " +
            (fase === "erro"
              ? "text-red-600 dark:text-red-400"
              : fase === "ok"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-slate-500")
          }
        >
          {fase === "erro" ? <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
          {fase === "ok" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
          <span>{msg}</span>
        </p>
      ) : null}
    </div>
  );
}
