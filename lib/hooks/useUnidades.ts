"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { gerarId } from "@/lib/utils";
import type { Unidade } from "@/lib/supabase/types";

const KEY = ["unidades"] as const;

/** Lista de unidades (agrupamento de empresas para controle de acesso). */
export function useUnidades() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("unidades")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Unidade[];
    },
  });
}

export function useCriarUnidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const supabase = createSupabaseBrowserClient();
      const id_unidade = gerarId("UNI");
      const { error } = await supabase
        .from("unidades")
        .insert({
          id_unidade,
          nome: nome.trim(),
          created_at: new Date().toISOString(),
        } as never);
      if (error) throw error;
      return id_unidade;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Unidade criada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useRenomearUnidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id_unidade: string; nome: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("unidades")
        .update({
          nome: params.nome.trim(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_unidade", params.id_unidade);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirUnidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_unidade: string) => {
      // empresas.id_unidade vira null (ON DELETE SET NULL) → voltam a ser visíveis a todos
      await excluirComLixeiraPorId({
        tabela: "unidades",
        chave: "id_unidade",
        id: id_unidade,
        modulo: "unidades",
        rotuloCol: "nome",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Unidade excluída");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}
