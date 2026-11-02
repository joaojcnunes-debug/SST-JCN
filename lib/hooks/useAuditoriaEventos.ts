"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuditoriaAcao, AuditoriaEvento, AuditoriaTabela } from "@/lib/supabase/types";
import { ehConclusao, semAcento } from "@/lib/auditoria/eventos";

/**
 * Leitura de `auditoria_eventos` (v212). A RLS já limita a Admin: quem não é
 * recebe lista vazia, não erro — a tela em `app/(admin)` nem chega a montar
 * para os outros (useRequireAdmin).
 */

export interface FiltrosAuditoria {
  /** AAAA-MM-DD, inclusivo, no fuso do navegador. */
  de?: string;
  ate?: string;
  email?: string;
  modulo?: string;
  acao?: AuditoriaAcao | "";
  idEmpresa?: string;
  tabela?: string;
  registroId?: string;
  /** Nome de coluna: "quem mudou o campo X". */
  campo?: string;
  /** Busca livre no título, e-mail, id e no texto do antes/depois. */
  busca?: string;
  /** Só edições em que o status foi para um valor de conclusão. */
  soConclusoes?: boolean;
}

const POR_PAGINA = 100;

interface PaginaAuditoria {
  eventos: AuditoriaEvento[];
  /** Só na 1ª página; undefined nas seguintes. */
  total?: number;
  /** Menor id da página — cursor da próxima. null quando acabou. */
  proximo: number | null;
  /** Menor id lido, mesmo quando a página veio incompleta. */
  ultimoId: number | null;
}

// Meia-noite LOCAL do dia, em ISO — o banco guarda timestamptz, então o filtro
// "de 14/09" precisa começar às 00:00 de Brasília, não de Greenwich.
function inicioDoDia(d: string) {
  return new Date(`${d}T00:00:00`).toISOString();
}
function fimDoDia(d: string) {
  return new Date(`${d}T23:59:59.999`).toISOString();
}

async function buscarPagina(f: FiltrosAuditoria, cursor: number | null, porPagina = POR_PAGINA): Promise<PaginaAuditoria & { lidos: number }> {
  const sb = createSupabaseBrowserClient();
  let q = sb
    .from("auditoria_eventos")
    // Contagem exata só na 1ª página: nas seguintes o número já é conhecido.
    .select("*", cursor === null ? { count: "exact" } : undefined)
    .order("id", { ascending: false })
    .limit(porPagina);

  if (f.de) q = q.gte("ocorrido_em", inicioDoDia(f.de));
  if (f.ate) q = q.lte("ocorrido_em", fimDoDia(f.ate));
  if (f.email) q = q.eq("usuario_email", f.email.toLowerCase());
  if (f.modulo) q = q.eq("modulo", f.modulo);
  if (f.acao) q = q.eq("acao", f.acao);
  if (f.idEmpresa) q = q.eq("id_empresa", f.idEmpresa);
  if (f.tabela) q = q.eq("tabela", f.tabela);
  if (f.registroId) q = q.eq("registro_id", f.registroId);
  if (f.campo?.trim()) q = q.contains("campos_alterados", [f.campo.trim()]);
  // Sem acento dos dois lados: o índice já nasce sem (v213).
  if (f.busca?.trim()) q = q.textSearch("busca", semAcento(f.busca.trim()), { type: "websearch", config: "simple" });
  // O servidor filtra o grosso (edição que tocou `status`); o valor de
  // conclusão é decidido no navegador por `ehConclusao`.
  if (f.soConclusoes) q = q.eq("acao", "editou").contains("campos_alterados", ["status"]);
  if (cursor !== null) q = q.lt("id", cursor);

  const { data, error, count } = await q;
  if (error) throw error;
  const brutos = (data ?? []) as unknown as AuditoriaEvento[];
  const eventos = f.soConclusoes ? brutos.filter(ehConclusao) : brutos;
  return {
    ultimoId: brutos.length ? brutos[brutos.length - 1].id : null,
    eventos,
    total: cursor === null ? (count ?? undefined) : undefined,
    proximo: brutos.length === porPagina ? brutos[brutos.length - 1].id : null,
    lidos: brutos.length,
  };
}

/** Teto da exportação: acima disso a planilha fica pesada demais para o Excel abrir bem. */
export const LIMITE_EXPORTACAO = 20000;

/**
 * Todos os eventos dos filtros, para o XLSX. Páginas de 1.000 pelo mesmo
 * cursor da tela; para quando a página vem vazia (não quando vem "menor que
 * 1.000": se o PostgREST tiver teto de linhas menor, parar ali perderia o resto).
 */
export async function buscarTodosParaExportar(
  f: FiltrosAuditoria,
  aoProgredir?: (lidos: number, total?: number) => void,
): Promise<{ eventos: AuditoriaEvento[]; cortado: boolean }> {
  const eventos: AuditoriaEvento[] = [];
  let cursor: number | null = null;
  let total: number | undefined;
  let lidos = 0;
  for (;;) {
    const pagina = await buscarPagina(f, cursor, 1000);
    if (cursor === null) total = pagina.total;
    if (pagina.lidos === 0) return { eventos, cortado: false };
    eventos.push(...pagina.eventos);
    lidos += pagina.lidos;
    aoProgredir?.(lidos, total);
    if (total !== undefined && lidos >= total) return { eventos, cortado: false };
    if (lidos >= LIMITE_EXPORTACAO) return { eventos, cortado: total === undefined || total > lidos };
    // O cursor anda pelo último id LIDO (antes do filtro de conclusão).
    cursor = pagina.ultimoId;
  }
}

export function useAuditoriaEventos(filtros: FiltrosAuditoria) {
  return useInfiniteQuery({
    queryKey: ["auditoria-eventos", filtros] as const,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => buscarPagina(filtros, pageParam),
    getNextPageParam: (ultima) => ultima.proximo,
    staleTime: 30 * 1000,
  });
}

/** Tabelas com gatilho ligado, para o filtro "Tabela" (agrupado por módulo). */
export function useAuditoriaTabelas() {
  return useQuery({
    queryKey: ["auditoria-tabelas"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("auditoria_tabelas")
        .select("tabela, modulo, ativo")
        .eq("ativo", true)
        .order("tabela");
      if (error) throw error;
      return (data ?? []) as unknown as Pick<AuditoriaTabela, "tabela" | "modulo" | "ativo">[];
    },
  });
}

/**
 * Aba "Histórico" do documento (v259): tudo do documento E dos itens dele
 * (riscos, setores, ações…), pelo `doc_tabela`/`doc_id` que o gatilho grava.
 * Quem não é Admin lê só se consegue abrir o documento (policy da v259).
 * Sem paginação; o teto de 1.000 é só guarda (a tela avisa quando bate nele).
 */
export const LIMITE_HISTORICO = 1000;

export function useHistoricoDocumento(docTabela: string | null | undefined, docId: string | null | undefined, ativo = true) {
  return useQuery({
    queryKey: ["auditoria-historico", docTabela ?? "", docId ?? ""],
    enabled: ativo && !!docTabela && !!docId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("auditoria_eventos")
        .select("*")
        .eq("doc_tabela", docTabela!)
        .eq("doc_id", docId!)
        .order("id", { ascending: false })
        .limit(LIMITE_HISTORICO);
      if (error) throw error;
      return (data ?? []) as unknown as AuditoriaEvento[];
    },
  });
}
