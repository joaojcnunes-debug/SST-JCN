"use client";

// Conciliação DRPS/QPS × AEP — o que a equipe grava (v0.3.176, banco v310): ligação de
// setores por empresa, parecer por cruzamento, ação 5W2H a partir do parecer e o
// fechamento (foto imutável). Escreve qualquer pessoa que edita e enxerga a empresa (RLS).
// v0.3.285 (banco v354): os mesmos hooks servem à conciliação por GRUPO — `alvo` diz qual. No grupo as
// tabelas são as psico_conciliacao_grupo_*, o parecer cria uma ação em cada empresa que tem o setor
// (`id_acoes`) e o fechamento guarda as empresas e a lista de documentos de cada uma.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import { carregarRegistrosConciliacao, carregarRegistrosConciliacaoGrupo } from "@/lib/psico-consolidacao/carregar-conciliacao";
import type { DocumentoFechamentoGrupo, ItemFechamentoGrupo } from "@/lib/psico-consolidacao/conciliacao-grupo";
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
const CHAVE_GRUPO = "psico-conciliacao-grupo-registros";

/** De quem é a conciliação: uma empresa ou um grupo (v0.3.285). */
export type AlvoConciliacao = { tipo: "empresa"; id: string } | { tipo: "grupo"; id: string };

const TABELA = {
  empresa: {
    coluna: "id_empresa",
    depara: "psico_conciliacao_setor_depara",
    pareceres: "psico_conciliacao_pareceres",
    fechamentos: "psico_conciliacao_fechamentos",
    prefixo: { depara: "PCS", parecer: "PCP", fechamento: "PCF" },
  },
  grupo: {
    coluna: "id_grupo",
    depara: "psico_conciliacao_grupo_setor_depara",
    pareceres: "psico_conciliacao_grupo_pareceres",
    fechamentos: "psico_conciliacao_grupo_fechamentos",
    prefixo: { depara: "PGS", parecer: "PGP", fechamento: "PGF" },
  },
} as const;

function mensagemErro(e: { message?: string; code?: string }): string {
  const msg = e.message ?? "";
  if (e.code === "42501" || msg.includes("row-level security")) return "Você não tem permissão para isso.";
  if (msg.includes("ux_psico_conc_setor_depara") || msg.includes("ux_psico_conc_grupo_setor_depara")) return "Esse setor já está ligado a outro.";
  if (msg.includes("só a última conciliação")) return "Só a última conciliação fechada pode ser reaberta.";
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

/** Pareceres, ligações e fechamentos dos grupos (v354); sem `idGrupo`, de todos (a lista). */
export function useRegistrosConciliacaoGrupo(idGrupo?: string) {
  return useQuery({
    queryKey: [CHAVE_GRUPO, idGrupo ?? "todos"],
    staleTime: 30_000,
    queryFn: () => carregarRegistrosConciliacaoGrupo(sb(), idGrupo),
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [CHAVE] });
    qc.invalidateQueries({ queryKey: [CHAVE_GRUPO] });
  };
}

