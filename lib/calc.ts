import type { MatrizRisco, NivelRisco } from "./supabase/types";

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
