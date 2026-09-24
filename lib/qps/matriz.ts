// QPS — cálculo da matriz de risco psicossocial (setor × categoria).
//
// Extraído de `resultados/page.tsx` em 2026-08-10, sem mudar uma linha da conta,
// para que a tela de Resultados e a de Resumo leiam a MESMA régua. Duas cópias
// da mesma fórmula é como tela e documento passam a discordar.

import type { QpsCategoria, QpsPergunta, QpsProbabilidade } from "@/lib/supabase/types";

export const PROB_LABEL = ["", "Baixa", "Média", "Alta"] as const;

/** Severidade fixa para risco psicossocial (NR-01). */
export const SEVERIDADE = 3;

export type NivelRisco = "BAIXO" | "MODERADO" | "ALTO";

export function nivelRisco(prob: 1 | 2 | 3): NivelRisco {
  const score = prob * SEVERIDADE;
  if (score <= 3) return "BAIXO";
  if (score <= 6) return "MODERADO";
  return "ALTO";
}

export const RISCO_COR: Record<NivelRisco, string> = {
  BAIXO: "bg-green-100 text-green-800 border-green-200",
  MODERADO: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ALTO: "bg-red-100 text-red-800 border-red-200",
};

export const RISCO_PONTO: Record<NivelRisco, string> = {
  BAIXO: "bg-green-500",
  MODERADO: "bg-yellow-400",
  ALTO: "bg-red-500",
};

export function normalizarResposta(
  valor: number,
  logica: "direta" | "invertida",
  min: number,
  max: number
): number {
  const v = logica === "invertida" ? max + min - valor : valor;
  return ((v - min) / (max - min)) * 100;
}

/** Só o que interessa de uma pergunta para achar a faixa dela. */
export interface PerguntaComFaixa {
  opcoes?: string[] | null;
}

/**
 * Faixa numérica de UMA pergunta (v180).
 *
 * Até aqui a escala era do TIPO e valia igual para todas as perguntas dele. O
 * questionário ordinal não é assim: cada pergunta tem as suas alternativas, em
 * quantidade diferente, e o valor gravado é a POSIÇÃO da alternativa. Então a
 * faixa de uma pergunta com N alternativas é 1..N.
 *
 * É a normalização para 0–100% logo abaixo que deixa perguntas de tamanhos
 * diferentes serem comparadas na mesma média sem inventar peso nenhum: a
 * primeira alternativa vale 0% e a última 100% em qualquer pergunta, tendo ela
 * 3 ou 7 alternativas.
 *
 * Sem alternativas cadastradas (o caso de todas as perguntas anteriores à
 * v180), vale a escala do tipo — comportamento idêntico ao de antes.
 */
export function faixaPergunta(
  pergunta: PerguntaComFaixa,
  escalaMin: number,
  escalaMax: number
): { min: number; max: number } {
  const n = pergunta.opcoes?.length ?? 0;
  return n >= 2 ? { min: 1, max: n } : { min: escalaMin, max: escalaMax };
}

export function scoreToProbabilidade(score: number): 1 | 2 | 3 {
  if (score < 34) return 1;
  if (score < 67) return 2;
  return 3;
}

export interface CelulaMatriz {
  setor: string;
  categoria: QpsCategoria;
  scorePerc: number;
  probCalculada: 1 | 2 | 3;
  probEfetiva: 1 | 2 | 3;
  override: boolean;
  risco: NivelRisco;
  nRespondentes: number;
  /**
   * Nenhuma resposta alimentou esta célula. Ela ainda assim sai como BAIXO,
   * porque `probCalculada` cai em 1 quando não há score — a tela de Resultados
   * sempre funcionou assim. O Resumo usa este campo para não contar "sem base"
   * como se fosse risco baixo apurado.
   */
  semBase: boolean;
}

export function calcularMatriz(
  setores: string[],
  categorias: QpsCategoria[],
  perguntas: QpsPergunta[],
  respondentes: { setor: string; respostas: Record<string, number> }[],
  overrides: QpsProbabilidade[],
  escalaMin: number,
  escalaMax: number
): CelulaMatriz[] {
  const overrideMap = new Map(
    overrides.map((o) => [`${o.setor}|${o.id_categoria}`, o.probabilidade as 1 | 2 | 3])
  );

  const cells: CelulaMatriz[] = [];

  for (const setor of setores) {
    const resp = respondentes.filter((r) => r.setor === setor);

    for (const cat of categorias) {
      const pergsCat = perguntas.filter((p) => p.id_categoria === cat.id_categoria);
      const scores: number[] = [];

      for (const r of resp) {
        for (const p of pergsCat) {
          const val = r.respostas[p.id_pergunta];
          if (val === undefined || val === null) continue;
          // A faixa é da PERGUNTA, não mais do tipo: pergunta com alternativas
          // próprias vale 1..N, as demais seguem a escala do tipo.
          const faixa = faixaPergunta(p, escalaMin, escalaMax);
          scores.push(normalizarResposta(val, p.logica, faixa.min, faixa.max));
        }
      }

      const scorePerc =
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      const probCalculada = scores.length > 0 ? scoreToProbabilidade(scorePerc) : 1;
      const chave = `${setor}|${cat.id_categoria}`;
      const probOverride = overrideMap.get(chave);
      const probEfetiva = probOverride ?? probCalculada;

      cells.push({
        setor,
        categoria: cat,
        scorePerc: Math.round(scorePerc),
        probCalculada,
        probEfetiva,
        override: !!probOverride,
        risco: nivelRisco(probEfetiva),
        nRespondentes: resp.length,
        semBase: scores.length === 0 && !probOverride,
      });
    }
  }

  return cells;
}
