"use client";

// Conciliação DRPS/QPS × AEP — o que a equipe grava (v0.3.176, banco v310): ligação de
// setores por empresa, parecer por cruzamento, ação 5W2H a partir do parecer e o
// fechamento (foto imutável). Escreve qualquer pessoa que edita e enxerga a empresa (RLS).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import { carregarRegistrosConciliacao } from "@/lib/psico-consolidacao/carregar-conciliacao";
import {
  REGUA,
  type DecisaoParecer,
  type ItemFechamento,
  type ParecerConciliacao,
  type Questionario,
} from "@/lib/psico-consolidacao/conciliacao";
import type { OrigemFonte } from "@/lib/psico-consolidacao/fatores";
import type { Acao5W2H, AcaoPrioridade } from "@/lib/supabase/types";

const sb = () => createSupabaseBrowserClient();
const CHAVE = "psico-conciliacao-registros";

function mensagemErro(e: { message?: string; code?: string }): string {
  const msg = e.message ?? "";
  if (e.code === "42501" || msg.includes("row-level security")) return "Você não tem permissão para isso.";
  if (msg.includes("ux_psico_conc_setor_depara")) return "Esse setor já está ligado a outro.";
  if (msg.includes("justificativa")) return "Para descartar, escreva a justificativa.";
  return msg || "Não foi possível salvar.";
}

export function useRegistrosConciliacao(idEmpresa?: string) {
  return useQuery({
    queryKey: [CHAVE, idEmpresa ?? "todas"],
    staleTime: 30_000,
    queryFn: () => carregarRegistrosConciliacao(sb(), idEmpresa),
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [CHAVE] });
}

/** "Este setor é o mesmo que aquele" — por empresa. */
export function useLigarSetores() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (p: { idEmpresa: string; chaveDe: string; nomeDe: string; chavePara: string; nomePara: string }) => {
      const { error } = await sb()
        .from("psico_conciliacao_setor_depara" as never)
        .insert({
          id_depara: gerarId("PCS"),
          id_empresa: p.idEmpresa,
          chave_de: p.chaveDe,
          nome_de: p.nomeDe,
          chave_para: p.chavePara,
          nome_para: p.nomePara,
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Setores ligados.");
      invalidar();
    },
    onError: (e: { message?: string; code?: string }) => toast.error(mensagemErro(e)),
  });
}

export function useDesligarSetor() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (idDepara: string) => {
      const { error } = await sb().from("psico_conciliacao_setor_depara" as never).delete().eq("id_depara", idDepara);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ligação desfeita.");
      invalidar();
    },
    onError: (e: { message?: string; code?: string }) => toast.error(mensagemErro(e)),
  });
}

export interface DadosAcaoParecer {
  setor: string;
  fator: string;
  classe: string;
  /** Ex.: "AEP Alto × DRPS Crítico (12 respondentes)". */
  retrato: string;
  /** Maior degrau das duas fontes (1–4) → prioridade da ação. */
  maiorDegrau: number;
}

const PRIORIDADE_POR_DEGRAU: Record<number, AcaoPrioridade> = { 4: "Critica", 3: "Alta", 2: "Media", 1: "Baixa" };

/**
 * A ação 5W2H do parecer. Nasce SEM prazo e SEM responsável, como a da inspeção
 * (lib/acoes/de-risco.ts): a equipe completa na tela de Ações.
 */
