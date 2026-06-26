"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentUser } from "./useUsuario";
import type {
  PortalSolicitacaoCliente,
  PortalComentario,
  PortalAnexo,
  TipoSolicitacaoPortal,
  PrioridadePortal,
  StatusSolicitacaoPortal,
} from "@/lib/supabase/types";

export function useSolicitacoesCliente() {
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? null;

  return useQuery({
    queryKey: ["portal", "solicitacoes", empresaId],
    enabled: !!empresaId,
    staleTime: 60_000,
    queryFn: async (): Promise<PortalSolicitacaoCliente[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("portal_solicitacoes_cliente")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalSolicitacaoCliente[];
    },
  });
}

export function useSolicitacaoComentarios(solicitacaoId: string | null) {
  return useQuery({
    queryKey: ["portal", "comentarios", "solicitacao", solicitacaoId],
    enabled: !!solicitacaoId,
    staleTime: 30_000,
    queryFn: async (): Promise<PortalComentario[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("portal_comentarios")
        .select("*")
        .eq("referencia_tipo", "solicitacao")
        .eq("referencia_id", solicitacaoId!)
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PortalComentario[];
    },
  });
}

export function useSolicitacaoAnexos(solicitacaoId: string | null) {
  return useQuery({
    queryKey: ["portal", "anexos", "solicitacao", solicitacaoId],
    enabled: !!solicitacaoId,
    staleTime: 30_000,
    queryFn: async (): Promise<PortalAnexo[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("portal_anexos")
        .select("*")
        .eq("referencia_tipo", "solicitacao")
        .eq("referencia_id", solicitacaoId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalAnexo[];
    },
  });
}

export function useCriarSolicitacao() {
  const qc = useQueryClient();
  const user = useCurrentUser();

  return useMutation({
    mutationFn: async (payload: {
      empresa_id: string;
      tipo_solicitacao: TipoSolicitacaoPortal;
      descricao: string;
      prioridade: PrioridadePortal;
    }) => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (sb as any)
        .from("portal_solicitacoes_cliente")
        .insert({ ...payload, criado_por: user?.id_usuario ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["portal", "solicitacoes", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["portal", "stats"] });
      toast.success("Solicitação enviada com sucesso.");
    },
    onError: () => toast.error("Erro ao enviar solicitação."),
  });
}

export function useAdicionarComentarioSolicitacao() {
  const qc = useQueryClient();
  const user = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      solicitacaoId,
      empresaId,
      texto,
    }: {
      solicitacaoId: string;
      empresaId: string;
      texto: string;
    }) => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any).from("portal_comentarios").insert({
        empresa_id: empresaId,
        referencia_tipo: "solicitacao",
        referencia_id: solicitacaoId,
        texto,
        criado_por: user?.id_usuario ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["portal", "comentarios", "solicitacao", vars.solicitacaoId],
      });
      toast.success("Comentário adicionado.");
    },
    onError: () => toast.error("Erro ao adicionar comentário."),
  });
}

export function useAtualizarStatusSolicitacao() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusSolicitacaoPortal; empresa_id: string }) => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any)
        .from("portal_solicitacoes_cliente")
        .update({ status, atualizado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["portal", "solicitacoes", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["portal", "stats"] });
    },
    onError: () => toast.error("Erro ao atualizar solicitação."),
  });
}
