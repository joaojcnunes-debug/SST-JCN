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
}

// Meia-noite LOCAL do dia, em ISO — o banco guarda timestamptz, então o filtro
// "de 14/09" precisa começar às 00:00 de Brasília, não de Greenwich.
function inicioDoDia(d: string) {
  return new Date(`${d}T00:00:00`).toISOString();
}
function fimDoDia(d: string) {
  return new Date(`${d}T23:59:59.999`).toISOString();
}

async function buscarPagina(f: FiltrosAuditoria, cursor: number | null): Promise<PaginaAuditoria> {
  const sb = createSupabaseBrowserClient();
  let q = sb
    .from("auditoria_eventos")
    // Contagem exata só na 1ª página: nas seguintes o número já é conhecido.
    .select("*", cursor === null ? { count: "exact" } : undefined)
    .order("id", { ascending: false })
    .limit(POR_PAGINA);

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
    eventos,
    total: cursor === null ? (count ?? undefined) : undefined,
    proximo: brutos.length === POR_PAGINA ? brutos[brutos.length - 1].id : null,
  };
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
 * Linha do tempo de UM registro (Fase 3: aba "Histórico" dentro do documento).
 * Mesma leitura, sem paginação: um documento raramente passa de algumas
 * centenas de eventos.
 */
export function useAuditoriaRegistro(tabela: string | null | undefined, registroId: string | null | undefined) {
  return useQuery({
    queryKey: ["auditoria-registro", tabela ?? "", registroId ?? ""],
    enabled: !!tabela && !!registroId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("auditoria_eventos")
        .select("*")
        .eq("tabela", tabela!)
        .eq("registro_id", registroId!)
        .order("id", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AuditoriaEvento[];
    },
  });
}
