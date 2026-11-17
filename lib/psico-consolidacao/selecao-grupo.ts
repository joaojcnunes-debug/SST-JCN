import type { EmpresaGrupo } from "@/lib/supabase/types";
import { documentosPadrao, type DocumentoFonte } from "./fontes";

/**
 * O que entra da consolidação de um grupo (0.3.297, 17/11/2026 — pedido do João): as empresas marcadas e, de cada
 * uma, os documentos marcados na aba Fontes. Gravado no grupo (v361), vale igual para a tela da Consolidação, o
 * relatório (servidor) e a Conciliação por grupo.
 *   psico_empresas_fora  empresas desmarcadas — não entram em nada.
 *   psico_documentos     {id_empresa: [ids]} — empresa ausente usa o padrão (o mais recente de cada tipo), então
 *                        documento novo ou empresa nova entram sozinhos.
 */
export type SelecaoGrupo = Pick<EmpresaGrupo, "psico_empresas_fora" | "psico_documentos">;

export function empresasFora(grupo: SelecaoGrupo | null | undefined): Set<string> {
  return new Set(Array.isArray(grupo?.psico_empresas_fora) ? grupo!.psico_empresas_fora : []);
}

/** As empresas que entram (das visíveis, menos as desmarcadas). */
export function empresasAtivas(ids: readonly string[], grupo: SelecaoGrupo | null | undefined): string[] {
  const fora = empresasFora(grupo);
  return ids.filter((id) => !fora.has(id));
}

function mapaDocumentos(grupo: SelecaoGrupo | null | undefined): Record<string, string[]> {
  const m = grupo?.psico_documentos;
  return m && typeof m === "object" && !Array.isArray(m) ? m : {};
}

/** Os documentos que entram: das empresas ativas, os marcados (ou o padrão da empresa sem escolha gravada). */
export function documentosUsados(docs: readonly DocumentoFonte[], idsAtivos: readonly string[], grupo: SelecaoGrupo | null | undefined): Set<string> {
  const ativos = new Set(idsAtivos);
  const mapa = mapaDocumentos(grupo);
  const out = new Set<string>();
  const porEmpresa = new Map<string, DocumentoFonte[]>();
  for (const d of docs) if (ativos.has(d.idEmpresa)) porEmpresa.set(d.idEmpresa, [...(porEmpresa.get(d.idEmpresa) ?? []), d]);
  for (const [idEmpresa, lista] of porEmpresa) {
    const escolha = mapa[idEmpresa];
    if (Array.isArray(escolha)) {
      const ids = new Set(escolha);
      for (const d of lista) if (ids.has(d.id)) out.add(d.id);
    } else {
      for (const id of documentosPadrao(lista)) out.add(id);
    }
  }
  return out;
}

/** A escolha de UMA empresa depois de marcar/desmarcar um documento (o resto do mapa fica igual). */
export function alternarDocumento(
  docs: readonly DocumentoFonte[],
  usados: ReadonlySet<string>,
  grupo: SelecaoGrupo | null | undefined,
  idDocumento: string,
): Record<string, string[]> {
  const doc = docs.find((d) => d.id === idDocumento);
  const mapa = { ...mapaDocumentos(grupo) };
  if (!doc) return mapa;
  const daEmpresa = docs.filter((d) => d.idEmpresa === doc.idEmpresa && usados.has(d.id)).map((d) => d.id);
  mapa[doc.idEmpresa] = daEmpresa.includes(idDocumento) ? daEmpresa.filter((id) => id !== idDocumento) : [...daEmpresa, idDocumento];
  return mapa;
}

/** A lista de empresas fora depois de marcar/desmarcar uma. */
export function alternarEmpresa(grupo: SelecaoGrupo | null | undefined, idEmpresa: string): string[] {
  const fora = empresasFora(grupo);
  if (fora.has(idEmpresa)) fora.delete(idEmpresa);
  else fora.add(idEmpresa);
  return [...fora];
}

/** O grupo tem alguma escolha diferente do padrão (para o "Voltar ao padrão"). */
export function temEscolhaPropria(grupo: SelecaoGrupo | null | undefined): boolean {
  return empresasFora(grupo).size > 0 || Object.keys(mapaDocumentos(grupo)).length > 0;
}
