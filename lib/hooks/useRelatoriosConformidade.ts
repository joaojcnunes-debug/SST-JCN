"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import type {
  RelatorioConformidade,
  RelatorioConformidadeItem,
  SituacaoConformidade,
  StatusRelatorioConformidade,
} from "@/lib/supabase/types";
import { getChecklistNR } from "@/lib/conformidade/checklists";

const KEY_LISTA = ["relatorios-conformidade"] as const;
const KEY_DETALHE = (id: string) => ["relatorio-conformidade", id] as const;

async function fetchLista(
  empresasVinculadas: string[] | null
): Promise<RelatorioConformidade[]> {
  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("relatorios_conformidade")
    .select("*")
    .order("created_at", { ascending: false });
  if (empresasVinculadas && empresasVinculadas.length > 0) {
    q = q.in("id_empresa", empresasVinculadas);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as RelatorioConformidade[];
}

export function useRelatoriosConformidade() {
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

export function useRelatorioConformidade(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_DETALHE(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const [{ data: relatorio, error: e1 }, { data: itens, error: e2 }] =
        await Promise.all([
          supabase
            .from("relatorios_conformidade")
            .select("*")
            .eq("id_relatorio", id!)
            .single(),
          supabase
            .from("relatorios_conformidade_itens")
            .select("*")
            .eq("id_relatorio", id!)
            .order("ordem", { ascending: true }),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        relatorio: relatorio as unknown as RelatorioConformidade,
        itens: (itens ?? []) as unknown as RelatorioConformidadeItem[],
      };
    },
  });
}

export interface CriarRelatorioConformidadeInput {
  id_empresa: string;
  nr_codigo: string;
  setor: string | null;
  responsavel: string | null;
  data_inspecao: string | null;
}

export function useCriarRelatorioConformidade() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: CriarRelatorioConformidadeInput) => {
      const supabase = createSupabaseBrowserClient();
      const checklist = getChecklistNR(input.nr_codigo);
      if (!checklist) throw new Error(`NR não encontrada: ${input.nr_codigo}`);

      const id_relatorio = gerarId("RCN");
      const row: RelatorioConformidade = {
        id_relatorio,
        id_empresa: input.id_empresa,
        nr_codigo: checklist.codigo,
        nr_titulo: checklist.titulo,
        setor: input.setor,
        responsavel: input.responsavel,
        data_inspecao: input.data_inspecao,
        observacoes_gerais: null,
        status: "RASCUNHO",
        finalizado_em: null,
        usuario_email: user?.email ?? null,
        usuario_nome: user?.nome ?? null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };

      const { error: errRel } = await supabase
        .from("relatorios_conformidade")
        .insert(row as never);
      if (errRel) throw errRel;

      // Snapshot dos itens do checklist da NR no momento da criação
      const itens: RelatorioConformidadeItem[] = checklist.itens.map(
        (it, idx) => ({
          id_item: gerarId("RCI"),
          id_relatorio,
          item_codigo: it.codigo,
          item_titulo: it.titulo,
          item_descricao: it.descricao ?? null,
          ordem: idx + 1,
          situacao: "PENDENTE",
          observacao: null,
          foto_url: null,
          foto_storage_path: null,
          created_at: new Date().toISOString(),
          updated_at: null,
        })
      );

      const { error: errItens } = await supabase
        .from("relatorios_conformidade_itens")
        .insert(itens as never);
      if (errItens) throw errItens;

      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
  });
}

export function useAtualizarItemConformidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
      situacao?: SituacaoConformidade;
      observacao?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const patch: Partial<RelatorioConformidadeItem> = {
        updated_at: new Date().toISOString(),
      };
      if (params.situacao !== undefined) patch.situacao = params.situacao;
      if (params.observacao !== undefined) patch.observacao = params.observacao;

      const { error } = await supabase
        .from("relatorios_conformidade_itens")
        .update(patch as never)
        .eq("id_item", params.id_item);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
  });
}

export function useAtualizarRelatorioConformidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      setor?: string | null;
      responsavel?: string | null;
      data_inspecao?: string | null;
      observacoes_gerais?: string | null;
      status?: StatusRelatorioConformidade;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const patch: Partial<RelatorioConformidade> = {
        updated_at: new Date().toISOString(),
      };
      if (params.setor !== undefined) patch.setor = params.setor;
      if (params.responsavel !== undefined) patch.responsavel = params.responsavel;
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
        .from("relatorios_conformidade")
        .update(patch as never)
        .eq("id_relatorio", params.id_relatorio);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
  });
}

/**
 * Upload de foto para um item do checklist. Salva no bucket `fotos` do
 * Supabase Storage (mesmo bucket das inspeções) em
 * `conformidade/{id_relatorio}/{id_item}.{ext}` e grava a URL pública no
 * item.
 *
 * Se o item já tinha uma foto, o arquivo antigo é apagado primeiro.
 */
export function useUploadFotoItemConformidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
      file: File;
      fotoAntigaPath?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();

      // Remove a antiga primeiro (se houver)
      if (params.fotoAntigaPath) {
        await supabase.storage.from("fotos").remove([params.fotoAntigaPath]);
      }

      const ext = (params.file.name.split(".").pop() ?? "jpg").toLowerCase();
      // Sufixo aleatório evita problema de cache CDN ao trocar a foto
      const sufixo = Math.random().toString(36).slice(2, 8);
      const path = `conformidade/${params.id_relatorio}/${params.id_item}-${sufixo}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("fotos")
        .upload(path, params.file, { upsert: false, contentType: params.file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);

      const { error: updateErr } = await supabase
        .from("relatorios_conformidade_itens")
        .update({
          foto_url: pub.publicUrl,
          foto_storage_path: path,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_item", params.id_item);
      if (updateErr) throw updateErr;

      return { foto_url: pub.publicUrl, path };
    },
    onSuccess: (_d, params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
    },
  });
}

export function useRemoverFotoItemConformidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
      foto_storage_path: string;
    }) => {
      const supabase = createSupabaseBrowserClient();

      // Apaga do storage (best-effort — não trava se arquivo já tiver sumido)
      await supabase.storage.from("fotos").remove([params.foto_storage_path]);

      const { error } = await supabase
        .from("relatorios_conformidade_itens")
        .update({
          foto_url: null,
          foto_storage_path: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_item", params.id_item);
      if (error) throw error;
      return params;
    },
    onSuccess: (_d, params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
    },
  });
}

export function useExcluirRelatorioConformidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_relatorio: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("relatorios_conformidade")
        .delete()
        .eq("id_relatorio", id_relatorio);
      if (error) throw error;
      return id_relatorio;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
  });
}
