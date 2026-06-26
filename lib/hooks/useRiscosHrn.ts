"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type { RiscoHrn, PodHrn, FepHrn, GpdHrn, NpeHrn, ClassificacaoRiscoHrn } from "@/lib/supabase/types";

const KEY = (idApreciacao: string | null | undefined) =>
  ["riscos-hrn", idApreciacao] as const;

export function useRiscosHrn(idApreciacao: string | null | undefined) {
  return useQuery({
    queryKey: KEY(idApreciacao),
    enabled: !!idApreciacao,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("apreciacao_riscos_hrn")
        .select("*")
        .eq("id_apreciacao", idApreciacao!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RiscoHrn[];
    },
  });
}

export interface RiscoHrnInput {
  tipo_perigo: string;
  origem: string | null;
  potenciais_consequencias: string | null;
  pod: PodHrn | null;
  fep: FepHrn | null;
  gpd: GpdHrn | null;
  npe_item: NpeHrn | null;
  classificacao_risco: ClassificacaoRiscoHrn | null;
  nivel_acoes: string | null;
  medidas_preventivas: string | null;
  ordem: number;
}

export function useCriarRiscoHrn(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RiscoHrnInput): Promise<RiscoHrn> => {
      const supabase = createSupabaseBrowserClient();
      const row: RiscoHrn = {
        id_risco: gerarId("HRN"),
        id_apreciacao: idApreciacao,
        ...input,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("apreciacao_riscos_hrn")
        .insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(idApreciacao) }),
    onError: (e: Error) => toast.error(`Erro ao adicionar risco: ${e.message}`),
  });
}

export function useAtualizarRiscoHrn(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id_risco: string } & Partial<RiscoHrnInput>) => {
      const supabase = createSupabaseBrowserClient();
      const { id_risco, ...patch } = params;
      const { error } = await supabase
        .from("apreciacao_riscos_hrn")
        .update(patch as never)
        .eq("id_risco", id_risco);
      if (error) throw error;
      return params;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(idApreciacao) }),
    onError: (e: Error) => toast.error(`Erro ao atualizar: ${e.message}`),
  });
}

export function useExcluirRiscoHrn(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_risco: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("apreciacao_riscos_hrn")
        .delete()
        .eq("id_risco", id_risco);
      if (error) throw error;
      return id_risco;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(idApreciacao) }),
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}
