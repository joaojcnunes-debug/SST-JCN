"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import type {
  RelatorioConformidade,
  RelatorioConformidadeItem,
  SituacaoConformidade,
  StatusRelatorioConformidade,
} from "@/lib/supabase/types";
import { getChecklistNR, ehSemNR, NR_LIVRE } from "@/lib/conformidade/checklists";

import { gravar } from "@/lib/offline/gravar";
import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
import { ehErroDeRede } from "@/lib/offline/rede";

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

/** O pacote da tela de detalhe. Nomeado porque agora ele também é guardado. */
export interface DetalheConformidade {
  relatorio: RelatorioConformidade;
  itens: RelatorioConformidadeItem[];
}

async function carregarDetalheDoServidor(
  id: string
): Promise<DetalheConformidade> {
  const supabase = createSupabaseBrowserClient();
  const [{ data: relatorio, error: e1 }, { data: itens, error: e2 }] =
    await Promise.all([
      supabase
        .from("relatorios_conformidade")
        .select("*")
        .eq("id_relatorio", id)
        .single(),
      supabase
        .from("relatorios_conformidade_itens")
        .select("*")
        .eq("id_relatorio", id)
        .order("ordem", { ascending: true }),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    relatorio: relatorio as unknown as RelatorioConformidade,
    itens: (itens ?? []) as unknown as RelatorioConformidadeItem[],
  };
}

export function useRelatorioConformidade(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_DETALHE(id ?? ""),
    enabled: !!id,

    // Sem rede, insistir é perder tempo do técnico olhando um spinner: o plano B
    // está dentro da `queryFn` e responde na primeira tentativa.
    retry: (falhas, erro) => !ehErroDeRede(erro) && falhas < 2,

    queryFn: async (): Promise<DetalheConformidade> => {
      try {
        const dados = await carregarDetalheDoServidor(id!);
        // Mantém fresca só a cópia que o técnico já levou — ver `LevarParaCampo`.
        void lerDocumentoCache(id!).then((ja) => {
          if (ja) void guardarDocumentoCache(id!, dados);
        });
        return dados;
      } catch (e) {
        // Recusa do banco e relatório inexistente continuam sendo erro.
        if (!ehErroDeRede(e)) throw e;
        const guardado = await lerDocumentoCache<DetalheConformidade>(id!);
        if (guardado) return guardado.dados;
        throw e;
      }
    },
  });
}

export interface CriarRelatorioConformidadeInput {
  id_empresa: string;
  /** `null` (ou `NR_LIVRE`) = relatório sem NR: nasce sem checklist. */
  nr_codigo: string | null;
  /** Só usado quando não há NR — vira o nome do relatório (`nr_titulo`). */
  titulo?: string | null;
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
      // Sem NR não há catálogo pra copiar: o relatório nasce vazio e o auditor
      // monta o checklist no detalhe (item livre / cross-ref de outra NR).
      const semNR = ehSemNR(input.nr_codigo);
      const checklist = semNR ? null : getChecklistNR(input.nr_codigo!);
      if (!semNR && !checklist) {
        throw new Error(`NR não encontrada: ${input.nr_codigo}`);
      }
      // Sem NR o nome do relatório é o título livre — é o que identifica o
      // documento nas listas, no cabeçalho e no PDF.
      const tituloLivre = input.titulo?.trim();
      if (semNR && !tituloLivre) {
        throw new Error("Informe um título pro relatório sem NR vinculada");
      }

