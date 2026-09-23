"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { mensagemErro } from "@/lib/errors";
import { useUserStore } from "@/lib/store";

/** Slug de status. Os 4 defaults existem em todo quadro; quadros podem ter status customizados. */
export type StatusTarefa = string;
export type TipoStatus = "nao_iniciado" | "ativo" | "concluido";
export type VistaGestao = "quadro" | "lista" | "calendario" | "timeline";
export type AgruparPor = "status" | "responsavel" | "prioridade" | "etiqueta";
export type PrioridadeTarefa = "Baixa" | "Media" | "Alta" | "Urgente";

export interface GestaoEspaco {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export interface GestaoPasta {
  id: string;
  id_espaco: string;
  nome: string;
  ordem: number;
}

export interface GestaoQuadro {
  id_quadro: string;
  nome: string;
  descricao: string | null;
  id_espaco: string | null;
  id_pasta: string | null;
  ordem: number;
  ics_token: string | null;
  restrito: boolean;
  /** v235: quadro pessoal ("Meu Quadro") do usuário — sem espaço/pasta; vive em Meu Espaço/Colaboradores. */
  dono_email?: string | null;
}

export interface GestaoStatus {
  id: string;
  id_quadro: string;
  slug: string;
  nome: string;
  cor: string;
  ordem: number;
  tipo: TipoStatus;
}

export interface Subtarefa {
  texto: string;
  feito: boolean;
  responsavel_email: string | null;
}

export type TipoVinculo = "responsavel" | "seguidor";

export interface GestaoVinculado {
  id: string;
  id_tarefa: string;
  usuario_email: string;
  tipo: TipoVinculo;
  origem: string;
  created_at: string;
}

export interface Recorrencia {
  tipo: "diaria" | "semanal" | "mensal";
  intervalo: number;
  proxima_geracao: string; // YYYY-MM-DD
}

export type TipoCampo = "texto" | "numero" | "data" | "selecao" | "multi" | "checkbox" | "moeda" | "url";

export interface GestaoCampo {
  id: string;
  id_quadro: string;
  nome: string;
  tipo: TipoCampo;
  opcoes: string[];
  ordem: number;
  visivel_cliente: boolean;
}

export interface GestaoTarefa {
  id_tarefa: string;
  id_quadro: string;
  titulo: string;
  descricao: string | null;
  status: StatusTarefa;
  prioridade: PrioridadeTarefa;
  responsavel: string | null;
  prazo: string | null;
  data_inicio: string | null;
  ordem: number;
  etiquetas: string[];
  subtarefas: Subtarefa[];
  campos: Record<string, unknown>;
  recorrencia: Recorrencia | null;
  pontos: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export const STATUS_TAREFA: { value: StatusTarefa; label: string; cor: string }[] = [
  { value: "A_FAZER", label: "A fazer", cor: "#94a3b8" },
  { value: "EM_ANDAMENTO", label: "Em andamento", cor: "#f59e0b" },
  { value: "EM_REVISAO", label: "Em revisão", cor: "#6366f1" },
  { value: "CONCLUIDO", label: "Concluído", cor: "#16a34a" },
];

/** Iniciais (1-2 letras) de um nome, para avatar. */
export function iniciais(nome: string): string {
  const p = (nome ?? "").trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

const AVATAR_CORES = ["#0ea5e9", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#14b8a6", "#f97316", "#0d9488"];

/** Cor determinística por nome (avatar). */
export function corAvatar(nome: string): string {
  let h = 0;
  for (let i = 0; i < (nome ?? "").length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return AVATAR_CORES[h % AVATAR_CORES.length];
}

export const PRIORIDADES: { value: PrioridadeTarefa; label: string; cor: string }[] = [
  { value: "Baixa", label: "Baixa", cor: "#16a34a" },
  { value: "Media", label: "Média", cor: "#f59e0b" },
  { value: "Alta", label: "Alta", cor: "#ea580c" },
  { value: "Urgente", label: "Urgente", cor: "#dc2626" },
];

export function useQuadroPadrao() {
  return useQuery({
    queryKey: ["gestao-quadro-padrao"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_quadros")
        .select("id_quadro,nome,descricao,id_espaco,id_pasta,ordem")
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as GestaoQuadro | null;
    },
  });
}

export function useQuadros() {
  return useQuery({
    queryKey: ["gestao-quadros"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_quadros")
        .select("id_quadro,nome,descricao,id_espaco,id_pasta,ordem")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoQuadro[];
    },
  });
}

export function useCriarQuadro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { nome: string; id_espaco: string | null; id_pasta: string | null; ordem?: number }) => {
      const sb = createSupabaseBrowserClient();
      const id = gerarId("QDR");
      const { error } = await sb.from("gestao_quadros").insert({
        id_quadro: id,
        nome: p.nome.trim() || "Nova lista",
        id_espaco: p.id_espaco,
        id_pasta: p.id_pasta,
        ordem: p.ordem ?? 0,
        created_at: new Date().toISOString(),
      } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-quadros"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível criar a lista.")),
  });
}

export function useRenomearQuadro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_quadro: string; nome: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_quadros").update({ nome: p.nome.trim() || "Lista", updated_at: new Date().toISOString() } as never).eq("id_quadro", p.id_quadro);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-quadros"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível renomear a lista.")),
  });
}

export function useExcluirQuadro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_quadro: string) => {
      const sb = createSupabaseBrowserClient();
      const { count, error: ce } = await sb.from("gestao_tarefas").select("id_tarefa", { count: "exact", head: true }).eq("id_quadro", id_quadro);
      if (ce) throw ce;
      if ((count ?? 0) > 0) throw new Error(`Há ${count} tarefa(s) nesta lista. Mova ou exclua antes.`);
      const { error } = await sb.from("gestao_quadros").delete().eq("id_quadro", id_quadro);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-quadros"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : mensagemErro(e)),
  });
}

/** Espaços (nível 1 da hierarquia). */
export function useEspacos() {
  return useQuery({
    queryKey: ["gestao-espacos"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_espacos").select("id,nome,cor,ordem").order("ordem", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoEspaco[];
    },
  });
}

export function useSalvarEspaco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: { id?: string; nome?: string; cor?: string; ordem?: number }) => {
      const sb = createSupabaseBrowserClient();
      if (!e.id) {
        const id = crypto.randomUUID();
        const { error } = await sb.from("gestao_espacos").insert({ id, nome: e.nome?.trim() || "Novo espaço", cor: e.cor ?? "#0ea5e9", ordem: e.ordem ?? 0 } as never);
        if (error) throw error;
        return id;
      }
      const patch: Record<string, unknown> = {};
      if (e.nome !== undefined) patch.nome = e.nome.trim() || "Espaço";
      if (e.cor !== undefined) patch.cor = e.cor;
      if (e.ordem !== undefined) patch.ordem = e.ordem;
      const { error } = await sb.from("gestao_espacos").update(patch as never).eq("id", e.id);
      if (error) throw error;
      return e.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-espacos"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar o espaço.")),
  });
}

export function useExcluirEspaco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const [{ count: nPastas }, { count: nQuadros }] = await Promise.all([
        sb.from("gestao_pastas").select("id", { count: "exact", head: true }).eq("id_espaco", id),
        sb.from("gestao_quadros").select("id_quadro", { count: "exact", head: true }).eq("id_espaco", id),
      ]);
      if ((nPastas ?? 0) > 0 || (nQuadros ?? 0) > 0) throw new Error("Esvazie o espaço (pastas e listas) antes de excluir.");
      const { error } = await sb.from("gestao_espacos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-espacos"] }); qc.invalidateQueries({ queryKey: ["gestao-pastas"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : mensagemErro(e)),
  });
}

/** Pastas (nível 2 da hierarquia). */
export function usePastas() {
  return useQuery({
    queryKey: ["gestao-pastas"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_pastas").select("id,id_espaco,nome,ordem").order("ordem", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoPasta[];
    },
  });
}