export function acaoDoParecer(idEmpresa: string, decisao: DecisaoParecer, d: DadosAcaoParecer, criadoPor: string | null): Acao5W2H {
  const what =
    decisao === "AET"
      ? `Realizar AET (NR-17) do fator psicossocial "${d.fator}" no setor ${d.setor} — a percepção dos trabalhadores e a AEP divergem.`
      : `Definir medida de controle para o fator psicossocial "${d.fator}" no setor ${d.setor}.`;
  return {
    id_acao: gerarId("ACA"),
    id_empresa: idEmpresa,
    id_setor: null,
    id_risco: null,
    id_inspecao: null,
    id_apreciacao_item: null,
    id_apreciacao_acao: null,
    id_risco_origem: null,
    id_aet_acao: null,
    what_acao: what,
    why_justificativa: `Conciliação DRPS/QPS × AEP: ${d.classe} — ${d.retrato}`,
    where_local: d.setor,
    when_prazo: null,
    who_responsavel: null,
    how_metodo: null,
    how_much_custo: null,
    status: "Pendente",
    prioridade: PRIORIDADE_POR_DEGRAU[d.maiorDegrau] ?? "Media",
    data_conclusao: null,
    observacoes: "Origem: Consolidação › Conciliação DRPS/QPS × AEP",
    created_by: criadoPor,
  };
}

export function useSalvarParecer() {
  const invalidar = useInvalidar();
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (p: {
      atual: ParecerConciliacao | undefined;
      idEmpresa: string;
      setorChave: string;
      setorNome: string;
      idFator: string;
      questionario: Questionario;
      decisao: DecisaoParecer;
      justificativa: string;
      classe: string;
      documentos: Partial<Record<OrigemFonte, string>>;
      /** Gera a ação 5W2H junto (Confirmar/AET, sem ação ainda). */
      gerarAcao: DadosAcaoParecer | null;
    }) => {
      let idAcao = p.atual?.id_acao ?? null;
      if (p.gerarAcao && !idAcao && p.decisao !== "DESCARTAR") {
        const acao = acaoDoParecer(p.idEmpresa, p.decisao, p.gerarAcao, user?.email ?? null);
        const { error } = await sb().from("acoes_5w2h").insert(acao as never);
        if (error) throw error;
        idAcao = acao.id_acao;
      }
      const linha = {
        id_empresa: p.idEmpresa,
        setor_chave: p.setorChave,
        setor_nome: p.setorNome,
        id_fator: p.idFator,
        questionario: p.questionario,
        decisao: p.decisao,
        justificativa: p.justificativa.trim() || null,
        classe: p.classe,
        documentos: p.documentos,
        id_acao: idAcao,
      };
      const { error } = p.atual
        ? await sb().from("psico_conciliacao_pareceres" as never).update(linha as never).eq("id_parecer", p.atual.id_parecer)
        : await sb()
            .from("psico_conciliacao_pareceres" as never)
            .insert({ ...linha, id_parecer: gerarId("PCP") } as never);
      if (error) throw error;
      return { gerouAcao: idAcao !== (p.atual?.id_acao ?? null) };
    },
    onSuccess: (r) => {
      toast.success(r.gerouAcao ? "Parecer salvo e ação criada no Plano de Ação." : "Parecer salvo.");
      invalidar();
      if (r.gerouAcao) qc.invalidateQueries({ queryKey: ["acoes-5w2h"] });
    },
    onError: (e: { message?: string; code?: string }) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirParecer() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (idParecer: string) => {
      const { error } = await sb().from("psico_conciliacao_pareceres" as never).delete().eq("id_parecer", idParecer);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parecer removido.");
      invalidar();
    },
    onError: (e: { message?: string; code?: string }) => toast.error(mensagemErro(e)),
  });
}

/** Fecha a conciliação: foto imutável com documentos, régua, totais e pareceres. */
export function useFecharConciliacao() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (p: {
      idEmpresa: string;
      documentos: Record<string, { id: string; titulo: string; data: string | null }>;
      resumo: Record<string, unknown>;
      itens: ItemFechamento[];
      observacao: string;
    }) => {
      const { error } = await sb()
        .from("psico_conciliacao_fechamentos" as never)
        .insert({
          id_fechamento: gerarId("PCF"),
          id_empresa: p.idEmpresa,
          documentos: p.documentos,
          regua: REGUA,
          resumo: p.resumo,
          itens: p.itens,
          observacao: p.observacao.trim() || null,
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conciliação fechada e guardada no histórico.");
      invalidar();
    },
    onError: (e: { message?: string; code?: string }) => toast.error(mensagemErro(e)),
  });
}
