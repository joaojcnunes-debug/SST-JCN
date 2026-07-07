"use client";

import { useCallback, useEffect } from "react";
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

export type GatilhoAutomacao = "status_muda" | "tarefa_criada" | "prazo_proximo" | "prazo_vencido";

export interface GestaoAutomacao {
  id: string;
  id_quadro: string;
  nome: string;
  ativo: boolean;
  gatilho: GatilhoAutomacao;
  condicao: { de?: string; para?: string; dias_antes?: string };
  acao: { tipo?: string; valor?: string; campo_id?: string };
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

/** Automações agora rodam NO SERVIDOR (v120: trigger em gestao_tarefas + pg_cron para prazos).
 *  O executor client-side foi aposentado para não aplicar a ação duas vezes. Mantido como no-op
 *  (mesma assinatura) para não quebrar os call sites em gestao/page.tsx. */
export function useAutomacaoRunner(_idQuadro: string | null | undefined) {
  return useCallback(
    (_ctx: { gatilho: "status_muda" | "tarefa_criada"; tarefa: GestaoTarefa; de?: string; para?: string }) => {
      /* no-op: ver public.gestao_automacao_trg / gestao_automacao_prazos (v120) */
    },
    [],
  );
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

/** Minhas tarefas em TODOS os quadros (responsável = usuário logado). */
export function useMinhasTarefas(enabled = true) {
  const nome = useUserStore((s) => s.user?.nome ?? null);
  return useQuery({
    queryKey: ["gestao-minhas", nome],
    enabled: enabled && !!nome,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_tarefas").select("*").eq("responsavel", nome!).order("prazo", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoTarefa[];
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
          subtarefas: t.subtarefas ?? [],
          campos: t.campos ?? {},
          recorrencia: t.recorrencia ?? null,
          pontos: t.pontos ?? null,
          created_at: now,
          updated_at: now,
        } as never);
        if (error) throw error;
        return id;
      }
      const { id_tarefa, ...patch } = t;
      const { error } = await sb
        .from("gestao_tarefas")
        .update({ ...patch, updated_at: now } as never)
        .eq("id_tarefa", id_tarefa);
      if (error) throw error;
      return id_tarefa;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-tarefas"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-tarefas"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-tarefas"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-tarefas"] }),
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
export interface PerguntaFormulario { label: string; obrigatorio: boolean }
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
  etiquetas_padrao: string[];
  perguntas: PerguntaFormulario[];
  created_by: string | null;
  created_at: string;
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
          etiquetas_padrao: f.etiquetas_padrao ?? [],
          perguntas: f.perguntas ?? [],
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

// ---- Acessos por lista (permissões finas) ----
export interface GestaoAcesso {
  id: string;
  id_quadro: string;
  usuario_email: string;
  papel: "viewer" | "editor";
  created_at: string;
}

/** Acessos cadastrados numa lista (para o modal Compartilhar). */
export function useAcessosQuadro(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-acessos", idQuadro],
    enabled: !!idQuadro,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_acessos").select("*").eq("id_quadro", idQuadro!).order("usuario_email", { ascending: true });
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

async function upsertAcesso(idQuadro: string, email: string, papel: "viewer" | "editor") {
  const sb = createSupabaseBrowserClient();
  const lower = email.toLowerCase();
  // Grava também o modelo novo (nivel/recurso) — o resolver da v117 lê `nivel`, não `papel`.
  // viewer→view, editor→edit; recurso é sempre a lista (list) deste quadro.
  const nivel = papel === "editor" ? "edit" : "view";
  const campos = { papel, nivel, recurso_tipo: "list", recurso_id: idQuadro };
  const { data: ex } = await sb.from("gestao_acessos").select("id").eq("id_quadro", idQuadro).eq("usuario_email", lower).maybeSingle();
  if (ex) { const { error } = await sb.from("gestao_acessos").update(campos as never).eq("id", (ex as { id: string }).id); if (error) throw error; }
  else { const { error } = await sb.from("gestao_acessos").insert({ id: crypto.randomUUID(), id_quadro: idQuadro, usuario_email: lower, ...campos } as never); if (error) throw error; }
}

// useSalvarAcesso/useExcluirAcesso removidos na Fase 4b: o compartilhamento por lista agora passa
// por gestao_alterar_acesso (useAlterarAcesso) — com motivo + log LGPD. upsertAcesso segue abaixo,
// usado só pelo auto-grant de useToggleRestrito (não se trancar fora ao restringir).

/** Liga/desliga "lista restrita". Ao ligar, garante o usuário atual como editor ANTES (não se trancar fora). */
export function useToggleRestrito() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (p: { id_quadro: string; restrito: boolean }) => {
      const sb = createSupabaseBrowserClient();
      if (p.restrito && email) await upsertAcesso(p.id_quadro, email, "editor");
      const { error } = await sb.from("gestao_quadros").update({ restrito: p.restrito } as never).eq("id_quadro", p.id_quadro);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-quadros"] }); qc.invalidateQueries({ queryKey: ["gestao-acessos"] }); qc.invalidateQueries({ queryKey: ["gestao-meus-acessos"] }); },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível alterar a restrição.")),
  });
}

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
