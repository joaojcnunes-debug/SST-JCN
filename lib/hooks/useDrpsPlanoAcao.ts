"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type StatusPlanoAcao = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA";

/** Linha do Plano de Ação 5W2H (tabela drps_plano_acao_5w2h, criada na Fase 3A). */
export interface DrpsPlanoAcao5w2h {
  id: string;
  id_relatorio: string;
  id_empresa: string | null;
  ordem: number;
  acao: string | null; // O quê (What)
  justificativa: string | null; // Por quê (Why)
  onde: string | null; // Onde (Where)
  prazo: string | null; // Quando (When)
  responsavel: string | null; // Quem (Who)
  como: string | null; // Como (How)
  quanto_custa: string | null; // Quanto custa (How much)
  status: StatusPlanoAcao;
  created_at: string;
  updated_at: string | null;
}

const KEY = (idRelatorio: string | null | undefined) => ["drps-plano-acao", idRelatorio];

export function useDrpsPlanoAcao(idRelatorio: string | null | undefined) {
  return useQuery({
    queryKey: KEY(idRelatorio),
    enabled: !!idRelatorio,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_plano_acao_5w2h")
        .select("*")
        .eq("id_relatorio", idRelatorio!)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DrpsPlanoAcao5w2h[];
    },
  });
}

export interface SalvarLinhaPlanoAcaoArgs {
  /** Sem id → INSERT; com id → UPDATE. */
  id?: string;
  id_relatorio: string;
  id_empresa: string | null;
  ordem: number;
  acao?: string | null;
  justificativa?: string | null;
  onde?: string | null;
  prazo?: string | null;
  responsavel?: string | null;
  como?: string | null;
  quanto_custa?: string | null;
  status?: StatusPlanoAcao;
  /** Quando true, não dispara toast de sucesso (ex.: ao adicionar linha em branco). */
  _silent?: boolean;
}

export function useSalvarLinhaPlanoAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: SalvarLinhaPlanoAcaoArgs) => {
      const supabase = createSupabaseBrowserClient();
      const { id, _silent: _, ...campos } = args;
      const payload = { ...campos, updated_at: new Date().toISOString() };
      if (id) {
        const { error } = await supabase
          .from("drps_plano_acao_5w2h")
          .update(payload as never)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("drps_plano_acao_5w2h")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: KEY(vars.id_relatorio) });
      if (!vars._silent) toast.success("Ação salva");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useRemoverLinhaPlanoAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; id_relatorio: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("drps_plano_acao_5w2h")
        .delete()
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: KEY(vars.id_relatorio) });
      toast.success("Ação removida");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}
