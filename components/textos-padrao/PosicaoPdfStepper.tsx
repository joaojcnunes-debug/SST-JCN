"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

/** As 6 posições válidas no fluxo do PDF (V53). */
export type PosicaoPdfValor =
  | "inicio"
  | "apos_sumario"
  | "apos_setores"
  | "apos_conclusao"
  | "apos_medidas"
  | "fim";

interface PosicaoInfo {
  valor: PosicaoPdfValor;
  curto: string;
  longo: string;
}

const POSICOES: PosicaoInfo[] = [
  { valor: "inicio", curto: "Início", longo: "Antes do sumário (capa, dedicatória)" },
  { valor: "apos_sumario", curto: "Após sumário", longo: "Após o sumário (introdução, metodologia)" },
  { valor: "apos_setores", curto: "Após setores", longo: "Após a análise por setor (antes da conclusão)" },
  { valor: "apos_conclusao", curto: "Após conclusão", longo: "Após a conclusão geral (antes do plano)" },
  { valor: "apos_medidas", curto: "Após plano", longo: "Após medidas/monitoramento/revisão" },
  { valor: "fim", curto: "Fim", longo: "Fim do PDF (considerações finais)" },
];

interface Props {
  /** Posição atualmente selecionada. */
  valor: PosicaoPdfValor;
  /** Callback ao clicar numa posição diferente. */
  onChange: (novo: PosicaoPdfValor) => void;
  /** Contagem opcional de capítulos em cada posição — mostrado como badge. */
  contagens?: Partial<Record<PosicaoPdfValor, number>>;
  /** Desabilita interação (durante save). */
  disabled?: boolean;
}

/**
 * Stepper visual horizontal pra escolher a posição do capítulo no fluxo do
 * PDF. Mostra as 6 posições conectadas por uma trilha, click selecciona,
 * label completo aparece abaixo. Badge opcional na bolinha mostra quantos
 * capítulos já existem naquela posição (útil pra visualizar a distribuição).
 *
 * Uso:
 *   <PosicaoPdfStepper
 *     valor={capitulo.posicao_pdf}
 *     onChange={(p) => onSalvar({ posicao_pdf: p })}
 *     contagens={contagensPorPosicao}
 *   />
 */
export default function PosicaoPdfStepper({
  valor,
  onChange,
  contagens,
  disabled = false,
}: Props) {
  const selecionado = POSICOES.find((p) => p.valor === valor) ?? POSICOES[0];

  return (
    <div className="space-y-2">
      {/* Trilha horizontal — 6 chips conectados */}
      <div className="flex items-start">
        {POSICOES.map((p, idx) => {
          const ativo = p.valor === valor;
          const count = contagens?.[p.valor] ?? 0;
          return (
            <Fragment key={p.valor}>
              {idx > 0 && (
                <div
                  aria-hidden="true"
                  className={cn(
                    "mt-3.5 h-0.5 flex-1 transition-colors",
                    ativo ||
                      POSICOES.findIndex((x) => x.valor === valor) > idx - 1
                      ? "bg-verde-primary/40"
                      : "bg-gray-200"
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => !disabled && !ativo && onChange(p.valor)}
                disabled={disabled}
                title={p.longo}
                className={cn(
                  "group relative flex flex-col items-center gap-1 px-1 transition-all",
                  "hover:-translate-y-0.5",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <div
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                    ativo
                      ? "border-verde-primary bg-verde-primary text-white shadow-sm"
                      : "border-gray-300 bg-white text-gray-500 group-hover:border-verde-primary/60"
                  )}
                >
                  {idx + 1}
                  {count > 0 && (
                    <span
                      className={cn(
                        "absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold",
                        ativo
                          ? "bg-white text-verde-primary"
                          : "bg-gray-700 text-white"
                      )}
                      title={`${count} capítulo${count !== 1 ? "s" : ""} nesta posição`}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "max-w-[72px] text-center text-[10px] font-semibold leading-tight",
                    ativo ? "text-verde-primary" : "text-gray-500"
                  )}
                >
                  {p.curto}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>

      {/* Descrição da posição selecionada */}
      <div className="rounded-md border border-verde-primary/20 bg-verde-primary/5 px-3 py-1.5 text-xs">
        <span className="font-semibold text-verde-primary">
          Selecionado:
        </span>{" "}
        <span className="text-gray-700">{selecionado.longo}</span>
      </div>
    </div>
  );
}
