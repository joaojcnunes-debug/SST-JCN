"use client";

import { useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Meu nível em VÁRIOS quadros de uma vez (Map id_quadro → nível|null). Mesma queryKey do
 *  useMeuNivel("list", id) — compartilha o cache. Usado pela vista agregada (Meu Espaço), que
 *  mistura tarefas de quadros diferentes e precisa saber onde o usuário pode editar. */
export function useMeusNiveisQuadros(ids: string[], enabled = true) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["gestao-meu-nivel", "list", id],
      enabled: enabled && !!id,
      staleTime: 60 * 1000,
      queryFn: async () => {
        const sb = createSupabaseBrowserClient();
        const { data, error } = await (sb as unknown as GestaoRpc).rpc("gestao_meu_nivel", { p_recurso_tipo: "list", p_recurso_id: id });
        if (error) throw error;
        return (data ?? null) as GestaoNivel | null;
      },
    })),
  });
  return useMemo(() => {
    const m = new Map<string, GestaoNivel | null>();
    results.forEach((r, i) => m.set(ids[i], r.data ?? null));
    return m;
  }, [results, ids]);
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

// ── Equipes, Meu Quadro e Colaboradores (v235 / GESTAO-EQUIPES-01) ─────────────
export type PapelEquipe = "membro" | "supervisor";
export interface GestaoEquipe { id: string; nome: string; descricao: string | null; ativo: boolean; created_by: string | null; created_at: string }
export interface GestaoEquipeMembro { id: string; id_equipe: string; usuario_email: string; papel: PapelEquipe; created_at: string }
export interface Colaborador { usuario_email: string; nome: string | null; id_quadro: string | null; equipes: string[]; papel_gestao: string | null }

/** Equipes (RLS: qualquer membro do módulo lê). */
export function useEquipes() {
  return useQuery({
    queryKey: ["gestao-equipes"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_equipes").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as GestaoEquipe[];
    },
  });
}

/** Membros de TODAS as equipes (filtra no cliente por id_equipe). */
export function useEquipeMembros() {
  return useQuery({
    queryKey: ["gestao-equipe-membros"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_equipe_membros").select("*").order("usuario_email");
      if (error) throw error;
      return (data ?? []) as unknown as GestaoEquipeMembro[];
    },
  });
}

function invalidarEquipes(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["gestao-equipes"] });
  qc.invalidateQueries({ queryKey: ["gestao-equipe-membros"] });
  qc.invalidateQueries({ queryKey: ["gestao-membros"] });
  qc.invalidateQueries({ queryKey: ["gestao-acessos"] });
  qc.invalidateQueries({ queryKey: ["gestao-meu-nivel"] });
  qc.invalidateQueries({ queryKey: ["gestao-meu-papel"] });
  qc.invalidateQueries({ queryKey: ["gestao-colaboradores"] });
  qc.invalidateQueries({ queryKey: ["gestao-quadros"] });
}

export function useSalvarEquipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id?: string | null; nome: string; descricao?: string | null; ativo?: boolean }) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await (sb as unknown as GestaoRpc).rpc<string>("gestao_equipe_salvar", {
        p_id: p.id ?? null, p_nome: p.nome, p_descricao: p.descricao ?? null, p_ativo: p.ativo ?? true,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidarEquipes(qc); toast.success("Equipe salva"); },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar a equipe.")),
  });
}

export function useExcluirEquipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await (sb as unknown as GestaoRpc).rpc("gestao_equipe_excluir", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidarEquipes(qc); toast.success("Equipe excluída"); },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir a equipe.")),
  });
}

/** Entrar/sair/mudar papel na equipe (gestor). Entrar já libera o módulo (roster). */
export function useDefinirMembroEquipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_equipe: string; email: string; papel: PapelEquipe; ativo: boolean }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await (sb as unknown as GestaoRpc).rpc("gestao_equipe_definir_membro", {
        p_id_equipe: p.id_equipe, p_email: p.email, p_papel: p.papel, p_ativo: p.ativo,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarEquipes(qc),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível alterar o membro da equipe.")),
  });
}

/** Grant de recurso para a equipe (nivel null = revoga). Exige motivo (≥5). */
export function useAlterarAcessoEquipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_equipe: string; recursoTipo: GestaoRecurso; recursoId: string; nivel: GestaoNivel | null; motivo: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await (sb as unknown as GestaoRpc).rpc("gestao_equipe_alterar_acesso", {
        p_id_equipe: p.id_equipe, p_recurso_tipo: p.recursoTipo, p_recurso_id: p.recursoId, p_nivel: p.nivel, p_motivo: p.motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarEquipes(qc),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível alterar o acesso da equipe.")),
  });
}

/** Meu Quadro do usuário logado (criado sob demanda pelo servidor). */
export function useMeuQuadro(enabled = true) {
  return useQuery({
    queryKey: ["gestao-meu-quadro"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await (sb as unknown as GestaoRpc).rpc<string>("gestao_meu_quadro");
      if (error) throw error;
      return (data ?? null) as string | null;
    },
  });
}

/** Meu Quadro de OUTRO usuário (gestor/supervisor) — cria sob demanda; devolve o id do quadro. */
export function useAbrirQuadroPessoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await (sb as unknown as GestaoRpc).rpc<string>("gestao_quadro_pessoal_de", { p_email: email });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-quadros"] }); qc.invalidateQueries({ queryKey: ["gestao-colaboradores"] }); },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível abrir o quadro do colaborador.")),
  });
}

/** Colaboradores visíveis (gestor: todos; supervisor: os das equipes dele; demais: vazio). */
export function useColaboradores(enabled = true) {
  return useQuery({
    queryKey: ["gestao-colaboradores"],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await (sb as unknown as GestaoRpc).rpc<Colaborador[]>("gestao_colaboradores_visiveis");
      if (error) throw error;
      return (data ?? []) as Colaborador[];
    },
  });
}