export function useSalvarPasta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id?: string; id_espaco?: string; nome?: string; ordem?: number }) => {
      const sb = createSupabaseBrowserClient();
      if (!p.id) {
        const id = crypto.randomUUID();
        const { error } = await sb.from("gestao_pastas").insert({ id, id_espaco: p.id_espaco, nome: p.nome?.trim() || "Nova pasta", ordem: p.ordem ?? 0 } as never);
        if (error) throw error;
        return id;
      }
      const patch: Record<string, unknown> = {};
      if (p.nome !== undefined) patch.nome = p.nome.trim() || "Pasta";
      if (p.ordem !== undefined) patch.ordem = p.ordem;
      const { error } = await sb.from("gestao_pastas").update(patch as never).eq("id", p.id);
      if (error) throw error;
      return p.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-pastas"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar a pasta.")),
  });
}

export function useExcluirPasta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { count } = await sb.from("gestao_quadros").select("id_quadro", { count: "exact", head: true }).eq("id_pasta", id);
      if ((count ?? 0) > 0) throw new Error("Mova ou exclua as listas desta pasta antes.");
      const { error } = await sb.from("gestao_pastas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-pastas"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : mensagemErro(e)),
  });
}

/** Fallback: os 4 status default como GestaoStatus (enquanto o quadro carrega seus status). */
export function statusPadrao(idQuadro: string): GestaoStatus[] {
  const tipos: TipoStatus[] = ["nao_iniciado", "ativo", "ativo", "concluido"];
  return STATUS_TAREFA.map((s, i) => ({
    id: s.value, id_quadro: idQuadro, slug: s.value, nome: s.label, cor: s.cor, ordem: i, tipo: tipos[i],
  }));
}

/** Status configuráveis de um quadro (ordenados). */
export function useStatusQuadro(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-status", idQuadro],
    enabled: !!idQuadro,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_status")
        .select("*")
        .eq("id_quadro", idQuadro!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoStatus[];
    },
  });
}

export function useSalvarStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<GestaoStatus> & { id_quadro: string }) => {
      const sb = createSupabaseBrowserClient();
      if (!s.id) {
        const id = crypto.randomUUID();
        const slug = s.slug ?? `S_${id.slice(0, 8).toUpperCase()}`;
        const { error } = await sb.from("gestao_status").insert({
          id, id_quadro: s.id_quadro, slug,
          nome: s.nome ?? "Novo status", cor: s.cor ?? "#94a3b8",
          ordem: s.ordem ?? 0, tipo: s.tipo ?? "ativo",
        } as never);
        if (error) throw error;
        return id;
      }
      // slug não muda no update (tarefas referenciam o slug)
      const patch: Record<string, unknown> = {};
      if (s.nome !== undefined) patch.nome = s.nome;
      if (s.cor !== undefined) patch.cor = s.cor;
      if (s.ordem !== undefined) patch.ordem = s.ordem;
      if (s.tipo !== undefined) patch.tipo = s.tipo;
      const { error } = await sb.from("gestao_status").update(patch as never).eq("id", s.id);
      if (error) throw error;
      return s.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-status"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar o status.")),
  });
}

export function useExcluirStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; id_quadro: string; slug: string }) => {
      const sb = createSupabaseBrowserClient();
      const { count, error: ce } = await sb
        .from("gestao_tarefas")
        .select("id_tarefa", { count: "exact", head: true })
        .eq("id_quadro", p.id_quadro)
        .eq("status", p.slug);
      if (ce) throw ce;
      if ((count ?? 0) > 0) throw new Error(`Há ${count} tarefa(s) neste status. Mova-as antes de excluir.`);
      const { error } = await sb.from("gestao_status").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-status"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : mensagemErro(e)),
  });
}

/** Definições de campos personalizados de um quadro (ordenados). */
export function useCamposQuadro(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-campos", idQuadro],
    enabled: !!idQuadro,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_campos")
        .select("*")
        .eq("id_quadro", idQuadro!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoCampo[];
    },
  });
}

export function useSalvarCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<GestaoCampo> & { id_quadro: string }) => {
      const sb = createSupabaseBrowserClient();
      if (!c.id) {
        const id = crypto.randomUUID();
        const { error } = await sb.from("gestao_campos").insert({
          id, id_quadro: c.id_quadro,
          nome: c.nome ?? "Novo campo", tipo: c.tipo ?? "texto",
          opcoes: c.opcoes ?? [], ordem: c.ordem ?? 0, visivel_cliente: c.visivel_cliente ?? false,
        } as never);
        if (error) throw error;
        return id;
      }
      const patch: Record<string, unknown> = {};
      if (c.nome !== undefined) patch.nome = c.nome;
      if (c.tipo !== undefined) patch.tipo = c.tipo;
      if (c.opcoes !== undefined) patch.opcoes = c.opcoes;
      if (c.ordem !== undefined) patch.ordem = c.ordem;
      if (c.visivel_cliente !== undefined) patch.visivel_cliente = c.visivel_cliente;
      const { error } = await sb.from("gestao_campos").update(patch as never).eq("id", c.id);
      if (error) throw error;
      return c.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-campos"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar o campo.")),
  });
}

export function useExcluirCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_campos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-campos"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir o campo.")),
  });
}

export interface GestaoEtiqueta {
  id: string;
  id_quadro: string;
  nome: string;
  cor: string;
  ordem: number;
}

/** Catálogo de etiquetas (nome + cor) de um quadro. */
export function useEtiquetasQuadro(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-etiquetas", idQuadro],
    enabled: !!idQuadro,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_etiquetas").select("*").eq("id_quadro", idQuadro!).order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoEtiqueta[];
    },
  });
}

export function useSalvarEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: { id?: string; id_quadro: string; nome?: string; cor?: string; ordem?: number }) => {
      const sb = createSupabaseBrowserClient();
      if (!e.id) {
        const { error } = await sb.from("gestao_etiquetas").insert({ id: crypto.randomUUID(), id_quadro: e.id_quadro, nome: e.nome?.trim() || "etiqueta", cor: e.cor ?? "#94a3b8", ordem: e.ordem ?? 0 } as never);
        if (error) throw error;
        return;
      }
      const patch: Record<string, unknown> = {};
      if (e.nome !== undefined) patch.nome = e.nome.trim() || "etiqueta";
      if (e.cor !== undefined) patch.cor = e.cor;
      if (e.ordem !== undefined) patch.ordem = e.ordem;
      const { error } = await sb.from("gestao_etiquetas").update(patch as never).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-etiquetas"] }),
    onError: (e) => toast.error((e as { code?: string }).code === "23505" ? "Já existe uma etiqueta com esse nome." : mensagemErro(e, "Não foi possível salvar a etiqueta.")),
  });
}

export function useExcluirEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_etiquetas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-etiquetas"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir a etiqueta.")),
  });
}

export interface FiltrosGestao {
  responsavel: string;
  prioridades: string[];
  status: string[];
  etiquetas: string[];
  prazo: "" | "atrasadas" | "sem" | "hoje" | "semana";
  semResponsavel: boolean;
}
export const FILTRO_VAZIO: FiltrosGestao = { responsavel: "", prioridades: [], status: [], etiquetas: [], prazo: "", semResponsavel: false };
export function contarFiltros(f: FiltrosGestao): number {
  return (f.responsavel ? 1 : 0) + (f.prioridades.length ? 1 : 0) + (f.status.length ? 1 : 0) + (f.etiquetas.length ? 1 : 0) + (f.prazo ? 1 : 0) + (f.semResponsavel ? 1 : 0);
}

export interface GestaoFiltroSalvo {
  id: string;
  nome: string;
  criterios: FiltrosGestao;
}

export function useFiltrosSalvos(idQuadro: string | null | undefined) {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-filtros", idQuadro, email],
    enabled: !!idQuadro && !!email,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_filtros_salvos").select("id,nome,criterios").eq("usuario_email", email!).eq("id_quadro", idQuadro!).order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoFiltroSalvo[];
    },
  });
}

