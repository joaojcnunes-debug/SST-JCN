"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { COLUNAS_PRIORIDADE } from "@/lib/hooks/useInspecao";
import { filtroPeriodo } from "@/lib/inspecoes/periodo";
import type { Inspecao } from "@/lib/supabase/types";

export type PapelAtribuicao = "tecnico" | "associado" | "todos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

/**
 * Inspeções atribuídas a uma pessoa (v306, RPC inspecoes_atribuidas): como TÉCNICO (foi a campo)
 * ou como ASSOCIADO (está no documento). `idUsuario` null = eu; outra pessoa só para supervisor
 * (o banco confere). A RPC devolve linhas de `inspecoes`, então dá para pedir as colunas
 * calculadas e filtrar/ordenar por cima, como numa tabela.
 */
const rpcAtribuidas = (sb: Sb, idUsuario: string | null, papel: PapelAtribuicao) =>
  sb.rpc("inspecoes_atribuidas", { p_id_usuario: idUsuario, p_papel: papel });

/** Só os ids — o "Só as minhas" da lista geral. */
export function useIdsAtribuidas(idUsuario: string | null, papel: PapelAtribuicao, enabled: boolean) {
  return useQuery({
    queryKey: ["inspecoes-atribuidas", "ids", idUsuario, papel],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await rpcAtribuidas(createSupabaseBrowserClient(), idUsuario, papel).select("id_inspecao");
      if (error) throw error;
      return ((data ?? []) as { id_inspecao: string }[]).map((r) => r.id_inspecao);
    },
  });
}

export interface FiltrosFila {
  idUsuario: string | null;
  papel: Exclude<PapelAtribuicao, "todos">;
  /** Status da inspeção (vazio = todos). 28/10: substituiu "abertas/todas". */
  status: string[];
  prioridade: string[];
  esperaMin: number;
  dataIni: string;
  dataFim: string;
  busca: string;
  ordem: "prioridade" | "espera" | "prazo" | "recentes";
}

/** A fila de uma pessoa, já com prioridade/espera/documento. Até 500 (é a fila de UMA pessoa). */
export function useFilaAtribuida(f: FiltrosFila) {
  return useQuery({
    queryKey: ["inspecoes-atribuidas", "fila", f],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      let q = rpcAtribuidas(sb, f.idUsuario, f.papel).select(`*, tecnicos_campo, ${COLUNAS_PRIORIDADE}, empresas(nome_empresa)`);
      if (f.status.length) q = q.in("status", f.status);
      if (f.prioridade.length) q = q.in("prioridade_efetiva", f.prioridade);
      if (f.esperaMin > 0) q = q.gte("dias_espera", f.esperaMin);
      const periodo = filtroPeriodo(f.dataIni, f.dataFim);
      if (periodo) q = q.or(periodo);
      // 28/10: a busca é só pelo nome da empresa (o ID saiu do campo).
      const termo = f.busca.trim().replace(/[(),*%]/g, " ").trim();
      if (termo) {
        const { data: emps } = await sb.from("empresas").select("id_empresa").ilike("nome_empresa", `%${termo}%`).limit(300);
        const ids = ((emps ?? []) as { id_empresa: string }[]).map((e) => e.id_empresa);
        q = ids.length ? q.in("id_empresa", ids) : q.eq("id_inspecao", "__nenhuma__");
      }
      if (f.ordem === "prioridade") q = q.order("prioridade_ord", { ascending: false }).order("dias_espera", { ascending: false, nullsFirst: false });
      else if (f.ordem === "espera") q = q.order("dias_espera", { ascending: false, nullsFirst: false });
      else if (f.ordem === "prazo") q = q.order("prazo", { ascending: true, nullsFirst: false }).order("prioridade_ord", { ascending: false });
      else q = q.order("created_at", { ascending: false });
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Inspecao[];
    },
  });
}

/** Resumo da fila (para os cartões): todas as atribuídas da pessoa no papel, sem os filtros da tela. */
export function useResumoFila(idUsuario: string | null, papel: Exclude<PapelAtribuicao, "todos">) {
  return useQuery({
    queryKey: ["inspecoes-atribuidas", "resumo", idUsuario, papel],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await rpcAtribuidas(createSupabaseBrowserClient(), idUsuario, papel)
        .select("status, prazo, concluida_em, elaboracao_concluida_em, dias_espera, prioridade_efetiva")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Array<Pick<Inspecao, "status" | "prazo" | "concluida_em" | "elaboracao_concluida_em" | "dias_espera" | "prioridade_efetiva">>;
    },
  });
}

/** Pessoas que podem ter inspeções atribuídas (técnicos e associados) — o seletor do supervisor. */
export function usePessoasAtribuicao(enabled = true) {
  return useQuery({
    queryKey: ["usuarios-atribuicao"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await createSupabaseBrowserClient()
        .from("usuarios")
        .select("id_usuario, nome, perfil, ativo_sistema")
        .neq("perfil", "Cliente")
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as Array<{ id_usuario: string; nome: string; perfil: string; ativo_sistema: boolean | null }>)
        .filter((u) => u.ativo_sistema !== false && (u.nome ?? "").trim());
    },
  });
}
