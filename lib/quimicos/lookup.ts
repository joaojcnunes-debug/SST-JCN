// Lookup determinístico de agentes químicos na base de referência.
//
// Estratégia: tenta achar primeiro por CAS (mais confiável), depois por
// nome (fuzzy match: normaliza acentos/caixa e procura contains).
//
// Aceita um array de override opcional (ex.: dados editados pelo Admin
// vindos do Supabase). Se omitido, usa o `BASE_REFERENCIA` estático.

import {
  BASE_REFERENCIA,
  type AgenteReferencia,
} from "./base_referencia";

type Base = readonly AgenteReferencia[];

/** Remove acentos, lowercase, colapsa espaços. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (acentos)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca por número CAS exato. Retorna o primeiro match que não é alias
 * (porque o alias só remete a outro agente).
 *
 * Se só houver aliases pra esse CAS, retorna o alias mesmo — o consumidor
 * pode decidir o que fazer (geralmente parsear o "vide X" do nome).
 */
export function buscarPorCAS(
  cas: string | null | undefined,
  base: Base = BASE_REFERENCIA
): AgenteReferencia | null {
  if (!cas) return null;
  const limpo = cas.trim();
  if (!limpo) return null;

  const matches = base.filter((a) => a.cas === limpo);
  if (matches.length === 0) return null;

  const canonical = matches.find((a) => !a.is_alias);
  return canonical ?? matches[0];
}

/**
 * Busca por nome do agente (fuzzy — case/acento insensitive).
 *
 * Aceita match exato OU termo de busca como substring do nome registrado.
 * Ex: "tolueno" encontra "Tolueno (toluol)".
 */
export function buscarPorNome(
  nome: string | null | undefined,
  base: Base = BASE_REFERENCIA
): AgenteReferencia | null {
  if (!nome) return null;
  const termo = normalizar(nome);
  if (termo.length < 3) return null;

  const exato = base.find(
    (a) => !a.is_alias && normalizar(a.agente) === termo
  );
  if (exato) return exato;

  const comeca = base.find(
    (a) => !a.is_alias && normalizar(a.agente).startsWith(termo)
  );
  if (comeca) return comeca;

  const contem = base.find(
    (a) => !a.is_alias && normalizar(a.agente).includes(termo)
  );
  return contem ?? null;
}

/**
 * Busca combinada: tenta CAS primeiro, depois nome.
 * Retorna { agente, fonte: 'cas' | 'nome' } ou null.
 */
export function buscarAgente(
  params: {
    cas?: string | null;
    nome?: string | null;
  },
  base: Base = BASE_REFERENCIA
): { agente: AgenteReferencia; fonte: "cas" | "nome" } | null {
  const porCas = buscarPorCAS(params.cas, base);
  if (porCas) return { agente: porCas, fonte: "cas" };

  const porNome = buscarPorNome(params.nome, base);
  if (porNome) return { agente: porNome, fonte: "nome" };

  return null;
}

/**
 * Conta as entradas válidas da base (útil pra mostrar pro usuário).
 */
export function totalEntradasBase(base: Base = BASE_REFERENCIA): number {
  return base.filter((a) => !a.is_alias).length;
}

// =====================================================
// Mistura — múltiplos componentes
// =====================================================

const GRAU_RANK: Record<string, number> = {
  Máximo: 3,
  Médio: 2,
  Mínimo: 1,
  "Asfixiante simples": 0,
};

const IARC_RANK: Record<string, number> = {
  "Grupo 1": 5,
  "Grupo 2A": 4,
  "Grupo 2B": 3,
  "Grupo 3": 2,
  "Grupo 4": 1,
};

export interface ComponenteHit {
  /** Componente original com nome+CAS submetido pelo usuário. */
  entrada: { nome?: string | null; cas?: string | null };
  agente: AgenteReferencia;
  fonte: "cas" | "nome";
}

/**
 * Procura cada componente da lista na base — devolve só os que casaram.
 * Componentes que não estão catalogados são ignorados (silenciosamente).
 */
export function buscarComponentes(
  componentes: Array<{ nome?: string | null; cas?: string | null }>,
  base: Base = BASE_REFERENCIA
): ComponenteHit[] {
  const hits: ComponenteHit[] = [];
  const vistos = new Set<string>();
  for (const c of componentes) {
    const hit = buscarAgente({ cas: c.cas, nome: c.nome }, base);
    if (!hit) continue;
    // Dedup pela identidade do agente (CAS + agente)
    const key = `${hit.agente.cas ?? ""}|${hit.agente.agente}`;
    if (vistos.has(key)) continue;
    vistos.add(key);
    hits.push({ entrada: c, agente: hit.agente, fonte: hit.fonte });
  }
  return hits;
}

