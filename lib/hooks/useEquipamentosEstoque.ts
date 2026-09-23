"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";

/**
 * Estoque e movimentação do módulo Equipamentos — a base da área de Movimentação.
 *
 * O DESENHO EM UMA FRASE: o saldo NUNCA é uma coluna gravada. Ele é derivado da
 * razão append-only `equipamentos_movimentacoes` pela view `v_equipamentos_saldo`.
 * É isso que dá auditoria (dá para responder "por que o saldo é 8?") e o que
 * impede o saldo de secar por um bug de update.
 *
 * DOIS MODELOS DE ITEM, decididos com o Leandro em 2026-08-11:
 *  • `controla_individual = true`  → computador, notebook. Cada aparelho é uma
 *    ficha própria em `equipamentos`, com série e plaqueta.
 *  • `controla_individual = false` → fone, mouse, cabo. Um cadastro no catálogo;
 *    o que existe por base é QUANTIDADE.
 *
 * As RPCs já existem no banco (v164/v165) e é por elas que tudo passa — gravar
 * direto na tabela de movimentação pelo PostgREST não valida saldo nem exige
 * motivo no ajuste.
 */

const KEY = {
  catalogo: ["equip-catalogo"] as const,
  saldo: ["equip-saldo"] as const,
  movs: ["equip-movimentacoes"] as const,
  nfe: ["equip-nfe"] as const,
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EquipamentoCatalogo {
  id_catalogo: string;
  nome: string;
  tipo: string | null;
  fabricante: string | null;
  modelo: string | null;
  unidade_medida: string | null;
  estoque_minimo: number | null;
  /** true = vira ficha individual na entrega; false = só quantidade. */
  controla_individual: boolean;
  foto_url: string | null;
  foto_thumb_path: string | null;
  ativo: boolean;
  criado_por: string | null;
  criado_em: string;
}

export type MovTipo = "entrada" | "saida";
export type MovOrigem =
  | "manual"
  | "nf"
  | "entrega"
  | "devolucao"
  | "transferencia"
  | "ajuste";

export interface EquipamentoMovimentacao {
  id_movimentacao: string;
  id_catalogo: string;
  id_unidade: string;
  tipo: MovTipo;
  quantidade: number;
  origem: MovOrigem;
  ref_id: string | null;
  motivo: string | null;
  responsavel: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface ImportacaoNfe {
  id_importacao: string;
  id_unidade: string;
  chnfe: string;
  fornecedor_nome: string | null;
  numero_nf: string | null;
  data_emissao: string | null;
  valor_total: number | null;
  total_itens: number | null;
  itens_lancados: number | null;
  status: string | null;
  criado_em: string;
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

export function useEquipamentosCatalogo() {
  return useQuery({
    queryKey: KEY.catalogo,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("equipamentos_catalogo")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoCatalogo[];
    },
  });
}

/**
 * Saldo por base. A chave do Map é `${id_unidade}|${id_catalogo}` porque o saldo
 * só existe nesse cruzamento: "10 fones" não quer dizer nada sem dizer onde.
 */
export function useEquipamentosSaldo() {
  return useQuery({
    queryKey: KEY.saldo,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("v_equipamentos_saldo")
        .select("id_unidade,id_catalogo,saldo");
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of (data ?? []) as unknown as {
        id_unidade: string;
        id_catalogo: string;
        saldo: number;
      }[]) {
        m.set(`${r.id_unidade}|${r.id_catalogo}`, Number(r.saldo));
      }
      return m;
    },
  });
}

/** Extrato. É a tela da área — por isso vem ordenado do mais recente. */
export function useEquipamentosMovimentacoes(limite = 300) {
  return useQuery({
    queryKey: [...KEY.movs, limite] as const,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("equipamentos_movimentacoes")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(limite);
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoMovimentacao[];
    },
  });
}

export function useImportacoesNfe() {
  return useQuery({
    queryKey: KEY.nfe,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("equipamentos_importacoes_nfe")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as ImportacaoNfe[];
    },
  });
}

/**
 * Extrato COMPLETO, sob demanda — só para a exportação (Fase 8).
 *
 * A tela usa `useEquipamentosMovimentacoes()`, que traz as 300 mais recentes:
 * é um teto de exibição, não uma escolha de quem está olhando. Exportar essas
 * 300 entregaria um arquivo silenciosamente curto — a mesma armadilha que a
 * janela progressiva armou para a exportação do inventário em 2026-08-10, e
 * que só foi descoberta conferindo linha por linha.
 *
 * `enabled: false` de propósito: nasce parada e só busca no clique do botão,
 * via `refetch()`. Ninguém paga o extrato inteiro por abrir a tela.
 */
export function useMovimentacoesParaExport() {
  return useQuery({
    queryKey: [...KEY.movs, "export"] as const,
    enabled: false,
    gcTime: 0,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("equipamentos_movimentacoes")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoMovimentacao[];
    },
  });
}

/** Tudo que muda saldo invalida as três leituras juntas — saldo e extrato andam
 *  sempre no mesmo passo, e o catálogo pode ter ganhado item novo. */
function invalidarTudo(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY.saldo });
  qc.invalidateQueries({ queryKey: KEY.movs });
  qc.invalidateQueries({ queryKey: KEY.catalogo });
  qc.invalidateQueries({ queryKey: KEY.nfe });
}

// ─── Escrita (sempre por RPC) ─────────────────────────────────────────────────

export function useCriarItemCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      tipo?: string | null;
      fabricante?: string | null;
      modelo?: string | null;
      unidade_medida?: string | null;
      estoque_minimo?: number | null;
      controla_individual: boolean;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("equipamentos_catalogo")
        .insert(input as never)
        .select("id_catalogo")
        .single();
      if (error) throw error;
      return data as unknown as { id_catalogo: string };
    },
    onSuccess: () => invalidarTudo(qc),
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível criar o item no catálogo.")),
  });
}

