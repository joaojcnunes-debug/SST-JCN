"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { mensagemErro } from "@/lib/errors";
import { useUserStore } from "@/lib/store";
import type { AlocadoSubtarefa } from "@/lib/gestao/subtarefa-colunas";
import type { ResumoIa } from "@/lib/gestao/ia-resumo";
import { comPadrao, type FiltrosGestao } from "@/lib/gestao/filtros";
import type { SlaTarefa } from "@/lib/gestao/sla";

/** Slug de status. Os 4 defaults existem em todo quadro; quadros podem ter status customizados. */
export type StatusTarefa = string;
export type TipoStatus = "nao_iniciado" | "ativo" | "concluido";
export type VistaGestao = "quadro" | "lista" | "calendario" | "timeline" | "painel";
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
  /** v294: quadro de unidade (Teresópolis…); null = quadro de setor. */
  id_unidade?: string | null;
}

export interface GestaoStatus {
  id: string;
  id_quadro: string;
  slug: string;
  nome: string;
  cor: string;
  ordem: number;
  tipo: TipoStatus;
  /** v353: para ENTRAR nesta coluna — checklist todo marcado / pelo menos um anexo. */
  requer_checklist?: boolean;
  requer_anexo?: boolean;
  /** v348: limite de cartões abertos na coluna (WIP) — aviso, não trava; por responsável se limite_por_pessoa. */
  limite_wip?: number | null;
  limite_por_pessoa?: boolean;
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
  /** 'HH:MM:SS' (coluna TIME, v298). */
  hora_inicio: string | null;
  hora_fim: string | null;
  /** v300: preenchido na tarefa "filha" de uma subtarefa aberta na janela (fica fora das listas). */
  id_tarefa_pai: string | null;
  ordem: number;
  etiquetas: string[];
  subtarefas: Subtarefa[];
  campos: Record<string, unknown>;
  recorrencia: Recorrencia | null;
  pontos: number | null;
  /** v353: tempo estimado, em minutos. */
  tempo_estimado_min?: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  /** De onde veio (formulário, importação do Runrun: client/project/tipo…); o "Ordenar por" da coluna lê. */
  origem?: Record<string, unknown> | null;
  /** Só no app (filtro "Mostrar subtarefas"): título da tarefa-mãe, para o cartão/linha. */
  titulo_mae?: string;
  /** v338 (Painel v354): empresa do cadastro (empresas). */
  id_empresa?: string | null;
  /** Só no app: subtarefa da lista que ainda não tem tarefa filha (id em gestao_subtarefas).
   *  É um cartão de exibição — não arrasta nem edita na linha; ao abrir vira filha (v300). */
  sub_linha?: string;
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
        .select("id_quadro,nome,descricao,id_espaco,id_pasta,ordem,id_unidade")
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
    // A lista some da barra NA HORA; se não puder excluir (tem tarefas, erro), volta como estava (0.3.252).
    onMutate: async (id_quadro) => {
      await qc.cancelQueries({ queryKey: ["gestao-quadros"] });
      const antes = qc.getQueriesData<unknown>({ queryKey: ["gestao-quadros"] });
      for (const [chave, lista] of antes) {
        if (!Array.isArray(lista) || !lista.some((q) => (q as { id_quadro?: string })?.id_quadro === id_quadro)) continue;
        qc.setQueryData(chave, lista.filter((q) => (q as { id_quadro?: string })?.id_quadro !== id_quadro));
      }
      return { antes };
    },
    onError: (e, _id, ctx) => {
      for (const [chave, lista] of ctx?.antes ?? []) qc.setQueryData(chave, lista);
      toast.error(e instanceof Error ? e.message : mensagemErro(e));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["gestao-quadros"] }),
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
      if (s.requer_checklist !== undefined) patch.requer_checklist = s.requer_checklist;
      if (s.requer_anexo !== undefined) patch.requer_anexo = s.requer_anexo;
      if (s.limite_wip !== undefined) patch.limite_wip = s.limite_wip;
      if (s.limite_por_pessoa !== undefined) patch.limite_por_pessoa = s.limite_por_pessoa;
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

// Filtros das listas: a regra mora em lib/gestao/filtros.ts (etapa 2 do calendário, com equipe, seguidor,
// criada por, região, produtos, situação e período). Reexportados aqui para quem já importava daqui.
export { FILTRO_VAZIO, contarFiltros, comPadrao } from "@/lib/gestao/filtros";
export type { FiltrosGestao } from "@/lib/gestao/filtros";

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
      // Filtro salvo antes de um campo existir chega sem ele: completa com o vazio.
      return ((data ?? []) as unknown as GestaoFiltroSalvo[]).map((f) => ({ ...f, criterios: comPadrao(f.criterios) }));
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

/** Lê as dependências de uma tarefa (a mesma leitura do useDependencias). Exportada para a Lista
 *  checar a trava de conclusão na hora de mudar o status, via queryClient.fetchQuery. */
export async function lerDependencias(idTarefa: string): Promise<{ dependeDe: DepRef[]; bloqueia: DepRef[] }> {
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
}

/** Dependências de uma tarefa: "depende de" (pré-requisitos) e "bloqueia" (inverso). */
export function useDependencias(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-dependencias", idTarefa],
    enabled: !!idTarefa,
    queryFn: () => lerDependencias(idTarefa!),
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
      // mensagemErro traduz o RAISE sem acento da dependência circular (lib/errors.ts).
      toast.error(err.code === "23505" ? "Essa dependência já existe." : mensagemErro(e, err.message || "Não foi possível adicionar a dependência."));
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

/** v302: fotos das contas Google (e-mail em minúsculas → URL), gravadas ao conectar o Google Agenda.
 *  Sem permissão ou sem foto → mapa vazio (o avatar cai nas iniciais). */
export function useFotosUsuarios() {
  return useQuery({
    queryKey: ["gestao-usuario-fotos"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_usuario_fotos").select("usuario_email,foto_url");
      if (error) return new Map<string, string>();
      return new Map(((data ?? []) as { usuario_email: string; foto_url: string }[]).map((f) => [f.usuario_email, f.foto_url]));
    },
  });
}

/** v302: URL da foto de uma pessoa, pelo e-mail ou (quando só há o nome) pelo cadastro de usuários. */
export function useFotoDe(nome: string | null | undefined, email?: string | null): string | null {
  const { data: fotos } = useFotosUsuarios();
  const { data: usuarios } = useUsuarios();
  if (!fotos || fotos.size === 0) return null;
  const em = (email ?? (nome ? usuarios?.find((u) => u.nome === nome)?.email : null) ?? "").toLowerCase();
  return em ? fotos.get(em) ?? null : null;
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
    // v295: N responsáveis (antes 1). Quem é responsável não entra também como seguidor.
    // manterResponsaveisAtuais: com a lista de responsáveis VAZIA, preserva os que já estão no banco
    // (tarefa recém-criada no Meu Quadro nasce com o dono como responsável — v294 JCN).
    // manterSeguidoresAtuais: quem só troca o responsável (lista e ação em massa) não conhece os
    // seguidores da tarefa — preserva os do banco (menos quem virou responsável) em vez de apagá-los.
    // somenteAdicionar (criação, Painel 0.3.917): não remove ninguém — a automação de tarefa_criada pode ter
    // vinculado pessoas no banco entre o insert e este passo, e o formulário não as conhece.
    // base (edição, Painel 0.3.919): os vínculos que a janela carregou ao abrir. Só sai quem estava na base e a pessoa
    // tirou na janela — quem a automação vinculou com a janela aberta não é removido.
    mutationFn: async (p: {
      id_tarefa: string; responsaveisEmails: string[]; seguidoresEmails: string[];
      manterResponsaveisAtuais?: boolean; manterSeguidoresAtuais?: boolean; somenteAdicionar?: boolean;
      base?: { responsaveisEmails: string[]; seguidoresEmails: string[] };
    }) => {
      const sb = createSupabaseBrowserClient();
      const rpc = (sb as unknown as {
        rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }).rpc.bind(sb); // 0.3.270: sem o bind, rpc(...) perde o cliente e quebra ("reading 'rest'").
      const resps = [...new Set(p.responsaveisEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
      const segs = [...new Set(p.seguidoresEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))].filter((e) => !resps.includes(e));

      // Estado desejado, por chave e-mail+tipo.
      const desejado = new Map<string, { email: string; tipo: TipoVinculo }>();
      for (const e of resps) desejado.set(`${e}|responsavel`, { email: e, tipo: "responsavel" });
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
      if (p.manterResponsaveisAtuais && resps.length === 0) {
        for (const [k, v] of atual) if (v.tipo === "responsavel") desejado.set(k, v);
      }
      if (p.manterSeguidoresAtuais) {
        for (const [k, v] of atual) if (v.tipo === "seguidor" && !resps.includes(v.email.toLowerCase())) desejado.set(k, v);
      }

      // Base da janela (edição): só pode sair quem a janela conhecia.
      const baseSet = p.base
        ? new Set([
            ...p.base.responsaveisEmails.map((e) => `${e.trim().toLowerCase()}|responsavel`),
            ...p.base.seguidoresEmails.map((e) => `${e.trim().toLowerCase()}|seguidor`),
          ])
        : null;

      // Delta: remover (atuais − desejados, e só o que estava na base), depois adicionar (desejados − atuais).
      for (const [k, v] of atual) {
        if (!p.somenteAdicionar && !desejado.has(k) && (!baseSet || baseSet.has(k))) {
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
      // v336: aviso de quem desligou o sino (Meu espaço › Notificações) é gravado só para o e-mail (canal 'email').
      const { data, error } = await sb.from("gestao_notificacoes").select("*").neq("canal", "email").order("created_at", { ascending: false }).limit(50);
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

/** v336: meus avisos da Gestão — no sino e por e-mail. Sem escolha gravada, os dois vêm ligados. */
export interface PreferenciasAviso { painel: boolean; email: boolean }

export function usePreferenciasAviso() {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-preferencias-aviso", email],
    enabled: !!email,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("gestao_minhas_preferencias_aviso" as never);
      if (error) throw error;
      const linha = ((data ?? []) as unknown as PreferenciasAviso[])[0];
      return linha ?? { painel: true, email: true };
    },
  });
}

export function useSalvarPreferenciasAviso() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (p: PreferenciasAviso) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.rpc("gestao_salvar_preferencias_aviso" as never, { p_painel: p.painel, p_email: p.email } as never);
      if (error) throw error;
      return p;
    },
    onSuccess: (p) => {
      qc.setQueryData(["gestao-preferencias-aviso", email], p);
      qc.invalidateQueries({ queryKey: ["gestao-notificacoes"] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar as notificações.")),
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
/** v353: resolve (ou reabre) um comentário atribuído — quem recebeu ou quem edita o quadro. */
export function useResolverComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_comentario: string; id_tarefa: string; resolvido: boolean }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.rpc("gestao_comentario_resolver" as never, { p_id: p.id_comentario, p_resolvido: p.resolvido } as never);
      if (error) throw error;
    },
    onSuccess: (_d, p) => {
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline", p.id_tarefa] });
      qc.invalidateQueries({ queryKey: ["gestao-comentarios-para-mim"] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível resolver o comentário.")),
  });
}

export interface ComentarioParaMim {
  id_comentario: string;
  id_tarefa: string;
  autor: string | null;
  texto: string;
  created_at: string;
  gestao_tarefas: { titulo: string; id_quadro: string } | null;
}

/** v353: comentários atribuídos a mim e ainda não resolvidos (Caixa de entrada). */
export function useComentariosParaMim() {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-comentarios-para-mim", email],
    enabled: !!email,
    refetchInterval: 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_comentarios")
        .select("id_comentario,id_tarefa,autor,texto,created_at,gestao_tarefas(titulo,id_quadro)")
        .ilike("atribuido_a", email!)
        .is("resolvido_em", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ComentarioParaMim[];
    },
  });
}

/** v353: Admin muda a coluna sem cumprir o requisito da etapa (fica no histórico). */
export function useMoverForcandoRequisito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; status: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.rpc("gestao_mover_forcando_requisito" as never, { p_id_tarefa: p.id_tarefa, p_status: p.status } as never);
      if (error) throw error;
    },
    onSuccess: (_d, p) => {
      qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
      qc.invalidateQueries({ queryKey: ["gestao-minhas"] });
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline", p.id_tarefa] });
      qc.invalidateQueries({ queryKey: ["gestao-atividades", p.id_tarefa] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível forçar a mudança.")),
  });
}

