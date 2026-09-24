"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type { PerigoCatalogo } from "@/lib/supabase/types";

/**
 * Catálogo de perigos NR-12 (v150). Escolher um perigo pré-preenche a linha HRN
 * da ficha — é o que evita digitar do zero a cada máquina.
 *
 * O conteúdo seedado é PONTO DE PARTIDA redigido no painel, não veio do laudo
 * de referência: o RT deve revisar antes do primeiro uso em documento assinado.
 */

const KEY = ["perigos-catalogo"] as const;

export function usePerigosCatalogo() {
  return useQuery({
    queryKey: KEY,
    staleTime: 5 * 60 * 1000, // catálogo muda raramente
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
  });
}

export type PerigoCatalogoInput = Partial<Omit<PerigoCatalogo, "id_perigo" | "created_at">> & {
  nome: string;
};

export function useSalvarPerigoCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id_perigo?: string } & PerigoCatalogoInput) => {
      const supabase = createSupabaseBrowserClient();
      const { id_perigo, ...campos } = params;
      if (id_perigo) {
        const { error } = await supabase
          .from("apreciacao_perigos_catalogo")
          .update({ ...campos, updated_at: new Date().toISOString() } as never)
          .eq("id_perigo", id_perigo);
        if (error) throw error;
        return id_perigo;
      }
      const novo = { id_perigo: gerarId("PRG"), ordem: 0, ativo: true, ...campos };
      const { error } = await supabase
        .from("apreciacao_perigos_catalogo")
        .insert(novo as never);
      if (error) throw error;
      return novo.id_perigo;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(`Erro ao salvar perigo: ${e.message}`),
  });
}
