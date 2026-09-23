"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import { gravar } from "@/lib/offline/gravar";
import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
import { ehErroDeRede } from "@/lib/offline/rede";
import type {
  ApreciacaoMaquina,
  ApreciacaoMaquinaItem,
  ApreciacaoAcao,
  Acao5W2H,
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

/** O pacote da tela de detalhe. Nomeado porque agora ele também é guardado. */
export interface DetalheApreciacao {
  apreciacao: ApreciacaoMaquina;
  itens: ApreciacaoMaquinaItem[];
}

async function carregarDetalheDoServidor(id: string): Promise<DetalheApreciacao> {
  const supabase = createSupabaseBrowserClient();
  const [{ data: apreciacao, error: e1 }, { data: itens, error: e2 }] =
    await Promise.all([
      supabase
        .from("apreciacoes_maquinas")
        .select("*")
        .eq("id_apreciacao", id)
        .single(),
      supabase
        .from("apreciacoes_maquinas_itens")
        .select("*")
        .eq("id_apreciacao", id)
        .order("ordem", { ascending: true }),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    apreciacao: apreciacao as unknown as ApreciacaoMaquina,
    itens: (itens ?? []) as unknown as ApreciacaoMaquinaItem[],
  };
}

export function useApreciacaoMaquina(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_DETALHE(id ?? ""),
    enabled: !!id,

    // Sem rede, insistir é perder tempo do técnico olhando um spinner: o plano B
    // está dentro da `queryFn` e responde na primeira tentativa.
    retry: (falhas, erro) => !ehErroDeRede(erro) && falhas < 2,

    queryFn: async (): Promise<DetalheApreciacao> => {
      try {
        const dados = await carregarDetalheDoServidor(id!);
        // Mantém fresca só a cópia que o técnico já levou — ver `LevarParaCampo`.
        void lerDocumentoCache(id!).then((ja) => {
          if (ja) void guardarDocumentoCache(id!, dados);
        });
        return dados;
      } catch (e) {
        // Recusa do banco e laudo inexistente continuam sendo erro.
        if (!ehErroDeRede(e)) throw e;
        const guardado = await lerDocumentoCache<DetalheApreciacao>(id!);
        if (guardado) return guardado.dados;
        throw e;
      }
    },
  });
}

export interface CriarApreciacaoInput {
  id_empresa: string;
  id_maquina: string | null;
  /** Inspeção de origem da máquina (v66) — rastreia inspeção → apreciação. */
  id_inspecao?: string | null;
  maquina_descricao: string | null;
  titulo: string | null;
  setor: string | null;
  responsavel: string | null;
  responsavel_empresa: string | null;
  cidade: string | null;
  data_apreciacao: string | null;
  /** Nº da notificação SIT/MTE (v149) — opcional, informado na criação. */
  notificacao_sit?: string | null;
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
      const id_apreciacao = gerarId("APR");

      const cabecalho: ApreciacaoMaquina = {
        id_apreciacao,
        id_empresa: input.id_empresa,
        id_maquina: input.id_maquina,
        id_inspecao: input.id_inspecao ?? null,
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
        constatacoes_inspecao: null,
        notificacao_sit: input.notificacao_sit ?? null,
        // Padrão desde a v171: o checklist sai no PDF. Quem não quiser desmarca
        // no editor — continua sendo escolha por laudo.
        incluir_checklist_pdf: true,
        componentes_maquina: null,
        limite_uso: null,
        limite_espaco: null,
        limite_tempo: null,
        limite_produtividade: null,
        npe: null,
        sistemas_atual: null,
        sistemas_necessario: null,
        usuario_email: user?.email ?? null,
        usuario_nome: user?.nome ?? null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };

      const resultado = await gravar({
        tabela: "apreciacoes_maquinas",
        tipo: "insert",
        linhas: [cabecalho as unknown as Record<string, unknown>],
        filtro: null,
        modulo: "apreciacao-maquinas",
        id_documento: id_apreciacao,
      });

