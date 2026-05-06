"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  MatrizRisco,
  PerguntaTipoRisco,
  TipoRiscoCustom,
} from "@/lib/supabase/types";

// =========================================================================
// TIPOS DE RISCO
// =========================================================================

export function useTiposRisco(opts?: { incluirInativos?: boolean }) {
  return useQuery({
    queryKey: ["tipos-risco", opts?.incluirInativos ?? false],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase.from("tipos_risco").select("*").order("ordem");
      if (!opts?.incluirInativos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TipoRiscoCustom[];
    },
  });
}

export function useSaveTipoRisco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Partial<TipoRiscoCustom> & { id_tipo: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("tipos_risco")
        .upsert(
          {
            ...t,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "id_tipo" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos-risco"] });
      toast.success("Tipo salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTipoRisco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idTipo: string) => {
      const supabase = createSupabaseBrowserClient();
      // Tipos de sistema: desativar em vez de apagar (evita perder histórico).
      const { data: existing } = await supabase
        .from("tipos_risco")
        .select("sistema")
        .eq("id_tipo", idTipo)
        .single();
      const isSistema = (existing as { sistema?: boolean } | null)?.sistema;
      if (isSistema) {
        const { error } = await supabase
          .from("tipos_risco")
          .update({ ativo: false } as never)
          .eq("id_tipo", idTipo);
        if (error) throw error;
        return "desativado";
      }
      const { error } = await supabase
        .from("tipos_risco")
        .delete()
        .eq("id_tipo", idTipo);
      if (error) throw error;
      return "removido";
    },
    onSuccess: (acao) => {
      qc.invalidateQueries({ queryKey: ["tipos-risco"] });
      toast.success(acao === "desativado" ? "Tipo desativado" : "Tipo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// =========================================================================
// PERGUNTAS POR TIPO DE RISCO
// =========================================================================

export function usePerguntasPorTipo(idTipo: string | null | undefined) {
  return useQuery({
    queryKey: ["perguntas-tipo", idTipo],
    enabled: !!idTipo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("perguntas_tipo_risco")
        .select("*")
        .eq("id_tipo", idTipo!)
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as PerguntaTipoRisco[];
    },
  });
}

export function useTodasPerguntas(idTipo: string | null | undefined) {
  return useQuery({
    queryKey: ["perguntas-tipo-todas", idTipo],
    enabled: !!idTipo,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("perguntas_tipo_risco")
        .select("*")
        .eq("id_tipo", idTipo!)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as PerguntaTipoRisco[];
    },
  });
}

export function useSavePergunta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      p: Partial<PerguntaTipoRisco> & { id_pergunta: string; id_tipo: string }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("perguntas_tipo_risco")
        .upsert(p as never, { onConflict: "id_pergunta" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["perguntas-tipo"] });
      qc.invalidateQueries({ queryKey: ["perguntas-tipo-todas"] });
      qc.invalidateQueries({
        queryKey: ["perguntas-tipo-todas", vars.id_tipo],
      });
      toast.success("Pergunta salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePergunta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idPergunta: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("perguntas_tipo_risco")
        .delete()
        .eq("id_pergunta", idPergunta);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perguntas-tipo"] });
      qc.invalidateQueries({ queryKey: ["perguntas-tipo-todas"] });
      toast.success("Pergunta removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// =========================================================================
// MATRIZES DE RISCO
// =========================================================================

export function useMatrizes() {
  return useQuery({
    queryKey: ["matrizes"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("matrizes_risco")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as MatrizRisco[];
    },
  });
}

export function useMatrizAtiva() {
  return useQuery({
    queryKey: ["matriz-ativa"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("matrizes_risco")
        .select("*")
        .eq("ativa", true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as MatrizRisco | null;
    },
  });
}

export function useSaveMatriz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<MatrizRisco> & { id_matriz: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("matrizes_risco")
        .upsert(
          {
            ...m,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "id_matriz" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matrizes"] });
      qc.invalidateQueries({ queryKey: ["matriz-ativa"] });
      toast.success("Matriz salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAtivarMatriz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idMatriz: string) => {
      const supabase = createSupabaseBrowserClient();
      // Desativa todas e ativa só a escolhida — a constraint do banco
      // garante que nunca duas fiquem ativas ao mesmo tempo.
      const { error: errDes } = await supabase
        .from("matrizes_risco")
        .update({ ativa: false } as never)
        .neq("id_matriz", idMatriz);
      if (errDes) throw errDes;
      const { error } = await supabase
        .from("matrizes_risco")
        .update({ ativa: true } as never)
        .eq("id_matriz", idMatriz);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matrizes"] });
      qc.invalidateQueries({ queryKey: ["matriz-ativa"] });
      toast.success("Matriz ativada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteMatriz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idMatriz: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("matrizes_risco")
        .delete()
        .eq("id_matriz", idMatriz);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matrizes"] });
      qc.invalidateQueries({ queryKey: ["matriz-ativa"] });
      toast.success("Matriz removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
