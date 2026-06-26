"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { AGRAVOS_OPCOES } from "@/lib/drps/topicos";

/**
 * Catálogo de "Possíveis Agravos à Saúde Mental" (DRPS) — base do multi-select
 * na aba Análise e Avaliação. Tabela `drps_agravos`.
 */

export interface AgravoCatalogo {
  id: string;
  titulo: string;
  ativo: boolean;
  ordem: number;
}

const KEY = ["drps-agravos"];

/** Base estática (fallback) caso o catálogo do banco esteja vazio. */
export const AGRAVOS_BASE: string[] = [...AGRAVOS_OPCOES];

export function useAgravos() {
  return useQuery({
    queryKey: KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_agravos")
        .select("id, titulo, ativo, ordem")
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AgravoCatalogo[];
    },
  });
}

/**
 * Lista de títulos (string[]) para o MultiSelectInline — só os ativos.
 * Se o catálogo estiver vazio, cai na base estática (não quebra a Análise).
 */
export function useAgravosOpcoes(): string[] {
  const { data } = useAgravos();
  if (!data || data.length === 0) return AGRAVOS_BASE;
  const ativos = data.filter((a) => a.ativo).map((a) => a.titulo);
  return ativos.length > 0 ? ativos : AGRAVOS_BASE;
}

export function useCriarAgravo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (titulo: string) => {
      const t = titulo.trim();
      if (!t) throw new Error("Informe o texto do agravo.");
      const supabase = createSupabaseBrowserClient();
      const { data: ult } = await supabase
        .from("drps_agravos")
        .select("ordem")
        .order("ordem", { ascending: false })
        .limit(1);
      const prox = (((ult ?? [])[0] as { ordem?: number } | undefined)?.ordem ?? 0) + 10;
      const { error } = await supabase
        .from("drps_agravos")
        .insert({ titulo: t, ordem: prox, ativo: true } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useAtualizarAgravo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; titulo?: string; ativo?: boolean; ordem?: number }) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (args.titulo !== undefined) patch.titulo = args.titulo.trim();
      if (args.ativo !== undefined) patch.ativo = args.ativo;
      if (args.ordem !== undefined) patch.ordem = args.ordem;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("drps_agravos")
        .update(patch as never)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirAgravo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await excluirComLixeiraPorId({
        tabela: "drps_agravos",
        chave: "id",
        id,
        modulo: "config",
        rotuloCol: "titulo",
      });
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

/** Repõe a base inicial (idempotente — só insere os que faltam). */
export function useRestaurarBaseAgravos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.from("drps_agravos").select("titulo");
      const existentes = new Set(((data ?? []) as { titulo: string }[]).map((r) => r.titulo));
      const faltam = AGRAVOS_BASE.filter((t) => !existentes.has(t));
      if (faltam.length === 0) return 0;
      const base = existentes.size * 10;
      const rows = faltam.map((titulo, i) => ({ titulo, ordem: base + (i + 1) * 10, ativo: true }));
      const { error } = await supabase.from("drps_agravos").insert(rows as never);
      if (error) throw error;
      return faltam.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(n > 0 ? `${n} agravo(s) adicionado(s) à base.` : "Base já estava completa.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}