/** O erro é o do gatilho dos requisitos da etapa (v353)? */
export function ehErroRequisito(e: unknown): boolean {
  const m = (e as { message?: string } | null)?.message ?? String(e ?? "");
  return m.includes("Requisito da etapa");
}

/** v353: prazos de atendimento das tarefas do quadro (vazio se o quadro não tem prazo ligado). */
export function useSlaTarefas(idQuadro: string | null | undefined, ids?: string[] | null) {
  return useQuery({
    queryKey: ["gestao-sla", idQuadro, ids ?? null],
    enabled: !!idQuadro,
    refetchInterval: 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("gestao_sla_tarefas" as never, { p_id_quadro: idQuadro, p_ids: ids ?? null } as never);
      if (error) throw error;
      return new Map(((data ?? []) as unknown as SlaTarefa[]).map((s) => [s.id_tarefa, s]));
    },
  });
}

export interface SlaQuadro {
  id_quadro: string;
  ativo: boolean;
  metas: Record<string, { resposta: number; resolucao: number }>;
  hora_inicio: string;
  hora_fim: string;
  dias: number[];
  vigente_desde: string;
}

export function useSlaQuadro(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-sla-quadro", idQuadro],
    enabled: !!idQuadro,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_sla_quadros" as never).select("*").eq("id_quadro", idQuadro!).maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as SlaQuadro | null;
    },
  });
}

export function useSalvarSlaQuadro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Omit<SlaQuadro, "vigente_desde">) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_sla_quadros" as never).upsert(c as never, { onConflict: "id_quadro" });
      if (error) throw error;
    },
    onSuccess: (_d, c) => {
      qc.invalidateQueries({ queryKey: ["gestao-sla-quadro", c.id_quadro] });
      qc.invalidateQueries({ queryKey: ["gestao-sla", c.id_quadro] });
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar o prazo de atendimento.")),
  });
}

export interface AutomacaoLogTarefa {
  id: string;
  id_automacao: string | null;
  gatilho: string;
  resultado: string;
  detalhe: string | null;
  created_at: string;
  gestao_automacoes: { nome: string } | null;
}

/** v353 (item 9): o que as automações fizeram nesta tarefa (gestao_automacao_log). */
export function useAutomacaoLogTarefa(idTarefa: string | null | undefined, ativo = true) {
  return useQuery({
    queryKey: ["gestao-automacao-log-tarefa", idTarefa],
    enabled: !!idTarefa && ativo,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_automacao_log")
        .select("id,id_automacao,gatilho,resultado,detalhe,created_at,gestao_automacoes(nome)")
        .eq("id_tarefa", idTarefa!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AutomacaoLogTarefa[];
    },
  });
}

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

/**
 * 29/10: `.in("id_tarefa", ids)` com o quadro inteiro (Teresópolis tem 1.093 tarefas) vira um
 * endereço grande demais e o servidor responde 431. Divide em lotes e junta as linhas.
 */
const LOTE_IDS = 150;
async function emLotes<T>(ids: string[], buscar: (lote: string[]) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += LOTE_IDS) lotes.push(ids.slice(i, i + LOTE_IDS));
  const res = await Promise.all(lotes.map((l) => buscar(l)));
  const out: T[] = [];
  for (const r of res) {
    if (r.error) throw r.error;
    out.push(...((r.data ?? []) as T[]));
  }
  return out;
}

/** Apontamentos de tempo de todas as tarefas de um quadro (para chip no card + relatório). */
export function useTempoQuadro(idQuadro: string | null | undefined, taskIds: string[]) {
  return useQuery({
    queryKey: ["gestao-tempo", "quadro", idQuadro, taskIds.length],
    enabled: !!idQuadro && taskIds.length > 0,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      return emLotes<GestaoTempo>(taskIds, (lote) => sb.from("gestao_tempo").select("*").in("id_tarefa", lote));
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

/** Nome de quem aponta, para o histórico (o e-mail só se a sessão não tiver nome). */
function useAtorTempo() {
  return useUserStore((s) => s.user?.nome ?? s.user?.email ?? null);
}

/** Depois de mexer no tempo: total, cronômetro ativo e o histórico da tarefa. */
function invalidarTempo(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["gestao-tempo"] });
  qc.invalidateQueries({ queryKey: ["gestao-timer-ativo"] });
  qc.invalidateQueries({ queryKey: ["gestao-atividades"] });
}

export function useIniciarTempo() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  const ator = useAtorTempo();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string }) => {
      if (!email) throw new Error("Sessão sem e-mail.");
      const sb = createSupabaseBrowserClient();
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      // Para qualquer timer rodando do usuário (um por vez).
      const { data: rodando } = await sb.from("gestao_tempo").select("id,inicio,id_tarefa").eq("usuario_email", email).is("fim", null);
      for (const r of (rodando ?? []) as { id: string; inicio: string; id_tarefa: string }[]) {
        const seg = Math.max(1, Math.round((nowMs - new Date(r.inicio).getTime()) / 1000));
        const { error: erroParar } = await sb.from("gestao_tempo").update({ fim: nowIso, segundos: seg } as never).eq("id", r.id);
        if (erroParar) throw erroParar;
        // Parado por iniciar outro: fica no histórico da tarefa onde estava rodando.
        await registrarAtividade(sb, ator, "tempo_parado", r.id_tarefa, { segundos: seg });
      }
      const id = crypto.randomUUID();
      const { error } = await sb.from("gestao_tempo").insert({ id, id_tarefa: p.id_tarefa, usuario_email: email, inicio: nowIso } as never);
      if (error) throw error;
      await registrarAtividade(sb, ator, "tempo_iniciado", p.id_tarefa, {});
    },
    onSuccess: () => invalidarTempo(qc),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível iniciar o cronômetro.")),
  });
}