export function useSalvarFiltro() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (p: { id_quadro: string; nome: string; criterios: FiltrosGestao }) => {
      if (!email) return;
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_filtros_salvos").insert({ id: crypto.randomUUID(), usuario_email: email, id_quadro: p.id_quadro, nome: p.nome.trim() || "Filtro", criterios: p.criterios } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-filtros"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar o filtro.")),
  });
}

export function useExcluirFiltro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_filtros_salvos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-filtros"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir o filtro.")),
  });
}

export interface GestaoDependencia {
  id: string;
  id_tarefa: string;   // depende de…
  depende_de: string;  // …esta
}

export interface DepRef {
  id: string;       // id da linha de dependência (para excluir)
  tarefa: string;   // id da outra tarefa
}

/** Dependências de uma tarefa: "depende de" (pré-requisitos) e "bloqueia" (inverso). */
export function useDependencias(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-dependencias", idTarefa],
    enabled: !!idTarefa,
    queryFn: async (): Promise<{ dependeDe: DepRef[]; bloqueia: DepRef[] }> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_dependencias")
        .select("id,id_tarefa,depende_de")
        .or(`id_tarefa.eq.${idTarefa},depende_de.eq.${idTarefa}`);
      if (error) throw error;
      const rows = (data ?? []) as unknown as GestaoDependencia[];
      return {
        dependeDe: rows.filter((r) => r.id_tarefa === idTarefa).map((r) => ({ id: r.id, tarefa: r.depende_de })),
        bloqueia: rows.filter((r) => r.depende_de === idTarefa).map((r) => ({ id: r.id, tarefa: r.id_tarefa })),
      };
    },
  });
}

/** Todas as dependências (para desenhar setas na Timeline). Carregue só quando a Timeline estiver aberta. */
export function useTodasDependencias(enabled = true) {
  return useQuery({
    queryKey: ["gestao-dependencias-todas"],
    enabled,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_dependencias").select("id,id_tarefa,depende_de");
      if (error) throw error;
      return (data ?? []) as unknown as GestaoDependencia[];
    },
  });
}

export function useAddDependencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; depende_de: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_dependencias").insert({ id: crypto.randomUUID(), id_tarefa: p.id_tarefa, depende_de: p.depende_de } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-dependencias"] }); qc.invalidateQueries({ queryKey: ["gestao-dependencias-todas"] }); },
    onError: (e) => {
      const err = e as { message?: string; code?: string };
      toast.error(err.code === "23505" ? "Essa dependência já existe." : err.message || "Não foi possível adicionar a dependência.");
    },
  });
}

export function useExcluirDependencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_dependencias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-dependencias"] }); qc.invalidateQueries({ queryKey: ["gestao-dependencias-todas"] }); },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível remover a dependência.")),
  });
}

export interface GestaoNotificacao {
  id: string;
  destinatario: string;
  tipo: string;
  titulo: string;
  id_tarefa: string | null;
  id_quadro: string | null;
  lida: boolean;
  created_at: string;
}

/** Usuários internos com nome + email (resolução de responsável → e-mail e menções). */
export function useUsuarios() {
  return useQuery({
    queryKey: ["gestao-usuarios-emails"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("usuarios").select("nome,email").neq("perfil", "Cliente").order("nome", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as { nome: string | null; email: string | null }[])
        .filter((u) => u.nome && u.email)
        .map((u) => ({ nome: u.nome as string, email: u.email as string }));
    },
  });
}

// ---- Vínculos por tarefa (responsável | seguidor por e-mail — v187/F1.2) ----

/** Vínculos de UMA tarefa (para pré-popular o seletor do modal). */
export function useVinculados(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-vinculados", idTarefa],
    enabled: !!idTarefa,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_tarefa_vinculados")
        .select("id,id_tarefa,usuario_email,tipo,origem,created_at")
        .eq("id_tarefa", idTarefa!)
        .order("tipo", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoVinculado[];
    },
  });
}

/** Todos os vínculos de um quadro, agrupados por id_tarefa (uma leitura compartilhada
 *  entre todos os cards via cache do react-query — o card lê o seu recorte por id_tarefa). */
export function useVinculadosQuadro(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-vinculados-quadro", idQuadro],
    enabled: !!idQuadro,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_tarefa_vinculados")
        .select("id,id_tarefa,usuario_email,tipo,origem,created_at,gestao_tarefas!inner(id_quadro)")
        .eq("gestao_tarefas.id_quadro", idQuadro!);
      if (error) throw error;
      const rows = (data ?? []) as unknown as GestaoVinculado[];
      const mapa = new Map<string, GestaoVinculado[]>();
      for (const v of rows) {
        const arr = mapa.get(v.id_tarefa) ?? [];
        arr.push(v);
        mapa.set(v.id_tarefa, arr);
      }
      return mapa;
    },
  });
}

/** Reconcilia os vínculos de uma tarefa: 1 responsável + N seguidores, por e-mail.
 *  Estratégia = DELTA + RPC logado (F1.3-C): lê os vínculos atuais, calcula adicionar
 *  (desejados − atuais) e remover (atuais − desejados) por e-mail+tipo, e chama
 *  gestao_vincular/gestao_desvincular (SECURITY DEFINER, v195) por mudança. O RPC autoriza
 *  (comum só a si; gestor qualquer um), grava a trilha de autoria e mantém o trigger-espelho
 *  v187 refletindo responsavel = usuarios.NOME. O DML direto foi revogado na v196 — não
 *  há mais delete-all+reinsert. E-mails em minúsculas. */
export function useSalvarVinculados() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; responsavelEmail: string | null; seguidoresEmails: string[] }) => {
      const sb = createSupabaseBrowserClient();
      const rpc = (sb as unknown as {
        rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }).rpc;
      const resp = p.responsavelEmail ? p.responsavelEmail.trim().toLowerCase() : null;
      const segs = [...new Set(p.seguidoresEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))].filter((e) => e !== resp);

      // Estado desejado, por chave e-mail+tipo.
      const desejado = new Map<string, { email: string; tipo: TipoVinculo }>();
      if (resp) desejado.set(`${resp}|responsavel`, { email: resp, tipo: "responsavel" });
      for (const e of segs) desejado.set(`${e}|seguidor`, { email: e, tipo: "seguidor" });

      // Estado atual (SELECT direto preservado na v196).
      const { data: atuaisRows, error: selErr } = await sb
        .from("gestao_tarefa_vinculados")
        .select("usuario_email,tipo")
        .eq("id_tarefa", p.id_tarefa);
      if (selErr) throw selErr;
      const atual = new Map<string, { email: string; tipo: TipoVinculo }>();
      for (const r of (atuaisRows ?? []) as unknown as { usuario_email: string; tipo: TipoVinculo }[]) {
        atual.set(`${r.usuario_email}|${r.tipo}`, { email: r.usuario_email, tipo: r.tipo });
      }

      // Delta: remover (atuais − desejados), depois adicionar (desejados − atuais).
      for (const [k, v] of atual) {
        if (!desejado.has(k)) {
          const { error } = await rpc("gestao_desvincular", { p_id_tarefa: p.id_tarefa, p_email: v.email, p_tipo: v.tipo });
          if (error) throw error;
        }
      }
      for (const [k, v] of desejado) {
        if (!atual.has(k)) {
          const { error } = await rpc("gestao_vincular", { p_id_tarefa: p.id_tarefa, p_email: v.email, p_tipo: v.tipo });
          if (error) throw error;
        }
      }
    },
    onSuccess: (_d, p) => {
      qc.invalidateQueries({ queryKey: ["gestao-vinculados", p.id_tarefa] });
      qc.invalidateQueries({ queryKey: ["gestao-vinculados-quadro"] });
      qc.invalidateQueries({ queryKey: ["gestao-minhas"] });
      qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar os vinculados.")),
  });
}

