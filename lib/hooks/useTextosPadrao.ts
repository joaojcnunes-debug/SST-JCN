"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type {
  ModuloTextoPadrao,
  OrientacaoPagina,
  QuebraPagina,
  TextoPadraoCapitulo,
} from "@/lib/textos-padrao/types";
import type { CaixaTexto } from "@/lib/drps/types";

const KEY = (m: ModuloTextoPadrao) => ["textos-padrao", m] as const;

/** Lista capítulos ativos do módulo, ordenados. */
export function useTextosPadrao(modulo: ModuloTextoPadrao) {
  return useQuery({
    queryKey: KEY(modulo),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("textos_padrao")
        .select("*")
        .eq("modulo", modulo)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TextoPadraoCapitulo[];
    },
  });
}

export function useCriarCapituloTexto(modulo: ModuloTextoPadrao) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      titulo: string;
      conteudo?: string | null;
      ordem?: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const id = gerarId("TXT");
      const { error } = await supabase
        .from("textos_padrao")
        .insert({
          id_capitulo: id,
          modulo,
          titulo: args.titulo,
          conteudo: args.conteudo ?? null,
          ordem: args.ordem ?? 0,
          ativo: true,
          created_at: new Date().toISOString(),
        } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(modulo) });
      toast.success("Capítulo criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSalvarCapituloTexto(modulo: ModuloTextoPadrao) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id_capitulo: string;
      titulo?: string;
      conteudo?: string | null;
      ordem?: number;
      ativo?: boolean;
      bg_imagem_url?: string | null;
      caixas_texto?: CaixaTexto[] | null;
      orientacao?: OrientacaoPagina;
      quebra_pagina?: QuebraPagina;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { id_capitulo, ...rest } = args;
      const { error } = await supabase
        .from("textos_padrao")
        .update({ ...rest, updated_at: new Date().toISOString() } as never)
        .eq("id_capitulo", id_capitulo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(modulo) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirCapituloTexto(modulo: ModuloTextoPadrao) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_capitulo: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("textos_padrao")
        .delete()
        .eq("id_capitulo", id_capitulo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(modulo) });
      toast.success("Capítulo excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