export function usePararTempo() {
  const qc = useQueryClient();
  const ator = useAtorTempo();
  return useMutation({
    mutationFn: async (p: { id: string; id_tarefa: string; inicio: string }) => {
      const sb = createSupabaseBrowserClient();
      const seg = Math.max(1, Math.round((Date.now() - new Date(p.inicio).getTime()) / 1000));
      const { error } = await sb.from("gestao_tempo").update({ fim: new Date().toISOString(), segundos: seg } as never).eq("id", p.id);
      if (error) throw error;
      await registrarAtividade(sb, ator, "tempo_parado", p.id_tarefa, { segundos: seg });
    },
    onSuccess: () => invalidarTempo(qc),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível parar o cronômetro.")),
  });
}

export function useAddTempoManual() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  const ator = useAtorTempo();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; segundos: number; descricao?: string | null }) => {
      if (!email) throw new Error("Sessão sem e-mail.");
      const sb = createSupabaseBrowserClient();
      const now = new Date().toISOString();
      const { error } = await sb.from("gestao_tempo").insert({ id: crypto.randomUUID(), id_tarefa: p.id_tarefa, usuario_email: email, inicio: now, fim: now, segundos: p.segundos, manual: true, descricao: p.descricao ?? null } as never);
      if (error) throw error;
      await registrarAtividade(sb, ator, "tempo_manual", p.id_tarefa, { segundos: p.segundos });
    },
    onSuccess: () => invalidarTempo(qc),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível lançar o tempo.")),
  });
}

export function useExcluirTempo() {
  const qc = useQueryClient();
  const ator = useAtorTempo();
  return useMutation({
    mutationFn: async (p: { id: string; id_tarefa: string; segundos: number }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_tempo").delete().eq("id", p.id);
      if (error) throw error;
      await registrarAtividade(sb, ator, "tempo_excluido", p.id_tarefa, { segundos: p.segundos });
    },
    onSuccess: () => invalidarTempo(qc),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir o apontamento.")),
  });
}

export type GatilhoAutomacao =
  | "status_muda" | "tarefa_criada" | "prazo_proximo" | "prazo_vencido"
  // motor v2 (F2.2a/b): gatilhos novos
  | "subtarefa_concluida" | "tarefa_movida_quadro" | "tarefa_aprovada"
  // recusa da aprovação (gestao_decidir_aprovacao já dispara)
  | "tarefa_rejeitada"
  // v298 (Pacote A, levantamento Jira/Trello/ClickUp/Notion)
  | "responsavel_adicionado" | "prioridade_muda" | "campo_muda" | "etiqueta_adicionada" | "comentario_adicionado"
  // v299 (Pacote B — tempo e cobrança; rodam no relógio, a cada 10 min)
  | "agendado" | "tarefa_parada" | "data_inicio_chega" | "dependencia_liberada"
  // v300 (Pacote C): só quando alguém clica no ⚡ (tarefa ou ações em massa)
  | "manual"
  // v301 (Pacote D): eventos do SST — criam uma tarefa do modelo no quadro da regra
  | "sst_inspecao_concluida" | "sst_documento_concluido" | "sst_vencimento";

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
  // v299
  /** gatilho agendado: quando roda. dias_semana: 1 = segunda … 7 = domingo. */
  agenda?: { freq?: "diaria" | "dias_uteis" | "semanal" | "mensal"; hora?: string; dias_semana?: number[]; dia_mes?: string };
  /** gatilho agendado: age em cada tarefa que casar (padrão) ou cria uma tarefa do modelo. */
  modo?: "cada_tarefa" | "criar_tarefa";
  modelo_tarefa?: ModeloTarefa;
  /** gatilho tarefa_parada: há quanto tempo sem atividade (base atualizacao) ou no mesmo status. */
  parada?: { quantidade?: string; unidade?: "horas" | "dias"; base?: "atualizacao" | "status" };
  /** gatilho sst_vencimento: o que vence (dias_antes = com quantos dias de antecedência). */
  fonte?: "documento" | "extintor";
}

/** Tarefa criada por uma automação (agenda; gatilhos do SST). Textos aceitam variáveis. */
export interface ModeloTarefa {
  titulo?: string;
  descricao?: string;
  prioridade?: string;
  prazo_dias?: string;
  prazo_uteis?: string;
  etiquetas?: string[];
  responsaveis?: string[];
}

/** Ação da automação. `tipo` é o discriminador lido pelo motor (gestao_automacao_aplicar).
 *  Cada ramo consome só as chaves abaixo (o motor ignora as demais). */
export interface AcaoAutomacao {
  /** v298: identificador local da ação na lista (o motor ignora) — mantém o editor estável ao reordenar. */
  id?: string;
  tipo?: string;
  valor?: string;
  campo_id?: string;
  // ações do motor v2 (F2.2a/b/c)
  modelo_slug?: string;                       // criar_subtarefas_modelo
  aprovador_email?: string;                   // solicitar_aprovacao (opcional)
  responsavel_email?: string;                 // criar_subtarefas_modelo (v315 = painel v319, opcional)
  id_quadro_destino?: string;                 // mover/criar_tarefa_quadro; '@unidade' = quadro da unidade da tarefa (v302, só criar)
  status_destino?: string;                    // mover/criar_tarefa_quadro: etapa no destino (criar: v302)
  titulo_template?: string;                   // criar_tarefa_quadro ({{titulo}})
  etiquetas?: string[];                       // criar_tarefa_quadro (v348): etiquetas do cartão novo, somadas às copiadas
  copiar_campos?: string;                     // criar_tarefa_quadro — o motor lê texto ('true'|'1')
  emails?: string[];                          // adicionar_vinculados, enviar_email (endereços extras)
  vinculo_tipo?: string;                      // adicionar_vinculados: responsavel|seguidor (ver nota do executor)
  // v298
  texto?: string;                             // comentar (aceita variáveis)
  assunto?: string;                           // enviar_email
  mensagem?: string;                          // enviar_email
  para?: "vinculados" | "responsaveis" | "";  // enviar_email: a quem da tarefa (+ emails)
  base?: "hoje" | "prazo" | "data_inicio" | "criacao"; // definir_prazo
  dias?: string;                              // definir_prazo (inteiro; negativo = antes)
  uteis?: string;                             // definir_prazo: 'true' = dias úteis
  quantidade?: string;                        // aguardar (v299)
  unidade?: "horas" | "dias";                 // aguardar (v299)
  modo?: "rodizio" | "menor_carga";           // atribuir_rodizio (v300); emails = a lista de pessoas
  substituir?: string;                        // atribuir_rodizio: 'true' = tira os outros responsáveis
  /** Só executa esta ação se a condição casar (E/OU) — o "se/senão" da regra. */
  condicao?: CondicaoAutomacao;
}

export interface GestaoAutomacao {
  id: string;
  id_quadro: string;
  nome: string;
  ativo: boolean;
  gatilho: GatilhoAutomacao;
  condicao: CondicaoAutomacao;
  acao: AcaoAutomacao;
  /** v298: as ações, em ordem. Regra antiga: vazio, e vale `acao`. */
  acoes?: AcaoAutomacao[];
  ordem: number;
  /** v315 (Painel v323): quando a regra ATIVA foi pausada por ficar incompleta (volta sozinha ao completar). */
  pausada_em?: string | null;
  pausada_por?: string | null;
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
          gatilho: a.gatilho ?? "status_muda", condicao: a.condicao ?? {}, acoes: a.acoes ?? [], ordem: a.ordem ?? 0,
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
      if (a.acoes !== undefined) patch.acoes = a.acoes;
      if (a.ordem !== undefined) patch.ordem = a.ordem;
      const { error } = await sb.from("gestao_automacoes").update(patch as never).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-automacoes"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar a automação.")),
  });
}

/** Uma execução registrada (v298, gestao_automacao_historico). */
export interface ExecucaoAutomacao {
  created_at: string;
  id_automacao: string;
  automacao: string;
  id_tarefa: string | null;
  tarefa: string | null;
  gatilho: string;
  resultado: "ok" | "skip" | "erro" | string;
  detalhe: string | null;
}

/** Histórico das execuções das automações do quadro (mais recentes primeiro). */
export function useHistoricoAutomacoes(idQuadro: string | null | undefined, ativo: boolean) {
  return useQuery({
    queryKey: ["gestao-automacoes-historico", idQuadro],
    enabled: !!idQuadro && ativo,
    refetchInterval: ativo ? 15_000 : false,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("gestao_automacao_historico" as never, { p_id_quadro: idQuadro, p_limite: 200 } as never);
      if (error) throw error;
      return (data ?? []) as ExecucaoAutomacao[];
    },
  });
}