      const id_relatorio = gerarId("RCN");
      const row: RelatorioConformidade = {
        id_relatorio,
        id_empresa: input.id_empresa,
        nr_codigo: checklist?.codigo ?? NR_LIVRE,
        nr_titulo: checklist?.titulo ?? tituloLivre!,
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

      const relatorioGravado = await gravar({
        tabela: "relatorios_conformidade",
        tipo: "insert",
        linhas: [row as unknown as Record<string, unknown>],
        filtro: null,
        modulo: "conformidade",
        id_documento: id_relatorio,
      });

      // Snapshot dos itens do checklist da NR no momento da criação.
      // `item_nr_origem = null` = veio do checklist principal (imutável).
      const itens: RelatorioConformidadeItem[] = (checklist?.itens ?? []).map(
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

      // Os itens dependem do relatório: a FK aponta para ele, e mandar a lista
      // primeiro faria o banco recusar um checklist que está correto.
      // Relatório sem NR não tem itens ainda — nada a gravar aqui.
      if (itens.length > 0) {
        await gravar({
          tabela: "relatorios_conformidade_itens",
          tipo: "insert",
          linhas: itens as unknown as Record<string, unknown>[],
          filtro: null,
          modulo: "conformidade",
          id_documento: id_relatorio,
          depende_de:
            relatorioGravado.destino === "APARELHO"
              ? [relatorioGravado.idOperacao]
              : undefined,
        });
      }

      return { row, itens, resultado: relatorioGravado };
    },
    onSuccess: ({ row, itens, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_LISTA });
        return;
      }
      // Sem rede o técnico é redirecionado para um relatório que o servidor
      // ainda não conhece — semear o detalhe é o que evita a tela de erro.
      const detalhe: DetalheConformidade = { relatorio: row, itens };
      qc.setQueryData<DetalheConformidade>(KEY_DETALHE(row.id_relatorio), detalhe);
      void guardarDocumentoCache(row.id_relatorio, detalhe);
      toast.success("Relatório guardado no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(`Erro ao criar relatório: ${e.message}`),
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
      const patch: Partial<RelatorioConformidadeItem> = {
        updated_at: new Date().toISOString(),
      };
      if (params.situacao !== undefined) patch.situacao = params.situacao;
      if (params.observacao !== undefined) patch.observacao = params.observacao;
      if (params.item_titulo !== undefined) patch.item_titulo = params.item_titulo;
      if (params.item_descricao !== undefined)
        patch.item_descricao = params.item_descricao;

      /**
       * Marcar conforme/não conforme é a ação mais repetida do módulo — o
       * auditor percorre o checklist inteiro tocando aqui, item por item, dentro
       * da fábrica. É o fluxo que mais precisa funcionar sem sinal.
       */
      const resultado = await gravar({
        tabela: "relatorios_conformidade_itens",
        tipo: "update",
        linhas: patch as Record<string, unknown>,
        filtro: { id_item: params.id_item },
        modulo: "conformidade",
        id_documento: params.id_relatorio,
      });

      if (resultado.destino === "APARELHO") {
        // Sem rede não há o que revalidar: mescla o patch sobre o item na tela.
        qc.setQueryData<DetalheConformidade>(
          KEY_DETALHE(params.id_relatorio),
          (antigo) =>
            antigo
              ? {
                  ...antigo,
                  itens: antigo.itens.map((i) =>
                    i.id_item === params.id_item ? { ...i, ...patch } : i,
                  ),
                }
              : antigo,
        );
      }
      return { params, resultado };
    },
    onSuccess: ({ params, resultado }) => {
      if (resultado.destino === "APARELHO") return;
      qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
      data_validade?: string | null;
      observacoes_gerais?: string | null;
      status?: StatusRelatorioConformidade;
    }) => {
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
      if (params.data_validade !== undefined)
        patch.data_validade = params.data_validade || null;
      if (params.observacoes_gerais !== undefined)
        patch.observacoes_gerais = params.observacoes_gerais;
      if (params.status !== undefined) {
        patch.status = params.status;
        if (params.status === "FINALIZADO") {
          patch.finalizado_em = new Date().toISOString();
        }
      }

      const resultado = await gravar({
        tabela: "relatorios_conformidade",
        tipo: "update",
        linhas: patch as Record<string, unknown>,
        filtro: { id_relatorio: params.id_relatorio },
        modulo: "conformidade",
        id_documento: params.id_relatorio,
      });
      return { params, patch, resultado };
    },
    onSuccess: ({ params, patch, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
        qc.invalidateQueries({ queryKey: KEY_LISTA });
        return;
      }
      // Sem rede não há o que revalidar: mescla o patch sobre o que está na tela.
      qc.setQueryData<DetalheConformidade>(
        KEY_DETALHE(params.id_relatorio),
        (antigo) =>
          antigo
            ? { ...antigo, relatorio: { ...antigo.relatorio, ...patch } }
            : antigo,
      );
      toast.success("Alteração guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
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

      const resultado = await gravar({
        tabela: "relatorios_conformidade_itens",
        tipo: "insert",
        linhas: [row as unknown as Record<string, unknown>],
        filtro: null,
        modulo: "conformidade",
        id_documento: params.id_relatorio,
      });
      return { row, resultado };
    },
    onSuccess: ({ row, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(row.id_relatorio) });
        return;
      }
      // Sem rede não há o que revalidar: o item entra na lista à mão.
      qc.setQueryData<DetalheConformidade>(
        KEY_DETALHE(row.id_relatorio),
        (antigo) => (antigo ? { ...antigo, itens: [...antigo.itens, row] } : antigo),
      );
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
      // Limpar o storage só com rede: sem ela o arquivo fica órfão no MinIO,
      // que é desperdício e não erro — travar a exclusão por isso seria pior.
      if (navigator.onLine) {
        try {
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
        } catch {
          /* silencioso de propósito */
        }
      }

      const resultado = await gravar({
        tabela: "relatorios_conformidade_itens",
        tipo: "delete",
        linhas: null,
        filtro: { id_item: params.id_item },
        modulo: "conformidade",
        id_documento: params.id_relatorio,
      });
      return { params, resultado };
    },
    onSuccess: ({ params, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
        return;
      }
      qc.setQueryData<DetalheConformidade>(
        KEY_DETALHE(params.id_relatorio),
        (antigo) =>
          antigo
            ? {
                ...antigo,
                itens: antigo.itens.filter((i) => i.id_item !== params.id_item),
              }
            : antigo,
      );
      toast.success("Remoção guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
/**
 * Lê os arrays de foto FRESCOS do banco. As mutações regravam o array
 * inteiro — partir dos arrays vindos das props (cache stale do React Query)
 * causa lost update quando o usuário sobe/remove fotos em sequência rápida.
 */
async function lerFotosItemConformidade(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  qc: ReturnType<typeof useQueryClient>,
  id_relatorio: string,
  id_item: string
) {
  // Sem rede não existe "fresco do banco", e falhar não é a resposta certa: o
  // que está na tela é a melhor verdade disponível. A queda para o cache só
  // acontece em erro de REDE — recusa do banco continua estourando, senão um
  // item apagado por outra pessoa voltaria a receber foto em silêncio.
  const doCache = () => {
    const detalhe = qc.getQueryData<DetalheConformidade>(KEY_DETALHE(id_relatorio));
    const item = detalhe?.itens.find((i) => i.id_item === id_item);
    return { urls: item?.foto_urls ?? [], paths: item?.foto_storage_paths ?? [] };
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return doCache();
  }

  try {
    const { data, error } = await supabase
      .from("relatorios_conformidade_itens")
      .select("foto_urls, foto_storage_paths")
      .eq("id_item", id_item)
      .single();
    if (error) throw error;
    const row = data as unknown as {
      foto_urls: string[] | null;
      foto_storage_paths: string[] | null;
    };
    return { urls: row.foto_urls ?? [], paths: row.foto_storage_paths ?? [] };
  } catch (e) {
    if (ehErroDeRede(e)) return doCache();
    throw e;
  }
}

/** Serializa as mutações de foto do mesmo item entre si (React Query scope). */
const SCOPE_FOTOS_CONF = { id: "conformidade-fotos-item" };

export function useUploadFotoItemConformidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
      file: File;
    }) => {
      const supabase = createSupabaseBrowserClient();

      const atual = await lerFotosItemConformidade(
        supabase,
        qc,
        params.id_relatorio,
        params.id_item
      );
      if (atual.paths.length >= MAX_FOTOS_POR_ITEM) {
        throw new Error(
          `Limite de ${MAX_FOTOS_POR_ITEM} fotos por item atingido.`
        );
      }

      const ext = (params.file.name.split(".").pop() ?? "jpg").toLowerCase();
      const sufixo = gerarId("F").slice(2);
      const path = `conformidade/${params.id_relatorio}/${params.id_item}-${sufixo}.${ext}`;

      // O arquivo não sobe aqui: `getPublicUrl` é montagem de string, então a
      // URL já é conhecida e o `gravar()` leva o arquivo junto da linha.
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);

      const patch = {
        foto_urls: [...atual.urls, pub.publicUrl],
        foto_storage_paths: [...atual.paths, path],
        updated_at: new Date().toISOString(),
      };

      const resultado = await gravar({
        tabela: "relatorios_conformidade_itens",
        tipo: "update",
        linhas: patch,
        filtro: { id_item: params.id_item },
        modulo: "conformidade",
        id_documento: params.id_relatorio,
        imagens: [{ blob: params.file, caminho: path }],
      });

      return { foto_url: pub.publicUrl, path, patch, resultado };
    },
    scope: SCOPE_FOTOS_CONF,
    onSuccess: ({ patch, resultado }, params) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
        return;
      }
      qc.setQueryData<DetalheConformidade>(
        KEY_DETALHE(params.id_relatorio),
        (antigo) =>
          antigo
            ? {
                ...antigo,
                itens: antigo.itens.map((i) =>
                  i.id_item === params.id_item ? { ...i, ...patch } : i,
                ),
              }
            : antigo,
      );
      toast.success("Foto guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
    }) => {
      const supabase = createSupabaseBrowserClient();

      // Apaga do storage (best-effort), e só com rede: sem ela o arquivo fica
      // órfão no MinIO — desperdício de espaço, não erro.
      if (navigator.onLine) {
        try {
          await supabase.storage.from("fotos").remove([params.foto_storage_path]);
        } catch {
          /* silencioso de propósito */
        }
      }

      // Relê fresco do banco e filtra mantendo o pareamento URL ↔ path
      const atual = await lerFotosItemConformidade(
        supabase,
        qc,
        params.id_relatorio,
        params.id_item
      );
      const idx = atual.paths.indexOf(params.foto_storage_path);
      // Já removida por outra mutação.
      if (idx < 0) return { params, patch: null, resultado: null };

      const patch = {
        foto_urls: atual.urls.filter((_, i) => i !== idx),
        foto_storage_paths: atual.paths.filter((_, i) => i !== idx),
        updated_at: new Date().toISOString(),
      };

      const resultado = await gravar({
        tabela: "relatorios_conformidade_itens",
        tipo: "update",
        linhas: patch,
        filtro: { id_item: params.id_item },
        modulo: "conformidade",
        id_documento: params.id_relatorio,
      });
      return { params, patch, resultado };
    },
    scope: SCOPE_FOTOS_CONF,
    onSuccess: ({ patch, resultado }, params) => {
      if (!resultado || resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
        return;
      }
      qc.setQueryData<DetalheConformidade>(
        KEY_DETALHE(params.id_relatorio),
        (antigo) =>
          antigo
            ? {
                ...antigo,
                itens: antigo.itens.map((i) =>
                  i.id_item === params.id_item ? { ...i, ...patch } : i,
                ),
              }
            : antigo,
      );
      toast.success("Remoção guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirRelatorioConformidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_relatorio: string) => {
      await excluirComLixeiraPorId({
        tabela: "relatorios_conformidade",
        chave: "id_relatorio",
        id: id_relatorio,
        modulo: "conformidade",
        rotuloCol: "nr_titulo",
      });
      return id_relatorio;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
    },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}
