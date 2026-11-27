"use client";

// Comercial › Orçamentos (0.3.339, banco v375): catálogo de preços e orçamentos com versões. A RLS
// (comercial_pode_usar) recorta quem lê e grava; as regras dos modelos estão em lib/orcamentos/modelo.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { useUserStore } from "@/lib/store";
import type { MarcaOrcamento } from "@/lib/orcamentos/marcas";
import {
  totalOrcamento,
  type DadosOrcamento,
  type ModeloOrcamento,
  type Orcamento,
  type PrecoCatalogo,
  type SituacaoOrcamento,
} from "@/lib/orcamentos/modelo";

// As tabelas da v375 ainda não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createSupabaseBrowserClient() as any;

const CHAVE_CATALOGO = ["comercial-catalogo-precos"];
const CHAVE_ORCAMENTOS = ["comercial-orcamentos"];

export function useCatalogoPrecos() {
  return useQuery({
    queryKey: CHAVE_CATALOGO,
    queryFn: async (): Promise<PrecoCatalogo[]> => {
      const { data, error } = await sb().from("comercial_catalogo_precos").select("*").order("tipo").order("ordem").order("nome");
      if (error) throw error;
      return ((data ?? []) as PrecoCatalogo[]).map((p) => ({ ...p, valor: Number(p.valor) }));
    },
  });
}

export function useSalvarPreco() {
  const qc = useQueryClient();
  const nome = useUserStore((s) => s.user?.nome ?? null);
  return useMutation({
    mutationFn: async (p: Partial<PrecoCatalogo> & Pick<PrecoCatalogo, "tipo" | "nome" | "valor" | "unidade">) => {
      const campos = {
        tipo: p.tipo,
        nome: p.nome.trim(),
        descricao: p.descricao?.trim() || null,
        unidade: p.unidade.trim() || "unidade",
        valor: p.valor,
        ativo: p.ativo ?? true,
        ordem: p.ordem ?? 0,
        atualizado_por: nome,
      };
      const r = p.id_preco
        ? await sb().from("comercial_catalogo_precos").update(campos).eq("id_preco", p.id_preco)
        : await sb().from("comercial_catalogo_precos").insert(campos);
      if (r.error) {
        if (String(r.error.message).includes("ux_comercial_catalogo_precos_nome")) throw new Error("Já existe um item com esse nome nesse tipo.");
        throw r.error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_CATALOGO }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao gravar o preço")),
  });
}

export function useExcluirPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("comercial_catalogo_precos").delete().eq("id_preco", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_CATALOGO }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao excluir o preço")),
  });
}

const comoOrcamento = (o: Orcamento): Orcamento => ({ ...o, total: Number(o.total), dados: (o.dados ?? { data: o.criado_em.slice(0, 10) }) as DadosOrcamento });

export function useOrcamentos() {
  return useQuery({
    queryKey: CHAVE_ORCAMENTOS,
    queryFn: async (): Promise<Orcamento[]> => {
      const { data, error } = await sb().from("comercial_orcamentos").select("*").order("numero", { ascending: false }).order("versao", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Orcamento[]).map(comoOrcamento);
    },
  });
}

export function useOrcamento(id: string | null) {
  return useQuery({
    queryKey: [...CHAVE_ORCAMENTOS, id],
    enabled: !!id,
    queryFn: async (): Promise<Orcamento | null> => {
      const { data, error } = await sb().from("comercial_orcamentos").select("*").eq("id_orcamento", id).maybeSingle();
      if (error) throw error;
      return data ? comoOrcamento(data as Orcamento) : null;
    },
  });
}

export interface OrcamentoParaGravar {
  id_orcamento?: string | null;
  id_empresa: string | null;
  cliente_nome: string;
  cliente_cnpj: string | null;
  cidade: string | null;
  marca: MarcaOrcamento;
  modelo: ModeloOrcamento;
  dados: DadosOrcamento;
}

/** Grava o rascunho (novo ou o mesmo). Devolve o id. */
export function useSalvarOrcamento() {
  const qc = useQueryClient();
  const nome = useUserStore((s) => s.user?.nome ?? null);
  return useMutation({
    mutationFn: async (o: OrcamentoParaGravar): Promise<string> => {
      const campos = {
        id_empresa: o.id_empresa,
        cliente_nome: o.cliente_nome.trim(),
        cliente_cnpj: o.cliente_cnpj?.trim() || null,
        cidade: o.cidade?.trim() || null,
        marca: o.marca,
        modelo: o.modelo,
        dados: o.dados,
        total: totalOrcamento(o.modelo, o.dados),
      };
      if (o.id_orcamento) {
        const { error } = await sb().from("comercial_orcamentos").update(campos).eq("id_orcamento", o.id_orcamento);
        if (error) throw error;
        return o.id_orcamento;
      }
      const { data, error } = await sb().from("comercial_orcamentos").insert({ ...campos, criado_por: nome }).select("id_orcamento").single();
      if (error) throw error;
      return (data as { id_orcamento: string }).id_orcamento;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_ORCAMENTOS }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao gravar o orçamento")),
  });
}

/** Uma versão nova (rascunho) de um orçamento já enviado/decidido: mesmo número, versão + 1. Devolve o id novo. */
export function useNovaVersao() {
  const qc = useQueryClient();
  const nome = useUserStore((s) => s.user?.nome ?? null);
  return useMutation({
    mutationFn: async (o: Orcamento): Promise<string> => {
      const { data: ult, error: e1 } = await sb().from("comercial_orcamentos").select("versao").eq("numero", o.numero).order("versao", { ascending: false }).limit(1).single();
      if (e1) throw e1;
      const { data, error } = await sb()
        .from("comercial_orcamentos")
        .insert({
          numero: o.numero,
          versao: (ult as { versao: number }).versao + 1,
          id_orcamento_origem: o.id_orcamento,
          id_empresa: o.id_empresa,
          cliente_nome: o.cliente_nome,
          cliente_cnpj: o.cliente_cnpj,
          cidade: o.cidade,
          marca: o.marca,
          modelo: o.modelo,
          dados: o.dados,
          total: o.total,
          criado_por: nome,
        })
        .select("id_orcamento")
        .single();
      if (error) throw error;
      return (data as { id_orcamento: string }).id_orcamento;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_ORCAMENTOS });
      toast.success("Versão nova criada (rascunho)");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao criar a versão")),
  });
}

export function useMudarSituacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, situacao }: { id: string; situacao: SituacaoOrcamento }) => {
      const agora = new Date().toISOString();
      const extra =
        situacao === "enviado" ? { enviado_em: agora, decidido_em: null } : situacao === "rascunho" ? { enviado_em: null, decidido_em: null } : { decidido_em: agora };
      const { error } = await sb().from("comercial_orcamentos").update({ situacao, ...extra }).eq("id_orcamento", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_ORCAMENTOS }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao mudar a situação")),
  });
}

export function useExcluirOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await sb().from("comercial_orcamentos").delete({ count: "exact" }).eq("id_orcamento", id);
      if (error) throw error;
      if (!count) throw new Error("Só rascunho pode ser excluído.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_ORCAMENTOS });
      toast.success("Rascunho excluído");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao excluir")),
  });
}