/** v300: roda uma automação "manual" nas tarefas escolhidas (o banco confere a permissão de cada uma). */
export function useExecutarAutomacaoManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ids }: { id: string; ids: string[] }) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("gestao_automacao_executar_manual" as never, { p_id_automacao: id, p_ids: ids } as never);
      if (error) throw error;
      return (data ?? { executadas: 0, ignoradas: 0 }) as { executadas: number; ignoradas: number };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
      qc.invalidateQueries({ queryKey: ["gestao-automacoes-historico"] });
      toast.success(`Automação rodou em ${r.executadas} tarefa${r.executadas !== 1 ? "s" : ""}` +
        (r.ignoradas ? ` (${r.ignoradas} sem permissão ou de outro quadro)` : "."));
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível rodar a automação.")),
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

/**
 * F3.A: reflete as tarefas com prazo na Agenda Google dos vinculados conectados. Sem cron, o
 * worker /api/gestao/google/sync roda ao abrir a Gestão e logo depois de cada gravação que deu
 * certo (criar/editar/mover/concluir/vincular): antes só rodava ao abrir, e a tarefa recém-criada
 * ficava parada na fila até alguém recarregar. O servidor deduplica por minuto — chamada que cai
 * num minuto já processado é refeita na virada do minuto. Best-effort: nunca derruba a página.
 */
export function useSyncGoogleAgenda() {
  const qc = useQueryClient();
  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const agendar = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void disparar(), ms);
    };
    const disparar = async () => {
      timer = undefined;
      try {
        const r = await fetch("/api/gestao/google/sync");
        const j = (await r.json().catch(() => ({}))) as { skipped?: string; pendentes?: number };
        // Minuto já processado, ou fila maior que o lote do worker (50 — ex.: ao conectar uma conta
        // com muitas tarefas): continua na virada do minuto.
        if (vivo && (j.skipped === "dedup-minuto" || (j.pendentes ?? 0) >= 50)) agendar(61_000 - (Date.now() % 60_000));
      } catch {
        /* silencioso — a fila drena na próxima */
      }
    };
    void disparar();
    // Espera 1,5 s: várias gravações seguidas (tarefa + vinculados) viram uma chamada só.
    const parar = qc.getMutationCache().subscribe((ev) => {
      if (ev.type === "updated" && ev.action.type === "success") agendar(1500);
    });
    return () => {
      vivo = false;
      parar();
      if (timer) clearTimeout(timer);
    };
  }, [qc]);
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
        // v300: a filha de uma subtarefa só abre pela subtarefa — não entra no quadro/listas.
        .is("id_tarefa_pai", null)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoTarefa[];
    },
  });
}

/** Subtarefas de um quadro para o filtro "Mostrar": as linhas (gestao_subtarefas) das tarefas do
 *  quadro e as filhas já abertas (gestao_tarefas com id_tarefa_pai). Só lê quando `enabled`. */
export interface SubtarefaDoQuadro {
  id: string;
  id_tarefa: string;
  texto: string;
  feito: boolean;
  ordem: number;
  responsavel_email: string | null;
  id_tarefa_filha: string | null;
  created_at: string;
}
export function useSubtarefasDoQuadro(idQuadro: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["gestao-subtarefas-quadro", idQuadro],
    enabled: !!idQuadro && enabled,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const [linhas, filhas] = await Promise.all([
        sb.from("gestao_subtarefas")
          .select("id,id_tarefa,texto,feito,ordem,responsavel_email,id_tarefa_filha,created_at,mae:gestao_tarefas!gestao_subtarefas_id_tarefa_fkey!inner(id_quadro)")
          .eq("mae.id_quadro", idQuadro!)
          .order("ordem", { ascending: true }),
        sb.from("gestao_tarefas").select("*").eq("id_quadro", idQuadro!).not("id_tarefa_pai", "is", null),
      ]);
      if (linhas.error) throw linhas.error;
      if (filhas.error) throw filhas.error;
      return {
        linhas: (linhas.data ?? []) as unknown as SubtarefaDoQuadro[],
        filhas: (filhas.data ?? []) as unknown as GestaoTarefa[],
      };
    },
  });
}

/** Tarefas em que estou alocado: vinculado (responsável OU seguidor) ou responsável de uma
 *  subtarefa ainda aberta (v0.3.806) — antes quem só tinha a subtarefa não achava a tarefa em
 *  Minhas tarefas/Agenda. RPC v315 (Painel v312): mesmo filtro de acesso da RLS, sem pagá-la linha a linha. */
async function buscarTarefasAlocadas(): Promise<GestaoTarefa[]> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.rpc("gestao_minhas_tarefas" as never);
  if (error) throw error;
  return (data ?? []) as unknown as GestaoTarefa[];
}

/** Minhas tarefas em TODOS os quadros: onde estou vinculado (responsável OU seguidor) ou sou
 *  responsável de subtarefa aberta, por e-mail — não mais por nome (v187/F1.2). */
export function useMinhasTarefas(enabled = true) {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-minhas", email],
    enabled: enabled && !!email,
    queryFn: async () => {
      const tarefas = await buscarTarefasAlocadas();
      return tarefas.sort((a, b) => {
        if (!a.prazo) return 1;
        if (!b.prazo) return -1;
        return a.prazo.localeCompare(b.prazo);
      });
    },
  });
}

/** Agenda do Meu Espaço: as tarefas COM DATA em que estou alocado (responsável, seguidor ou
 *  responsável de subtarefa aberta), em todos os quadros. A chave começa com "gestao-minhas" para
 *  pegar as mesmas invalidações. */
export function useMinhasTarefasAgenda(enabled = true) {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-minhas", "agenda", email],
    enabled: enabled && !!email,
    queryFn: async () => {
      const tarefas = await buscarTarefasAlocadas();
      // v300: a filha de uma subtarefa só abre pela subtarefa — fica fora, como nas outras vistas.
      // Só o que tem data entra na Agenda (prazo ou, sem prazo, a data de início).
      return tarefas.filter((t) => !t.id_tarefa_pai && (t.prazo || t.data_inicio));
    },
  });
}

/**
 * Calendário de uma pessoa ou de uma equipe (etapa 2 do calendário do Runrun, 10/11/2026): as tarefas COM DATA
 * no período [ini, fim] em que alguma das pessoas é RESPONSÁVEL, em todas as listas que EU vejo — a RLS de
 * gestao_tarefas/gestao_tarefa_vinculados decide; nada aparece aqui que eu não abriria pela própria lista.
 * Entra a tarefa cujo prazo ou início cai no período, ou que começa antes e termina depois dele.
 */
export function useTarefasDeResponsaveis(emails: string[], ini: string, fim: string, enabled: boolean) {
  const lista = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))].sort();
  return useQuery({
    queryKey: ["gestao-tarefas-de", lista, ini, fim],
    enabled: enabled && lista.length > 0 && !!ini && !!fim,
    staleTime: 30 * 1000,
    // Mantém a tela anterior só enquanto carrega o novo período; sem ninguém escolhido, fica vazio (0.3.270).
    placeholderData: (anterior) => (lista.length ? anterior : undefined),
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_tarefas")
        .select("*, gestao_tarefa_vinculados!inner(usuario_email,tipo)")
        .in("gestao_tarefa_vinculados.usuario_email", lista)
        .eq("gestao_tarefa_vinculados.tipo", "responsavel")
        // v300: a filha de uma subtarefa só abre pela subtarefa — fica fora, como nas outras vistas.
        .is("id_tarefa_pai", null)
        .or(`and(prazo.gte.${ini},prazo.lte.${fim}),and(data_inicio.gte.${ini},data_inicio.lte.${fim}),and(data_inicio.lt.${ini},prazo.gt.${fim})`)
        .order("prazo", { ascending: true })
        .limit(3000);
      if (error) throw error;
      const vistos = new Set<string>();
      const out: GestaoTarefa[] = [];
      for (const r of (data ?? []) as unknown as (GestaoTarefa & { gestao_tarefa_vinculados?: unknown })[]) {
        if (vistos.has(r.id_tarefa)) continue;
        vistos.add(r.id_tarefa);
        const { gestao_tarefa_vinculados: _v, ...t } = r;
        void _v;
        out.push(t as GestaoTarefa);
      }
      return out;
    },
  });
}

/** Agenda (página da Gestão, 10/11/2026): tarefa ou subtarefa com as pessoas da agenda que são responsáveis nela. */
export interface TarefaAgenda extends GestaoTarefa {
  /** E-mails (em minúsculas) das pessoas escolhidas na Agenda que são responsáveis por esta tarefa. */
  emails_agenda: string[];
  /** v338: a empresa da atividade — a da tarefa ou, numa subtarefa sem empresa, a da tarefa-mãe. */
  empresa_agenda: string | null;
}

