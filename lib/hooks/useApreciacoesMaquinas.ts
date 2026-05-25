"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import { CATALOGO_NR12 } from "@/lib/apreciacao-maquinas/catalogo-nr12";
import type {
  ApreciacaoMaquina,
  ApreciacaoMaquinaItem,
  ApreciacaoAcao,
  SituacaoApreciacaoItem,
  StatusApreciacao,
  StatusAcaoApreciacao,
  PrioridadeAcaoApreciacao,
  RiscoResidual,
  NivelRisco,
} from "@/lib/supabase/types";

const KEY_LISTA = ["apreciacoes-maquinas"] as const;
const KEY_DETALHE = (id: string) => ["apreciacao-maquina", id] as const;

// ============================================================
// Cabeçalho — lista e CRUD do laudo
// ============================================================

async function fetchLista(
  empresasVinculadas: string[] | null
): Promise<ApreciacaoMaquina[]> {
  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("apreciacoes_maquinas")
    .select("*")
    .order("created_at", { ascending: false });
  if (empresasVinculadas && empresasVinculadas.length > 0) {
    q = q.in("id_empresa", empresasVinculadas);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ApreciacaoMaquina[];
}

export function useApreciacoesMaquinas() {
  const user = useUserStore((s) => s.user);
  const vinculos =
    user?.perfil === "Tecnico" &&
    user.empresas_vinculadas &&
    user.empresas_vinculadas.length > 0
      ? user.empresas_vinculadas
      : null;

  return useQuery({
    queryKey: [...KEY_LISTA, vinculos],
    queryFn: () => fetchLista(vinculos),
  });
}

export function useApreciacaoMaquina(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_DETALHE(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const [{ data: apreciacao, error: e1 }, { data: itens, error: e2 }] =
        await Promise.all([
          supabase
            .from("apreciacoes_maquinas")
            .select("*")
            .eq("id_apreciacao", id!)
            .single(),
          supabase
            .from("apreciacoes_maquinas_itens")
            .select("*")
            .eq("id_apreciacao", id!)
            .order("ordem", { ascending: true }),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        apreciacao: apreciacao as unknown as ApreciacaoMaquina,
        itens: (itens ?? []) as unknown as ApreciacaoMaquinaItem[],
      };
    },
  });
}

export interface CriarApreciacaoInput {
  id_empresa: string;
  id_maquina: string | null;
  maquina_descricao: string | null;
  titulo: string | null;
  setor: string | null;
  responsavel: string | null;
  responsavel_empresa: string | null;
  cidade: string | null;
  data_apreciacao: string | null;
}

/**
 * Cria apreciação + faz snapshot dos itens do catálogo NR-12.
 * Mudanças futuras no catálogo NÃO afetam apreciações já criadas.
 */
export function useCriarApreciacaoMaquina() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: CriarApreciacaoInput) => {
      const supabase = createSupabaseBrowserClient();
      const id_apreciacao = gerarId("APR");

      const cabecalho: ApreciacaoMaquina = {
        id_apreciacao,
        id_empresa: input.id_empresa,
        id_maquina: input.id_maquina,
        maquina_descricao: input.maquina_descricao,
        titulo: input.titulo,
        setor: input.setor,
        responsavel: input.responsavel,
        responsavel_empresa: input.responsavel_empresa,
        cidade: input.cidade,
        data_apreciacao: input.data_apreciacao,
        conclusao_tecnica: null,
        recomendacoes: null,
        risco_residual: null,
        status: "RASCUNHO",
        finalizado_em: null,
        observacoes_gerais: null,
        usuario_email: user?.email ?? null,
        usuario_nome: user?.nome ?? null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };

      const { error: e1 } = await supabase
        .from("apreciacoes_maquinas")
        .insert(cabecalho as never);
      if (e1) throw e1;

      // Snapshot dos itens do catálogo (item_origem = null marca "veio do catálogo")
      const itens: ApreciacaoMaquinaItem[] = CATALOGO_NR12.map((it, idx) => ({
        id_item: gerarId("APRI"),
        id_apreciacao,
        item_codigo: it.codigo,
        item_categoria: it.categoria,
        item_titulo: it.titulo,
        item_descricao: it.descricao ?? null,
        item_origem: null,
        ordem: idx,
        situacao: "PENDENTE",
        observacao: null,
        recomendacao: null,
        probabilidade: null,
        severidade: null,
        nivel_risco_calculado: null,
        id_matriz: null,
        foto_urls: [],
        foto_storage_paths: [],
        created_at: new Date().toISOString(),
        updated_at: null,
      }));

      const { error: e2 } = await supabase
        .from("apreciacoes_maquinas_itens")
        .insert(itens as never);
      if (e2) throw e2;

      return cabecalho;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
    onError: (e: Error) => toast.error(`Erro ao criar: ${e.message}`),
  });
}

