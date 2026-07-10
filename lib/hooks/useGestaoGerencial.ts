"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface GGCategoria { id: string; nome: string; ordem: number; ativo: boolean; id_unidade: string }
export interface GGTurno { id: string; nome: string; ordem: number; ativo: boolean; id_unidade: string }
export interface GGProfissional { id: string; nome: string; ativo: boolean }
export interface GGVinculo {
  id: string; id_profissional: string; id_unidade: string; id_categoria: string | null;
  profissional: { nome: string; ativo: boolean } | null;
  categoria: { nome: string } | null;
}
export type EscalaTipo = "trabalha" | "disponivel";
export interface GGEscala { id: string; id_profissional: string; id_unidade: string; dia_semana: number; id_turno: string; tipo: EscalaTipo }

// A RPC nova (gg_sugerir_substitutos) ainda não está nos tipos gerados → cast tipado.
type GGRpc = {
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<{ data: T; error: { message: string } | null }>;
};

export const DIAS_SEMANA = [
  { n: 1, label: "Seg" }, { n: 2, label: "Ter" }, { n: 3, label: "Qua" },
  { n: 4, label: "Qui" }, { n: 5, label: "Sex" }, { n: 6, label: "Sáb" }, { n: 7, label: "Dom" },
] as const;

// ── Categorias (por unidade) ─────────────────────────────────────────────────
export function useGGCategorias(idUnidade: string | null | undefined) {
  return useQuery({
    queryKey: ["gg-categorias", idUnidade],
    enabled: !!idUnidade,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gg_categorias").select("*").eq("id_unidade", idUnidade!).order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as GGCategoria[];
    },
  });
}
export function useGGTurnos(idUnidade: string | null | undefined) {
  return useQuery({
    queryKey: ["gg-turnos", idUnidade],
    enabled: !!idUnidade,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gg_turnos").select("*").eq("id_unidade", idUnidade!).order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as GGTurno[];
    },
  });
}