/** Editar um produto do catálogo. Nasceu com o "+ Novo produto" dentro do Dar
 *  entrada (21/09/2026): antes o catálogo só criava, e quem errasse o tipo ou
 *  o mínimo ficava com o erro para sempre. `controla_individual` só muda
 *  enquanto o produto não tem movimento — quem chama decide isso na tela. */
export function useAtualizarItemCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id_catalogo: string;
      nome?: string;
      tipo?: string | null;
      fabricante?: string | null;
      modelo?: string | null;
      unidade_medida?: string | null;
      estoque_minimo?: number | null;
      controla_individual?: boolean;
      ativo?: boolean;
    }) => {
      const { id_catalogo, ...patch } = input;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("equipamentos_catalogo")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id_catalogo", id_catalogo);
      if (error) throw error;
      return { id_catalogo };
    },
    onSuccess: () => invalidarTudo(qc),
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível atualizar o produto.")),
  });
}

/** Entrada manual — a porta do que chega sem nota: doação, reaproveitamento,
 *  devolução de contrato. A RPC valida e lança na razão. */
export function useLancarEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id_catalogo: string;
      id_unidade: string;
      quantidade: number;
      fornecedor?: string | null;
      nota_fiscal?: string | null;
      observacao?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("equipamento_lancar_entrada", {
        p_id_catalogo: p.id_catalogo,
        p_id_unidade: p.id_unidade,
        p_quantidade: p.quantidade,
        p_fornecedor: p.fornecedor ?? null,
        p_nota_fiscal: p.nota_fiscal ?? null,
        p_observacao: p.observacao ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(qc);
      toast.success("Entrada registrada.");
    },
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível registrar a entrada.")),
  });
}

/**
 * Ajuste de contagem. A RPC recebe O QUE FOI CONTADO e calcula a diferença
 * sozinha — quem contou 10 na prateleira digita 10, não "−2". É a correção do
 * defeito do EPI, onde `ajuste` nunca conseguia BAIXAR o estoque.
 * Motivo é obrigatório, e a trava é do banco.
 */
export function useAjustarSaldo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id_catalogo: string;
      id_unidade: string;
      saldo_contado: number;
      motivo: string;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("equipamento_ajustar_saldo", {
        p_id_catalogo: p.id_catalogo,
        p_id_unidade: p.id_unidade,
        p_saldo_contado: p.saldo_contado,
        p_motivo: p.motivo,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(qc);
      toast.success("Contagem ajustada.");
    },
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível ajustar o saldo.")),
  });
}

/**
 * Transferência POR QUANTIDADE entre bases (v176).
 *
 * A SAÍDA SAI AQUI, no registro — não no aceite. Se o saldo só mudasse quando o
 * destinatário assinasse, a origem mostraria 10 fones com 8 na mão, e alguém
 * prometeria os 2 que já estão no carro. Como romaneio: a mercadoria saiu, fica
 * em trânsito, e entra no destino quando alguém assina o recebimento.
 *
 * Desistir devolve: recusar e cancelar chamam o estorno dentro da mesma
 * transação, no banco. Não é a tela que faz isso — se a recusa viesse por outra
 * via, o material sumiria em silêncio.
 *
 * O saldo é conferido no BANCO, não aqui: entre a tela carregar e o clique,
 * outra pessoa pode ter dado saída no mesmo item.
 */
export function useTransferirEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id_catalogo: string;
      de_unidade: string;
      para_unidade: string;
      quantidade: number;
      para_email: string;
      motivo?: string | null;
      transportado_por?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("equipamento_transferir_estoque", {
        p_id_catalogo: p.id_catalogo,
        p_de_unidade: p.de_unidade,
        p_para_unidade: p.para_unidade,
        p_quantidade: p.quantidade,
        p_para_email: p.para_email,
        p_motivo: p.motivo ?? null,
        p_transportado_por: p.transportado_por ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => {
      invalidarTudo(qc);
      qc.invalidateQueries({ queryKey: ["transferencias"] });
      toast.success("Transferência registrada. O material saiu do saldo da origem.");
    },
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível registrar a transferência.")),
  });
}

/**
 * Importação de NF-e. A chave da nota é única no sistema inteiro — se a mesma
 * nota for importada duas vezes, a RPC recusa e diz em qual base ela já entrou.
 * Sem isso o saldo inflaria em silêncio, que é o risco que o briefing manda
 * respeitar.
 */
export function useImportarNfe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id_unidade: string;
      chnfe: string;
      fornecedor_cnpj?: string | null;
      fornecedor_nome?: string | null;
      numero_nf?: string | null;
      data_emissao?: string | null;
      valor_total?: number | null;
      xml_nome?: string | null;
      /** [{ id_catalogo | nome_novo, quantidade, valor_unitario, controla_individual }] */
      itens: unknown[];
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("equipamento_importar_nfe", {
        p_id_unidade: p.id_unidade,
        p_chnfe: p.chnfe,
        p_fornecedor_cnpj: p.fornecedor_cnpj ?? null,
        p_fornecedor_nome: p.fornecedor_nome ?? null,
        p_numero_nf: p.numero_nf ?? null,
        p_data_emissao: p.data_emissao ?? null,
        p_valor_total: p.valor_total ?? null,
        p_xml_nome: p.xml_nome ?? null,
        p_itens: p.itens,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(qc);
      toast.success("Nota importada e estoque atualizado.");
    },
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível importar a nota.")),
  });
}
