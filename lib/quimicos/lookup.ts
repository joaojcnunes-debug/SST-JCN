// Lookup determinístico de agentes químicos na base de referência local.
//
// Estratégia: tenta achar primeiro por CAS (mais confiável), depois por
// nome (fuzzy match: normaliza acentos/caixa e procura contains).

import {
  BASE_REFERENCIA,
  type AgenteReferencia,
} from "./base_referencia";

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
export function buscarPorCAS(cas: string | null | undefined): AgenteReferencia | null {
  if (!cas) return null;
  const limpo = cas.trim();
  if (!limpo) return null;

  const matches = BASE_REFERENCIA.filter((a) => a.cas === limpo);
  if (matches.length === 0) return null;

  // Prefere entry NÃO-alias (tem os dados completos)
  const canonical = matches.find((a) => !a.is_alias);
  return canonical ?? matches[0];
}

/**
 * Busca por nome do agente (fuzzy — case/acento insensitive).
 *
 * Aceita match exato OU termo de busca como substring do nome registrado.
 * Ex: "tolueno" encontra "Tolueno (toluol)".
 */
export function buscarPorNome(nome: string | null | undefined): AgenteReferencia | null {
  if (!nome) return null;
  const termo = normalizar(nome);
  if (termo.length < 3) return null;

  // 1) Match exato (depois de normalizar)
  const exato = BASE_REFERENCIA.find(
    (a) => !a.is_alias && normalizar(a.agente) === termo
  );
  if (exato) return exato;

  // 2) Match começa com termo
  const comeca = BASE_REFERENCIA.find(
    (a) => !a.is_alias && normalizar(a.agente).startsWith(termo)
  );
  if (comeca) return comeca;

  // 3) Match contém termo
  const contem = BASE_REFERENCIA.find(
    (a) => !a.is_alias && normalizar(a.agente).includes(termo)
  );
  return contem ?? null;
}

/**
 * Busca combinada: tenta CAS primeiro, depois nome.
 * Retorna { agente, fonte: 'cas' | 'nome' } ou null.
 */
export function buscarAgente(params: {
  cas?: string | null;
  nome?: string | null;
}): { agente: AgenteReferencia; fonte: "cas" | "nome" } | null {
  const porCas = buscarPorCAS(params.cas);
  if (porCas) return { agente: porCas, fonte: "cas" };

  const porNome = buscarPorNome(params.nome);
  if (porNome) return { agente: porNome, fonte: "nome" };

  return null;
}

/**
 * Conta as entradas válidas da base (útil pra mostrar pro usuário).
 */
export function totalEntradasBase(): number {
  return BASE_REFERENCIA.filter((a) => !a.is_alias).length;
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