      // O checklist NR-12 NÃO é mais snapshotado aqui: desde a v148 ele pertence
      // à MÁQUINA, não ao laudo. Quem copia o catálogo é a criação da ficha
      // (useCriarFicha / useImportarInspecaoParaLaudo). Snapshotar aqui deixaria
      // 38 itens órfãos, sem ficha, em todo laudo novo.
      return { ...cabecalho, __destino: resultado.destino };
    },
    onSuccess: (cab) => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
      if (cab.__destino === "APARELHO") {
        // Sem rede o laudo é aberto logo em seguida, e o servidor ainda não o
        // conhece — semear o detalhe evita a tela de erro no redirecionamento.
        qc.setQueryData(KEY_DETALHE(cab.id_apreciacao), {
          apreciacao: cab as ApreciacaoMaquina,
          itens: [],
        });
        toast.success("Apreciação guardada no aparelho", { icon: "📵" });
      }
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
      data_validade?: string | null;
      conclusao_tecnica?: string | null;
      recomendacoes?: string | null;
      risco_residual?: RiscoResidual | null;
      observacoes_gerais?: string | null;
      /** V149 — nº da notificação SIT/MTE. */
      notificacao_sit?: string | null;
      /** V153 — imprime o checklist no PDF. */
      incluir_checklist_pdf?: boolean;
      /** V146 — constatações de campo da máquina (ficha do laudo). */
      constatacoes_inspecao?: string | null;
      status?: StatusApreciacao;
      // Identificação dos componentes / limites / sistemas (NR-12 HRN)
      componentes_maquina?: string[] | null;
      limite_uso?: string | null;
      limite_espaco?: string | null;
      limite_tempo?: string | null;
      limite_produtividade?: string | null;
      npe?: string | null;
      sistemas_atual?: string[] | null;
      sistemas_necessario?: string[] | null;
    }) => {
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
      if (params.notificacao_sit !== undefined) patch.notificacao_sit = params.notificacao_sit;
      if (params.incluir_checklist_pdf !== undefined) patch.incluir_checklist_pdf = params.incluir_checklist_pdf;
      if (params.data_apreciacao !== undefined)
        patch.data_apreciacao = params.data_apreciacao;
      if (params.data_validade !== undefined)
        patch.data_validade = params.data_validade || null;
      if (params.conclusao_tecnica !== undefined)
        patch.conclusao_tecnica = params.conclusao_tecnica;
      if (params.recomendacoes !== undefined)
        patch.recomendacoes = params.recomendacoes;
      if (params.risco_residual !== undefined)
        patch.risco_residual = params.risco_residual;
      if (params.observacoes_gerais !== undefined)
        patch.observacoes_gerais = params.observacoes_gerais;
      if (params.constatacoes_inspecao !== undefined)
        patch.constatacoes_inspecao = params.constatacoes_inspecao;
      if (params.componentes_maquina !== undefined) patch.componentes_maquina = params.componentes_maquina;
      if (params.limite_uso !== undefined) patch.limite_uso = params.limite_uso;
      if (params.limite_espaco !== undefined) patch.limite_espaco = params.limite_espaco;
      if (params.limite_tempo !== undefined) patch.limite_tempo = params.limite_tempo;
      if (params.limite_produtividade !== undefined) patch.limite_produtividade = params.limite_produtividade;
      if (params.npe !== undefined) patch.npe = params.npe;
      if (params.sistemas_atual !== undefined) patch.sistemas_atual = params.sistemas_atual;
      if (params.sistemas_necessario !== undefined) patch.sistemas_necessario = params.sistemas_necessario;
      if (params.status !== undefined) {
        patch.status = params.status;
        if (params.status === "FINALIZADO") {
          patch.finalizado_em = new Date().toISOString();
        }
      }

      const resultado = await gravar({
        tabela: "apreciacoes_maquinas",
        tipo: "update",
        linhas: patch as Record<string, unknown>,
        filtro: { id_apreciacao: params.id_apreciacao },
        modulo: "apreciacao-maquinas",
        id_documento: params.id_apreciacao,
      });
      return { ...params, patch, resultado };
    },
    onSuccess: ({ id_apreciacao, patch, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(id_apreciacao) });
        qc.invalidateQueries({ queryKey: KEY_LISTA });
        return;
      }
      // Sem rede não há o que revalidar: mescla o patch sobre o que está na tela.
      qc.setQueryData<DetalheApreciacao>(KEY_DETALHE(id_apreciacao), (antigo) =>
        antigo
          ? { ...antigo, apreciacao: { ...antigo.apreciacao, ...patch } }
          : antigo,
      );
      toast.success("Alteração guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirApreciacaoMaquina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_apreciacao: string) => {
      // Vai para a lixeira (snapshot + auditoria). Fotos mantidas para restore.
      await excluirComLixeiraPorId({
        tabela: "apreciacoes_maquinas",
        chave: "id_apreciacao",
        id: id_apreciacao,
        modulo: "apreciacao_maquinas",
        rotuloCol: "titulo",
      });
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

      /**
       * Marcar a situação de cada item do checklist NR-12 é a ação mais
       * repetida deste módulo — o técnico percorre os 38 itens diante da
       * máquina, no chão de fábrica. É o fluxo que mais precisa de offline.
       */
      const resultado = await gravar({
        tabela: "apreciacoes_maquinas_itens",
        tipo: "update",
        linhas: patch as Record<string, unknown>,
        filtro: { id_item: params.id_item },
        modulo: "apreciacao-maquinas",
        id_documento: params.id_apreciacao,
      });
      return { ...params, patch, resultado };
    },
    onSuccess: ({ id_apreciacao, id_item, patch, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(id_apreciacao) });
        return;
      }
      // Sem rede não há o que revalidar: mescla o patch sobre o item na tela.
      qc.setQueryData<DetalheApreciacao>(KEY_DETALHE(id_apreciacao), (antigo) =>
        antigo
          ? {
              ...antigo,
              itens: antigo.itens.map((i) =>
                i.id_item === id_item ? { ...i, ...patch } : i,
              ),
            }
          : antigo,
      );
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export const MAX_FOTOS_POR_ITEM_APR = 6;