/** "Este setor é o mesmo que aquele" — por empresa ou por grupo. */
export function useLigarSetores() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (p: { alvo: AlvoConciliacao; chaveDe: string; nomeDe: string; chavePara: string; nomePara: string }) => {
      const t = TABELA[p.alvo.tipo];
      const { error } = await sb()
        .from(t.depara as never)
        .insert({
          id_depara: gerarId(t.prefixo.depara),
          [t.coluna]: p.alvo.id,
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
    mutationFn: async ({ alvo, idDepara }: { alvo: AlvoConciliacao; idDepara: string }) => {
      const { error } = await sb().from(TABELA[alvo.tipo].depara as never).delete().eq("id_depara", idDepara);
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
export function acaoDoParecer(
  idEmpresa: string,
  decisao: DecisaoParecer,
  d: DadosAcaoParecer,
  criadoPor: string | null,
  /** Nome do grupo, quando o parecer é da conciliação por grupo (v0.3.285). */
  origemGrupo?: string,
): Acao5W2H {
  const what =
    decisao === "AET"
      ? `Realizar AET (NR-17) do fator psicossocial "${d.fator}" no setor ${d.setor}${d.classe === "Fonte única" ? "." : " — a percepção dos trabalhadores e a AEP divergem."}`
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
    why_justificativa: `${origemGrupo ? "Conciliação por grupo" : "Conciliação DRPS/QPS × AEP"}: ${d.classe} — ${d.retrato}`,
    where_local: d.setor,
    when_prazo: null,
    who_responsavel: null,
    how_metodo: null,
    how_much_custo: null,
    status: "Pendente",
    prioridade: PRIORIDADE_POR_DEGRAU[d.maiorDegrau] ?? "Media",
    data_conclusao: null,
    observacoes: origemGrupo
      ? `Origem: Consolidação › Conciliação por grupo (${origemGrupo})`
      : "Origem: Consolidação › Conciliação DRPS/QPS × AEP",
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
      alvo: AlvoConciliacao;
      /** Empresas que recebem a ação 5W2H (por empresa, ela mesma; por grupo, as que têm o setor). */
      empresasAcao: string[];
      /** Nome do grupo, que vai na origem da ação. */
      nomeGrupo?: string;
      setorChave: string;
      setorNome: string;
      idFator: string;
      questionario: Questionario;
      decisao: DecisaoParecer;
      justificativa: string;
      classe: string;
      /** Por empresa: {AEP: id, DRPS: id, QPS: id}; por grupo: a lista dos ids usados. */
      documentos: Partial<Record<OrigemFonte, string>> | string[];
      /** Gera a ação 5W2H junto (Confirmar/AET, sem ação ainda). */
      gerarAcao: DadosAcaoParecer | null;
    }) => {
      const t = TABELA[p.alvo.tipo];
      const antes = p.atual ? (p.alvo.tipo === "grupo" ? p.atual.id_acoes ?? [] : p.atual.id_acao ? [p.atual.id_acao] : []) : [];
      let ids = antes;
      if (p.gerarAcao && antes.length === 0 && p.decisao !== "DESCARTAR") {
        const dados = p.gerarAcao;
        const destino = p.alvo.tipo === "empresa" ? [p.alvo.id] : p.empresasAcao;
        const origem = p.alvo.tipo === "grupo" ? p.nomeGrupo ?? p.alvo.id : undefined;
        const acoes = destino.map((e) => acaoDoParecer(e, p.decisao, dados, user?.email ?? null, origem));
        if (acoes.length > 0) {
          const { error } = await sb().from("acoes_5w2h").insert(acoes as never);
          if (error) throw error;
        }
        ids = acoes.map((a) => a.id_acao);
      }
      const linha = {
        [t.coluna]: p.alvo.id,
        setor_chave: p.setorChave,
        setor_nome: p.setorNome,
        id_fator: p.idFator,
        questionario: p.questionario,
        decisao: p.decisao,
        justificativa: p.justificativa.trim() || null,
        classe: p.classe,
        documentos: p.documentos,
        ...(p.alvo.tipo === "grupo" ? { id_acoes: ids } : { id_acao: ids[0] ?? null }),
      };
      const { error } = p.atual
        ? await sb().from(t.pareceres as never).update(linha as never).eq("id_parecer", p.atual.id_parecer)
        : await sb()
            .from(t.pareceres as never)
            .insert({ ...linha, id_parecer: gerarId(t.prefixo.parecer) } as never);
      if (error) throw error;
      return { acoesNovas: ids.length - antes.length };
    },
    onSuccess: (r) => {
      toast.success(
        r.acoesNovas > 1
          ? `Parecer salvo e ${r.acoesNovas} ações criadas no Plano de Ação (uma por empresa).`
          : r.acoesNovas === 1
            ? "Parecer salvo e ação criada no Plano de Ação."
            : "Parecer salvo.",
      );
      invalidar();
      if (r.acoesNovas > 0) qc.invalidateQueries({ queryKey: ["acoes-5w2h"] });
    },
    onError: (e: { message?: string; code?: string }) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirParecer() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ alvo, idParecer }: { alvo: AlvoConciliacao; idParecer: string }) => {
      const { error } = await sb().from(TABELA[alvo.tipo].pareceres as never).delete().eq("id_parecer", idParecer);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parecer removido.");
      invalidar();
    },
    onError: (e: { message?: string; code?: string }) => toast.error(mensagemErro(e)),
  });
}

/**
 * Reabre a última conciliação (v324/v325): registro à parte, com motivo; a foto e o PDF não mudam.
 * Se estava liberada, o atendimento reabre junto, numa operação só.
 */
export function useReabrirConciliacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { idFechamento: string; alvo: AlvoConciliacao; motivo: string }) => {
      // Grupo (v354): ainda sem Comercial, a reabertura é só o registro (o banco confere que é a última).
      const { error } =
        p.alvo.tipo === "grupo"
          ? await sb()
              .from("psico_conciliacao_grupo_reaberturas" as never)
              .insert({ id_reabertura: gerarId("PGR"), id_fechamento: p.idFechamento, id_grupo: p.alvo.id, motivo: p.motivo.trim() } as never)
          : await sb().rpc(
              "comercial_reabrir_conciliacao" as never,
              { p_id_empresa: p.alvo.id, p_id_fechamento: p.idFechamento, p_motivo: p.motivo } as never,
            );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conciliação reaberta.");
      for (const k of [CHAVE, CHAVE_GRUPO, "comercial-dados", "comercial-eventos", "documento-sessoes"]) qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: { message?: string; code?: string }) => toast.error(mensagemErro(e)),
  });
}

/** Fecha a conciliação: foto imutável com documentos, régua, totais e pareceres. */
export function useFecharConciliacao() {
  const qc = useQueryClient();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (p: {
      alvo: AlvoConciliacao;
      /** Por empresa: um por origem; por grupo: a lista, com a empresa de cada um. */
      documentos: Record<string, { id: string; titulo: string; data: string | null }> | DocumentoFechamentoGrupo[];
      resumo: Record<string, unknown>;
      itens: ItemFechamento[] | ItemFechamentoGrupo[];
      observacao: string;
      /** Só no grupo: o nome e as empresas do momento. */
      grupo?: { nome: string; empresas: Array<{ id_empresa: string; nome: string; cnpj: string | null }> };
    }) => {
      const t = TABELA[p.alvo.tipo];
      const { error } = await sb()
        .from(t.fechamentos as never)
        .insert({
          id_fechamento: gerarId(t.prefixo.fechamento),
          [t.coluna]: p.alvo.id,
          ...(p.alvo.tipo === "grupo" ? { nome_grupo: p.grupo?.nome ?? p.alvo.id, empresas: p.grupo?.empresas ?? [] } : {}),
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
      qc.invalidateQueries({ queryKey: ["comercial-dados"] });
    },
    onError: (e: { message?: string; code?: string }) => toast.error(mensagemErro(e)),
  });
}
