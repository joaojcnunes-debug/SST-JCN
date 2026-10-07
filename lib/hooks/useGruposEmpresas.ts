"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type { EmpresaGrupo, MembroGrupo, PapelGrupo } from "@/lib/supabase/types";

/**
 * Grupos de empresas (v278). Duas leituras pequenas, em cache por toda a sessão:
 *  • `empresa_grupos` — os grupos (nome, descrição);
 *  • `empresa_grupos_membros()` — quem está em cada grupo, de TODAS as unidades
 *    (`visivel = false` = empresa de outra unidade: mostra o nome, sem acesso).
 */
export const CHAVE_GRUPOS = ["empresa-grupos"] as const;

export interface InfoGrupoDaEmpresa {
  id_grupo: string;
  nome: string;
  papel: PapelGrupo;
}

export function useGruposEmpresas() {
  const q = useQuery({
    queryKey: CHAVE_GRUPOS,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const [g, m] = await Promise.all([
        sb.from("empresa_grupos" as never).select("*").order("nome"),
        sb.rpc("empresa_grupos_membros" as never),
      ]);
      if (g.error) throw g.error;
      if (m.error) throw m.error;
      return {
        grupos: (g.data ?? []) as unknown as EmpresaGrupo[],
        membros: (m.data ?? []) as unknown as MembroGrupo[],
      };
    },
  });

  const grupos = useMemo(() => q.data?.grupos ?? [], [q.data]);
  const membros = useMemo(() => q.data?.membros ?? [], [q.data]);

  const porEmpresa = useMemo(() => {
    const nomes = new Map(grupos.map((g) => [g.id_grupo, g.nome]));
    const m = new Map<string, InfoGrupoDaEmpresa>();
    for (const x of membros) {
      m.set(x.id_empresa, { id_grupo: x.id_grupo, nome: nomes.get(x.id_grupo) ?? "", papel: x.papel_grupo });
    }
    return m;
  }, [grupos, membros]);

  const membrosPorGrupo = useMemo(() => {
    const m = new Map<string, MembroGrupo[]>();
    for (const x of membros) {
      const l = m.get(x.id_grupo) ?? [];
      l.push(x);
      m.set(x.id_grupo, l);
    }
    return m;
  }, [membros]);

  /** Nome do grupo da empresa — para somar à busca por texto de qualquer lista. */
  const nomeGrupoDe = useCallback(
    (idEmpresa: string | null | undefined) => (idEmpresa ? porEmpresa.get(idEmpresa)?.nome : undefined),
    [porEmpresa],
  );

  return { ...q, grupos, membros, porEmpresa, membrosPorGrupo, nomeGrupoDe };
}

function useInvalidarGrupos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: CHAVE_GRUPOS });
    qc.invalidateQueries({ queryKey: ["empresas"] });
    qc.invalidateQueries({ queryKey: ["empresa"] });
  };
}

/** Traduz o erro do banco para a pessoa. */
export function mensagemErroGrupo(e: { message?: string; code?: string }): string {
  const msg = e.message ?? "";
  if (msg.includes("ux_empresa_grupos_nome")) return "Já existe um grupo com esse nome.";
  if (msg.includes("ux_empresas_matriz_por_grupo")) return "Este grupo já tem uma matriz.";
  if (e.code === "42501" || msg.includes("row-level security")) return "Você não tem permissão para isso.";
  return msg || "Não foi possível salvar.";
}

export function useCriarGrupo() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: async (p: { nome: string; descricao?: string | null }) => {
      const id_grupo = gerarId("GRP");
      const { error } = await createSupabaseBrowserClient()
        .from("empresa_grupos" as never)
        .insert({ id_grupo, nome: p.nome.trim(), descricao: p.descricao?.trim() || null } as never);
      if (error) throw error;
      return id_grupo;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(mensagemErroGrupo(e)),
  });
}

