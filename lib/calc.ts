import type { FaixaRisco, MatrizRisco, NivelRisco } from "./supabase/types";

/**
 * Calcula o nível de risco a partir de uma matriz dinâmica (V3).
 *
 * Substitui calcularNivelRisco(prob, sev) que usava lista hardcoded —
 * agora a matriz vem do banco (public.matrizes_risco) e é editável via UI.
 *
 * Fallback "Baixo" cobre os casos: sem matriz carregada, prob/sev inválida
 * para a matriz, ou lookup ausente.
 */
export function calcularNivelComMatriz(
  prob: string | null | undefined,
  sev: string | null | undefined,
  matriz: MatrizRisco | null | undefined
): NivelRisco {
  if (!matriz || !prob || !sev) return "Baixo";
  const iP = matriz.probabilidades.indexOf(prob);
  const iS = matriz.severidades.indexOf(sev);
  if (iP < 0 || iS < 0) return "Baixo";
  const v = matriz.lookup?.[iP]?.[iS];
  if (typeof v === "string" && v.length > 0) return v as NivelRisco;
  return "Baixo";
}

/** Cria uma matriz NxM com todas as células no nível default (`Baixo`). */
export function matrizVazia(nProbs: number, nSevs: number): string[][] {
  return Array.from({ length: nProbs }, () =>
    Array.from({ length: nSevs }, () => "Baixo")
  );
}

/** Redimensiona uma matriz preservando valores onde possível. */
export function redimensionarLookup(
  lookup: string[][],
  nProbs: number,
  nSevs: number
): string[][] {
  const novo = matrizVazia(nProbs, nSevs);
  for (let i = 0; i < Math.min(lookup.length, nProbs); i++) {
    for (let j = 0; j < Math.min(lookup[i]?.length ?? 0, nSevs); j++) {
      const v = lookup[i][j];
      if (v) novo[i][j] = v;
    }
  }
  return novo;
}

/**
 * Encontra o nível dentro das faixas para um score numérico.
 * Faixas são intervalos fechados [min, max]. Retorna "Baixo" se não bater.
 */
export function nivelPorFaixa(
  score: number,
  faixas: FaixaRisco[]
): NivelRisco {
  for (const f of faixas) {
    if (score >= f.min && score <= f.max) return f.nivel;
  }
  return "Baixo";
}

/**
 * Gera lookup[iP][iS] automaticamente a partir de pesos e faixas.
 * Score de cada célula = peso(prob) × peso(sev). Cada score é mapeado
 * para um nível pelas faixas. Útil pra preencher matriz grande sem
 * clicar célula a célula.
 */
export function calcularLookupPorPesos(
  pesos_prob: number[],
  pesos_sev: number[],
  faixas: FaixaRisco[]
): string[][] {
  return pesos_prob.map((pp) =>
    pesos_sev.map((ps) => nivelPorFaixa(pp * ps, faixas))
  );
}

/** Faixas padrão SGG (compatíveis com a fórmula histórica). */
export const FAIXAS_PADRAO: FaixaRisco[] = [
  { nivel: "Trivial", min: 0, max: 0 },
  { nivel: "Baixo", min: 1, max: 2 },
  { nivel: "Moderado", min: 3, max: 6 },
  { nivel: "Alto", min: 7, max: 10 },
  { nivel: "Muito Alto", min: 11, max: 999 },
];
