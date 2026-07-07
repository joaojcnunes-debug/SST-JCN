"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";

/**
 * Catálogo configurável do Plano de Ação (DRPS): "O Quê" (pai) -> "Como" (filho).
 * Global (todas as empresas). Tabelas `drps_acao_oque` e `drps_acao_como`.
 */

export interface AcaoOque {
  id: string;
  titulo: string;
  ativo: boolean;
  ordem: number;
}
export interface AcaoComo {
  id: string;
  id_oque: string;
  titulo: string;
  ativo: boolean;
  ordem: number;
}

const KEY_OQUE = ["drps-acao-oque"];
const KEY_COMO = ["drps-acao-como"];

export function useAcaoOque() {
  return useQuery({
    queryKey: KEY_OQUE,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_acao_oque")
        .select("id, titulo, ativo, ordem")
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AcaoOque[];
    },
  });
}

export function useAcaoComo() {
  return useQuery({
    queryKey: KEY_COMO,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_acao_como")
        .select("id, id_oque, titulo, ativo, ordem")
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AcaoComo[];
    },
  });
}

/** Títulos de "O Quê" ativos (para o combo/datalist do plano de ação). */
export function useAcaoOqueOpcoes(): string[] {
  const { data } = useAcaoOque();
  return (data ?? []).filter((a) => a.ativo).map((a) => a.titulo);
}

/** Opções de "Como" (ativas) do "O Quê" cujo título casa (case-insensitive). */
export function comoOpcoesDeTitulo(
  oque: AcaoOque[],
  como: AcaoComo[],
  tituloOque: string,
): string[] {
  const t = tituloOque.trim().toLowerCase();
  if (!t) return [];
  const pai = oque.find((o) => o.titulo.trim().toLowerCase() === t);
  if (!pai) return [];
  return como.filter((c) => c.id_oque === pai.id && c.ativo).map((c) => c.titulo);
}

// ---- O Quê (pai) ----
export function useCriarOque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (titulo: string) => {
      const t = titulo.trim();
      if (!t) throw new Error("Informe a ação (O Quê).");
      const supabase = createSupabaseBrowserClient();
      const { data: ult } = await supabase
        .from("drps_acao_oque")
        .select("ordem")
        .order("ordem", { ascending: false })
        .limit(1);
      const prox = (((ult ?? [])[0] as { ordem?: number } | undefined)?.ordem ?? 0) + 10;
      const { error } = await supabase
        .from("drps_acao_oque")
        .insert({ titulo: t, ordem: prox, ativo: true } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_OQUE }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useAtualizarOque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; titulo?: string; ativo?: boolean; ordem?: number }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (args.titulo !== undefined) patch.titulo = args.titulo.trim();
      if (args.ativo !== undefined) patch.ativo = args.ativo;
      if (args.ordem !== undefined) patch.ordem = args.ordem;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("drps_acao_oque").update(patch as never).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_OQUE }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirOque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Os "Como" filhos caem por ON DELETE CASCADE no banco.
      await excluirComLixeiraPorId({ tabela: "drps_acao_oque", chave: "id", id, modulo: "config", rotuloCol: "titulo" });
      return id;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY_OQUE }); qc.invalidateQueries({ queryKey: KEY_COMO }); },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

// ---- Como (filho) ----
export function useCriarComo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id_oque: string; titulo: string }) => {
      const t = args.titulo.trim();
      if (!t) throw new Error("Informe o 'Como'.");
      const supabase = createSupabaseBrowserClient();
      const { data: ult } = await supabase
        .from("drps_acao_como")
        .select("ordem")
        .eq("id_oque", args.id_oque)
        .order("ordem", { ascending: false })
        .limit(1);
      const prox = (((ult ?? [])[0] as { ordem?: number } | undefined)?.ordem ?? 0) + 10;
      const { error } = await supabase
        .from("drps_acao_como")
        .insert({ id_oque: args.id_oque, titulo: t, ordem: prox, ativo: true } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_COMO }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useAtualizarComo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; titulo?: string; ativo?: boolean; ordem?: number }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (args.titulo !== undefined) patch.titulo = args.titulo.trim();
      if (args.ativo !== undefined) patch.ativo = args.ativo;
      if (args.ordem !== undefined) patch.ordem = args.ordem;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("drps_acao_como").update(patch as never).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_COMO }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirComo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await excluirComLixeiraPorId({ tabela: "drps_acao_como", chave: "id", id, modulo: "config", rotuloCol: "titulo" });
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_COMO }),
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}