/**
 * Agenda de pessoas (página "Agenda" da Gestão, pedido de 10/11/2026: "os técnicos saberem as atividades do dia"):
 * as tarefas COM DATA no período [ini, fim] em que alguma das pessoas é RESPONSÁVEL, em todas as listas que EU vejo
 * (a RLS decide), INCLUSIVE as subtarefas abertas em janela própria (as filhas, v292), que o calendário de uma
 * pessoa da lista deixa de fora. A filha vem com `titulo_mae` (a tarefa de que ela faz parte).
 * Subtarefa que nunca foi aberta não tem data: não entra.
 */
export function useAgendaDe(emails: string[], ini: string, fim: string, enabled = true) {
  const lista = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))].sort();
  return useQuery({
    queryKey: ["gestao-agenda-de", lista, ini, fim],
    enabled: enabled && lista.length > 0 && !!ini && !!fim,
    staleTime: 30 * 1000,
    // Mantém a tela anterior só enquanto carrega o novo período; sem ninguém escolhido, fica vazio (0.3.270).
    placeholderData: (anterior) => (lista.length ? anterior : undefined),
    queryFn: async (): Promise<TarefaAgenda[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_tarefas")
        .select("*, gestao_tarefa_vinculados!inner(usuario_email,tipo)")
        .in("gestao_tarefa_vinculados.usuario_email", lista)
        .eq("gestao_tarefa_vinculados.tipo", "responsavel")
        .or(`and(prazo.gte.${ini},prazo.lte.${fim}),and(data_inicio.gte.${ini},data_inicio.lte.${fim}),and(data_inicio.lt.${ini},prazo.gt.${fim})`)
        .order("prazo", { ascending: true })
        .limit(3000);
      if (error) throw error;
      const porId = new Map<string, TarefaAgenda>();
      for (const r of (data ?? []) as unknown as (GestaoTarefa & { gestao_tarefa_vinculados?: { usuario_email: string }[] })[]) {
        const { gestao_tarefa_vinculados: vinc, ...t } = r;
        const emailsT = (vinc ?? []).map((v) => v.usuario_email.toLowerCase());
        const ja = porId.get(t.id_tarefa);
        if (ja) ja.emails_agenda = [...new Set([...ja.emails_agenda, ...emailsT])];
        else porId.set(t.id_tarefa, { ...(t as GestaoTarefa), emails_agenda: [...new Set(emailsT)], empresa_agenda: (t as GestaoTarefa).id_empresa ?? null });
      }
      const out = [...porId.values()];
      // A filha mostra de qual tarefa ela é (a mãe pode estar fora do período ou sem data).
      const maes = [...new Set(out.map((t) => t.id_tarefa_pai).filter((x): x is string => !!x))];
      if (maes.length) {
        const { data: m, error: e2 } = await sb.from("gestao_tarefas").select("id_tarefa,titulo,id_empresa").in("id_tarefa", maes);
        if (e2) throw e2;
        const mae = new Map(((m ?? []) as { id_tarefa: string; titulo: string; id_empresa: string | null }[]).map((x) => [x.id_tarefa, x]));
        for (const t of out) {
          if (!t.id_tarefa_pai) continue;
          const x = mae.get(t.id_tarefa_pai);
          t.titulo_mae = x?.titulo ?? undefined;
          t.empresa_agenda = t.empresa_agenda ?? x?.id_empresa ?? null;
        }
      }
      return out;
    },
  });
}

/** v335: colunas (slugs) deste quadro em que EU habilitei notificações (menu "…" da coluna). */
export function useEtapasAvisadas(idQuadro: string | null | undefined) {
  const email = useUserStore((s) => s.user?.email ?? null);
  return useQuery({
    queryKey: ["gestao-etapas-avisadas", idQuadro, email],
    enabled: !!idQuadro && !!email,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("gestao_etapas_avisadas" as never, { p_id_quadro: idQuadro } as never);
      if (error) throw error;
      return (data ?? []) as unknown as string[];
    },
  });
}

/** v335: liga/desliga o aviso "uma tarefa entrou nesta coluna" para quem está logado. Devolve o estado novo. */
export function useAlternarAvisoEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_quadro: string; slug: string }) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("gestao_etapa_aviso_alternar" as never, { p_id_quadro: p.id_quadro, p_slug: p.slug } as never);
      if (error) throw error;
      return data as unknown as boolean;
    },
    onSuccess: (_l, p) => qc.invalidateQueries({ queryKey: ["gestao-etapas-avisadas", p.id_quadro] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível mudar as notificações da coluna.")),
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
    // camposAlterados (edição): só as chaves de campo personalizado que a pessoa mudou. São mescladas
    // sobre o `campos` ATUAL do banco — regravar o objeto inteiro carregado na abertura apagava o que
    // uma automação escreveu nesse meio-tempo. Sem chaves alteradas, `campos` nem vai no update.
    mutationFn: async (entrada: Partial<GestaoTarefa> & { id_quadro: string; camposAlterados?: Record<string, unknown> }) => {
      const { camposAlterados, ...t } = entrada;
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
          hora_inicio: t.hora_inicio ?? null,
          hora_fim: t.hora_fim ?? null,
          ordem: t.ordem ?? 0,
          etiquetas: t.etiquetas ?? [],
          // subtarefas NAO e gravado aqui (F2.1/v199): vive em gestao_subtarefas e o
          // trigger-espelho reescreve o jsonb da coluna. A coluna nasce '[]' (default).
          campos: t.campos ?? {},
          recorrencia: t.recorrencia ?? null,
          pontos: t.pontos ?? null,
          id_empresa: t.id_empresa ?? null,
          tempo_estimado_min: t.tempo_estimado_min ?? null,
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
      if (camposAlterados && Object.keys(camposAlterados).length > 0) {
        const { data: atual, error: selErr } = await sb.from("gestao_tarefas").select("campos").eq("id_tarefa", id_tarefa).maybeSingle();
        if (selErr) throw selErr;
        const base = ((atual as { campos?: Record<string, unknown> | null } | null)?.campos ?? {}) as Record<string, unknown>;
        patch.campos = { ...base, ...camposAlterados };
      }
      const { error } = await sb
        .from("gestao_tarefas")
        .update({ ...patch, updated_at: now } as never)
        .eq("id_tarefa", id_tarefa);
      if (error) throw error;
      return id_tarefa;
    },
    // Edição: o cartão muda de coluna NA HORA (antes da resposta do servidor), nas listas de quadro já
    // carregadas; se a gravação falhar, volta como estava. Mudou de quadro: sai da lista do quadro antigo.
    onMutate: async (entrada) => {
      if (!entrada.id_tarefa) return { antes: [] as [QueryKey, GestaoTarefa[] | undefined][] };
      await qc.cancelQueries({ queryKey: ["gestao-tarefas"] });
      const antes = qc.getQueriesData<GestaoTarefa[]>({ queryKey: ["gestao-tarefas"] });
      const t = entrada;
      const patch: Partial<GestaoTarefa> & { camposAlterados?: unknown } = { ...entrada };
      delete patch.subtarefas;
      delete patch.camposAlterados;
      for (const [chave, lista] of antes) {
        if (!Array.isArray(lista) || !lista.some((x) => x.id_tarefa === t.id_tarefa)) continue;
        const doQuadro = typeof chave[1] === "string" ? chave[1] : null;
        qc.setQueryData<GestaoTarefa[]>(chave, doQuadro && t.id_quadro && t.id_quadro !== doQuadro
          ? lista.filter((x) => x.id_tarefa !== t.id_tarefa)
          : lista.map((x) => (x.id_tarefa === t.id_tarefa ? { ...x, ...patch } : x)));
      }
      return { antes };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
      // Meu Espaço (vista agregada por e-mail) também mostra a tarefa salva.
      qc.invalidateQueries({ queryKey: ["gestao-minhas"] });
      // Descrição do cartão original mostrada na janela das subtarefas dele (0.3.279).
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-mae"] });
      // G1: o trigger v216 grava o histórico da tarefa no update/insert; refazer a linha do
      // tempo da sidebar (prefixo pega a query montada da tarefa aberta) — antes só um comentário
      // invalidava, então movimentações/campos alterados não subiam até comentar.
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline"] });
    },
    onError: (e, _t, ctx) => {
      for (const [chave, lista] of ctx?.antes ?? []) qc.setQueryData(chave, lista);   // o cartão volta
      toast.error(mensagemErro(e, "Não foi possível salvar a tarefa."));
    },
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

/** Exclusão de tarefa: o cartão (e as filhas dele) some NA HORA de todas as listas já carregadas — quadros,
 *  Meu espaço e Agenda —, antes da resposta do servidor. Antes só as listas de quadro eram refeitas, e no
 *  Meu espaço a tarefa excluída ficava até atualizar a página. Devolve o que havia, para o onError recolocar
 *  se a exclusão falhar (0.3.252, do Painel). */
const LISTAS_DE_TAREFAS: QueryKey[] = [["gestao-tarefas"], ["gestao-minhas"]];
async function tirarTarefasDasListas(qc: QueryClient, ids: string[]) {
  const fora = new Set(ids);
  const sai = (x: unknown) => {
    const t = x as { id_tarefa?: string; id_tarefa_pai?: string | null } | null;
    return !!t && ((!!t.id_tarefa && fora.has(t.id_tarefa)) || (!!t.id_tarefa_pai && fora.has(t.id_tarefa_pai)));
  };
  await Promise.all(LISTAS_DE_TAREFAS.map((queryKey) => qc.cancelQueries({ queryKey })));
  const antes = LISTAS_DE_TAREFAS.flatMap((queryKey) => qc.getQueriesData<unknown>({ queryKey }));
  for (const [chave, lista] of antes) {
    if (Array.isArray(lista) && lista.some(sai)) qc.setQueryData(chave, lista.filter((x) => !sai(x)));
  }
  return antes;
}

function refazerListasDeTarefas(qc: QueryClient) {
  for (const queryKey of LISTAS_DE_TAREFAS) qc.invalidateQueries({ queryKey });
  qc.invalidateQueries({ queryKey: ["gestao-subtarefas-quadro"] });
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
    onMutate: async (p) => ({ antes: p.excluir && p.ids.length ? await tirarTarefasDasListas(qc, p.ids) : [] }),
    onSuccess: () => {
      refazerListasDeTarefas(qc);
      // G1: ação em massa pode alterar status/prioridade/prazo → histórico via trigger v216.
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline"] });
    },
    onError: (e, _p, ctx) => {
      for (const [chave, lista] of ctx?.antes ?? []) qc.setQueryData(chave, lista);   // os cartões voltam
      toast.error(mensagemErro(e, "Não foi possível aplicar a ação."));
    },
  });
}