/** E-mails mencionados (@nome ou @primeiroNome) num texto. */
export function detectarMencoes(texto: string, usuarios: { nome: string; email: string }[]): string[] {
  const t = texto.toLowerCase();
  const emails = new Set<string>();
  for (const u of usuarios) {
    const primeiro = u.nome.trim().split(/\s+/)[0]?.toLowerCase();
    if (primeiro && (t.includes("@" + u.nome.toLowerCase()) || t.includes("@" + primeiro))) emails.add(u.email);
  }
  return [...emails];
}

/** Notificações do usuário logado (polling a cada 60s; RLS já filtra ao destinatário). */
export function useNotificacoes() {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-notificacoes", email],
    enabled: !!email,
    refetchInterval: 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_notificacoes").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as GestaoNotificacao[];
    },
  });
}

export function useMarcarLida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id?: string; todas?: boolean }) => {
      const sb = createSupabaseBrowserClient();
      const base = sb.from("gestao_notificacoes").update({ lida: true } as never);
      const { error } = p.id ? await base.eq("id", p.id) : await base.eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-notificacoes"] }),
  });
}

/** Apaga TODAS as notificações do usuário logado (lidas e não lidas). A policy
 *  notif_del (v228) limita ao próprio destinatário; o filtro por e-mail aqui é só
 *  para não emitir DELETE sem predicado. `ilike` sem curinga = igualdade sem caixa,
 *  como o lower() da policy. */
export function useLimparNotificacoes() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async () => {
      if (!email) throw new Error("Sem usuário logado.");
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_notificacoes").delete().ilike("destinatario", email);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-notificacoes"] }),
  });
}

export function useCriarNotificacao() {
  return useMutation({
    mutationFn: async (p: { destinatario: string; tipo: string; titulo: string; id_tarefa?: string | null; id_quadro?: string | null }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_notificacoes").insert({
        id: crypto.randomUUID(),
        destinatario: p.destinatario, tipo: p.tipo, titulo: p.titulo,
        id_tarefa: p.id_tarefa ?? null, id_quadro: p.id_quadro ?? null,
      } as never);
      if (error) throw error;
    },
    // Falha de notificação é silenciosa (não interrompe a ação principal).
  });
}

export interface GestaoTempo {
  id: string;
  id_tarefa: string;
  usuario_email: string;
  inicio: string;
  fim: string | null;
  segundos: number | null;
  manual: boolean;
  descricao: string | null;
  created_at: string;
}