/** CRUD genérico para as tabelas de config (categorias/turnos), ambas com o mesmo shape. */
function useConfigCrud(tabela: "gg_categorias" | "gg_turnos", prefixo: string, chaveQuery: string) {
  const qc = useQueryClient();
  const inval = (idUnidade: string) => qc.invalidateQueries({ queryKey: [chaveQuery, idUnidade] });
  const criar = useMutation({
    mutationFn: async (p: { id_unidade: string; nome: string; ordem: number }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from(tabela).insert({ id: gerarId(prefixo), nome: p.nome.trim(), ordem: p.ordem, id_unidade: p.id_unidade } as never);
      if (error) throw error;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  const atualizar = useMutation({
    mutationFn: async (p: { id: string; id_unidade: string; nome?: string; ativo?: boolean }) => {
      const sb = createSupabaseBrowserClient();
      const patch: Record<string, unknown> = {};
      if (p.nome !== undefined) patch.nome = p.nome.trim();
      if (p.ativo !== undefined) patch.ativo = p.ativo;
      const { error } = await sb.from(tabela).update(patch as never).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  const excluir = useMutation({
    mutationFn: async (p: { id: string; id_unidade: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from(tabela).delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  return { criar, atualizar, excluir };
}
export const useCategoriaCrud = () => useConfigCrud("gg_categorias", "CAT", "gg-categorias");
export const useTurnoCrud = () => useConfigCrud("gg_turnos", "TRN", "gg-turnos");

// ── Profissionais (compartilhados) + vínculo por unidade ─────────────────────
/** Equipe da unidade: vínculos + nome do profissional + nome da categoria. */
export function useGGEquipe(idUnidade: string | null | undefined) {
  return useQuery({
    queryKey: ["gg-equipe", idUnidade],
    enabled: !!idUnidade,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gg_profissional_unidades")
        .select("id, id_profissional, id_unidade, id_categoria, profissional:gg_profissionais(nome, ativo), categoria:gg_categorias(nome)")
        .eq("id_unidade", idUnidade!);
      if (error) throw error;
      const rows = (data ?? []) as unknown as GGVinculo[];
      return rows.sort((a, b) => (a.profissional?.nome ?? "").localeCompare(b.profissional?.nome ?? ""));
    },
  });
}

/** Todos os profissionais do sistema (para vincular um existente). */
export function useTodosProfissionais() {
  return useQuery({
    queryKey: ["gg-profissionais-todos"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gg_profissionais").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as GGProfissional[];
    },
  });
}

export function useGGProfissionalMut() {
  const qc = useQueryClient();
  const inval = (idUnidade: string) => {
    qc.invalidateQueries({ queryKey: ["gg-equipe", idUnidade] });
    qc.invalidateQueries({ queryKey: ["gg-profissionais-todos"] });
  };
  // cria um profissional novo e já vincula à unidade com a categoria
  const criarEVincular = useMutation({
    mutationFn: async (p: { nome: string; id_unidade: string; id_categoria: string }) => {
      const sb = createSupabaseBrowserClient();
      const idProf = gerarId("PROF");
      const { error: e1 } = await sb.from("gg_profissionais").insert({ id: idProf, nome: p.nome.trim() } as never);
      if (e1) throw e1;
      const { error: e2 } = await sb.from("gg_profissional_unidades").insert({ id: gerarId("PU"), id_profissional: idProf, id_unidade: p.id_unidade, id_categoria: p.id_categoria } as never);
      if (e2) throw e2;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  // vincula um profissional existente a esta unidade
  const vincular = useMutation({
    mutationFn: async (p: { id_profissional: string; id_unidade: string; id_categoria: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gg_profissional_unidades").insert({ id: gerarId("PU"), id_profissional: p.id_profissional, id_unidade: p.id_unidade, id_categoria: p.id_categoria } as never);
      if (error) throw error;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e).includes("duplicate") ? "Profissional já está nesta unidade." : mensagemErro(e)),
  });
  // muda a categoria do profissional NESTA unidade
  const setCategoria = useMutation({
    mutationFn: async (p: { id_vinculo: string; id_unidade: string; id_categoria: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gg_profissional_unidades").update({ id_categoria: p.id_categoria } as never).eq("id", p.id_vinculo);
      if (error) throw error;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  // renomeia / ativa-desativa o profissional (global)
  const atualizarProf = useMutation({
    mutationFn: async (p: { id: string; id_unidade: string; nome?: string; ativo?: boolean }) => {
      const sb = createSupabaseBrowserClient();
      const patch: Record<string, unknown> = {};
      if (p.nome !== undefined) patch.nome = p.nome.trim();
      if (p.ativo !== undefined) patch.ativo = p.ativo;
      const { error } = await sb.from("gg_profissionais").update(patch as never).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  // remove o profissional DESTA unidade (desfaz o vínculo)
  const desvincular = useMutation({
    mutationFn: async (p: { id_vinculo: string; id_unidade: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gg_profissional_unidades").delete().eq("id", p.id_vinculo);
      if (error) throw error;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  return { criarEVincular, vincular, setCategoria, atualizarProf, desvincular };
}

// ── Escala padrão (por unidade) ──────────────────────────────────────────────
export function useGGEscala(idUnidade: string | null | undefined) {
  return useQuery({
    queryKey: ["gg-escala", idUnidade],
    enabled: !!idUnidade,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gg_escala_padrao").select("*").eq("id_unidade", idUnidade!);
      if (error) throw error;
      return (data ?? []) as unknown as GGEscala[];
    },
  });
}

/**
 * Ciclo tri-estado de uma célula da escala ao clicar:
 *   vazio → 'trabalha' (Atua) → 'disponivel' (Disponível p/ substituir) → vazio.
 * `atual`/`id_existente` descrevem o estado atual da célula.
 */
export function useCicloEscala() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_profissional: string; id_unidade: string; dia_semana: number; id_turno: string; atual: EscalaTipo | null; id_existente?: string }) => {
      const sb = createSupabaseBrowserClient();
      if (p.atual === null) {
        const { error } = await sb.from("gg_escala_padrao").insert({ id: gerarId("ESC"), id_profissional: p.id_profissional, id_unidade: p.id_unidade, dia_semana: p.dia_semana, id_turno: p.id_turno, tipo: "trabalha" } as never);
        if (error) throw error;
      } else if (p.atual === "trabalha" && p.id_existente) {
        const { error } = await sb.from("gg_escala_padrao").update({ tipo: "disponivel" } as never).eq("id", p.id_existente);
        if (error) throw error;
      } else if (p.id_existente) {
        const { error } = await sb.from("gg_escala_padrao").delete().eq("id", p.id_existente);
        if (error) throw error;
      }
    },
    // mudar quem atua/está disponível afeta as sugestões → invalida também substituições e projeção
    onSuccess: (_d, p) => {
      qc.invalidateQueries({ queryKey: ["gg-escala", p.id_unidade] });
      qc.invalidateQueries({ queryKey: ["gg-substituicoes", p.id_unidade] });
      qc.invalidateQueries({ queryKey: ["gg-projecao", p.id_unidade] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ── Ausências (por profissional; exibidas no escopo da unidade) ──────────────
export const TIPOS_AUSENCIA = [
  { v: "folga", label: "Folga" },
  { v: "ferias", label: "Férias" },
  { v: "atestado", label: "Atestado" },
  { v: "falta", label: "Falta" },
  { v: "in_loco", label: "Atend. in loco" },
] as const;
export type TipoAusencia = (typeof TIPOS_AUSENCIA)[number]["v"];
export const rotuloTipoAusencia = (v: string) => TIPOS_AUSENCIA.find((t) => t.v === v)?.label ?? v;

export interface GGAusencia {
  id: string; id_profissional: string; tipo: string;
  data_inicio: string; data_fim: string; obs: string | null;
  profissional: { nome: string } | null;
}

/** Ausências dos profissionais vinculados a ESTA unidade (mais recentes primeiro). */
export function useGGAusencias(idUnidade: string | null | undefined) {
  return useQuery({
    queryKey: ["gg-ausencias", idUnidade],
    enabled: !!idUnidade,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data: vincs, error: e1 } = await sb
        .from("gg_profissional_unidades").select("id_profissional").eq("id_unidade", idUnidade!);
      if (e1) throw e1;
      const ids = Array.from(new Set((vincs ?? []).map((v: { id_profissional: string }) => v.id_profissional)));
      if (ids.length === 0) return [] as GGAusencia[];
      const { data, error } = await sb
        .from("gg_ausencias")
        .select("id, id_profissional, tipo, data_inicio, data_fim, obs, profissional:gg_profissionais(nome)")
        .in("id_profissional", ids)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as GGAusencia[];
    },
  });
}

export function useGGAusenciaMut() {
  const qc = useQueryClient();
  const inval = (idUnidade: string) => {
    qc.invalidateQueries({ queryKey: ["gg-ausencias", idUnidade] });
    qc.invalidateQueries({ queryKey: ["gg-substituicoes", idUnidade] });
    qc.invalidateQueries({ queryKey: ["gg-projecao", idUnidade] });
  };
  const criar = useMutation({
    mutationFn: async (p: { id_unidade: string; id_profissional: string; tipo: string; data_inicio: string; data_fim: string; obs?: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gg_ausencias").insert({
        id: gerarId("AUS"), id_profissional: p.id_profissional, tipo: p.tipo,
        data_inicio: p.data_inicio, data_fim: p.data_fim, obs: p.obs?.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  const excluir = useMutation({
    mutationFn: async (p: { id: string; id_unidade: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gg_ausencias").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  return { criar, excluir };
}

// ── Verificação de substituição (RPC v124) ───────────────────────────────────
export interface GGSubstituicaoRow {
  id_turno: string; turno_nome: string;
  id_categoria: string | null; categoria_nome: string | null;
  id_ausente: string; ausente_nome: string; tipo_ausencia: string;
  id_substituto: string | null; substituto_nome: string | null;
}

/** Para uma unidade e uma data, retorna slots descobertos + substitutos sugeridos. */
export function useGGSubstituicoes(idUnidade: string | null | undefined, data: string | null | undefined) {
  return useQuery({
    queryKey: ["gg-substituicoes", idUnidade, data],
    enabled: !!idUnidade && !!data,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient() as unknown as GGRpc;
      const { data: rows, error } = await sb.rpc<GGSubstituicaoRow[]>("gg_sugerir_substitutos", {
        p_id_unidade: idUnidade!, p_data: data!,
      });
      if (error) throw new Error(error.message);
      return rows ?? [];
    },
  });
}

export interface GGProjecaoRow extends GGSubstituicaoRow { data: string }

/** Projeção mensal: para cada dia do mês, slots descobertos + substitutos sugeridos. */
export function useGGProjecaoMensal(idUnidade: string | null | undefined, ano: number, mes: number) {
  return useQuery({
    queryKey: ["gg-projecao", idUnidade, ano, mes],
    enabled: !!idUnidade && ano > 0 && mes >= 1 && mes <= 12,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient() as unknown as GGRpc;
      const { data: rows, error } = await sb.rpc<GGProjecaoRow[]>("gg_projecao_mensal", {
        p_id_unidade: idUnidade!, p_ano: ano, p_mes: mes,
      });
      if (error) throw new Error(error.message);
      return rows ?? [];
    },
  });
}

// ── Substituições ESCOLHIDAS (decisão persistida) ────────────────────────────
export interface GGSubSalva {
  id: string; id_unidade: string; data: string;
  id_turno: string; id_ausente: string; id_substituto: string;
  substituto: { nome: string } | null;
}
/** Chave de um slot (data+turno+ausente) para casar sugestão × escolha salva. */
export const chaveSlot = (data: string, idTurno: string, idAusente: string) => `${data}|${idTurno}|${idAusente}`;

/** Substituições já escolhidas na unidade dentro de um intervalo de datas. */
export function useGGSubsSalvas(idUnidade: string | null | undefined, dataIni: string, dataFim: string) {
  return useQuery({
    queryKey: ["gg-subs-salvas", idUnidade, dataIni, dataFim],
    enabled: !!idUnidade && !!dataIni && !!dataFim,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gg_substituicoes")
        .select("id, id_unidade, data, id_turno, id_ausente, id_substituto, substituto:gg_profissionais!gg_substituicoes_id_substituto_fkey(nome)")
        .eq("id_unidade", idUnidade!)
        .gte("data", dataIni)
        .lte("data", dataFim);
      if (error) throw error;
      return (data ?? []) as unknown as GGSubSalva[];
    },
  });
}

export function useGGSubstituicaoMut() {
  const qc = useQueryClient();
  const inval = (idUnidade: string) => qc.invalidateQueries({ queryKey: ["gg-subs-salvas", idUnidade] });
  // define/troca o substituto de um slot (um por slot: apaga o anterior e grava o novo)
  const setSub = useMutation({
    mutationFn: async (p: { id_unidade: string; data: string; id_turno: string; id_ausente: string; id_substituto: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error: e1 } = await sb.from("gg_substituicoes").delete()
        .eq("id_unidade", p.id_unidade).eq("data", p.data).eq("id_turno", p.id_turno).eq("id_ausente", p.id_ausente);
      if (e1) throw e1;
      const { error: e2 } = await sb.from("gg_substituicoes").insert({
        id: gerarId("SUB"), id_unidade: p.id_unidade, data: p.data,
        id_turno: p.id_turno, id_ausente: p.id_ausente, id_substituto: p.id_substituto,
      } as never);
      if (e2) throw e2;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  const removerSub = useMutation({
    mutationFn: async (p: { id_unidade: string; data: string; id_turno: string; id_ausente: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gg_substituicoes").delete()
        .eq("id_unidade", p.id_unidade).eq("data", p.data).eq("id_turno", p.id_turno).eq("id_ausente", p.id_ausente);
      if (error) throw error;
    },
    onSuccess: (_d, p) => inval(p.id_unidade),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
  return { setSub, removerSub };
}
