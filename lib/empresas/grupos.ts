/**
 * Grupos de empresas (v278) — regras puras, sem React (testadas em grupos.test.ts).
 *
 * Um grupo junta empresas com mais de um CNPJ: uma MATRIZ (a principal) e as
 * FILIAIS. O CNPJ já carrega a pista: os 8 primeiros dígitos (a "raiz") são os
 * mesmos em matriz e filiais da mesma empresa, e a ordem `0001` é a matriz.
 */
import { somenteDigitos } from "@/lib/busca/texto";
import type { MembroGrupo, PapelGrupo } from "@/lib/supabase/types";

/** Raiz do CNPJ (8 primeiros dígitos) ou null se não for CNPJ completo. */
export function raizCnpj(cnpj: string | null | undefined): string | null {
  const d = somenteDigitos(cnpj);
  return d.length === 14 ? d.slice(0, 8) : null;
}

/** Pelo CNPJ: ordem 0001 = matriz; outra ordem = filial; sem CNPJ = não sabe. */
export function papelPeloCnpj(cnpj: string | null | undefined): PapelGrupo | null {
  const d = somenteDigitos(cnpj);
  if (d.length !== 14) return null;
  return d.slice(8, 12) === "0001" ? "MATRIZ" : "FILIAL";
}

export const ROTULO_PAPEL: Record<PapelGrupo, string> = {
  MATRIZ: "Matriz",
  FILIAL: "Filial",
};

/** Membros de um grupo com a matriz primeiro, depois por nome. */
export function ordenarMembros<T extends Pick<MembroGrupo, "papel_grupo" | "nome_empresa">>(m: T[]): T[] {
  return [...m].sort((a, b) => {
    if (a.papel_grupo !== b.papel_grupo) return a.papel_grupo === "MATRIZ" ? -1 : 1;
    return a.nome_empresa.localeCompare(b.nome_empresa, "pt-BR");
  });
}

export interface SugestaoRaiz<T> {
  raiz: string;
  empresas: T[];
  matriz: T | null;
}

/**
 * Empresas SEM grupo que dividem a raiz de CNPJ — candidatas a virar um grupo.
 * Só sugere quando há 2+ CNPJs DIFERENTES na mesma raiz: o mesmo CNPJ
 * cadastrado duas vezes é duplicata, não filial. A matriz sugerida é a de
 * ordem 0001 (quando existe).
 */

export function sugestoesPorRaiz<
  T extends { id_empresa: string; cnpj: string | null; nome_empresa: string; id_grupo?: string | null },
>(empresas: T[]): SugestaoRaiz<T>[] {
  const porRaiz = new Map<string, T[]>();
  for (const e of empresas) {
    if (e.id_grupo) continue;
    const r = raizCnpj(e.cnpj);
    if (!r) continue;
    const lista = porRaiz.get(r) ?? [];
    lista.push(e);
    porRaiz.set(r, lista);
  }
  return [...porRaiz.entries()]
    .filter(([, l]) => new Set(l.map((e) => somenteDigitos(e.cnpj))).size >= 2)
    .map(([raiz, l]) => ({
      raiz,
      empresas: [...l].sort((a, b) => a.nome_empresa.localeCompare(b.nome_empresa, "pt-BR")),
      matriz: l.find((e) => papelPeloCnpj(e.cnpj) === "MATRIZ") ?? null,
    }))
    .sort((a, b) => b.empresas.length - a.empresas.length);
}

/**
 * O grupo com uma empresa da mesma raiz de CNPJ — para o cadastro sugerir
 * "esta parece filial de X, que está no grupo Y".
 */
export function grupoDaMesmaRaiz(
  cnpj: string | null | undefined,
  membros: Pick<MembroGrupo, "id_empresa" | "id_grupo" | "cnpj" | "nome_empresa">[],
  ignorarIdEmpresa?: string | null,
): { id_grupo: string; nome_empresa: string } | null {
  const r = raizCnpj(cnpj);
  if (!r) return null;
  const m = membros.find((x) => x.id_empresa !== ignorarIdEmpresa && raizCnpj(x.cnpj) === r);
  return m ? { id_grupo: m.id_grupo, nome_empresa: m.nome_empresa } : null;
}