/** "1h 23m" / "12m" / "45s" a partir de segundos. */
export function formatarDuracao(seg: number): string {
  if (!seg || seg < 0) return "0m";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seg}s`;
}

/** Total (em segundos) de uma lista de apontamentos; o que está rodando conta até agora. */
export function totalSegundos(entries: GestaoTempo[], agoraMs = Date.now()): number {
  return entries.reduce((acc, e) => {
    if (e.fim) return acc + (e.segundos ?? 0);
    return acc + Math.max(0, Math.round((agoraMs - new Date(e.inicio).getTime()) / 1000));
  }, 0);
}

async function registrarAtividade(sb: ReturnType<typeof createSupabaseBrowserClient>, ator: string | null, acao: string, idTarefa: string, payload: Record<string, unknown>) {
  await sb.from("gestao_atividades").insert({ id: crypto.randomUUID(), ator, acao, id_tarefa: idTarefa, payload } as never);
}

export interface GestaoAtividade {
  id: string;
  ator: string | null;
  acao: string;
  id_tarefa: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Histórico de atividades de uma tarefa (mais recente primeiro). */
export function useAtividades(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-atividades", idTarefa],
    enabled: !!idTarefa,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_atividades").select("*").eq("id_tarefa", idTarefa!).order("created_at", { ascending: false }).limit(80);
      if (error) throw error;
      return (data ?? []) as unknown as GestaoAtividade[];
    },
  });
}

/** Registra um ou mais eventos no histórico da tarefa (best-effort). */
export function useRegistrarAtividade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; ator: string | null; eventos: { acao: string; payload?: Record<string, unknown> }[] }) => {
      if (!p.eventos.length) return;
      const sb = createSupabaseBrowserClient();
      const rows = p.eventos.map((e) => ({ id: crypto.randomUUID(), ator: p.ator, acao: e.acao, id_tarefa: p.id_tarefa, payload: e.payload ?? {} }));
      const { error } = await sb.from("gestao_atividades").insert(rows as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-atividades"] }),
  });
}

export function useTempoTarefa(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-tempo", idTarefa],
    enabled: !!idTarefa,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_tempo").select("*").eq("id_tarefa", idTarefa!).order("inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoTempo[];
    },
  });
}

/** Apontamentos de tempo de todas as tarefas de um quadro (para chip no card + relatório). */
export function useTempoQuadro(idQuadro: string | null | undefined, taskIds: string[]) {
  return useQuery({
    queryKey: ["gestao-tempo", "quadro", idQuadro, taskIds.length],
    enabled: !!idQuadro && taskIds.length > 0,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_tempo").select("*").in("id_tarefa", taskIds);
      if (error) throw error;
      return (data ?? []) as unknown as GestaoTempo[];
    },
  });
}

/** Apontamento em andamento (fim null) do usuário logado, se houver. */
export function useTimerAtivo() {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-timer-ativo", email],
    enabled: !!email,
    refetchInterval: 30_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_tempo").select("*").eq("usuario_email", email!).is("fim", null).order("inicio", { ascending: false }).limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as GestaoTempo | null;
    },
  });
}

export function useIniciarTempo() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (p: { id_tarefa: string }) => {
      if (!email) throw new Error("Sessão sem e-mail.");
      const sb = createSupabaseBrowserClient();
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      // Para qualquer timer rodando do usuário (um por vez).
      const { data: rodando } = await sb.from("gestao_tempo").select("id,inicio").eq("usuario_email", email).is("fim", null);
      for (const r of (rodando ?? []) as { id: string; inicio: string }[]) {
        const seg = Math.max(1, Math.round((nowMs - new Date(r.inicio).getTime()) / 1000));
        await sb.from("gestao_tempo").update({ fim: nowIso, segundos: seg } as never).eq("id", r.id);
      }
      const id = crypto.randomUUID();
      const { error } = await sb.from("gestao_tempo").insert({ id, id_tarefa: p.id_tarefa, usuario_email: email, inicio: nowIso } as never);
      if (error) throw error;
      await registrarAtividade(sb, email, "tempo_iniciado", p.id_tarefa, {});
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-tempo"] }); qc.invalidateQueries({ queryKey: ["gestao-timer-ativo"] }); },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível iniciar o cronômetro.")),
  });
}

export function usePararTempo() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (p: { id: string; id_tarefa: string; inicio: string }) => {
      const sb = createSupabaseBrowserClient();
      const seg = Math.max(1, Math.round((Date.now() - new Date(p.inicio).getTime()) / 1000));
      const { error } = await sb.from("gestao_tempo").update({ fim: new Date().toISOString(), segundos: seg } as never).eq("id", p.id);
      if (error) throw error;
      await registrarAtividade(sb, email, "tempo_parado", p.id_tarefa, { segundos: seg });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-tempo"] }); qc.invalidateQueries({ queryKey: ["gestao-timer-ativo"] }); },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível parar o cronômetro.")),
  });
}

export function useAddTempoManual() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; segundos: number; descricao?: string | null }) => {
      if (!email) throw new Error("Sessão sem e-mail.");
      const sb = createSupabaseBrowserClient();
      const now = new Date().toISOString();
      const { error } = await sb.from("gestao_tempo").insert({ id: crypto.randomUUID(), id_tarefa: p.id_tarefa, usuario_email: email, inicio: now, fim: now, segundos: p.segundos, manual: true, descricao: p.descricao ?? null } as never);
      if (error) throw error;
      await registrarAtividade(sb, email, "tempo_manual", p.id_tarefa, { segundos: p.segundos });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-tempo"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível lançar o tempo.")),
  });
}

export function useExcluirTempo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_tempo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-tempo"] }); qc.invalidateQueries({ queryKey: ["gestao-timer-ativo"] }); },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir o apontamento.")),
  });
}

export type GatilhoAutomacao =
  | "status_muda" | "tarefa_criada" | "prazo_proximo" | "prazo_vencido"
  // motor v2 (F2.2a/b): gatilhos novos
  | "subtarefa_concluida" | "tarefa_movida_quadro" | "tarefa_aprovada";

/** Uma cláusula do construtor E/OU. Campos aceitos pelo motor (gestao_automacao_cond_teste):
 *  status, status_de, status_para, prioridade, quadro, etiqueta, campo:<id>. Ops: '=' '!=' 'in' 'contains'. */
export interface ClausulaCondicao { campo: string; op: string; valor: string }

/** Condição da automação. Duas formas mutuamente reconhecidas pelo motor:
 *  - PLANA (legado v120): de/para (status_muda) e dias_antes (prazo). Regressão zero — segue editável.
 *  - E/OU (motor v2, gestao_automacao_cond_bate): {all:[…], any:[…]}. Presença de all|any liga o caminho novo. */
export interface CondicaoAutomacao {
  de?: string;
  para?: string;
  dias_antes?: string;
  all?: ClausulaCondicao[];
  any?: ClausulaCondicao[];
}

/** Ação da automação. `tipo` é o discriminador lido pelo motor (gestao_automacao_aplicar).
 *  Cada ramo consome só as chaves abaixo (o motor ignora as demais). */
export interface AcaoAutomacao {
  tipo?: string;
  valor?: string;
  campo_id?: string;
  // ações do motor v2 (F2.2a/b/c)
  modelo_slug?: string;                       // criar_subtarefas_modelo
  aprovador_email?: string;                   // solicitar_aprovacao (opcional)
  id_quadro_destino?: string;                 // mover/criar_tarefa_quadro
  status_destino?: string;                    // mover_tarefa_quadro
  titulo_template?: string;                   // criar_tarefa_quadro ({{titulo}})
  copiar_campos?: string;                     // criar_tarefa_quadro — o motor lê texto ('true'|'1')
  emails?: string[];                          // adicionar_vinculados
  vinculo_tipo?: string;                      // adicionar_vinculados: responsavel|seguidor (ver nota do executor)
}

export interface GestaoAutomacao {
  id: string;
  id_quadro: string;
  nome: string;
  ativo: boolean;
  gatilho: GatilhoAutomacao;
  condicao: CondicaoAutomacao;
  acao: AcaoAutomacao;
  ordem: number;
}

export function useAutomacoes(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-automacoes", idQuadro],
    enabled: !!idQuadro,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_automacoes").select("*").eq("id_quadro", idQuadro!).order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoAutomacao[];
    },
  });
}

export function useSalvarAutomacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<GestaoAutomacao> & { id_quadro: string }) => {
      const sb = createSupabaseBrowserClient();
      if (!a.id) {
        const { error } = await sb.from("gestao_automacoes").insert({
          id: crypto.randomUUID(), id_quadro: a.id_quadro,
          nome: a.nome ?? "Nova automação", ativo: a.ativo ?? true,
          gatilho: a.gatilho ?? "status_muda", condicao: a.condicao ?? {}, acao: a.acao ?? {}, ordem: a.ordem ?? 0,
        } as never);
        if (error) throw error;
        return;
      }
      const patch: Record<string, unknown> = {};
      if (a.nome !== undefined) patch.nome = a.nome;
      if (a.ativo !== undefined) patch.ativo = a.ativo;
      if (a.gatilho !== undefined) patch.gatilho = a.gatilho;
      if (a.condicao !== undefined) patch.condicao = a.condicao;
      if (a.acao !== undefined) patch.acao = a.acao;
      if (a.ordem !== undefined) patch.ordem = a.ordem;
      const { error } = await sb.from("gestao_automacoes").update(patch as never).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-automacoes"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar a automação.")),
  });
}

export function useExcluirAutomacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_automacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-automacoes"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir a automação.")),
  });
}

/** Dispara o scan diário de prazos no servidor (fallback sem pg_cron, ex.: .107). Idempotente:
 *  gestao_automacao_tick roda no máximo 1x/dia. Chamado ao abrir a Gestão. */
export function useAutomacaoTick() {
  useEffect(() => {
    // O rpc() do Supabase é um thenable (sem .catch) — consumir via await + try/catch.
    // Um fallback de agendamento NUNCA deve derrubar a página.
    void (async () => {
      try {
        const sb = createSupabaseBrowserClient() as unknown as { rpc: (fn: string) => PromiseLike<unknown> };
        await sb.rpc("gestao_automacao_tick");
      } catch {
        /* silencioso */
      }
    })();
  }, []);
}

export function useTarefas(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-tarefas", idQuadro],
    enabled: !!idQuadro,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_tarefas")
        .select("*")
        .eq("id_quadro", idQuadro!)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoTarefa[];
    },
  });
}

/** Minhas tarefas em TODOS os quadros: onde estou vinculado (responsável OU seguidor),
 *  por e-mail — não mais por nome (v187/F1.2). O e-mail é gravado em minúsculas na tabela;
 *  o filtro por igualdade exata sobre o valor normalizado equivale a lower(usuario_email). */
export function useMinhasTarefas(enabled = true) {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-minhas", email],
    enabled: enabled && !!email,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_tarefa_vinculados")
        .select("tarefa:gestao_tarefas!inner(*)")
        .eq("usuario_email", (email as string).toLowerCase());
      if (error) throw error;
      const rows = (data ?? []) as unknown as { tarefa: GestaoTarefa | null }[];
      const porId = new Map<string, GestaoTarefa>();
      for (const r of rows) if (r.tarefa) porId.set(r.tarefa.id_tarefa, r.tarefa);
      return [...porId.values()].sort((a, b) => {
        if (!a.prazo) return 1;
        if (!b.prazo) return -1;
        return a.prazo.localeCompare(b.prazo);
      });
    },
  });
}

/** Todos os status de todos os quadros (para resolver nome/cor na visão "Minhas tarefas"). */
export function useTodosStatus(enabled = true) {
  return useQuery({
    queryKey: ["gestao-status-todos"],
    enabled,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_status").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as GestaoStatus[];
    },
  });
}

/** Lista de usuários internos (para o seletor de responsável). */
export function useUsuariosLista() {
  return useQuery({
    queryKey: ["gestao-usuarios"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("usuarios")
        .select("nome")
        .neq("perfil", "Cliente")
        .order("nome", { ascending: true });
      if (error) throw error;
      return [...new Set(((data ?? []) as { nome: string | null }[]).map((u) => (u.nome ?? "").trim()).filter(Boolean))];
    },
  });
}

export function useSalvarTarefa() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (t: Partial<GestaoTarefa> & { id_quadro: string }) => {
      const sb = createSupabaseBrowserClient();
      const now = new Date().toISOString();
      if (!t.id_tarefa) {
        const id = gerarId("TRF");
        const { error } = await sb.from("gestao_tarefas").insert({
          id_tarefa: id,
          id_quadro: t.id_quadro,
          titulo: (t.titulo ?? "").trim() || "Nova tarefa",
          descricao: t.descricao ?? null,
          status: t.status ?? "A_FAZER",
          prioridade: t.prioridade ?? "Media",
          responsavel: t.responsavel ?? null,
          prazo: t.prazo ?? null,
          data_inicio: t.data_inicio ?? null,
          ordem: t.ordem ?? 0,
          etiquetas: t.etiquetas ?? [],
          // subtarefas NAO e gravado aqui (F2.1/v199): vive em gestao_subtarefas e o
          // trigger-espelho reescreve o jsonb da coluna. A coluna nasce '[]' (default).
          campos: t.campos ?? {},
          recorrencia: t.recorrencia ?? null,
          pontos: t.pontos ?? null,
          created_by: email,
          created_at: now,
          updated_at: now,
        } as never);
        if (error) throw error;
        return id;
      }
      const { id_tarefa, ...patch } = t;
      // subtarefas nao e mais escrito por aqui (F2.1/v199): a tabela gestao_subtarefas e a
      // fonte de verdade e o trigger-espelho mantem o jsonb. Remove do patch p/ nao
      // sobrescrever o espelho com o estado (possivelmente defasado) carregado no cliente.
      delete (patch as Partial<GestaoTarefa>).subtarefas;
      const { error } = await sb
        .from("gestao_tarefas")
        .update({ ...patch, updated_at: now } as never)
        .eq("id_tarefa", id_tarefa);
      if (error) throw error;
      return id_tarefa;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
      // Meu Espaço (vista agregada por e-mail) também mostra a tarefa salva.
      qc.invalidateQueries({ queryKey: ["gestao-minhas"] });
      // G1: o trigger v216 grava o histórico da tarefa no update/insert; refazer a linha do
      // tempo da sidebar (prefixo pega a query montada da tarefa aberta) — antes só um comentário
      // invalidava, então movimentações/campos alterados não subiam até comentar.
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline"] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar a tarefa.")),
  });
}

export function useMoverTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; status: StatusTarefa }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("gestao_tarefas")
        .update({ status: p.status, updated_at: new Date().toISOString() } as never)
        .eq("id_tarefa", p.id_tarefa);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
      // G1: mover de coluna gera histórico (status) via trigger v216 → refazer a timeline.
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline"] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível mover a tarefa.")),
  });
}

/** Persiste a nova ordem/status de uma coluna (drag-and-drop). */
export function useReordenar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id_tarefa: string; status: StatusTarefa; ordem: number }[]) => {
      const sb = createSupabaseBrowserClient();
      const now = new Date().toISOString();
      await Promise.all(
        updates.map((u) =>
          sb
            .from("gestao_tarefas")
            .update({ status: u.status, ordem: u.ordem, updated_at: now } as never)
            .eq("id_tarefa", u.id_tarefa),
        ),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
      // G1: drag-and-drop muda status/ordem → histórico via trigger v216 → refazer a timeline.
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline"] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível reordenar.")),
  });
}

/** Ações em massa: atualiza um campo em várias tarefas, ou exclui várias. */
export function useAcaoMassa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { ids: string[]; patch?: Partial<GestaoTarefa>; excluir?: boolean }) => {
      if (!p.ids.length) return;
      const sb = createSupabaseBrowserClient();
      if (p.excluir) {
        const { error } = await sb.from("gestao_tarefas").delete().in("id_tarefa", p.ids);
        if (error) throw error;
        return;
      }
      const { error } = await sb.from("gestao_tarefas").update({ ...p.patch, updated_at: new Date().toISOString() } as never).in("id_tarefa", p.ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
      // G1: ação em massa pode alterar status/prioridade/prazo → histórico via trigger v216.
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline"] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível aplicar a ação.")),
  });
}

export function useExcluirTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_tarefas").delete().eq("id_tarefa", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-tarefas"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir.")),
  });
}

// ---- Anexos (bucket 'anexos', caminho gestao/<id_tarefa>/<uuid>-<nome>) ----
export interface GestaoAnexo {
  id: string;
  id_tarefa: string;
  nome: string;
  storage_path: string;
  mime: string | null;
  tamanho_bytes: number | null;
  created_by: string | null;
  created_at: string;
}

const BUCKET_ANEXOS = "anexos";

export function useAnexos(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-anexos", idTarefa],
    enabled: !!idTarefa,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_anexos").select("*").eq("id_tarefa", idTarefa!).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoAnexo[];
    },
  });
}

/** Contagem de anexos por tarefa (para os cards de um quadro), numa única consulta. */
export function useAnexosCountQuadro(idQuadro: string | null | undefined, ids: string[]) {
  return useQuery({
    queryKey: ["gestao-anexos-count", idQuadro, ids.length],
    enabled: !!idQuadro && ids.length > 0,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_anexos").select("id_tarefa").in("id_tarefa", ids);
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of (data ?? []) as { id_tarefa: string }[]) m.set(r.id_tarefa, (m.get(r.id_tarefa) ?? 0) + 1);
      return m;
    },
  });
}

export function useUploadAnexo() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; file: File }) => {
      const sb = createSupabaseBrowserClient();
      const safe = p.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `gestao/${p.id_tarefa}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await sb.storage.from(BUCKET_ANEXOS).upload(path, p.file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await sb.from("gestao_anexos").insert({
        id: crypto.randomUUID(),
        id_tarefa: p.id_tarefa,
        nome: p.file.name,
        storage_path: path,
        mime: p.file.type || null,
        tamanho_bytes: p.file.size,
        created_by: email,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-anexos"] }); qc.invalidateQueries({ queryKey: ["gestao-anexos-count"] }); },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível enviar o anexo.")),
  });
}

