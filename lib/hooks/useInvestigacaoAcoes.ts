"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { mensagemErro } from "@/lib/errors";
import { useUserStore } from "@/lib/store";
import type {
  InvestigacaoAcao,
  StatusAcaoApreciacao,
  PrioridadeAcaoApreciacao,
} from "@/lib/supabase/types";

const KEY = (id: string) => ["investigacao-acoes", id];

export function useInvestigacaoAcoes(id_investigacao: string | null | undefined) {
  return useQuery({
    queryKey: KEY(id_investigacao ?? ""),
    enabled: !!id_investigacao,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("investigacao_acoes")
        .select("*")
        .eq("id_investigacao", id_investigacao!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InvestigacaoAcao[];
    },
  });
}

export interface CriarInvestigacaoAcaoInput {
  id_investigacao: string;
  ordem: number;
  what_acao: string;
  why_justificativa?: string | null;
  where_local?: string | null;
  when_prazo?: string | null;
  who_responsavel?: string | null;
  how_metodo?: string | null;
  how_much_custo?: string | null;
  prioridade?: PrioridadeAcaoApreciacao;
}

export function useCriarInvestigacaoAcao() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (input: CriarInvestigacaoAcaoInput) => {
      const supabase = createSupabaseBrowserClient();
      const row: InvestigacaoAcao = {
        id_acao: gerarId("IAC"),
        id_investigacao: input.id_investigacao,
        ordem: input.ordem,
        what_acao: input.what_acao,
        why_justificativa: input.why_justificativa ?? null,
        where_local: input.where_local ?? null,
        when_prazo: input.when_prazo ?? null,
        who_responsavel: input.who_responsavel ?? null,
        how_metodo: input.how_metodo ?? null,
        how_much_custo: input.how_much_custo ?? null,
        status: "Pendente",
        prioridade: input.prioridade ?? "Media",
        data_conclusao: null,
        observacoes: null,
        created_by: user?.email ?? null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      const { error } = await supabase.from("investigacao_acoes").insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: KEY(row.id_investigacao) }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useAtualizarInvestigacaoAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_investigacao: string;
      id_acao: string;
      what_acao?: string;
      why_justificativa?: string | null;
      where_local?: string | null;
      when_prazo?: string | null;
      who_responsavel?: string | null;
      how_metodo?: string | null;
      how_much_custo?: string | null;
      status?: StatusAcaoApreciacao;
      prioridade?: PrioridadeAcaoApreciacao;
      data_conclusao?: string | null;
      observacoes?: string | null;
      ordem?: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { id_investigacao, id_acao, ...rest } = params;
      void id_investigacao; // só usado no onSuccess (via params) p/ invalidar o cache
      const patch: Partial<InvestigacaoAcao> = {
        ...rest,
        updated_at: new Date().toISOString(),
      };
      if (params.status === "Concluida" && !params.data_conclusao) {
        patch.data_conclusao = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase
        .from("investigacao_acoes")
        .update(patch as never)
        .eq("id_acao", id_acao);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => qc.invalidateQueries({ queryKey: KEY(params.id_investigacao) }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirInvestigacaoAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id_investigacao: string; id_acao: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("investigacao_acoes")
        .delete()
        .eq("id_acao", params.id_acao);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => qc.invalidateQueries({ queryKey: KEY(params.id_investigacao) }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}
