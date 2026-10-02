// Ergonomia Organizacional da AEP na matriz de risco AIHA (pedido de 2026-10-02).
//
// Cada fator marcado "Sim" ganha Probabilidade × Severidade da MESMA matriz da
// inspeção (`matrizes_risco` ativa — hoje a AIHA 5×5), e o nível sai da mesma
// conta: `calcularNivelComMatriz` = peso_prob × peso_sev → faixa da matriz.
//
//   • SÓ CALCULA COM SINAL MARCADO (pedido de 2026-10-02): sem nenhum sinal
//     observado, o fator fica nos níveis mais baixos da matriz (AIHA: "Não há
//     exposição" × "Pouca importância") e SEM nível — não conta para nada.
//   • A partir do 1º sinal, Probabilidade SUGERIDA pela proporção de sinais:
//       até 1/3 → 3º nível da escala ("Exposição moderada")
//       até 2/3 → 4º ("Exposição elevada")
//       acima   → 5º ("Exposição elevadíssima")
//     e Severidade PADRÃO do fator (SEVERIDADE_PADRAO_IDX, índice da escala).
//   • Com sinal marcado, o técnico pode trocar qualquer uma das duas; a troca
//     fica marcada como manual e deixa de acompanhar a sugestão.
//
// O resultado é GRAVADO no setor (`aiha_organizacional`) — laudo, PDF e a
// Sinalização Psicossocial leem o gravado, sem precisar da matriz. O editor
// recalcula a cada mudança no setor.

import { calcularNivelComMatriz } from "@/lib/calc";
import type { AepChecklistOrganizacional, MatrizRisco, NivelRisco } from "@/lib/supabase/types";

export type FatorOrganizacional = keyof AepChecklistOrganizacional;

export interface AihaFator {
  probabilidade: string;
  severidade: string;
  /** null = ainda sem sinal observado marcado → não calculado. */
  nivel: NivelRisco | null;
  /** true = escolhida pelo técnico; false = sugestão (acompanha os sinais). */
  prob_manual?: boolean;
  sev_manual?: boolean;
}

export type AihaOrganizacional = Partial<Record<string, AihaFator>>;

/**
 * Severidade padrão de cada fator, como ÍNDICE na escala de severidade da
 * matriz (AIHA: 0 Pouca importância · 1 Preocupantes · 2 Severos ·
 * 3 Irreversíveis · 4 Ameaça).
 */
export const SEVERIDADE_PADRAO_IDX: Record<FatorOrganizacional, number> = {
  assedio: 3,
  eventos_traumaticos: 3,
  falta_suporte: 2,
  baixo_controle: 2,
  justica_organizacional: 2,
  sobrecarga: 2,
  maus_relacionamentos: 2,
  gestao_mudancas: 1,
  clareza_papel: 1,
  recompensas: 1,
  subcarga: 1,
  comunicacao_dificil: 1,
  trabalho_remoto: 1,
};

/** Índice da probabilidade sugerida pela proporção de sinais marcados. */
export function indiceProbabilidadeSugerida(marcados: number, total: number, nNiveis: number): number {
  const max = Math.max(0, nNiveis - 1);
  let idx: number;
  if (marcados <= 0 || total <= 0) idx = 0;
  else {
    const p = marcados / total;
    idx = p <= 1 / 3 ? 2 : p <= 2 / 3 ? 3 : 4;
  }
  return Math.min(idx, max);
}

/** Avaliação de UM fator marcado "Sim". */
export function avaliarFator(args: {
  fator: string;
  sinaisMarcados: number;
  sinaisTotal: number;
  anterior?: AihaFator;
  matriz: Pick<MatrizRisco, "probabilidades" | "severidades" | "pesos_prob" | "pesos_sev" | "faixas" | "lookup">;
}): AihaFator {
  const { matriz, anterior } = args;

  // Sem sinal marcado: níveis mais baixos da matriz e nada calculado.
  if (args.sinaisMarcados <= 0) {
    return {
      probabilidade: matriz.probabilidades[0],
      severidade: matriz.severidades[0],
      nivel: null,
      prob_manual: false,
      sev_manual: false,
    };
  }

  const probSug = matriz.probabilidades[
    indiceProbabilidadeSugerida(args.sinaisMarcados, args.sinaisTotal, matriz.probabilidades.length)
  ];
  const idxSev = Math.min(
    SEVERIDADE_PADRAO_IDX[args.fator as FatorOrganizacional] ?? 1,
    Math.max(0, matriz.severidades.length - 1),
  );
  const sevSug = matriz.severidades[idxSev];

  // Escolha manual só vale se ainda existir na matriz (a matriz pode ter mudado).
  const probManual = !!anterior?.prob_manual && matriz.probabilidades.includes(anterior.probabilidade);
  const sevManual = !!anterior?.sev_manual && matriz.severidades.includes(anterior.severidade);
  const probabilidade = probManual ? anterior!.probabilidade : probSug;
  const severidade = sevManual ? anterior!.severidade : sevSug;

  return {
    probabilidade,
    severidade,
    nivel: calcularNivelComMatriz(probabilidade, severidade, matriz as MatrizRisco),
    prob_manual: probManual,
    sev_manual: sevManual,
  };
}

/**
 * Recalcula todos os fatores do setor: só os marcados "Sim" ficam; os demais
 * saem (fator negado não tem risco a classificar).
 */
export function recalcularAihaOrganizacional(args: {
  checklist: Record<string, string | null | undefined>;
  sinaisMarcados: Record<string, string[] | undefined> | undefined;
  totalSinais: (fator: string) => number;
  anterior: AihaOrganizacional | undefined;
  matriz: Parameters<typeof avaliarFator>[0]["matriz"];
}): AihaOrganizacional {
  const out: AihaOrganizacional = {};
  for (const [fator, resposta] of Object.entries(args.checklist)) {
    if (resposta !== "sim") continue;
    out[fator] = avaliarFator({
      fator,
      sinaisMarcados: args.sinaisMarcados?.[fator]?.length ?? 0,
      sinaisTotal: args.totalSinais(fator),
      anterior: args.anterior?.[fator],
      matriz: args.matriz,
    });
  }
  return out;
}

/** Quantos fatores contam como Alto e como Moderado para o "Necessita AET". */
export function contagemParaAet(aiha: AihaOrganizacional | undefined): { altos: number; moderados: number } {
  let altos = 0;
  let moderados = 0;
  for (const f of Object.values(aiha ?? {})) {
    if (!f) continue;
    if (f.nivel === "Alto" || f.nivel === "Muito Alto") altos++;
    else if (f.nivel === "Moderado") moderados++;
  }
  return { altos, moderados };
}

/** Cores dos níveis — as MESMAS da inspeção (lib/constants.ts). */
export { NIVEL_CONFIG as COR_NIVEL_AIHA } from "@/lib/constants";