export function useExcluirAnexo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; storage_path: string }) => {
      const sb = createSupabaseBrowserClient();
      await sb.storage.from(BUCKET_ANEXOS).remove([p.storage_path]);
      const { error } = await sb.from("gestao_anexos").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-anexos"] }); qc.invalidateQueries({ queryKey: ["gestao-anexos-count"] }); },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir o anexo.")),
  });
}

/** URL assinada (bucket privado) para abrir/baixar um anexo. */
export async function urlAssinadaAnexo(path: string): Promise<string | null> {
  const sb = createSupabaseBrowserClient();
  const { data } = await sb.storage.from(BUCKET_ANEXOS).createSignedUrl(path, 120);
  return data?.signedUrl ?? null;
}

/** Chama a Edge Function de IA (Groq). Lança em caso de erro. */
export async function gerarIaGestao(body: { acao: "subtarefas" | "descricao"; titulo: string; descricao?: string }) {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.functions.invoke("gestao-ia", { body });
  if (error) throw error;
  const d = data as { error?: string; data?: { subtarefas?: string[]; descricao?: string } };
  if (d?.error) throw new Error(d.error);
  return d?.data ?? {};
}

// ---- Formulários de entrada (captação por link público) ----
// Tipos de pergunta (F1 GESTAO-KANBAN-03). `tipo` default "texto".
export type TipoPergunta =
  | "texto" | "texto_longo" | "email" | "cnpj" | "cpf" | "telefone"
  | "data" | "data_hora" | "selecao" | "multipla";
// `destino` diz onde a resposta é gravada na tarefa:
//   "descricao" (default) | "etiquetas" | "prazo" | "campo:<id do gestao_campos>"
// F1.5 (v230): `id` estável (referenciado por condicao/titulo_composicao), `ajuda` (texto sob o
// rótulo), `condicao` (só aparece quando a pergunta de origem tem a opção) e `pendente_anexo`
// (era anexo no Runrun; upload público fica para a F2 — vira texto e a tarefa nasce marcada).
export interface CondicaoPergunta { pergunta: string; opcao: string }
export interface PerguntaFormulario {
  id?: string;
  label: string;
  obrigatorio: boolean;
  tipo?: TipoPergunta;
  opcoes?: string[];
  destino?: string;
  ajuda?: string;
  condicao?: CondicaoPergunta | null;
  pendente_anexo?: boolean;
}
// Token de composição do título: "form_title" | "p:<id da pergunta>". Vazio/null = o
// respondente digita o título.
export type TokenTitulo = string;
export interface GestaoFormulario {
  id: string;
  id_quadro: string;
  titulo: string;
  descricao: string | null;
  token: string;
  ativo: boolean;
  mostra_descricao: boolean;
  mostra_prazo: boolean;
  mostra_prioridade: boolean;
  prioridade_padrao: string;
  status_inicial: string | null;
  responsavel_padrao: string | null;
  responsavel_email: string | null;
  etiquetas_padrao: string[];
  perguntas: PerguntaFormulario[];
  titulo_composicao: TokenTitulo[] | null;
  runrun_form_id: number | null;
  origem: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}
