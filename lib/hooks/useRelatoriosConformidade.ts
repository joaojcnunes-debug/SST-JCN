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
  responsavel_empresa: string | null;
  cidade: string | null;
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

      const { error: errRel } = await supabase
        .from("relatorios_conformidade")
        .insert(row as never);
      if (errRel) throw errRel;

      // Snapshot dos itens do checklist da NR no momento da criação.
      // `item_nr_origem = null` = veio do checklist principal (imutável).
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
          item_nr_origem: null,
          foto_urls: [],
          foto_storage_paths: [],
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
      /** Apenas pra itens livres (item_nr_origem === 'LIVRE'). UI controla
       *  o gating; o hook só passa o patch adiante. */
      item_titulo?: string;
      item_descricao?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const patch: Partial<RelatorioConformidadeItem> = {
        updated_at: new Date().toISOString(),
      };
      if (params.situacao !== undefined) patch.situacao = params.situacao;
      if (params.observacao !== undefined) patch.observacao = params.observacao;
      if (params.item_titulo !== undefined) patch.item_titulo = params.item_titulo;
      if (params.item_descricao !== undefined)
        patch.item_descricao = params.item_descricao;

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
      responsavel_empresa?: string | null;
      cidade?: string | null;
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

// ============================================================
// Itens extras (v44+) — livre + cross-ref de outras NRs
// ============================================================

/**
 * Adiciona um item extra ao relatório.
 *   - Livre: passe `tipo: 'LIVRE'`. Cria com título/desc em branco (auditor edita).
 *   - Cross-ref: passe `tipo: 'CROSS_REF'`, `nr_origem` e `item_codigo` —
 *     título/descrição são snapshotados do catálogo dessa outra NR.
 *
 * Ambos entram com `situacao = 'PENDENTE'` e `ordem` no final da lista.
 */
export function useAdicionarItemConformidadeExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params:
        | {
            id_relatorio: string;
            ordem: number;
            tipo: "LIVRE";
          }
        | {
            id_relatorio: string;
            ordem: number;
            tipo: "CROSS_REF";
            nr_origem: string; // ex "NR-17"
            item_codigo: string; // ex "17.2.5"
          }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const id_item = gerarId("RCI");

      let row: RelatorioConformidadeItem;
      if (params.tipo === "LIVRE") {
        // Código interno único pra esse item livre (não conflita com catálogo)
        const sufixo = Math.random().toString(36).slice(2, 6).toUpperCase();
        row = {
          id_item,
          id_relatorio: params.id_relatorio,
          item_codigo: `LIVRE-${sufixo}`,
          item_titulo: "",
          item_descricao: null,
          ordem: params.ordem,
          situacao: "PENDENTE",
          observacao: null,
          item_nr_origem: "LIVRE",
          foto_urls: [],
          foto_storage_paths: [],
          created_at: new Date().toISOString(),
          updated_at: null,
        };
      } else {
        const checklist = getChecklistNR(params.nr_origem);
        if (!checklist) {
          throw new Error(`NR não encontrada: ${params.nr_origem}`);
        }
        const it = checklist.itens.find((x) => x.codigo === params.item_codigo);
        if (!it) {
          throw new Error(
            `Item ${params.item_codigo} não encontrado em ${params.nr_origem}`
          );
        }
        row = {
          id_item,
          id_relatorio: params.id_relatorio,
          item_codigo: it.codigo,
          item_titulo: it.titulo,
          item_descricao: it.descricao ?? null,
          ordem: params.ordem,
          situacao: "PENDENTE",
          observacao: null,
          item_nr_origem: params.nr_origem,
          foto_urls: [],
          foto_storage_paths: [],
          created_at: new Date().toISOString(),
          updated_at: null,
        };
      }

      const { error } = await supabase
        .from("relatorios_conformidade_itens")
        .insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(row.id_relatorio) });
    },
  });
}

/**
 * Apaga um item do relatório. Só faz sentido pra itens com `item_nr_origem`
 * não-null (livres ou cross-ref). Itens do checklist principal são imutáveis
 * — pra "remover", o auditor marca NÃO APLICÁVEL. A UI controla o gating.
 *
 * Limpa as fotos do storage antes de remover o item (best-effort).
 */
export function useExcluirItemConformidadeExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id_relatorio: string; id_item: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { data: itemAtual } = await supabase
        .from("relatorios_conformidade_itens")
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
        .from("relatorios_conformidade_itens")
        .delete()
        .eq("id_item", params.id_item);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
    },
  });
}

/** Limite máximo de fotos por item (UI). Manter coerente com o front. */
export const MAX_FOTOS_POR_ITEM = 8;

/**
 * Adiciona UMA foto ao item. Anexa ao final dos arrays `foto_urls` e
 * `foto_storage_paths` (não substitui). Bucket: `fotos`, path:
 * `conformidade/{id_relatorio}/{id_item}-{sufixo}.{ext}`.
 *
 * Recebe os arrays atuais pra evitar race condition quando o usuário
 * sobe 2+ fotos rapidamente em sequência (cada chamada vê o estado mais
 * recente vindo do componente).
 */
export function useUploadFotoItemConformidade() {
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

      if (params.fotos_paths_atuais.length >= MAX_FOTOS_POR_ITEM) {
        throw new Error(
          `Limite de ${MAX_FOTOS_POR_ITEM} fotos por item atingido.`
        );
      }

      const ext = (params.file.name.split(".").pop() ?? "jpg").toLowerCase();
      const sufixo = Math.random().toString(36).slice(2, 8);
      const path = `conformidade/${params.id_relatorio}/${params.id_item}-${sufixo}.${ext}`;

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
        .from("relatorios_conformidade_itens")
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
  });
}

/**
 * Remove UMA foto específica do item (pelo storage_path). Atualiza os arrays
 * mantendo os outros itens na mesma ordem.
 */
export function useRemoverFotoItemConformidade() {
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

      // Apaga do storage (best-effort)
      await supabase.storage.from("fotos").remove([params.foto_storage_path]);

      // Filtra mantendo o pareamento URL ↔ path
      const idx = params.fotos_paths_atuais.indexOf(params.foto_storage_path);
      const novosPaths = params.fotos_paths_atuais.filter(
        (_, i) => i !== idx
      );
      const novasUrls = params.fotos_urls_atuais.filter((_, i) => i !== idx);

      const { error } = await supabase
        .from("relatorios_conformidade_itens")
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
