"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PerigoCatalogo } from "@/lib/supabase/types";

const KEY = ["perigos-catalogo"] as const;

/** Catálogo de perigos reutilizável (só os ativos, ordenados). */
export function usePerigosCatalogo() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("apreciacao_perigos_catalogo")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PerigoCatalogo[];
    },
    staleTime: 5 * 60 * 1000, // catálogo muda pouco
  });
}

export interface PerigoCatalogoInput {
  nome: string;
  origem_consequencias: string | null;
  itens_nr12: string[];
  medidas_eng: string | null;
  medidas_adm: string | null;
  pod_default: string | null;
  fep_default: string | null;
  gpd_default: string | null;
  pod_residual_default: string | null;
  fep_residual_default: string | null;
  gpd_residual_default: string | null;
  ordem: number;
  ativo: boolean;
}

/** Upsert de um perigo do catálogo (tela de manutenção do catálogo, Fase 3). */
export function useSalvarPerigoCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string } & Partial<PerigoCatalogoInput>) => {
      const supabase = createSupabaseBrowserClient();
      const { id, ...patch } = params;
      const { error } = await supabase
        .from("apreciacao_perigos_catalogo")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
      return params;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(`Erro ao salvar perigo: ${e.message}`),
  });
}
