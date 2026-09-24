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
  CategoriaSeguranca,
} from "@/lib/supabase/types";

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

/** Riscos de UMA máquina (ficha) — v148. */
export function useRiscosHrnPorFicha(idFicha: string | null | undefined) {
  return useQuery({
    queryKey: ["riscos-hrn-ficha", idFicha] as const,
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
  /** Máquina a que o perigo pertence (v148). */
  id_ficha?: string | null;
  /** V149 — itens da norma como lista; substitui `item_nr12`. */
  itens_nr12?: string[] | null;
  /** V149 — categoria de segurança do comando (NBR 14153). */
  categoria_seguranca?: CategoriaSeguranca | null;
  tipo_perigo: string;
  origem: string | null;
  potenciais_consequencias: string | null;
  /** V147 — item da norma ligado ao perigo ("12.38 a 12.55"). */
  item_nr12: string | null;
  pod: PodHrn | null;
  fep: FepHrn | null;
  gpd: GpdHrn | null;
  npe_item: NpeHrn | null;
  classificacao_risco: ClassificacaoRiscoHrn | null;
  nivel_acoes: string | null;
  medidas_preventivas: string | null;
  // V146 — colunas da ficha do laudo (medidas separadas + risco residual).
  medidas_engenharia: string | null;
  medidas_administrativas: string | null;
  pod_residual: PodHrn | null;
  fep_residual: FepHrn | null;
  gpd_residual: GpdHrn | null;
  classificacao_residual: ClassificacaoRiscoHrn | null;
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
        // Campos opcionais no input, obrigatórios na linha gravada.
        id_ficha: input.id_ficha ?? null,
        itens_nr12: input.itens_nr12 ?? null,
        categoria_seguranca: input.categoria_seguranca ?? null,
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