// ── Lixeira (v361, 11/11/2026) ──────────────────────────────────────────────────────────────────────────────────
// Cartão ou lista excluídos ficam 180 dias na Lixeira. O banco guarda o retrato na exclusão (gatilho) e devolve tudo
// como era (gestao_lixeira_restaurar). Cada pessoa vê o que excluiu; gestores veem tudo (lista restrita só para gestor vinculado).

/** Dias que um item fica na Lixeira (o mesmo prazo de gestao_lixeira_limpar). */
export const DIAS_LIXEIRA = 180;

export interface ItemLixeira {
  id: string;
  tipo: "tarefa" | "quadro";
  id_item: string;
  id_quadro: string;
  titulo: string;
  nome_quadro: string | null;
  quadro_existe: boolean;
  mae_existe: boolean;
  excluida_por_nome: string;
  minha: boolean;
  excluida_em: string;
  expira_em: string;
  n_subtarefas: number;
  n_comentarios: number;
  n_anexos: number;
  n_tarefas: number;
  pode_restaurar: boolean;
}

export function useLixeira(enabled: boolean) {
  return useQuery({
    queryKey: ["gestao-lixeira"],
    enabled,
    staleTime: 10 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("gestao_lixeira_listar" as never);
      if (error) throw error;
      return (data ?? []) as unknown as ItemLixeira[];
    },
  });
}

export function useRestaurarLixeira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("gestao_lixeira_restaurar" as never, { p_id: id } as never);
      if (error) throw error;
      return data as unknown as { tipo: "tarefa" | "quadro"; id_item: string; id_quadro: string; titulo: string; tarefas: number };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["gestao-lixeira"] });
      if (r.tipo === "quadro") qc.invalidateQueries({ queryKey: ["gestao-quadros"] });
      refazerListasDeTarefas(qc);
    },
    onError: (e) => {
      toast.error(mensagemErro(e, "Não foi possível restaurar."));
      qc.invalidateQueries({ queryKey: ["gestao-lixeira"] });
    },
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
    onMutate: async (id) => ({ antes: await tirarTarefasDasListas(qc, [id]) }),
    onSuccess: () => refazerListasDeTarefas(qc),
    onError: (e, _id, ctx) => {
      for (const [chave, lista] of ctx?.antes ?? []) qc.setQueryData(chave, lista);   // o cartão volta
      toast.error(mensagemErro(e, "Não foi possível excluir."));
    },
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

/** Contagem de anexos por tarefa (para os cards de um quadro), em lotes de ids. */
export function useAnexosCountQuadro(idQuadro: string | null | undefined, ids: string[]) {
  return useQuery({
    queryKey: ["gestao-anexos-count", idQuadro, ids.length],
    enabled: !!idQuadro && ids.length > 0,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const linhas = await emLotes<{ id_tarefa: string }>(ids, (lote) => sb.from("gestao_anexos").select("id_tarefa").in("id_tarefa", lote));
      const m = new Map<string, number>();
      for (const r of linhas) m.set(r.id_tarefa, (m.get(r.id_tarefa) ?? 0) + 1);
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

/** Chama a Edge Function de IA (Groq). Lança em caso de erro. v0.3.925: "checklist" (não repete os existentes). */
/**
 * 0.3.275: com status de erro, o functions.invoke só diz "non-2xx". A Edge Function gestao-ia manda a recusa escrita
 * para a pessoa no corpo ({ error, codigo: "mensagem_usuario" }); aqui ela vira um erro que o mensagemErro mostra como está.
 */
async function erroDaFuncaoIa(error: unknown): Promise<unknown> {
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (!ctx?.json) return error;
  const corpo = (await ctx.json().catch(() => null)) as { error?: string; codigo?: string } | null;
  if (!corpo?.error) return error;
  return Object.assign(new Error(corpo.error), { code: corpo.codigo });
}

export async function gerarIaGestao(body: { acao: "subtarefas" | "descricao" | "checklist"; titulo: string; descricao?: string; existentes?: string[] }) {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.functions.invoke("gestao-ia", { body });
  if (error) throw await erroDaFuncaoIa(error);
  const d = data as { error?: string; data?: { subtarefas?: string[]; descricao?: string; checklist?: string[] } };
  if (d?.error) throw new Error(d.error);
  return d?.data ?? {};
}

/** 0.3.275 (= Painel 0.3.925): resumo dos comentários pela IA. A Edge Function lê os comentários com o login da pessoa. */
export async function resumirComentariosIa(idTarefa: string) {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.functions.invoke("gestao-ia", { body: { acao: "resumo", id_tarefa: idTarefa } });
  if (error) throw await erroDaFuncaoIa(error);
  const d = data as { error?: string; data?: { resumo: ResumoIa; usados: number; total: number } };
  if (d?.error) throw new Error(d.error);
  if (!d?.data?.resumo) throw new Error("A IA não devolveu o resumo.");
  return d.data;
}

export interface ResponsavelSugerido { email: string; nome: string; tarefas: number }

/** v356: quem costuma ser responsável por tarefas de título parecido neste quadro (histórico, sem IA externa). */
export function useResponsaveisSugeridos(idQuadro: string | null | undefined, texto: string, ativo: boolean) {
  const t = texto.trim();
  return useQuery({
    queryKey: ["gestao-resp-sugeridos", idQuadro, t],
    enabled: !!idQuadro && ativo && t.length >= 6,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await (sb as unknown as {
        rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: ResponsavelSugerido[] | null; error: { message: string } | null }>;
      }).rpc("gestao_sugerir_responsaveis", { p_id_quadro: idQuadro, p_texto: t });
      if (error) return [] as ResponsavelSugerido[]; // sugestão é ajuda: sem ela a tela segue igual
      return data ?? [];
    },
  });
}

// ---- Formulários de entrada (captação por link público) ----
// Tipos de pergunta (F1 GESTAO-KANBAN-03). `tipo` default "texto".
export type TipoPergunta =
  | "texto" | "texto_longo" | "email" | "cnpj" | "cpf" | "telefone"
  | "data" | "data_hora" | "selecao" | "multipla"
  // Arquivos de evidência (OS de T.I): upload em /api/gestao/form/anexo com o ticket do envio.
  | "anexo";
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
  /** Logado no painel não vê a pergunta: a resposta é o nome/e-mail do login (quem está de fora digita). */
  preencher?: "usuario_nome" | "usuario_email" | null;
  /** Seleção (várias) com todas as opções à vista em caixas de seleção (padrão: lista que abre e filtra). */
  caixas?: boolean;
}
// Token de composição do título: "form_title" | "p:<id da pergunta>". Vazio/null = o
// respondente digita o título.
export type TokenTitulo = string;
export interface GestaoFormulario {
  id: string;
  id_quadro: string;
  /** Só no app (useTodosFormularios): nome da lista dona do formulário. */
  quadro_nome?: string | null;
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

/** Todos os formulários que eu enxergo (RLS), com o nome da lista — "Formulários de outras listas". */
export function useTodosFormularios(enabled: boolean) {
  return useQuery({
    queryKey: ["gestao-formularios", "__todos__"],
    enabled,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_formularios").select("*, quadro:gestao_quadros(nome)").order("titulo", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as (GestaoFormulario & { quadro: { nome: string } | null })[])
        .map(({ quadro, ...f }) => ({ ...f, quadro_nome: quadro?.nome ?? null }) as GestaoFormulario);
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
  /** v354 (modelo de tarefa): o que o modelo põe na Nova tarefa. */
  descricao?: string | null;
  checklist?: string[];
  prioridade?: PrioridadeTarefa | null;
  etiquetas?: string[];
  prazo_dias?: number | null;
  prazo_uteis?: boolean;
  /** Aparece em "Usar modelo" na Nova tarefa (os das automações por produto, v350, nascem fora). */
  na_criacao?: boolean;
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
          descricao: m.descricao ?? null,
          checklist: m.checklist ?? [],
          prioridade: m.prioridade ?? null,
          etiquetas: m.etiquetas ?? [],
          prazo_dias: m.prazo_dias ?? null,
          prazo_uteis: m.prazo_uteis ?? false,
          na_criacao: m.na_criacao ?? true,
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

// ---- v338: tarefa ligada à Empresa do cadastro ----
export interface EmpresaSugerida { id_empresa: string; nome: string; municipio: string | null; por: "cnpj" | "nome" }

/** Sugestão pelo CNPJ ou pelo nome no título (a pessoa confirma; nada é gravado). Só para tarefa sem empresa. */
export function useEmpresaSugerida(idTarefa: string | null | undefined, ativo: boolean) {
  return useQuery({
    queryKey: ["gestao-empresa-sugerida", idTarefa],
    enabled: !!idTarefa && ativo,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await (sb as unknown as {
        rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: EmpresaSugerida[] | null; error: { message: string } | null }>;
      }).rpc("gestao_empresa_sugerida", { p_id_tarefa: idTarefa });
      if (error) return [] as EmpresaSugerida[]; // sugestão é ajuda: sem ela a tela segue igual
      return data ?? [];
    },
  });
}

export interface NomeEmpresa { nome: string; municipio: string | null }

/**
 * v342 (Painel v348): opções do campo Produtos da lista Comercial para a tarefa de qualquer lista (a lista Comercial
 * pode ser restrita, e a RLS de gestao_campos não deixa ler de fora). Só a lista de nomes.
 */
export function useProdutosCatalogo(enabled: boolean) {
  return useQuery({
    queryKey: ["gestao-produtos-catalogo"],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient() as unknown as { rpc: (fn: string) => Promise<{ data: unknown; error: unknown }> };
      const { data, error } = await sb.rpc("gestao_produtos_catalogo");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as string[];
    },
  });
}

// ---- v350 (= v363 do Painel): tela "Produtos" (só gestores): criar, renomear e excluir os produtos da Gestão ----
// A lista é a do campo Produtos (a mesma do catálogo acima). Renomear muda em tudo (cartões, formulários, automações,
// responsáveis por produto, filtros salvos); excluir tira da lista e dos formulários e os cartões mantêm.

export interface ProdutoGestao {
  nome: string;
  na_lista: boolean;
  posicao: number | null;
  cartoes: number;
  automacoes: number;
  formularios: number;
  /** Nomes antigos (renomeados) que viram este ao chegar num cartão. */
  apelidos: string[];
}

export function useProdutosGestao(enabled: boolean) {
  return useQuery({
    queryKey: ["gestao-produtos"],
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("gestao_produtos_listar" as never);
      if (error) throw error;
      return (data ?? []) as unknown as ProdutoGestao[];
    },
  });
}

