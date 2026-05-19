"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import { CATALOGO_NR12 } from "@/lib/apreciacao-maquinas/catalogo-nr12";
import type {
  ApreciacaoMaquina,
  ApreciacaoMaquinaItem,
  SituacaoApreciacaoItem,
  StatusApreciacao,
  RiscoResidual,
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

      // Snapshot dos itens do catálogo
      const itens: ApreciacaoMaquinaItem[] = CATALOGO_NR12.map((it, idx) => ({
        id_item: gerarId("APRI"),
        id_apreciacao,
        item_codigo: it.codigo,
        item_categoria: it.categoria,
        item_titulo: it.titulo,
        item_descricao: it.descricao ?? null,
        ordem: idx,
        situacao: "PENDENTE",
        observacao: null,
        recomendacao: null,
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
    }) => {
      const supabase = createSupabaseBrowserClient();
      const patch: Partial<ApreciacaoMaquinaItem> = {
        updated_at: new Date().toISOString(),
      };
      if (params.situacao !== undefined) patch.situacao = params.situacao;
      if (params.observacao !== undefined) patch.observacao = params.observacao;
      if (params.recomendacao !== undefined)
        patch.recomendacao = params.recomendacao;

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
  });
}
