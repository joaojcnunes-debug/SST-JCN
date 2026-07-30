"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type {
  RiscoHrn,
  PodHrn,
  FepHrn,
  GpdHrn,
  NpeHrn,
  ClassificacaoRiscoHrn,
} from "@/lib/supabase/types";

// Duas visões da mesma tabela: por LAUDO (id_apreciacao) — legado, ainda usado
// pela tela atual — e por MÁQUINA (id_ficha) — multi-máquina (v132).
const KEY_APRE = (idApreciacao: string | null | undefined) =>
  ["riscos-hrn", idApreciacao] as const;
const KEY_FICHA = (idFicha: string | null | undefined) =>
  ["riscos-hrn-ficha", idFicha] as const;

/** Invalida ambas as visões (apreciação e ficha) após qualquer mutação. */
function invalidarRiscos(
  qc: ReturnType<typeof useQueryClient>,
  idApreciacao?: string
) {
  qc.invalidateQueries({
    queryKey: idApreciacao ? KEY_APRE(idApreciacao) : ["riscos-hrn"],
  });
  qc.invalidateQueries({ queryKey: ["riscos-hrn-ficha"] });
}

/** Riscos HRN de todo o laudo (todas as fichas). */
export function useRiscosHrn(idApreciacao: string | null | undefined) {
  return useQuery({
    queryKey: KEY_APRE(idApreciacao),
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

/** Riscos HRN de uma máquina (ficha) específica. */
export function useRiscosHrnPorFicha(idFicha: string | null | undefined) {
  return useQuery({
    queryKey: KEY_FICHA(idFicha),
    enabled: !!idFicha,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("apreciacao_riscos_hrn")
        .select("*")
        .eq("id_ficha", idFicha!)
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
  // Novos (v132) — opcionais para não quebrar a tela atual (legado por laudo).
  id_ficha?: string | null;
  pod_residual?: PodHrn | null;
  fep_residual?: FepHrn | null;
  gpd_residual?: GpdHrn | null;
  classificacao_residual?: ClassificacaoRiscoHrn | null;
}

export function useCriarRiscoHrn(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RiscoHrnInput): Promise<RiscoHrn> => {
      const supabase = createSupabaseBrowserClient();
      const row: RiscoHrn = {
        id_risco: gerarId("HRN"),
        id_apreciacao: idApreciacao,
        id_ficha: input.id_ficha ?? null,
        tipo_perigo: input.tipo_perigo,
        origem: input.origem,
        potenciais_consequencias: input.potenciais_consequencias,
        pod: input.pod,
        fep: input.fep,
        gpd: input.gpd,
        npe_item: input.npe_item,
        classificacao_risco: input.classificacao_risco,
        pod_residual: input.pod_residual ?? null,
        fep_residual: input.fep_residual ?? null,
        gpd_residual: input.gpd_residual ?? null,
        classificacao_residual: input.classificacao_residual ?? null,
        nivel_acoes: input.nivel_acoes,
        medidas_preventivas: input.medidas_preventivas,
        ordem: input.ordem,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("apreciacao_riscos_hrn")
        .insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: () => invalidarRiscos(qc, idApreciacao),
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
    onSuccess: () => invalidarRiscos(qc, idApreciacao),
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
    onSuccess: () => invalidarRiscos(qc, idApreciacao),
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}