/** Tudo o que mostra produto volta a ler depois de mexer na lista. */
function refazerProdutos(qc: QueryClient) {
  for (const queryKey of [["gestao-produtos"], ["gestao-produtos-catalogo"], ["gestao-campos"], ["gestao-formularios"],
    ["gestao-automacoes"], ["gestao-produto-responsaveis"], ["gestao-filtros"]]) qc.invalidateQueries({ queryKey });
  refazerListasDeTarefas(qc);
}

function useMutacaoProduto<P>(fn: string, args: (p: P) => Record<string, string>, falha: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: P) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc(fn as never, args(p) as never);
      if (error) throw error;
      return data as unknown as Record<string, number | string | boolean>;
    },
    onSuccess: () => refazerProdutos(qc),
    onError: (e) => {
      toast.error(mensagemErro(e, falha));
      qc.invalidateQueries({ queryKey: ["gestao-produtos"] });
    },
  });
}

export const useCriarProduto = () =>
  useMutacaoProduto<string>("gestao_produto_criar", (nome) => ({ p_nome: nome }), "Não foi possível criar o produto.");
export const useRenomearProduto = () =>
  useMutacaoProduto<{ de: string; para: string }>("gestao_produto_renomear", (p) => ({ p_de: p.de, p_para: p.para }), "Não foi possível renomear.");
export const useExcluirProduto = () =>
  useMutacaoProduto<string>("gestao_produto_excluir", (nome) => ({ p_nome: nome }), "Não foi possível excluir.");


/** Nomes das empresas ligadas às tarefas da tela (cartões). Só as que a pessoa vê (RLS de empresas). */
export function useNomesEmpresas(ids: (string | null | undefined)[]) {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))].sort();
  return useQuery({
    queryKey: ["gestao-empresas-nomes", unicos.join(",")],
    enabled: unicos.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const mapa = new Map<string, NomeEmpresa>();
      for (let i = 0; i < unicos.length; i += 80) {
        const { data, error } = await sb.from("empresas").select("id_empresa, nome_empresa, nome_fantasia, municipio").in("id_empresa", unicos.slice(i, i + 80));
        if (error) throw error;
        for (const e of (data ?? []) as unknown as { id_empresa: string; nome_empresa: string; nome_fantasia: string | null; municipio: string | null }[]) {
          mapa.set(e.id_empresa, { nome: e.nome_fantasia?.trim() || e.nome_empresa, municipio: e.municipio });
        }
      }
      return mapa;
    },
  });
}

export interface TarefaDaEmpresa {
  id_tarefa: string;
  titulo: string;
  id_quadro: string;
  quadro: string | null;
  status: string;
  status_nome: string | null;
  status_cor: string | null;
  concluida: boolean;
  prazo: string | null;
  prioridade: PrioridadeTarefa;
  responsavel: string | null;
  created_at: string;
}

/** Ficha da empresa: as tarefas dela que a pessoa vê na Gestão (a RLS da Gestão decide; SECURITY INVOKER). */
export function useTarefasDaEmpresa(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-tarefas-da-empresa", idEmpresa],
    enabled: !!idEmpresa,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await (sb as unknown as {
        rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: TarefaDaEmpresa[] | null; error: { message: string } | null }>;
      }).rpc("gestao_tarefas_da_empresa", { p_id_empresa: idEmpresa });
      if (error) throw error;
      return data ?? [];
    },
  });
}


// ---- v315 (Painel v325): campos que vieram de outro quadro (ex.: Produtos do Comercial), só leitura ----
export interface GestaoCampoOrigem {
  id: string;
  nome: string;
  tipo: string;
  quadro: string;
  valor: unknown;
}

export function useCamposDeOrigem(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-campos-origem", idTarefa],
    enabled: !!idTarefa,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient() as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
      const { data, error } = await sb.rpc("gestao_campos_de_origem", { p_id_tarefa: idTarefa });
      if (error) throw error;
      return (data ?? []) as GestaoCampoOrigem[];
    },
  });
}

// ---- v315 (Painel v322): funcionário responsável pelas subtarefas de cada produto, por quadro ----
export interface GestaoProdutoResponsavel {
  id: string;
  id_quadro: string;
  usuario_email: string;
  produtos: string[];
  ordem: number;
  created_at: string;
}

/** v315 (Painel v326): quem tem acesso a um quadro em Membros e acessos (sem os administradores). */
export function usePessoasDoQuadro(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-pessoas-quadro", idQuadro],
    enabled: !!idQuadro,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient() as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
      const { data, error } = await sb.rpc("gestao_pessoas_do_quadro", { p_id_quadro: idQuadro });
      if (error) throw error;
      return (data ?? []) as { email: string; nome: string; nivel: string }[];
    },
  });
}

export function useProdutoResponsaveis(idQuadro: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-produto-responsaveis", idQuadro],
    enabled: !!idQuadro,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_produto_responsaveis" as never)
        .select("*")
        .eq("id_quadro", idQuadro!)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoProdutoResponsavel[];
    },
  });
}

export function useSalvarProdutoResponsavel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Partial<GestaoProdutoResponsavel> & { id_quadro: string }) => {
      const sb = createSupabaseBrowserClient();
      if (!r.id) {
        const { error } = await sb.from("gestao_produto_responsaveis" as never).insert({
          id_quadro: r.id_quadro,
          usuario_email: (r.usuario_email ?? "").toLowerCase(),
          produtos: r.produtos ?? [],
          ordem: r.ordem ?? 0,
        } as never);
        if (error) throw error;
        return;
      }
      const { id, ...patch } = r;
      const { error } = await sb
        .from("gestao_produto_responsaveis" as never)
        .update({ ...patch, ...(patch.usuario_email ? { usuario_email: patch.usuario_email.toLowerCase() } : {}), updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-produto-responsaveis"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível salvar o funcionário do produto.")),
  });
}