export function useEditarGrupo() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: async (p: { id_grupo: string; nome: string; descricao?: string | null }) => {
      const { error } = await createSupabaseBrowserClient()
        .from("empresa_grupos" as never)
        .update({ nome: p.nome.trim(), descricao: p.descricao?.trim() || null, updated_at: new Date().toISOString() } as never)
        .eq("id_grupo", p.id_grupo);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(mensagemErroGrupo(e)),
  });
}

export function useExcluirGrupo() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: async (id_grupo: string) => {
      const { error } = await createSupabaseBrowserClient().rpc(
        "empresa_grupo_excluir" as never,
        { p_id_grupo: id_grupo } as never,
      );
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(mensagemErroGrupo(e)),
  });
}

/** Põe a empresa no grupo (ou tira, com `id_grupo: null`). */
export async function gravarGrupoDaEmpresa(p: {
  id_empresa: string;
  id_grupo: string | null;
  papel: PapelGrupo | null;
  /** Matriz atual do grupo (outra empresa), se houver — vira filial na troca. */
  matrizAtual?: string | null;
}) {
  const sb = createSupabaseBrowserClient();
  if (!p.id_grupo) {
    const { data, error } = await sb
      .from("empresas")
      .update({ id_grupo: null, papel_grupo: null } as never)
      .eq("id_empresa", p.id_empresa)
      .select("id_empresa");
    if (error) throw error;
    if (!data?.length) throw new Error("Você não tem permissão para editar esta empresa.");
    return;
  }
  // Trocar a matriz: entra como filial e a função promove (rebaixando a antiga),
  // senão o índice "uma matriz por grupo" recusa a gravação.
  const trocaMatriz = p.papel === "MATRIZ" && !!p.matrizAtual && p.matrizAtual !== p.id_empresa;
  const { data, error } = await sb
    .from("empresas")
    .update({ id_grupo: p.id_grupo, papel_grupo: trocaMatriz ? "FILIAL" : p.papel } as never)
    .eq("id_empresa", p.id_empresa)
    .select("id_empresa");
  if (error) throw error;
  if (!data?.length) throw new Error("Você não tem permissão para editar esta empresa.");
  if (trocaMatriz) {
    const { error: e2 } = await sb.rpc(
      "empresa_grupo_definir_matriz" as never,
      { p_id_grupo: p.id_grupo, p_id_empresa: p.id_empresa } as never,
    );
    if (e2) throw e2;
  }
}

/**
 * Põe várias empresas no grupo de uma vez (sugestão pelo CNPJ): 1 gravação
 * para a matriz e 1 para todas as filiais. Só para grupo NOVO (sem matriz).
 */
export async function gravarGrupoEmLote(p: { id_grupo: string; matriz: string | null; filiais: string[] }) {
  const sb = createSupabaseBrowserClient();
  if (p.matriz) {
    const { error } = await sb
      .from("empresas")
      .update({ id_grupo: p.id_grupo, papel_grupo: "MATRIZ" } as never)
      .eq("id_empresa", p.matriz);
    if (error) throw error;
  }
  if (p.filiais.length) {
    const { error } = await sb
      .from("empresas")
      .update({ id_grupo: p.id_grupo, papel_grupo: "FILIAL" } as never)
      .in("id_empresa", p.filiais);
    if (error) throw error;
  }
}

export function useGravarGrupoDaEmpresa() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: gravarGrupoDaEmpresa,
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(mensagemErroGrupo(e)),
  });
}

export function useDefinirMatriz() {
  const invalidar = useInvalidarGrupos();
  return useMutation({
    mutationFn: async (p: { id_grupo: string; id_empresa: string }) => {
      const { error } = await createSupabaseBrowserClient().rpc(
        "empresa_grupo_definir_matriz" as never,
        { p_id_grupo: p.id_grupo, p_id_empresa: p.id_empresa } as never,
      );
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(mensagemErroGrupo(e)),
  });
}