/** Id estável para pergunta nova (curto, legível no jsonb). */
export function novoIdPergunta(): string {
  return "q" + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export function useFormulariosQuadro(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-formularios", idQuadro],
    enabled: !!idQuadro,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_formularios").select("*").eq("id_quadro", idQuadro!).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoFormulario[];
    },
  });
}

export function useSalvarFormulario() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (f: Partial<GestaoFormulario> & { id_quadro: string }) => {
      const sb = createSupabaseBrowserClient();
      if (!f.id) {
        const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 24);
        const { error } = await sb.from("gestao_formularios").insert({
          id: crypto.randomUUID(),
          id_quadro: f.id_quadro,
          titulo: (f.titulo ?? "").trim() || "Formulário de solicitação",
          descricao: f.descricao ?? null,
          token,
          ativo: f.ativo ?? true,
          mostra_descricao: f.mostra_descricao ?? true,
          mostra_prazo: f.mostra_prazo ?? false,
          mostra_prioridade: f.mostra_prioridade ?? false,
          prioridade_padrao: f.prioridade_padrao ?? "Media",
          status_inicial: f.status_inicial ?? null,
          responsavel_padrao: f.responsavel_padrao ?? null,
          responsavel_email: f.responsavel_email ?? null,
          etiquetas_padrao: f.etiquetas_padrao ?? [],
          perguntas: f.perguntas ?? [],
          titulo_composicao: f.titulo_composicao ?? null,
          created_by: email,
        } as never);
        if (error) throw error;
        return;
      }
      const { id, ...patch } = f;
      const { error } = await sb.from("gestao_formularios").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-formularios"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar o formulário.")),
  });
}

export function useExcluirFormulario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_formularios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-formularios"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir o formulário.")),
  });
}

// ---- Modelos de checklist de subtarefa (tabela gestao_subtarefa_modelos; F2.2c) ----
// Config de quadro (como gestao_formularios): CRUD direto gated pela RLS (gestao_pode_editar_q).
// A automação `criar_subtarefas_modelo {modelo_slug}` materializa os itens em gestao_subtarefas.
export interface ItemModelo { texto: string; etapa?: string | null; tipo?: string | null }
export interface GestaoSubtarefaModelo {
  id: string;
  id_quadro: string;
  slug: string;
  titulo: string;
  itens: ItemModelo[];
  created_at: string;
}

export function useModelos(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-modelos", idQuadro],
    enabled: !!idQuadro,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_subtarefa_modelos").select("*").eq("id_quadro", idQuadro!).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoSubtarefaModelo[];
    },
  });
}

export function useSalvarModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<GestaoSubtarefaModelo> & { id_quadro: string }) => {
      const sb = createSupabaseBrowserClient();
      if (!m.id) {
        const { error } = await sb.from("gestao_subtarefa_modelos").insert({
          id: crypto.randomUUID(),
          id_quadro: m.id_quadro,
          slug: (m.slug ?? "").trim() || "modelo",
          titulo: (m.titulo ?? "").trim() || "Novo modelo",
          itens: m.itens ?? [],
        } as never);
        if (error) throw error;
        return;
      }
      const { id, ...patch } = m;
      const { error } = await sb.from("gestao_subtarefa_modelos").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-modelos"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar o modelo.")),
  });
}

export function useExcluirModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_subtarefa_modelos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-modelos"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir o modelo.")),
  });
}

// ---- Acessos por lista (permissões finas) ----
export interface GestaoAcesso {
  id: string;
  id_quadro: string;
  /** null quando o principal é uma EQUIPE (v235). */
  usuario_email: string | null;
  /** v235: grant de equipe (principal = equipe, não pessoa). */
  id_equipe?: string | null;
  papel: "viewer" | "editor";
  nivel: "view" | "comment" | "edit" | "full";
  created_at: string;
}

/** TODOS os grants de acesso a quadro (list-level), p/ o modal unificado "Membros e
 *  acessos". A RLS `gestao_acessos_sel = gestao_pode_ver(id_quadro)` filtra aos quadros
 *  que o chamador vê — como só gestor (owner/admin) abre o modal, vê todos. Só grants
 *  com `id_quadro` (o modal gere acesso POR QUADRO). Key sob o prefixo `gestao-acessos`
 *  → `useAlterarAcesso` já invalida. */
export function useAcessosGestao() {
  return useQuery({
    queryKey: ["gestao-acessos", "todos"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_acessos")
        .select("*")
        .not("id_quadro", "is", null)
        .order("id_quadro", { ascending: true })
        .order("usuario_email", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoAcesso[];
    },
  });
}

/** Papel do usuário logado por lista (Map id_quadro → papel). */
export function useMeusAcessos() {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-meus-acessos", email],
    enabled: !!email,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_acessos").select("id_quadro,papel").eq("usuario_email", email!.toLowerCase());
      if (error) throw error;
      const m = new Map<string, "viewer" | "editor">();
      for (const r of (data ?? []) as { id_quadro: string; papel: "viewer" | "editor" }[]) m.set(r.id_quadro, r.papel);
      return m;
    },
  });
}

// useSalvarAcesso/useExcluirAcesso removidos na Fase 4b: o compartilhamento por lista passa por
// gestao_alterar_acesso (useAlterarAcesso) — com motivo + log LGPD. O front NÃO tem INSERT/UPDATE
// direto em gestao_acessos (v186 revoga o DML de authenticated).
// useAcessosQuadro/useToggleRestrito removidos junto do CompartilharModal (2026-09-17): o acesso vive
// no modal unificado "Membros e acessos" (useAcessosGestao) e a v227 tornou `restrito` inerte p/ acesso.

/** Gera/regenera (ou remove) o token do feed ICS de uma lista. */
export function useDefinirIcsToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_quadro: string; remover?: boolean }) => {
      const sb = createSupabaseBrowserClient();
      const token = p.remover ? null : (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 24);
      const { error } = await sb.from("gestao_quadros").update({ ics_token: token } as never).eq("id_quadro", p.id_quadro);
      if (error) throw error;
      return token;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-quadros"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível atualizar o calendário.")),
  });
}

export interface GestaoComentario {
  id_comentario: string;
  id_tarefa: string;
  autor: string | null;
  texto: string;
  created_at: string;
}

export function useComentarios(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-comentarios", idTarefa],
    enabled: !!idTarefa,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_comentarios")
        .select("*")
        .eq("id_tarefa", idTarefa!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoComentario[];
    },
  });
}

export function useAddComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; texto: string; autor: string | null }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_comentarios").insert({
        id_comentario: gerarId("CMT"),
        id_tarefa: p.id_tarefa,
        autor: p.autor,
        texto: p.texto,
        created_at: new Date().toISOString(),
      } as never);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["gestao-comentarios", v.id_tarefa] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível comentar.")),
  });
}

export function useExcluirComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_comentario: string; id_tarefa: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_comentarios").delete().eq("id_comentario", p.id_comentario);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["gestao-comentarios", v.id_tarefa] }),
    onError: (e) => toast.error(mensagemErro(e)),
  });
}

// ---- Subtarefas (tabela gestao_subtarefas; F2.1 — GESTAO-UX-01-UXB-F21) ----
// A tabela e a FONTE DE VERDADE da edicao; gestao_tarefas.subtarefas (jsonb) e ESPELHO
// mantido pelo trigger v199 (para o card e demais leitores do jsonb seguirem intactos).
export interface GestaoSubtarefa {
  id: string;
  id_tarefa: string;
  texto: string;
  feito: boolean;
  ordem: number;
  etapa: string | null;
  tipo: string | null;
  responsavel_email: string | null;
  created_at: string;
}