/** Garante que o array de legendas tenha exatamente `tamanho` posições. */
function padLegendas(legendas: string[] | null | undefined, tamanho: number): string[] {
  const base = [...(legendas ?? [])].slice(0, tamanho);
  while (base.length < tamanho) base.push("");
  return base;
}

/**
 * Lê os arrays de foto FRESCOS do banco. As mutações de foto/legenda regravam
 * o array inteiro — partir do cache do React Query (props) causa lost update
 * quando duas mutações correm em sequência rápida (blur + blur, blur + X).
 */
async function lerFotosItemFresco(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  qc: ReturnType<typeof useQueryClient>,
  id_apreciacao: string,
  id_item: string
) {
  // Sem rede não existe "fresco do banco", e falhar não é a resposta certa: o
  // que está na tela é a melhor verdade disponível. Cai para o cache SÓ em erro
  // de rede — recusa do banco continua estourando, senão um item apagado por
  // outra pessoa voltaria a receber foto em silêncio.
  const doCache = () => {
    const detalhe = qc.getQueryData<DetalheApreciacao>(KEY_DETALHE(id_apreciacao));
    const item = detalhe?.itens.find((i) => i.id_item === id_item);
    return {
      urls: item?.foto_urls ?? [],
      paths: item?.foto_storage_paths ?? [],
      legendas: item?.foto_legendas ?? [],
    };
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return doCache();
  }

  try {
    const { data, error } = await supabase
      .from("apreciacoes_maquinas_itens")
      .select("foto_urls, foto_storage_paths, foto_legendas")
      .eq("id_item", id_item)
      .single();
    if (error) throw error;
    const row = data as unknown as {
      foto_urls: string[] | null;
      foto_storage_paths: string[] | null;
      foto_legendas: string[] | null;
    };
    return {
      urls: row.foto_urls ?? [],
      paths: row.foto_storage_paths ?? [],
      legendas: row.foto_legendas ?? [],
    };
  } catch (e) {
    if (ehErroDeRede(e)) return doCache();
    throw e;
  }
}

/** Serializa as mutações de foto/legenda entre si (React Query scope). */
const SCOPE_FOTOS_APR = { id: "apreciacao-fotos-item" };

export function useUploadFotoItemApreciacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_apreciacao: string;
      id_item: string;
      file: File;
      fotos_urls_atuais: string[];
      fotos_paths_atuais: string[];
      fotos_legendas_atuais?: string[];
    }) => {
      const supabase = createSupabaseBrowserClient();

      const atual = await lerFotosItemFresco(
        supabase,
        qc,
        params.id_apreciacao,
        params.id_item
      );
      if (atual.paths.length >= MAX_FOTOS_POR_ITEM_APR) {
        throw new Error(
          `Limite de ${MAX_FOTOS_POR_ITEM_APR} fotos por item atingido.`
        );
      }

      const ext = (params.file.name.split(".").pop() ?? "jpg").toLowerCase();
      const sufixo = gerarId("F").slice(2);
      const path = `apreciacao-maquinas/${params.id_apreciacao}/${params.id_item}-${sufixo}.${ext}`;

      // O arquivo não sobe aqui: `getPublicUrl` é montagem de string, então a
      // URL já é conhecida e o `gravar()` leva o arquivo junto da linha.
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);

      const patch = {
        foto_urls: [...atual.urls, pub.publicUrl],
        foto_storage_paths: [...atual.paths, path],
        foto_legendas: [...padLegendas(atual.legendas, atual.urls.length), ""],
        updated_at: new Date().toISOString(),
      };

      const resultado = await gravar({
        tabela: "apreciacoes_maquinas_itens",
        tipo: "update",
        linhas: patch,
        filtro: { id_item: params.id_item },
        modulo: "apreciacao-maquinas",
        id_documento: params.id_apreciacao,
        imagens: [{ blob: params.file, caminho: path }],
      });

      return { foto_url: pub.publicUrl, path, patch, resultado };
    },
    scope: SCOPE_FOTOS_APR,
    onSuccess: ({ patch, resultado }, params) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_apreciacao) });
        return;
      }
      qc.setQueryData<DetalheApreciacao>(
        KEY_DETALHE(params.id_apreciacao),
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

/** Atualiza a legenda de UMA foto do item (pareada por índice). */
export function useAtualizarLegendaFotoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id_apreciacao: string;
      id_item: string;
      indice: number;
      legenda: string;
      legendas_atuais: string[];
      total_fotos: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const atual = await lerFotosItemFresco(
        supabase,
        qc,
        params.id_apreciacao,
        params.id_item
      );
      // a foto pode ter sido removida entre o blur e a gravação
      if (params.indice >= atual.urls.length) return { params, patch: null, resultado: null };
      const legendas = padLegendas(atual.legendas, atual.urls.length);
      legendas[params.indice] = params.legenda;
      const patch = { foto_legendas: legendas, updated_at: new Date().toISOString() };

      const resultado = await gravar({
        tabela: "apreciacoes_maquinas_itens",
        tipo: "update",
        linhas: patch,
        filtro: { id_item: params.id_item },
        modulo: "apreciacao-maquinas",
        id_documento: params.id_apreciacao,
      });
      return { params, patch, resultado };
    },
    scope: SCOPE_FOTOS_APR,
    onSuccess: ({ patch, resultado }, params) => {
      if (!resultado || resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_apreciacao) });
        return;
      }
      qc.setQueryData<DetalheApreciacao>(
        KEY_DETALHE(params.id_apreciacao),
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
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
      /** Máquina (ficha) do item livre — v148. */
      id_ficha?: string | null;
      categoria: string;
      titulo: string;
      descricao?: string | null;
      /** Ordem do item (geralmente último do array + 1). */
      ordem: number;
      /** Contagem atual de itens livres pra gerar o próximo código LIVRE-N. */
      proximoIndiceLivre: number;
    }) => {
      const id_item = gerarId("APRI");
      const row: ApreciacaoMaquinaItem = {
        id_item,
        id_apreciacao: params.id_apreciacao,
        id_ficha: params.id_ficha ?? null,
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
        foto_legendas: [],
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      const resultado = await gravar({
        tabela: "apreciacoes_maquinas_itens",
        tipo: "insert",
        linhas: [row as unknown as Record<string, unknown>],
        filtro: null,
        modulo: "apreciacao-maquinas",
        id_documento: params.id_apreciacao,
      });
      return { row, resultado };
    },
    onSuccess: ({ row, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(row.id_apreciacao) });
        return;
      }
      // Sem rede não há o que revalidar: o item entra na lista à mão.
      qc.setQueryData<DetalheApreciacao>(KEY_DETALHE(row.id_apreciacao), (antigo) =>
        antigo ? { ...antigo, itens: [...antigo.itens, row] } : antigo,
      );
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
      // Limpa fotos do storage primeiro (best-effort), e só com rede: sem ela o
      // arquivo fica órfão no MinIO — desperdício, não erro.
      if (navigator.onLine) {
        try {
          const supabase = createSupabaseBrowserClient();
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
        } catch {
          /* silencioso de propósito */
        }
      }

      const resultado = await gravar({
        tabela: "apreciacoes_maquinas_itens",
        tipo: "delete",
        linhas: null,
        filtro: { id_item: params.id_item },
        modulo: "apreciacao-maquinas",
        id_documento: params.id_apreciacao,
      });
      return { params, resultado };
    },
    onSuccess: ({ params, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_apreciacao) });
        return;
      }
      qc.setQueryData<DetalheApreciacao>(KEY_DETALHE(params.id_apreciacao), (antigo) =>
        antigo
          ? { ...antigo, itens: antigo.itens.filter((i) => i.id_item !== params.id_item) }
          : antigo,
      );
      toast.success("Remoção guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
    onError: (e: Error) => toast.error(mensagemErro(e)),
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

/** Achado visual estruturado (possível não conformidade vista na foto). */
export interface AchadoVisualIA {
  titulo: string;
  severidade: "ALTA" | "MEDIA" | "BAIXA" | null;
  recomendacao: string | null;
}

export interface AnalisarFotoIAOutput {
  observacao: string;
  /** Possíveis NCs visíveis nas fotos (edge function v3+; pode vir vazio). */
  achados?: AchadoVisualIA[];
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
      fotos_legendas_atuais?: string[];
    }) => {
      const supabase = createSupabaseBrowserClient();
      // Storage: best-effort, e só com rede — sem ela o arquivo fica órfão no
      // MinIO, que é desperdício de espaço e não erro.
      if (navigator.onLine) {
        try {
          await supabase.storage.from("fotos").remove([params.foto_storage_path]);
        } catch {
          /* silencioso de propósito */
        }
      }

      const atual = await lerFotosItemFresco(
        supabase,
        qc,
        params.id_apreciacao,
        params.id_item
      );
      const idx = atual.paths.indexOf(params.foto_storage_path);
      // Já removida por outra mutação.
      if (idx < 0) return { params, patch: null, resultado: null };

      const patch = {
        foto_urls: atual.urls.filter((_, i) => i !== idx),
        foto_storage_paths: atual.paths.filter((_, i) => i !== idx),
        foto_legendas: padLegendas(atual.legendas, atual.urls.length).filter(
          (_, i) => i !== idx
        ),
        updated_at: new Date().toISOString(),
      };

      const resultado = await gravar({
        tabela: "apreciacoes_maquinas_itens",
        tipo: "update",
        linhas: patch,
        filtro: { id_item: params.id_item },
        modulo: "apreciacao-maquinas",
        id_documento: params.id_apreciacao,
      });
      return { params, patch, resultado };
    },
    scope: SCOPE_FOTOS_APR,
    onSuccess: ({ patch, resultado }, params) => {
      if (!resultado || resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY_DETALHE(params.id_apreciacao) });
        return;
      }
      qc.setQueryData<DetalheApreciacao>(
        KEY_DETALHE(params.id_apreciacao),
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

// ============================================================
// "Enviar para Plano de Ação" (v67) — copia ações do plano de
// adequação da apreciação pro Plano de Ação central (acoes_5w2h)
// ============================================================

export interface ResultadoEnvioPlanoAcao {
  enviadas: number;
  ignoradas: number;
}

/**
 * Copia ações de apreciacao_acoes pra acoes_5w2h, marcando a origem em
 * id_apreciacao_acao (índice único parcial no banco impede duplicar) e
 * id_apreciacao_item (v49) quando a ação veio de item NAO_CONFORME.
 * Ações canceladas não são enviadas.
 */
export function useEnviarAcoesParaPlanoAcao() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (params: {
      apreciacao: ApreciacaoMaquina;
      acoes: ApreciacaoAcao[];
    }): Promise<ResultadoEnvioPlanoAcao> => {
      const supabase = createSupabaseBrowserClient();
      const { apreciacao } = params;
      const candidatas = params.acoes.filter((a) => a.status !== "Cancelada");
      if (candidatas.length === 0) return { enviadas: 0, ignoradas: 0 };

      // Quais já foram enviadas? (dedupe pela origem)
      const { data: exist, error: exErr } = await supabase
        .from("acoes_5w2h")
        .select("id_apreciacao_acao")
        .in("id_apreciacao_acao", candidatas.map((a) => a.id_acao));
      if (exErr) throw exErr;
      const jaEnviadas = new Set(
        ((exist ?? []) as { id_apreciacao_acao: string | null }[])
          .map((r) => r.id_apreciacao_acao)
          .filter(Boolean) as string[]
      );

      const referencia =
        apreciacao.titulo ||
        apreciacao.maquina_descricao ||
        apreciacao.id_apreciacao;

      const novas: Acao5W2H[] = candidatas
        .filter((a) => !jaEnviadas.has(a.id_acao))
        .map((a) => ({
          id_acao: gerarId("ACA"),
          id_empresa: apreciacao.id_empresa,
          id_setor: null,
          id_risco: null,
          id_inspecao: apreciacao.id_inspecao ?? null,
          id_apreciacao_item: a.id_item,
          id_apreciacao_acao: a.id_acao,
          // v184: esta ação vem da apreciação, não de risco de inspeção.
          id_risco_origem: null,
          id_aet_acao: null,
          what_acao: a.what_acao,
          why_justificativa: a.why_justificativa,
          where_local: a.where_local ?? apreciacao.setor,
          when_prazo: a.when_prazo,
          who_responsavel: a.who_responsavel,
          how_metodo: a.how_metodo,
          how_much_custo: a.how_much_custo,
          status: a.status,
          prioridade: a.prioridade,
          data_conclusao: a.data_conclusao,
          observacoes: [
            `Origem: Apreciação de Máquinas NR-12 — ${referencia}`,
            a.observacoes,
          ]
            .filter(Boolean)
            .join("\n"),
          created_by: user?.email ?? null,
        }));

      if (novas.length > 0) {
        const { error } = await supabase
          .from("acoes_5w2h")
          .insert(novas as never);
        if (error) {
          // unique violation = envio concorrente (duas abas/usuários):
          // re-consulta o que já entrou e insere só o restante
          if ((error as { code?: string }).code === "23505") {
            const { data: ex2 } = await supabase
              .from("acoes_5w2h")
              .select("id_apreciacao_acao")
              .in("id_apreciacao_acao", novas.map((n) => n.id_apreciacao_acao!));
            const jaForam = new Set(
              ((ex2 ?? []) as { id_apreciacao_acao: string | null }[])
                .map((r) => r.id_apreciacao_acao)
                .filter(Boolean) as string[]
            );
            const restantes = novas.filter(
              (n) => !jaForam.has(n.id_apreciacao_acao!)
            );
            if (restantes.length > 0) {
              const { error: e2 } = await supabase
                .from("acoes_5w2h")
                .insert(restantes.map((n) => ({ ...n, id_acao: gerarId("ACA") })) as never);
              if (e2) throw e2;
            }
            return {
              enviadas: restantes.length,
              ignoradas: candidatas.length - restantes.length,
            };
          }
          throw error;
        }
      }

      return {
        enviadas: novas.length,
        ignoradas: candidatas.length - novas.length,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acoes-5w2h"] });
    },
    onError: (e: Error) =>
      toast.error(`Erro ao enviar pro Plano de Ação: ${e.message}`),
  });
}
