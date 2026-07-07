"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";

export type GestaoPapel = "owner" | "admin" | "membro";
export type GestaoNivel = "view" | "comment" | "edit" | "full";
export type GestaoRecurso = "space" | "folder" | "list" | "task";
export type GestaoAcaoAcesso = "concedeu" | "revogou";

// As RPCs novas (gestao_*) ainda não estão nos tipos gerados do Supabase → cast tipado.
type GestaoRpc = {
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<{ data: T; error: { message: string } | null }>;
};

/** Meu papel na Gestão (owner/admin/membro) ou null se NÃO for membro (portão). */
export function useMeuPapelGestao() {
  return useQuery({
    queryKey: ["gestao-meu-papel"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await (sb as unknown as GestaoRpc).rpc("gestao_meu_papel");
      if (error) throw error;
      return (data ?? null) as GestaoPapel | null;
    },
  });
}

/** Meu nível efetivo num recurso (view/comment/edit/full) ou null (negado). */
export function useMeuNivel(recursoTipo: GestaoRecurso, recursoId: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-meu-nivel", recursoTipo, recursoId],
    enabled: !!recursoId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await (sb as unknown as GestaoRpc).rpc("gestao_meu_nivel", { p_recurso_tipo: recursoTipo, p_recurso_id: recursoId });
      if (error) throw error;
      return (data ?? null) as GestaoNivel | null;
    },
  });
}

export function nivelPodeVer(n: GestaoNivel | null | undefined) {
  return n === "view" || n === "comment" || n === "edit" || n === "full";
}
export function nivelPodeEditar(n: GestaoNivel | null | undefined) {
  return n === "edit" || n === "full";
}

// ── Roster + concessão de acesso (base da Fase 4) ───────────────────────────
export interface GestaoMembro {
  id: string;
  usuario_email: string;
  papel: GestaoPapel;
  ativo: boolean;
  adicionado_por: string | null;
  created_at: string;
}

export function useGestaoMembros() {
  return useQuery({
    queryKey: ["gestao-membros"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_membros").select("*").order("papel").order("usuario_email");
      if (error) throw error;
      return (data ?? []) as unknown as GestaoMembro[];
    },
  });
}

/** Usuários internos (não-Cliente) para o seletor de adicionar membro. */
export function useUsuariosParaMembro() {
  return useQuery({
    queryKey: ["gestao-usuarios-membro"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("usuarios")
        .select("email, nome, perfil")
        .neq("perfil", "Cliente")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as { email: string; nome: string; perfil: string }[];
    },
  });
}

/** Gere o roster (adicionar/remover/mudar papel) — passa por gestao_definir_membro (log + motivo). */
export function useDefinirMembro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { alvo: string; papel: GestaoPapel; ativo: boolean; motivo: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await (sb as unknown as GestaoRpc).rpc("gestao_definir_membro", {
        p_alvo: p.alvo, p_papel: p.papel, p_ativo: p.ativo, p_motivo: p.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gestao-membros"] });
      qc.invalidateQueries({ queryKey: ["gestao-meu-papel"] });
      toast.success("Roster atualizado");
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível atualizar o membro.")),
  });
}

/** Concede/revoga acesso a um recurso — passa por gestao_alterar_acesso (log + motivo). */
export function useAlterarAcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { alvo: string; acao: GestaoAcaoAcesso; recursoTipo: GestaoRecurso; recursoId: string; nivel: GestaoNivel; motivo: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await (sb as unknown as GestaoRpc).rpc("gestao_alterar_acesso", {
        p_alvo: p.alvo, p_acao: p.acao, p_recurso_tipo: p.recursoTipo, p_recurso_id: p.recursoId, p_nivel_novo: p.nivel, p_motivo: p.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gestao-meu-nivel"] });
      // O RPC (v118) espelha id_quadro/papel → atualiza o modal e o podeEditar do cliente.
      qc.invalidateQueries({ queryKey: ["gestao-acessos"] });
      qc.invalidateQueries({ queryKey: ["gestao-meus-acessos"] });
      toast.success("Acesso atualizado");
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível alterar o acesso.")),
  });
}