/** Subtarefas de uma tarefa, ordenadas por (ordem, created_at). */
export function useSubtarefas(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-subtarefas", idTarefa],
    enabled: !!idTarefa,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_subtarefas")
        .select("id,id_tarefa,texto,feito,ordem,etapa,tipo,responsavel_email,created_at")
        .eq("id_tarefa", idTarefa!)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoSubtarefa[];
    },
  });
}

/** Reconcilia as subtarefas de uma tarefa a partir do estado do modal (Subtarefa[] =
 *  {texto,feito} na ordem visual). Estrategia = delete-all + insert ordenado — satelite
 *  com DML direto (grants iguais a gestao_anexos; sem RPC), espelhando a reconciliacao
 *  delete+insert. O trigger-espelho v199 reescreve gestao_tarefas.subtarefas (jsonb). A
 *  UX-A e preservada: o flush de novaSub acontece no modal e chega aqui como +1 item;
 *  a IA chega como N itens; ordem = indice visual. */
export function useSalvarSubtarefas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; subtarefas: (Subtarefa & { id?: string })[]; reconciliar?: boolean }) => {
      const sb = createSupabaseBrowserClient();
      const limpos = p.subtarefas
        .map((s, i) => ({ id: s.id, texto: (s.texto ?? "").trim(), feito: !!s.feito, responsavel_email: s.responsavel_email ?? null, ordem: i }))
        .filter((s) => s.texto !== "");

      // CRIACAO (reconciliar:false): append — NAO apaga (preserva subtarefas que uma automacao
      // criou server-side no insert da tarefa, ex.: esteira/checklists em tarefa_criada) e posiciona
      // as novas do modal apos as existentes. So insere as que ainda nao tem id.
      if (p.reconciliar === false) {
        const { data } = await sb.from("gestao_subtarefas").select("ordem").eq("id_tarefa", p.id_tarefa).order("ordem", { ascending: false }).limit(1);
        const base = (((data?.[0] as { ordem?: number } | undefined)?.ordem) ?? -1) + 1;
        const novas = limpos.filter((s) => !s.id).map((s, i) => ({ id: gerarId("SUB"), id_tarefa: p.id_tarefa, texto: s.texto, feito: s.feito, responsavel_email: s.responsavel_email, ordem: base + i }));
        if (novas.length) { const { error } = await sb.from("gestao_subtarefas").insert(novas as never); if (error) throw error; }
        return;
      }

      // EDICAO: diff por id. UPDATE nas existentes (o flip de feito false->true dispara o gatilho
      // subtarefa_concluida -> move a esteira; INSERT nao dispararia). INSERT nas sem id (novas do
      // modal). DELETE so nas que o usuario removeu (id em `atuais`, lido ANTES de qualquer UPDATE,
      // e ausente do modal) — subtarefas criadas por automacao durante este save entram DEPOIS da
      // leitura de `atuais`, entao nunca sao apagadas.
      const { data: atuais } = await sb.from("gestao_subtarefas").select("id").eq("id_tarefa", p.id_tarefa);
      const idsLocais = new Set(limpos.filter((s) => s.id).map((s) => s.id as string));
      const remover = (atuais ?? []).map((r) => (r as { id: string }).id).filter((id) => !idsLocais.has(id));
      if (remover.length) { const { error } = await sb.from("gestao_subtarefas").delete().in("id", remover); if (error) throw error; }
      for (const s of limpos) {
        if (s.id) {
          const { error } = await sb.from("gestao_subtarefas").update({ texto: s.texto, feito: s.feito, responsavel_email: s.responsavel_email, ordem: s.ordem } as never).eq("id", s.id);
          if (error) throw error;
        } else {
          const { error } = await sb.from("gestao_subtarefas").insert({ id: gerarId("SUB"), id_tarefa: p.id_tarefa, texto: s.texto, feito: s.feito, responsavel_email: s.responsavel_email, ordem: s.ordem } as never);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_d, p) => {
      qc.invalidateQueries({ queryKey: ["gestao-subtarefas", p.id_tarefa] });
      qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar as subtarefas.")),
  });
}

export interface PreferenciaVisao {
  vista: VistaGestao;
  agrupar_por: AgruparPor | null;
  config: Record<string, unknown>;
}

/** Preferência de visão (Quadro/Lista/Calendário/Timeline) do usuário para um quadro. */
export function usePreferenciaVisao(idQuadro: string | null | undefined) {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-pref-visao", idQuadro, email],
    enabled: !!idQuadro && !!email,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_preferencias_visao")
        .select("vista,agrupar_por,config")
        .eq("usuario_email", email!)
        .eq("id_quadro", idQuadro!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PreferenciaVisao | null;
    },
  });
}

export function useSalvarPreferenciaVisao() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (p: { id_quadro: string; vista: VistaGestao; agrupar_por?: AgruparPor | null; config?: Record<string, unknown> }) => {
      if (!email) return;
      const sb = createSupabaseBrowserClient();
      const row = {
        usuario_email: email,
        id_quadro: p.id_quadro,
        vista: p.vista,
        agrupar_por: p.agrupar_por ?? null,
        config: p.config ?? {},
        updated_at: new Date().toISOString(),
      };
      // Atualiza a linha existente; se não houver, insere com UUID client-generated.
      const upd = await sb
        .from("gestao_preferencias_visao")
        .update(row as never)
        .eq("usuario_email", email)
        .eq("id_quadro", p.id_quadro)
        .select("id");
      if (upd.error) throw upd.error;
      if (upd.data && upd.data.length > 0) return;
      const ins = await sb.from("gestao_preferencias_visao").insert({ id: crypto.randomUUID(), ...row } as never);
      if (ins.error) throw ins.error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["gestao-pref-visao", v.id_quadro] }),
    onError: () => {
      // Preferência é best-effort; não interrompe o uso se falhar.
    },
  });
}

// ---- Aprovações (motor v2 / F2.2b) ------------------------------------------

export type StatusAprovacao = "pendente" | "aprovada" | "rejeitada";

export interface GestaoAprovacao {
  id: string;
  id_tarefa: string;
  solicitado_por: string | null;
  aprovador_email: string | null;
  status: StatusAprovacao;
  motivo: string | null;
  decidido_em: string | null;
  created_at: string;
}

/** Aprovações PENDENTES visíveis ao usuário (RLS já limita: vê a tarefa OU é o aprovador).
 *  Uma leitura compartilhada — a Caixa de Entrada lista, o card lê seu recorte por id_tarefa. */
export function useAprovacoesPendentes() {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-aprovacoes", email],
    enabled: !!email,
    refetchInterval: 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_aprovacoes")
        .select("id,id_tarefa,solicitado_por,aprovador_email,status,motivo,decidido_em,created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoAprovacao[];
    },
  });
}

/** Há aprovação pendente nesta tarefa? (badge no card — lê o cache compartilhado). */
export function useAprovacaoTarefa(idTarefa: string | null | undefined) {
  const { data } = useAprovacoesPendentes();
  return (data ?? []).some((a) => a.id_tarefa === idTarefa);
}

/** Decide uma aprovação via RPC logado (SECURITY DEFINER autoriza: aprovador designado OU gestor).
 *  Ao aprovar, o RPC dispara o gatilho `tarefa_aprovada` (encadeia as automações). */
export function useDecidirAprovacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; decisao: Exclude<StatusAprovacao, "pendente">; motivo?: string | null }) => {
      const sb = createSupabaseBrowserClient();
      const rpc = (sb as unknown as {
        rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }).rpc;
      const { error } = await rpc("gestao_decidir_aprovacao", { p_id: p.id, p_decisao: p.decisao, p_motivo: p.motivo ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, p) => {
      qc.invalidateQueries({ queryKey: ["gestao-aprovacoes"] });
      qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
      toast.success(p.decisao === "aprovada" ? "Aprovação concedida." : "Aprovação rejeitada.");
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível registrar a decisão.")),
  });
}