export function useAtualizarApreciacaoMaquina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_apreciacao: string;
      titulo?: string | null;
      id_maquina?: string | null;
      maquina_descricao?: string | null;
      setor?: string | null;
      responsavel?: string | null;
      responsavel_empresa?: string | null;
      cidade?: string | null;
      data_apreciacao?: string | null;
      conclusao_tecnica?: string | null;
      recomendacoes?: string | null;
      risco_residual?: RiscoResidual | null;
      observacoes_gerais?: string | null;
      status?: StatusApreciacao;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const patch: Partial<ApreciacaoMaquina> = {
        updated_at: new Date().toISOString(),
      };
      if (params.titulo !== undefined) patch.titulo = params.titulo;
      if (params.id_maquina !== undefined) patch.id_maquina = params.id_maquina;
      if (params.maquina_descricao !== undefined)
        patch.maquina_descricao = params.maquina_descricao;
      if (params.setor !== undefined) patch.setor = params.setor;
      if (params.responsavel !== undefined)
        patch.responsavel = params.responsavel;
      if (params.responsavel_empresa !== undefined)
        patch.responsavel_empresa = params.responsavel_empresa;
      if (params.cidade !== undefined) patch.cidade = params.cidade;
      if (params.data_apreciacao !== undefined)
        patch.data_apreciacao = params.data_apreciacao;
      if (params.conclusao_tecnica !== undefined)
        patch.conclusao_tecnica = params.conclusao_tecnica;
      if (params.recomendacoes !== undefined)
        patch.recomendacoes = params.recomendacoes;
      if (params.risco_residual !== undefined)
        patch.risco_residual = params.risco_residual;
      if (params.observacoes_gerais !== undefined)
        patch.observacoes_gerais = params.observacoes_gerais;
      if (params.status !== undefined) {
        patch.status = params.status;
        if (params.status === "FINALIZADO") {
          patch.finalizado_em = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from("apreciacoes_maquinas")
        .update(patch as never)
        .eq("id_apreciacao", params.id_apreciacao);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_apreciacao) });
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirApreciacaoMaquina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_apreciacao: string) => {
      const supabase = createSupabaseBrowserClient();
      // Best-effort: limpa fotos de TODOS os itens antes do delete em cascata
      const { data: itens } = await supabase
        .from("apreciacoes_maquinas_itens")
        .select("foto_storage_paths")
        .eq("id_apreciacao", id_apreciacao);
      const paths = (
        (itens ?? []) as { foto_storage_paths: string[] }[]
      ).flatMap((i) => i.foto_storage_paths ?? []);
      if (paths.length > 0) {
        await supabase.storage.from("fotos").remove(paths);
      }
      const { error } = await supabase
        .from("apreciacoes_maquinas")
        .delete()
        .eq("id_apreciacao", id_apreciacao);
      if (error) throw error;
      return id_apreciacao;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

// ============================================================
// Itens — atualização individual + fotos
// ============================================================

export function useAtualizarItemApreciacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_apreciacao: string;
      id_item: string;
      situacao?: SituacaoApreciacaoItem;
      observacao?: string | null;
      recomendacao?: string | null;
      probabilidade?: string | null;
      severidade?: string | null;
      nivel_risco_calculado?: NivelRisco | null;
      id_matriz?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const patch: Partial<ApreciacaoMaquinaItem> = {
        updated_at: new Date().toISOString(),
      };
      if (params.situacao !== undefined) patch.situacao = params.situacao;
      if (params.observacao !== undefined) patch.observacao = params.observacao;
      if (params.recomendacao !== undefined)
        patch.recomendacao = params.recomendacao;
      if (params.probabilidade !== undefined)
        patch.probabilidade = params.probabilidade;
      if (params.severidade !== undefined) patch.severidade = params.severidade;
      if (params.nivel_risco_calculado !== undefined)
        patch.nivel_risco_calculado = params.nivel_risco_calculado;
      if (params.id_matriz !== undefined) patch.id_matriz = params.id_matriz;

      const { error } = await supabase
        .from("apreciacoes_maquinas_itens")
        .update(patch as never)
        .eq("id_item", params.id_item);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_apreciacao) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const MAX_FOTOS_POR_ITEM_APR = 6;

export function useUploadFotoItemApreciacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_apreciacao: string;
      id_item: string;
      file: File;
      fotos_urls_atuais: string[];
      fotos_paths_atuais: string[];
    }) => {
      const supabase = createSupabaseBrowserClient();

      if (params.fotos_paths_atuais.length >= MAX_FOTOS_POR_ITEM_APR) {
        throw new Error(
          `Limite de ${MAX_FOTOS_POR_ITEM_APR} fotos por item atingido.`
        );
      }

      const ext = (params.file.name.split(".").pop() ?? "jpg").toLowerCase();
      const sufixo = Math.random().toString(36).slice(2, 8);
      const path = `apreciacao-maquinas/${params.id_apreciacao}/${params.id_item}-${sufixo}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("fotos")
        .upload(path, params.file, {
          upsert: false,
          contentType: params.file.type,
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);

      const novasUrls = [...params.fotos_urls_atuais, pub.publicUrl];
      const novosPaths = [...params.fotos_paths_atuais, path];

      const { error: updateErr } = await supabase
        .from("apreciacoes_maquinas_itens")
        .update({
          foto_urls: novasUrls,
          foto_storage_paths: novosPaths,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_item", params.id_item);
      if (updateErr) throw updateErr;

      return { foto_url: pub.publicUrl, path };
    },
    onSuccess: (_d, params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_apreciacao) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Adiciona um item LIVRE à apreciação — quando o auditor encontra algo
 * relevante que não está no catálogo NR-12. Recebe categoria + título +
 * descrição opcional. Código gerado como "LIVRE-{N}" onde N é o próximo
 * índice sequencial de itens livres já presentes na apreciação.
 */
export function useAdicionarItemLivreApreciacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_apreciacao: string;
      categoria: string;
      titulo: string;
      descricao?: string | null;
      /** Ordem do item (geralmente último do array + 1). */
      ordem: number;
      /** Contagem atual de itens livres pra gerar o próximo código LIVRE-N. */
      proximoIndiceLivre: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const id_item = gerarId("APRI");
      const row: ApreciacaoMaquinaItem = {
        id_item,
        id_apreciacao: params.id_apreciacao,
        item_codigo: `LIVRE-${params.proximoIndiceLivre}`,
        item_categoria: params.categoria,
        item_titulo: params.titulo,
        item_descricao: params.descricao ?? null,
        item_origem: "LIVRE",
        ordem: params.ordem,
        situacao: "PENDENTE",
        observacao: null,
        recomendacao: null,
        probabilidade: null,
        severidade: null,
        nivel_risco_calculado: null,
        id_matriz: null,
        foto_urls: [],
        foto_storage_paths: [],
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      const { error } = await supabase
        .from("apreciacoes_maquinas_itens")
        .insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(row.id_apreciacao) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Exclui um item da apreciação. Só faz sentido pra itens LIVRES — itens do
 * catálogo (item_origem = null) devem ser avaliados como NAO_APLICAVEL ao
 * invés de excluídos, pra preservar o snapshot regulatório. A UI deve gatear
 * isso; aqui o hook aceita qualquer id_item por simplicidade.
 */
export function useExcluirItemApreciacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_apreciacao: string;
      id_item: string;
    }) => {
      const supabase = createSupabaseBrowserClient();
      // Limpa fotos do storage primeiro (best-effort)
      const { data: itemAtual } = await supabase
        .from("apreciacoes_maquinas_itens")
        .select("foto_storage_paths")
        .eq("id_item", params.id_item)
        .single();
      const paths =
        (itemAtual as { foto_storage_paths: string[] } | null)
          ?.foto_storage_paths ?? [];
      if (paths.length > 0) {
        await supabase.storage.from("fotos").remove(paths);
      }
      const { error } = await supabase
        .from("apreciacoes_maquinas_itens")
        .delete()
        .eq("id_item", params.id_item);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_apreciacao) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================
// Plano de Ação — STANDALONE da apreciação (não vincula com Painel SST)
// ============================================================

const KEY_ACOES = (id_apreciacao: string) =>
  ["apreciacao-acoes", id_apreciacao] as const;

/** Mapeia nível de risco do Painel SST → prioridade da ação da apreciação. */
function prioridadePorNivel(
  nivel: NivelRisco | null
): PrioridadeAcaoApreciacao {
  switch (nivel) {
    case "Muito Alto":
      return "Critica";
    case "Alto":
      return "Alta";
    case "Moderado":
      return "Media";
    case "Baixo":
    case "Trivial":
    case null:
    default:
      return "Baixa";
  }
}

/** Lista as ações da apreciação, ordenadas por `ordem`. */
export function useAcoesApreciacao(id_apreciacao: string | null | undefined) {
  return useQuery({
    queryKey: KEY_ACOES(id_apreciacao ?? ""),
    enabled: !!id_apreciacao,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("apreciacao_acoes")
        .select("*")
        .eq("id_apreciacao", id_apreciacao!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ApreciacaoAcao[];
    },
  });
}

export interface CriarAcaoApreciacaoInput {
  id_apreciacao: string;
  /** Item NAO_CONFORME que originou. Null = ação geral do laudo. */
  id_item?: string | null;
  ordem: number;
  what_acao: string;
  why_justificativa?: string | null;
  where_local?: string | null;
  when_prazo?: string | null;
  who_responsavel?: string | null;
  how_metodo?: string | null;
  how_much_custo?: string | null;
  prioridade?: PrioridadeAcaoApreciacao;
}

export function useCriarAcaoApreciacao() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (input: CriarAcaoApreciacaoInput) => {
      const supabase = createSupabaseBrowserClient();
      const row: ApreciacaoAcao = {
        id_acao: gerarId("AAC"),
        id_apreciacao: input.id_apreciacao,
        id_item: input.id_item ?? null,
        ordem: input.ordem,
        what_acao: input.what_acao,
        why_justificativa: input.why_justificativa ?? null,
        where_local: input.where_local ?? null,
        when_prazo: input.when_prazo ?? null,
        who_responsavel: input.who_responsavel ?? null,
        how_metodo: input.how_metodo ?? null,
        how_much_custo: input.how_much_custo ?? null,
        status: "Pendente",
        prioridade: input.prioridade ?? "Media",
        data_conclusao: null,
        observacoes: null,
        created_by: user?.email ?? null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      const { error } = await supabase
        .from("apreciacao_acoes")
        .insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY_ACOES(row.id_apreciacao) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAtualizarAcaoApreciacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_apreciacao: string;
      id_acao: string;
      what_acao?: string;
      why_justificativa?: string | null;
      where_local?: string | null;
      when_prazo?: string | null;
      who_responsavel?: string | null;
      how_metodo?: string | null;
      how_much_custo?: string | null;
      status?: StatusAcaoApreciacao;
      prioridade?: PrioridadeAcaoApreciacao;
      data_conclusao?: string | null;
      observacoes?: string | null;
      ordem?: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { id_apreciacao, id_acao, ...rest } = params;
      const patch: Partial<ApreciacaoAcao> = {
        ...rest,
        updated_at: new Date().toISOString(),
      };
      if (params.status === "Concluida" && !params.data_conclusao) {
        patch.data_conclusao = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase
        .from("apreciacao_acoes")
        .update(patch as never)
        .eq("id_acao", id_acao);
      if (error) throw error;
      return { id_apreciacao, id_acao };
    },
    onSuccess: ({ id_apreciacao }) => {
      qc.invalidateQueries({ queryKey: KEY_ACOES(id_apreciacao) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirAcaoApreciacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id_apreciacao: string; id_acao: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("apreciacao_acoes")
        .delete()
        .eq("id_acao", params.id_acao);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_ACOES(params.id_apreciacao) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface GerarPlanoResult {
  criadas: number;
  ignoradas: number;
}

/**
 * Gera ações pendentes a partir dos itens NAO_CONFORME da apreciação.
 * Idempotente: itens que JÁ têm ação vinculada são ignorados (por `id_item`).
 * Prioridade mapeada de `nivel_risco_calculado`.
 */
export function useGerarPlanoApreciacao() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (params: {
      apreciacao: ApreciacaoMaquina;
      itens: ApreciacaoMaquinaItem[];
    }): Promise<GerarPlanoResult> => {
      const supabase = createSupabaseBrowserClient();
      const naoConforme = params.itens.filter(
        (i) => i.situacao === "NAO_CONFORME"
      );
      if (naoConforme.length === 0) {
        return { criadas: 0, ignoradas: 0 };
      }

      // Quais itens da apreciação JÁ têm ação? (idempotência)
      const { data: existentes, error: eExist } = await supabase
        .from("apreciacao_acoes")
        .select("id_item, ordem")
        .eq("id_apreciacao", params.apreciacao.id_apreciacao);
      if (eExist) throw eExist;
      const linhasExistentes =
        (existentes ?? []) as { id_item: string | null; ordem: number }[];
      const jaVinculados = new Set(
        linhasExistentes
          .map((r) => r.id_item)
          .filter((s): s is string => !!s)
      );
      const maxOrdem = linhasExistentes.reduce(
        (m, r) => (r.ordem > m ? r.ordem : m),
        -1
      );

      const novos = naoConforme.filter((i) => !jaVinculados.has(i.id_item));
      if (novos.length === 0) {
        return { criadas: 0, ignoradas: naoConforme.length };
      }

      const setorTexto = params.apreciacao.setor
        ? `${params.apreciacao.setor} (NR-12)`
        : "Apreciação NR-12";

      const linhas: ApreciacaoAcao[] = novos.map((it, idx) => ({
        id_acao: gerarId("AAC"),
        id_apreciacao: params.apreciacao.id_apreciacao,
        id_item: it.id_item,
        ordem: maxOrdem + 1 + idx,
        what_acao: `${it.item_codigo} — ${it.item_titulo}`.slice(0, 240),
        why_justificativa: it.observacao,
        where_local: setorTexto,
        when_prazo: null,
        who_responsavel: params.apreciacao.responsavel_empresa,
        how_metodo: it.recomendacao,
        how_much_custo: null,
        status: "Pendente",
        prioridade: prioridadePorNivel(it.nivel_risco_calculado),
        data_conclusao: null,
        observacoes: null,
        created_by: user?.email ?? null,
        created_at: new Date().toISOString(),
        updated_at: null,
      }));

      const { error } = await supabase
        .from("apreciacao_acoes")
        .insert(linhas as never);
      if (error) throw error;

      return {
        criadas: novos.length,
        ignoradas: naoConforme.length - novos.length,
      };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: KEY_ACOES(vars.apreciacao.id_apreciacao),
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================
// IA — geração do parecer técnico
// ============================================================

export interface ParecerIAInput {
  empresa?: { nome?: string | null } | null;
  maquina?: { nome?: string | null; descricao?: string | null } | null;
  setor?: string | null;
  responsavel?: string | null;
  itens: Array<{
    codigo: string;
    categoria: string;
    titulo: string;
    situacao: SituacaoApreciacaoItem;
    observacao?: string | null;
    recomendacao?: string | null;
    livre?: boolean;
  }>;
  textoAtual?: string | null;
}

export interface ParecerIAOutput {
  conclusao_tecnica: string;
  recomendacoes_finais: string;
  risco_residual_sugerido: RiscoResidual | null;
}

/**
 * Chama a edge function `gerar-parecer-apreciacao-ia` (Groq) com o checklist
 * preenchido e devolve `{ conclusao_tecnica, recomendacoes_finais,
 * risco_residual_sugerido }`. A UI exibe pro auditor revisar e salvar.
 *
 * Não persiste nada — só transporta da IA pra UI. O usuário decide se
 * aceita/edita e clica "Salvar conclusão".
 */
export function useGerarParecerApreciacaoIA() {
  return useMutation({
    mutationFn: async (input: ParecerIAInput): Promise<ParecerIAOutput> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke(
        "gerar-parecer-apreciacao-ia",
        { body: input }
      );
      if (error) throw error;
      const payload = (data as { data?: ParecerIAOutput } | null)?.data;
      if (!payload?.conclusao_tecnica) {
        throw new Error("Resposta inválida da IA — tente novamente");
      }
      return payload;
    },
  });
}

// ============================================================
// IA — análise de foto (vision) pra gerar observação técnica
// ============================================================

export interface AnalisarFotoIAInput {
  foto_urls: string[];
  item_codigo: string;
  item_titulo: string;
  item_descricao?: string | null;
  categoria?: string | null;
  textoAtual?: string | null;
}

export interface AnalisarFotoIAOutput {
  observacao: string;
}

/**
 * Invoca a edge function `analisar-foto-apreciacao-ia` (Groq vision) com
 * as URLs públicas das fotos + contexto do requisito NR-12. Retorna uma
 * observação técnica descritiva pra preencher o campo do item.
 */
export function useAnalisarFotoApreciacaoIA() {
  return useMutation({
    mutationFn: async (
      input: AnalisarFotoIAInput
    ): Promise<AnalisarFotoIAOutput> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke(
        "analisar-foto-apreciacao-ia",
        { body: input }
      );
      if (error) throw error;
      const payload = (data as { data?: AnalisarFotoIAOutput } | null)?.data;
      if (!payload?.observacao) {
        throw new Error("Resposta inválida da IA — tente novamente");
      }
      return payload;
    },
  });
}

export function useRemoverFotoItemApreciacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_apreciacao: string;
      id_item: string;
      foto_storage_path: string;
      fotos_urls_atuais: string[];
      fotos_paths_atuais: string[];
    }) => {
      const supabase = createSupabaseBrowserClient();
      // Storage: best-effort
      await supabase.storage.from("fotos").remove([params.foto_storage_path]);

      const idx = params.fotos_paths_atuais.indexOf(params.foto_storage_path);
      const novasUrls = params.fotos_urls_atuais.filter((_, i) => i !== idx);
      const novosPaths = params.fotos_paths_atuais.filter((_, i) => i !== idx);

      const { error } = await supabase
        .from("apreciacoes_maquinas_itens")
        .update({
          foto_urls: novasUrls,
          foto_storage_paths: novosPaths,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_item", params.id_item);
      if (error) throw error;
      return params;
    },
    onSuccess: (_d, params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_apreciacao) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
