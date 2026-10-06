/**
 * Origem da evidência e confiança por fator organizacional (Fase 2,
 * 2026-10-06). Decisão do usuário: a origem é registrada POR FATOR (não por
 * sinal) — um multiselect em cada fator "Sim".
 *
 * Confiança (separada da matriz AIHA, não muda o nível):
 *   1 tipo de origem → Baixa · 2 tipos → Média · 3 ou mais → Alta.
 * Lacuna do checklist de gestão mapeada ao fator conta como origem
 * "documental".
 *
 * Gravado no setor em `origem_evidencia` `{fator: [origem…]}` (jsonb).
 * As fontes geradoras marcadas pelo técnico (códigos da biblioteca, ex.
 * "1.3") ficam em `fontes_geradoras` `{fator: [codigo…]}`.
 */

export type OrigemEvidencia =
  | "observacao_direta"
  | "relato_individual"
  | "relato_grupo"
  | "documental"
  | "questionario_anonimo";

export const ORIGENS_EVIDENCIA: { key: OrigemEvidencia; label: string }[] = [
  { key: "observacao_direta", label: "Observação direta" },
  { key: "relato_individual", label: "Relato individual" },
  { key: "relato_grupo", label: "Relato em grupo" },
  { key: "documental", label: "Documental" },
  { key: "questionario_anonimo", label: "Questionário anônimo" },
];

export type Confianca = "Baixa" | "Média" | "Alta";

export const COR_CONFIANCA: Record<Confianca, { bg: string; cor: string }> = {
  Baixa: { bg: "#fee2e2", cor: "#991b1b" },
  Média: { bg: "#fef3c7", cor: "#92400e" },
  Alta: { bg: "#dcfce7", cor: "#166534" },
};

/** Origens efetivas do fator (as marcadas + "documental" se houver lacuna de gestão). */
export function origensEfetivas(marcadas: readonly string[] | undefined, temLacunaGestao: boolean): OrigemEvidencia[] {
  const set = new Set((marcadas ?? []).filter((o): o is OrigemEvidencia => ORIGENS_EVIDENCIA.some((x) => x.key === o)));
  if (temLacunaGestao) set.add("documental");
  return ORIGENS_EVIDENCIA.map((x) => x.key).filter((k) => set.has(k));
}

/** Confiança do fator; null sem nenhuma origem. */
export function confiancaDoFator(marcadas: readonly string[] | undefined, temLacunaGestao: boolean): Confianca | null {
  const n = origensEfetivas(marcadas, temLacunaGestao).length;
  if (n === 0) return null;
  return n === 1 ? "Baixa" : n === 2 ? "Média" : "Alta";
}

export const rotuloOrigem = (k: string) => ORIGENS_EVIDENCIA.find((x) => x.key === k)?.label ?? k;

/** `{fator: [string…]}` limpo (jsonb pode trazer lixo). */
export function normalizarMapaLista(raw: unknown): Record<string, string[]> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = [...new Set(v.filter((x): x is string => typeof x === "string"))];
  }
  return out;
}
