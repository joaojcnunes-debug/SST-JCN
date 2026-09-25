// Fontes geradoras do risco como lista (v262) — regra única do DRPS e do QPS.
//
// O texto padrão de cada tópico/categoria é uma lista separada por ";" (ou
// ","): cada pedaço é UMA fonte. O relatório guarda, por setor, só os
// tópicos em que alguém mexeu; o que não está guardado usa todas as fontes
// padrão — por isso laudos antigos saem idênticos.

/** {setor: {chave: [fontes]}} — chave = índice do tópico (DRPS) ou id_categoria (QPS). */
export type FontesPorSetor = Record<string, Record<string, string[]>>;

/** "a; b, c." → ["a", "b", "c"]: separa por ; ou , e tira ponto final e espaços. */
export function separarFontes(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const itens = texto
    .split(/[;,\n]/)
    .map((s) => s.replace(/^\s*[•\-]\s*/, "").trim().replace(/\.+$/, "").trim())
    .filter(Boolean);
  return unicos(itens);
}

/** Remove repetidos sem diferenciar maiúscula/minúscula, mantendo a 1ª grafia. */
export function unicos(itens: string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const i of itens) {
    const k = i.trim().toLowerCase();
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    out.push(i.trim());
  }
  return out;
}

/** Opções da lista: as fontes padrão do tópico + as do catálogo. */
export function opcoesFonte(padrao: string | null | undefined, catalogo: string[] = []): string[] {
  return unicos([...separarFontes(padrao), ...catalogo]);
}

/** Fontes que valem: as guardadas para o setor, ou todas as padrão. */
export function fontesEscolhidas(
  guardadas: string[] | undefined,
  padrao: string | null | undefined
): string[] {
  return guardadas ? unicos(guardadas) : separarFontes(padrao);
}

/** Texto para laudo/PDF: "a; b; c." — mesmo formato do texto padrão. */
export function textoFontes(fontes: string[]): string {
  return fontes.length ? `${fontes.join("; ")}.` : "";
}

/** Guardadas para um setor/chave, se houver — aceita mapa vazio/nulo. */
export function guardadasDe(
  mapa: FontesPorSetor | null | undefined,
  setor: string,
  chave: string | number
): string[] | undefined {
  const v = mapa?.[setor]?.[String(chave)];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
}
