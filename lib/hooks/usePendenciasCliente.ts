"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentUser } from "./useUsuario";
import type {
  PortalPendenciaCliente,
  PortalComentario,
  PortalAnexo,
  StatusPendenciaPortal,
  PrioridadePortal,
} from "@/lib/supabase/types";

export function usePendenciasCliente() {
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? null;

  return useQuery({
    queryKey: ["portal", "pendencias", empresaId],
    enabled: !!empresaId,
    staleTime: 60_000,
    queryFn: async (): Promise<PortalPendenciaCliente[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("portal_pendencias_cliente")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalPendenciaCliente[];
    },
  });
}

export function usePendenciaComentarios(pendenciaId: string | null) {
  return useQuery({
    queryKey: ["portal", "comentarios", "pendencia", pendenciaId],
    enabled: !!pendenciaId,
    staleTime: 30_000,
    queryFn: async (): Promise<PortalComentario[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("portal_comentarios")
        .select("*")
        .eq("referencia_tipo", "pendencia")
        .eq("referencia_id", pendenciaId!)
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PortalComentario[];
    },
  });
}

export function usePendenciaAnexos(pendenciaId: string | null) {
  return useQuery({
    queryKey: ["portal", "anexos", "pendencia", pendenciaId],
    enabled: !!pendenciaId,
    staleTime: 30_000,
    queryFn: async (): Promise<PortalAnexo[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("portal_anexos")
        .select("*")
        .eq("referencia_tipo", "pendencia")
        .eq("referencia_id", pendenciaId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalAnexo[];
    },
  });
}

export function useResponderPendencia() {
  const qc = useQueryClient();
  const user = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      pendenciaId,
      empresaId,
      texto,
    }: {
      pendenciaId: string;
      empresaId: string;
      texto: string;
    }) => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anySb = sb as any;
      const { error } = await anySb.from("portal_comentarios").insert({
        empresa_id: empresaId,
        referencia_tipo: "pendencia",
        referencia_id: pendenciaId,
        texto,
        criado_por: user?.id_usuario ?? null,
      });
      if (error) throw error;

      // Marcar como recebido se ainda estava pendente
      await anySb
        .from("portal_pendencias_cliente")
        .update({ status: "recebido", atualizado_em: new Date().toISOString() })
        .eq("id", pendenciaId)
        .eq("status", "pendente");
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["portal", "comentarios", "pendencia", vars.pendenciaId] });
      qc.invalidateQueries({ queryKey: ["portal", "pendencias", vars.empresaId] });
      qc.invalidateQueries({ queryKey: ["portal", "stats"] });
      toast.success("Resposta enviada.");
    },
    onError: () => toast.error("Erro ao enviar resposta."),
  });
}

export function useCriarPendencia() {
  const qc = useQueryClient();
  const user = useCurrentUser();

  return useMutation({
    mutationFn: async (payload: {
      empresa_id: string;
      titulo: string;
      descricao?: string;
      prioridade: PrioridadePortal;
      prazo?: string;
    }) => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (sb as any)
        .from("portal_pendencias_cliente")
        .insert({ ...payload, criado_por: user?.id_usuario ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["portal", "pendencias", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["portal", "stats"] });
      toast.success("Pendência criada.");
    },
    onError: () => toast.error("Erro ao criar pendência."),
  });
}

export function useAtualizarStatusPendencia() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusPendenciaPortal; empresa_id: string }) => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any)
        .from("portal_pendencias_cliente")
        .update({ status, atualizado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["portal", "pendencias", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["portal", "stats"] });
    },
    onError: () => toast.error("Erro ao atualizar pendência."),
  });
}
