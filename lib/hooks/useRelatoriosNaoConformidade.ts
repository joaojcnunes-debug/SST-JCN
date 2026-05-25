"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import { getChecklistNR } from "@/lib/conformidade/checklists";
import type {
  CriticidadeNC,
  RelatorioNaoConformidade,
  RelatorioNaoConformidadeItem,
  StatusRelatorioNC,
  StatusTratativaNC,
} from "@/lib/supabase/types";

const KEY_LISTA = ["relatorios-nao-conformidade"] as const;
const KEY_DETALHE = (id: string) =>
  ["relatorio-nao-conformidade", id] as const;

async function fetchLista(
  empresasVinculadas: string[] | null
): Promise<RelatorioNaoConformidade[]> {
  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("relatorios_nao_conformidade")
    .select("*")
    .order("created_at", { ascending: false });
  if (empresasVinculadas && empresasVinculadas.length > 0) {
    q = q.in("id_empresa", empresasVinculadas);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as RelatorioNaoConformidade[];
}

export function useRelatoriosNaoConformidade() {
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

export function useRelatorioNaoConformidade(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_DETALHE(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const [{ data: relatorio, error: e1 }, { data: itens, error: e2 }] =
        await Promise.all([
          supabase
            .from("relatorios_nao_conformidade")
            .select("*")
            .eq("id_relatorio", id!)
            .single(),
          supabase
            .from("relatorios_nao_conformidade_itens")
            .select("*")
            .eq("id_relatorio", id!)
            .order("ordem", { ascending: true }),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        relatorio: relatorio as unknown as RelatorioNaoConformidade,
        itens: (itens ?? []) as unknown as RelatorioNaoConformidadeItem[],
      };
    },
  });
}

export interface CriarRelatorioNaoConformidadeInput {
  id_empresa: string;
  titulo: string;
  /** NR opcional. Se setada, o título da NR vem do catálogo. */
  nr_codigo: string | null;
  setor: string | null;
  responsavel: string | null;
  responsavel_empresa: string | null;
  cidade: string | null;
  data_inspecao: string | null;
}

export function useCriarRelatorioNaoConformidade() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: CriarRelatorioNaoConformidadeInput) => {
      const supabase = createSupabaseBrowserClient();
      const id_relatorio = gerarId("RNC");

      // Snapshot do título da NR (catálogo é a única fonte; guarda pra
      // sobreviver a mudanças futuras no catálogo)
      let nr_titulo: string | null = null;
      if (input.nr_codigo) {
        const checklist = getChecklistNR(input.nr_codigo);
        if (!checklist) {
          throw new Error(`NR não encontrada: ${input.nr_codigo}`);
        }
        nr_titulo = checklist.titulo;
      }

      const row: RelatorioNaoConformidade = {
        id_relatorio,
        id_empresa: input.id_empresa,
        titulo: input.titulo,
        nr_codigo: input.nr_codigo,
        nr_titulo,
        setor: input.setor,
        responsavel: input.responsavel,
        responsavel_empresa: input.responsavel_empresa,
        cidade: input.cidade,
        data_inspecao: input.data_inspecao,
        observacoes_gerais: null,
        status: "RASCUNHO",
        finalizado_em: null,
        usuario_email: user?.email ?? null,
        usuario_nome: user?.nome ?? null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };

      const { error } = await supabase
        .from("relatorios_nao_conformidade")
        .insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
    onError: (e: Error) => toast.error(`Erro ao criar relatório: ${e.message}`),
  });
}

export function useAtualizarRelatorioNaoConformidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      titulo?: string;
      /** Passe null pra desvincular a NR. Quando trocar de NR, o título é
       *  re-snapshotado do catálogo. */
      nr_codigo?: string | null;
      setor?: string | null;
      responsavel?: string | null;
      responsavel_empresa?: string | null;
      cidade?: string | null;
      data_inspecao?: string | null;
      observacoes_gerais?: string | null;
      status?: StatusRelatorioNC;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const patch: Partial<RelatorioNaoConformidade> = {
        updated_at: new Date().toISOString(),
      };
      if (params.titulo !== undefined) patch.titulo = params.titulo;
      if (params.nr_codigo !== undefined) {
        patch.nr_codigo = params.nr_codigo;
        if (params.nr_codigo) {
          const checklist = getChecklistNR(params.nr_codigo);
          if (!checklist) {
            throw new Error(`NR não encontrada: ${params.nr_codigo}`);
          }
          patch.nr_titulo = checklist.titulo;
        } else {
          patch.nr_titulo = null;
        }
      }
      if (params.setor !== undefined) patch.setor = params.setor;
      if (params.responsavel !== undefined)
        patch.responsavel = params.responsavel;
      if (params.responsavel_empresa !== undefined)
        patch.responsavel_empresa = params.responsavel_empresa;
      if (params.cidade !== undefined) patch.cidade = params.cidade;
      if (params.data_inspecao !== undefined)
        patch.data_inspecao = params.data_inspecao;
      if (params.observacoes_gerais !== undefined)
        patch.observacoes_gerais = params.observacoes_gerais;
      if (params.status !== undefined) {
        patch.status = params.status;
        if (params.status === "FINALIZADO") {
          patch.finalizado_em = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from("relatorios_nao_conformidade")
        .update(patch as never)
        .eq("id_relatorio", params.id_relatorio);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirRelatorioNaoConformidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_relatorio: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("relatorios_nao_conformidade")
        .delete()
        .eq("id_relatorio", id_relatorio);
      if (error) throw error;
      return id_relatorio;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

// ============================================================
// Itens (NCs) — adicionados livremente pelo auditor
// ============================================================

export function useAdicionarItemNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      ordem: number;
      /** Pré-preenchimento opcional (usado pelo quick-pick de NR). */
      descricao?: string;
      norma_violada?: string | null;
      item_codigo_origem?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const id_item = gerarId("NCI");
      const row: RelatorioNaoConformidadeItem = {
        id_item,
        id_relatorio: params.id_relatorio,
        ordem: params.ordem,
        item_codigo_origem: params.item_codigo_origem ?? null,
        descricao: params.descricao ?? "",
        norma_violada: params.norma_violada ?? null,
        criticidade: "MEDIA",
        causa_raiz: null,
        acao_corretiva: null,
        prazo: null,
        responsavel_tratativa: null,
        status_tratativa: "ABERTA",
        foto_urls: [],
        foto_storage_paths: [],
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      const { error } = await supabase
        .from("relatorios_nao_conformidade_itens")
        .insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(row.id_relatorio) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAtualizarItemNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
      descricao?: string;
      norma_violada?: string | null;
      criticidade?: CriticidadeNC;
      causa_raiz?: string | null;
      acao_corretiva?: string | null;
      prazo?: string | null;
      responsavel_tratativa?: string | null;
      status_tratativa?: StatusTratativaNC;
      ordem?: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const patch: Partial<RelatorioNaoConformidadeItem> = {
        updated_at: new Date().toISOString(),
      };
      if (params.descricao !== undefined) patch.descricao = params.descricao;
      if (params.norma_violada !== undefined)
        patch.norma_violada = params.norma_violada;
      if (params.criticidade !== undefined)
        patch.criticidade = params.criticidade;
      if (params.causa_raiz !== undefined) patch.causa_raiz = params.causa_raiz;
      if (params.acao_corretiva !== undefined)
        patch.acao_corretiva = params.acao_corretiva;
      if (params.prazo !== undefined) patch.prazo = params.prazo;
      if (params.responsavel_tratativa !== undefined)
        patch.responsavel_tratativa = params.responsavel_tratativa;
      if (params.status_tratativa !== undefined)
        patch.status_tratativa = params.status_tratativa;
      if (params.ordem !== undefined) patch.ordem = params.ordem;

      const { error } = await supabase
        .from("relatorios_nao_conformidade_itens")
        .update(patch as never)
        .eq("id_item", params.id_item);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirItemNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
    }) => {
      const supabase = createSupabaseBrowserClient();
      // Limpa fotos do storage antes de remover o item (best-effort)
      const { data: itemAtual } = await supabase
        .from("relatorios_nao_conformidade_itens")
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
        .from("relatorios_nao_conformidade_itens")
        .delete()
        .eq("id_item", params.id_item);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Limite máximo de fotos por item (mesmo padrão do Conformidade). */
export const MAX_FOTOS_POR_NC = 8;

export function useUploadFotoItemNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
      file: File;
      fotos_urls_atuais: string[];
      fotos_paths_atuais: string[];
    }) => {
      const supabase = createSupabaseBrowserClient();

      if (params.fotos_paths_atuais.length >= MAX_FOTOS_POR_NC) {
        throw new Error(
          `Limite de ${MAX_FOTOS_POR_NC} fotos por item atingido.`
        );
      }

      const ext = (params.file.name.split(".").pop() ?? "jpg").toLowerCase();
      const sufixo = Math.random().toString(36).slice(2, 8);
      const path = `nao-conformidade/${params.id_relatorio}/${params.id_item}-${sufixo}.${ext}`;

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
        .from("relatorios_nao_conformidade_itens")
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
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoverFotoItemNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
      foto_storage_path: string;
      fotos_urls_atuais: string[];
      fotos_paths_atuais: string[];
    }) => {
      const supabase = createSupabaseBrowserClient();

      await supabase.storage.from("fotos").remove([params.foto_storage_path]);

      const idx = params.fotos_paths_atuais.indexOf(params.foto_storage_path);
      const novosPaths = params.fotos_paths_atuais.filter((_, i) => i !== idx);
      const novasUrls = params.fotos_urls_atuais.filter((_, i) => i !== idx);

      const { error } = await supabase
        .from("relatorios_nao_conformidade_itens")
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
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