/**
 * Dado um conjunto de agentes catalogados (componentes de uma mistura),
 * calcula o "agente representativo" que reúne o pior caso de cada campo
 * regulatório. Esse é o objeto enviado à IA como ground-truth quando há
 * múltiplos componentes catalogados.
 *
 * Regras:
 *   - grau_nr15: pior grau entre os componentes (Máximo > Médio > Mínimo)
 *   - anexo: do componente que define o pior grau
 *   - cancerigeno_13a / inflamavel / pele / teto: any() — TRUE se ALGUM for
 *   - iarc: pior grupo (1 > 2A > 2B > 3 > 4)
 *   - esocial_tab24 / decreto_3048 / cod_gfip / tlv_acgih: lista todos
 *     prefixados com nome do componente (`Tolueno: 09.01.001; Xileno: 09.01.022`)
 *   - lt_mg_m3 / lt_ppm: do componente que define o pior grau (o mais crítico)
 *   - observacoes: concatena tudo
 */
export function piorCasoMistura(
  hits: ComponenteHit[]
): AgenteReferencia | null {
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0].agente;

  // Componente "pior" pelo grau de insalubridade
  const piorPorGrau = hits.reduce((acc, h) => {
    const rankAcc = acc?.agente.grau_nr15
      ? GRAU_RANK[acc.agente.grau_nr15] ?? -1
      : -1;
    const rankCur = h.agente.grau_nr15
      ? GRAU_RANK[h.agente.grau_nr15] ?? -1
      : -1;
    return rankCur > rankAcc ? h : acc;
  }, hits[0]);

  // Pior IARC entre os componentes
  let piorIarc: AgenteReferencia["iarc"] | null = null;
  for (const h of hits) {
    if (!h.agente.iarc) continue;
    const rA = piorIarc ? IARC_RANK[piorIarc] ?? -1 : -1;
    const rC = IARC_RANK[h.agente.iarc] ?? -1;
    if (rC > rA) piorIarc = h.agente.iarc;
  }

  const fmtPorComponente = (
    campo: keyof Pick<
      AgenteReferencia,
      "esocial_tab24" | "decreto_3048" | "cod_gfip" | "tlv_acgih"
    >
  ): string | null => {
    const vals = hits
      .map((h) => {
        const v = h.agente[campo];
        return v ? `${h.agente.agente}: ${v}` : null;
      })
      .filter((s): s is string => !!s);
    if (vals.length === 0) return null;
    return vals.join("; ");
  };

  return {
    agente: hits.map((h) => h.agente.agente).join(" + "),
    cas: piorPorGrau.agente.cas,
    lt_mg_m3: piorPorGrau.agente.lt_mg_m3,
    lt_ppm: piorPorGrau.agente.lt_ppm,
    grau_nr15: piorPorGrau.agente.grau_nr15,
    teto: hits.some((h) => h.agente.teto === true),
    pele: hits.some((h) => h.agente.pele === true),
    esocial_tab24: fmtPorComponente("esocial_tab24"),
    iarc: piorIarc,
    inflamavel: hits.some((h) => h.agente.inflamavel === true),
    cancerigeno_13a: hits.some((h) => h.agente.cancerigeno_13a === true),
    tlv_acgih: fmtPorComponente("tlv_acgih"),
    decreto_3048: fmtPorComponente("decreto_3048"),
    cod_gfip: fmtPorComponente("cod_gfip"),
    anexo: piorPorGrau.agente.anexo,
    observacoes: hits
      .map((h) => h.agente.observacoes)
      .filter((o): o is string => !!o)
      .join(" | ") || null,
    is_alias: false,
  };
}

/**
 * Converte um agente da base num resumo legível pra exibir no UI.
 * Ex: "Insalubridade: Grau Máximo (Anexo 11) · eSocial 09.01.001 · IARC Grupo 2B"
 */
export function resumirAgente(a: AgenteReferencia): string {
  const partes: string[] = [];
  if (a.grau_nr15) {
    partes.push(`Insalubridade: Grau ${a.grau_nr15}`);
  }
  if (a.anexo) partes.push(a.anexo);
  if (a.esocial_tab24) partes.push(`eSocial ${a.esocial_tab24}`);
  if (a.iarc) partes.push(`IARC ${a.iarc}`);
  if (a.cancerigeno_13a) partes.push("Cancerígeno NR-15 13-A");
  if (a.pele) partes.push("Absorvido por pele");
  return partes.join(" · ");
}
