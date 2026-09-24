"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { gravar } from "@/lib/offline/gravar";
import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
import { ehErroDeRede } from "@/lib/offline/rede";
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

/** O pacote da tela de detalhe. Nomeado porque agora ele também é guardado. */
export interface DetalheNC {
  relatorio: RelatorioNaoConformidade;
  itens: RelatorioNaoConformidadeItem[];
}

async function carregarDetalheDoServidor(id: string): Promise<DetalheNC> {
  const supabase = createSupabaseBrowserClient();
  const [{ data: relatorio, error: e1 }, { data: itens, error: e2 }] =
    await Promise.all([
      supabase
        .from("relatorios_nao_conformidade")
        .select("*")
        .eq("id_relatorio", id)
        .single(),
      supabase
        .from("relatorios_nao_conformidade_itens")
        .select("*")
        .eq("id_relatorio", id)
        .order("ordem", { ascending: true }),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    relatorio: relatorio as unknown as RelatorioNaoConformidade,
    itens: (itens ?? []) as unknown as RelatorioNaoConformidadeItem[],
  };
}

export function useRelatorioNaoConformidade(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_DETALHE(id ?? ""),
    enabled: !!id,

    // Sem rede, insistir é perder tempo do técnico olhando um spinner: o plano B
    // está dentro da `queryFn` e responde na primeira tentativa.
    retry: (falhas, erro) => !ehErroDeRede(erro) && falhas < 2,

    queryFn: async (): Promise<DetalheNC> => {
      try {
        const dados = await carregarDetalheDoServidor(id!);
        // Mantém fresca a cópia que o técnico já levou — e só ela. Ver
        // `LevarParaCampo` para o porquê de não guardar tudo o que se abre.
        void lerDocumentoCache(id!).then((ja) => {
          if (ja) void guardarDocumentoCache(id!, dados);
        });
        return dados;
      } catch (e) {
        // Recusa do banco e relatório inexistente continuam sendo erro: cair no
        // cache aqui esconderia o problema e mostraria dado velho como atual.
        if (!ehErroDeRede(e)) throw e;
        const guardado = await lerDocumentoCache<DetalheNC>(id!);
        if (guardado) return guardado.dados;
        throw e;
      }
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

      /**
       * O relatório de não-conformidade NASCE em campo, ao contrário da
       * inspeção. É o registro de algo que o auditor acabou de ver, e o momento
       * em que ele vê é justamente o momento sem sinal. Por isso a criação
       * entra no offline aqui, e não ficou de fora como a criação de inspeção.
       */
      const resultado = await gravar({
        tabela: "relatorios_nao_conformidade",
        tipo: "insert",
        linhas: [row as unknown as Record<string, unknown>],
        filtro: null,
        modulo: "nao-conformidade",
        id_documento: id_relatorio,
      });
      return { row, resultado };
    },
    onSuccess: ({ row, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_LISTA });
        return;
      }
      // Sem rede não há o que revalidar. O detalhe é semeado à mão para o
      // técnico conseguir abrir o relatório que acabou de criar — sem isto ele
      // criaria o registro e cairia numa tela de erro.
      qc.setQueryData<DetalheNC>(KEY_DETALHE(row.id_relatorio), {
        relatorio: row,
        itens: [],
      });
      void guardarDocumentoCache(row.id_relatorio, {
        relatorio: row,
        itens: [],
      } satisfies DetalheNC);
      toast.success("Relatório guardado no aparelho", { icon: "📵" });
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
      data_validade?: string | null;
      observacoes_gerais?: string | null;
      status?: StatusRelatorioNC;
    }) => {
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
        tabela: "relatorios_nao_conformidade",
        tipo: "update",
        linhas: patch as Record<string, unknown>,
        filtro: { id_relatorio: params.id_relatorio },
        modulo: "nao-conformidade",
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
      // Sem rede não há o que revalidar: o patch é aplicado à mão sobre o que
      // está na tela. Mesclar, e não substituir — o patch é parcial por desenho.
      qc.setQueryData<DetalheNC>(KEY_DETALHE(params.id_relatorio), (antigo) =>
        antigo
          ? { ...antigo, relatorio: { ...antigo.relatorio, ...patch } }
          : antigo,
      );
      toast.success("Alteração guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirRelatorioNaoConformidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_relatorio: string) => {
      await excluirComLixeiraPorId({
        tabela: "relatorios_nao_conformidade",
        chave: "id_relatorio",
        id: id_relatorio,
        modulo: "nao_conformidade",
        rotuloCol: "titulo",
      });
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
      const resultado = await gravar({
        tabela: "relatorios_nao_conformidade_itens",
        tipo: "insert",
        linhas: [row as unknown as Record<string, unknown>],
        filtro: null,
        modulo: "nao-conformidade",
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
      qc.setQueryData<DetalheNC>(KEY_DETALHE(row.id_relatorio), (antigo) =>
        antigo ? { ...antigo, itens: [...antigo.itens, row] } : antigo,
      );
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
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

      const resultado = await gravar({
        tabela: "relatorios_nao_conformidade_itens",
        tipo: "update",
        linhas: patch as Record<string, unknown>,
        filtro: { id_item: params.id_item },
        modulo: "nao-conformidade",
        id_documento: params.id_relatorio,
      });
      return { params, patch, resultado };
    },
    onSuccess: ({ params, patch, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
        return;
      }
      // Sem rede não há o que revalidar: mescla o patch sobre o item na tela.
      qc.setQueryData<DetalheNC>(KEY_DETALHE(params.id_relatorio), (antigo) =>
        antigo
          ? {
              ...antigo,
              itens: antigo.itens.map((i) =>
                i.id_item === params.id_item ? { ...i, ...patch } : i,
              ),
            }
          : antigo,
      );
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirItemNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
    }) => {
      // Limpa fotos do storage antes de remover o item (best-effort). Só com
      // rede: sem ela o arquivo fica órfão no MinIO, que é desperdício de
      // espaço e não erro — e travar a exclusão por causa disso seria pior.
      if (navigator.onLine) {
        try {
          const supabase = createSupabaseBrowserClient();
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
        } catch {
          /* silencioso de propósito */
        }
      }

      const resultado = await gravar({
        tabela: "relatorios_nao_conformidade_itens",
        tipo: "delete",
        linhas: null,
        filtro: { id_item: params.id_item },
        modulo: "nao-conformidade",
        id_documento: params.id_relatorio,
      });
      return { params, resultado };
    },
    onSuccess: ({ params, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
        return;
      }
      qc.setQueryData<DetalheNC>(KEY_DETALHE(params.id_relatorio), (antigo) =>
        antigo
          ? { ...antigo, itens: antigo.itens.filter((i) => i.id_item !== params.id_item) }
          : antigo,
      );
      toast.success("Remoção guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/** Limite máximo de fotos por item (mesmo padrão do Conformidade). */
export const MAX_FOTOS_POR_NC = 8;

/**
 * Lê os arrays de foto FRESCOS do banco (evita lost update — ver Conformidade).
 *
 * Sem rede não existe "fresco do banco", e a resposta certa não é falhar: o que
 * está na tela é a melhor verdade disponível. A queda para o cache só acontece
 * em erro de REDE — recusa do banco continua estourando, senão um item apagado
 * por outra pessoa voltaria a receber foto em silêncio.
 */
async function lerFotosItemNC(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  qc: ReturnType<typeof useQueryClient>,
  id_relatorio: string,
  id_item: string
) {
  const doCache = () => {
    const detalhe = qc.getQueryData<DetalheNC>(KEY_DETALHE(id_relatorio));
    const item = detalhe?.itens.find((i) => i.id_item === id_item);
    return {
      urls: item?.foto_urls ?? [],
      paths: item?.foto_storage_paths ?? [],
    };
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return doCache();
  }

  try {
    const { data, error } = await supabase
      .from("relatorios_nao_conformidade_itens")
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

const SCOPE_FOTOS_NC = { id: "nao-conformidade-fotos-item" };

export function useUploadFotoItemNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
      file: File;
    }) => {
      const supabase = createSupabaseBrowserClient();

      const atual = await lerFotosItemNC(
        supabase,
        qc,
        params.id_relatorio,
        params.id_item
      );
      if (atual.paths.length >= MAX_FOTOS_POR_NC) {
        throw new Error(
          `Limite de ${MAX_FOTOS_POR_NC} fotos por item atingido.`
        );
      }

      const ext = (params.file.name.split(".").pop() ?? "jpg").toLowerCase();
      const sufixo = gerarId("F").slice(2);
      const path = `nao-conformidade/${params.id_relatorio}/${params.id_item}-${sufixo}.${ext}`;

      // O arquivo não sobe aqui: `getPublicUrl` é montagem de string, então a
      // URL final já é conhecida e o `gravar()` leva o arquivo junto da linha —
      // servidor se houver rede, aparelho se não houver.
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);

      const patch = {
        foto_urls: [...atual.urls, pub.publicUrl],
        foto_storage_paths: [...atual.paths, path],
        updated_at: new Date().toISOString(),
      };

      const resultado = await gravar({
        tabela: "relatorios_nao_conformidade_itens",
        tipo: "update",
        linhas: patch,
        filtro: { id_item: params.id_item },
        modulo: "nao-conformidade",
        id_documento: params.id_relatorio,
        imagens: [{ blob: params.file, caminho: path }],
      });

      return { foto_url: pub.publicUrl, path, patch, resultado };
    },
    scope: SCOPE_FOTOS_NC,
    onSuccess: ({ patch, resultado }, params) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
        return;
      }
      qc.setQueryData<DetalheNC>(KEY_DETALHE(params.id_relatorio), (antigo) =>
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

export function useRemoverFotoItemNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      id_item: string;
      foto_storage_path: string;
    }) => {
      const supabase = createSupabaseBrowserClient();

      // Apagar o arquivo só com rede — sem ela fica órfão no MinIO, que é
      // desperdício e não erro.
      if (navigator.onLine) {
        try {
          await supabase.storage.from("fotos").remove([params.foto_storage_path]);
        } catch {
          /* silencioso de propósito */
        }
      }

      const atual = await lerFotosItemNC(
        supabase,
        qc,
        params.id_relatorio,
        params.id_item
      );
      const idx = atual.paths.indexOf(params.foto_storage_path);
      if (idx < 0) return { params, patch: null, resultado: null };

      const patch = {
        foto_urls: atual.urls.filter((_, i) => i !== idx),
        foto_storage_paths: atual.paths.filter((_, i) => i !== idx),
        updated_at: new Date().toISOString(),
      };

      const resultado = await gravar({
        tabela: "relatorios_nao_conformidade_itens",
        tipo: "update",
        linhas: patch,
        filtro: { id_item: params.id_item },
        modulo: "nao-conformidade",
        id_documento: params.id_relatorio,
      });
      return { params, patch, resultado };
    },
    scope: SCOPE_FOTOS_NC,
    onSuccess: ({ patch, resultado }, params) => {
      if (!resultado || resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_relatorio) });
        return;
      }
      qc.setQueryData<DetalheNC>(KEY_DETALHE(params.id_relatorio), (antigo) =>
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