export function useExcluirProdutoResponsavel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_produto_responsaveis" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-produto-responsaveis"] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível excluir a linha.")),
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
  nivel: import("@/lib/gestao/niveis").GestaoNivel;
  /** Recurso do grant: espaço, pasta, lista (id_quadro) ou tarefa. */
  recurso_tipo?: "space" | "folder" | "list" | "task";
  recurso_id?: string;
  restritivo?: boolean | null;
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
    mutationFn: async (p: { id_tarefa: string; texto: string; autor: string | null; atribuido_a?: string | null }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_comentarios").insert({
        id_comentario: gerarId("CMT"),
        id_tarefa: p.id_tarefa,
        autor: p.autor,
        texto: p.texto,
        ...(p.atribuido_a ? { atribuido_a: p.atribuido_a.toLowerCase() } : {}),
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
  /** v300: tarefa filha criada no 1º duplo clique (janela completa da subtarefa). */
  id_tarefa_filha: string | null;
  created_at: string;
  /** v357: colunas do Runrun (a sincronização preenche; subtarefa da Gestão fica vazia). */
  etapa_nome: string | null;
  tipo_cor: string | null;
  alocados: AlocadoSubtarefa[];
  tempo_trabalhado_seg: number | null;
  progresso: number | null;
  inicio_desejado: string | null;
  /** v358: entrega desejada no Runrun. */
  entrega_desejada: string | null;
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
        .select("id,id_tarefa,texto,feito,ordem,etapa,tipo,responsavel_email,id_tarefa_filha,created_at,etapa_nome,tipo_cor,alocados,tempo_trabalhado_seg,progresso,inicio_desejado,entrega_desejada")
        .eq("id_tarefa", idTarefa!)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoSubtarefa[];
    },
  });
}

/** Quantos comentários tem a janela (tarefa filha, v292) de cada subtarefa: o balão na lista de
 *  subtarefas. Devolve { id_tarefa_filha: quantidade } só das que têm comentário. */
export function useComentariosDasSubtarefas(idsFilhas: string[]) {
  const chave = [...idsFilhas].sort().join(",");
  return useQuery({
    queryKey: ["gestao-comentarios-subtarefas", chave],
    enabled: idsFilhas.length > 0,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_comentarios").select("id_tarefa").in("id_tarefa", chave.split(","));
      if (error) throw error;
      const n: Record<string, number> = {};
      for (const c of (data ?? []) as { id_tarefa: string }[]) n[c.id_tarefa] = (n[c.id_tarefa] ?? 0) + 1;
      return n;
    },
  });
}

/** v300: abre a subtarefa na janela completa — a RPC cria a tarefa filha no 1º uso (ou devolve a
 *  existente) e aqui se lê a linha inteira para o TarefaModal. */
export function useAbrirSubtarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_subtarefa: string; id_tarefa: string }) => {
      const sb = createSupabaseBrowserClient();
      const { data: idFilha, error } = await sb.rpc("gestao_subtarefa_abrir", { p_id_subtarefa: p.id_subtarefa } as never);
      if (error) throw error;
      const { data, error: e2 } = await sb.from("gestao_tarefas").select("*").eq("id_tarefa", idFilha as unknown as string).single();
      if (e2) throw e2;
      return data as unknown as GestaoTarefa;
    },
    onSuccess: (_t, p) => qc.invalidateQueries({ queryKey: ["gestao-subtarefas", p.id_tarefa] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível abrir a subtarefa.")),
  });
}

/** v300: lê uma tarefa pelo id (RLS decide). Para o link direto/aviso que aponta para a filha de uma
 *  subtarefa, que não vem na lista do quadro. */
export async function buscarTarefa(idTarefa: string): Promise<GestaoTarefa | null> {
  const sb = createSupabaseBrowserClient();
  const { data } = await sb.from("gestao_tarefas").select("*").eq("id_tarefa", idTarefa).maybeSingle();
  return (data as unknown as GestaoTarefa | null) ?? null;
}

/**
 * v300: a tarefa-mãe da janela da subtarefa — o título vai no cabeçalho e, desde 11/11/2026, a descrição do
 * cartão original aparece na aba Descrição da subtarefa (só leitura, sempre a atual). A RLS decide: quem não vê a
 * mãe recebe null e a janela fica como antes.
 */
export function useTarefaMae(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-tarefa-mae", idTarefa],
    enabled: !!idTarefa,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_tarefas").select("titulo,descricao").eq("id_tarefa", idTarefa!).maybeSingle();
      if (error) throw error;
      return (data as { titulo: string; descricao: string | null } | null) ?? null;
    },
  });
}

/** Reconcilia as subtarefas de uma tarefa a partir do estado do modal (Subtarefa[] =
 *  {texto,feito} na ordem visual). Estrategia = delete-all + insert ordenado — satelite
 *  com DML direto (grants iguais a gestao_anexos; sem RPC), espelhando a reconciliacao
 *  delete+insert. O trigger-espelho v199 reescreve gestao_tarefas.subtarefas (jsonb). A
 *  UX-A e preservada: o flush de novaSub acontece no modal e chega aqui como +1 item;
 *  a IA chega como N itens; ordem = indice visual. */
/** v351: item do checklist da tarefa (sem responsável; quem marcou e quando vêm do banco). */
export interface GestaoChecklistItem {
  id: string;
  id_tarefa: string;
  texto: string;
  feito: boolean;
  ordem: number;
  feito_por: string | null;
  feito_em: string | null;
  created_by: string | null;
  created_at: string;
}

export function useChecklist(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-checklist", idTarefa],
    enabled: !!idTarefa,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_checklist_itens")
        .select("id,id_tarefa,texto,feito,ordem,feito_por,feito_em,created_by,created_at")
        .eq("id_tarefa", idTarefa!)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GestaoChecklistItem[];
    },
  });
}

/** Acrescenta itens no fim do checklist (um ou vários — colar uma lista vira um item por linha). */
export function useAddChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; textos: string[]; ordemInicial: number }) => {
      const linhas = p.textos.map((t) => t.trim()).filter(Boolean)
        .map((texto, i) => ({ id: gerarId("CHK"), id_tarefa: p.id_tarefa, texto, ordem: p.ordemInicial + i }));
      if (!linhas.length) return;
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_checklist_itens").insert(linhas as never);
      if (error) throw error;
    },
    onSuccess: (_d, p) => qc.invalidateQueries({ queryKey: ["gestao-checklist", p.id_tarefa] }),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível adicionar ao checklist.")),
  });
}

/** Marca/desmarca ou troca o texto de um item — na hora, sem esperar o "Salvar" da janela. */
export function useAtualizarChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; id_tarefa: string; patch: { feito?: boolean; texto?: string } }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_checklist_itens").update(p.patch as never).eq("id", p.id);
      if (error) throw error;
    },
    onMutate: async (p) => {
      const chave = ["gestao-checklist", p.id_tarefa];
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<GestaoChecklistItem[]>(chave);
      qc.setQueryData<GestaoChecklistItem[]>(chave, (l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, ...p.patch } : x)));
      return { antes };
    },
    onError: (e, p, ctx) => {
      qc.setQueryData(["gestao-checklist", p.id_tarefa], ctx?.antes);
      toast.error(mensagemErro(e, "Não foi possível alterar o item."));
    },
    onSettled: (_d, _e, p) => qc.invalidateQueries({ queryKey: ["gestao-checklist", p.id_tarefa] }),
  });
}

export function useExcluirChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; id_tarefa: string }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("gestao_checklist_itens").delete().eq("id", p.id);
      if (error) throw error;
    },
    onMutate: async (p) => {
      const chave = ["gestao-checklist", p.id_tarefa];
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<GestaoChecklistItem[]>(chave);
      qc.setQueryData<GestaoChecklistItem[]>(chave, (l) => (l ?? []).filter((x) => x.id !== p.id));
      return { antes };
    },
    onError: (e, p, ctx) => {
      qc.setQueryData(["gestao-checklist", p.id_tarefa], ctx?.antes);
      toast.error(mensagemErro(e, "Não foi possível excluir o item."));
    },
    onSettled: (_d, _e, p) => qc.invalidateQueries({ queryKey: ["gestao-checklist", p.id_tarefa] }),
  });
}

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
      qc.invalidateQueries({ queryKey: ["gestao-minhas"] });
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
  /** Lista (quadro) da tarefa — null se a RLS não deixa ver a tarefa. Decide quem vê a aprovação SEM
   *  aprovador na Caixa de entrada (o banco só deixa decidir gestor ou quem edita a lista — v315). */
  id_quadro: string | null;
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
        .select("id,id_tarefa,solicitado_por,aprovador_email,status,motivo,decidido_em,created_at,tarefa:gestao_tarefas(id_quadro)")
        .eq("status", "pendente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as (Omit<GestaoAprovacao, "id_quadro"> & { tarefa: { id_quadro: string } | null })[])
        .map(({ tarefa, ...a }) => ({ ...a, id_quadro: tarefa?.id_quadro ?? null }));
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
      }).rpc.bind(sb); // 0.3.270: sem o bind, rpc(...) perde o cliente e quebra ("reading 'rest'").
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
