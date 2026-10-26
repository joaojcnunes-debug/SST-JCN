"use client";

/**
 * Consultas do Dashboard de inspeções e documentos (26/10/2026) — as MESMAS para o card, a tela de
 * detalhe e a página da pessoa (/dashboard/pessoa), para os números nunca divergirem.
 *
 * As réguas (qual mês, a quem conta) moram em lib/dashboard/*; aqui só se busca.
 */

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { ehRenovacao, type InspecaoContavel, type TecnicoDeCampo } from "@/lib/dashboard/inspecoes";
import type { LinhaAssociacao, LinhaAssuncao, DocumentoDaEmpresa } from "@/lib/dashboard/associacoes-empresas";

type EmpresaJoin = { nome_empresa: string | null } | { nome_empresa: string | null }[] | null;

export function nomeDaEmpresa(e: EmpresaJoin | undefined): string {
  const x = Array.isArray(e) ? e[0] : e;
  return x?.nome_empresa ?? "—";
}

/** Inspeção concluída (1ª conclusão travada ou status atual), com a empresa. */
export type InspecaoConcluida = InspecaoContavel & {
  id_inspecao: string;
  concluida_por_email?: string | null;
  primeira_conclusao_por?: string | null;
  usuario?: string | null;
  id_empresa?: string | null;
  empresas?: EmpresaJoin;
};

/**
 * Inspeções que já foram concluídas alguma vez: status CONCLUIDA ou com `primeira_conclusao_em`
 * (v295 — a reaberta continua contando no mês da 1ª conclusão). Renovação fica de fora (23/09).
 */
export function useInspecoesConcluidas() {
  return useQuery<InspecaoConcluida[]>({
    queryKey: ["dashboard-concluidas-detalhe"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const linhas = await fetchAllRows<InspecaoConcluida>((de, ate) =>
        sb
          .from("inspecoes")
          .select(
            "id_inspecao, status, data_inspecao, concluida_em, primeira_conclusao_em, primeira_conclusao_por, concluida_por_email, usuario, created_at, tipo_criacao, responsavel, id_empresa, empresas(nome_empresa)",
          )
          .neq("status", "DELETADA")
          .or("status.eq.CONCLUIDA,primeira_conclusao_em.not.is.null")
          .order("id_inspecao")
          .range(de, ate),
      );
      return linhas.filter((i) => !ehRenovacao(i.tipo_criacao));
    },
  });
}

/** Técnicos da aba Responsáveis por inspeção (quem foi a campo) — vínculo v204 + texto digitado. */
export function useTecnicosDeCampo() {
  return useQuery<Map<string, TecnicoDeCampo[]>>({
    queryKey: ["dashboard-tecnicos-de-campo"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const linhas = await fetchAllRows<{ id_inspecao: string | null; tecnico_responsavel: string | null; id_usuario: string | null }>(
        (de, ate) => sb.from("responsaveis").select("id_inspecao, tecnico_responsavel, id_usuario").order("id_responsavel").range(de, ate),
      );
      const mapa = new Map<string, TecnicoDeCampo[]>();
      for (const l of linhas) {
        if (!l.id_inspecao) continue;
        const lista = mapa.get(l.id_inspecao) ?? [];
        lista.push({ digitado: l.tecnico_responsavel ?? "", idUsuario: l.id_usuario });
        mapa.set(l.id_inspecao, lista);
      }
      return mapa;
    },
  });
}

export interface ContaDoPainel {
  id_usuario: string;
  email: string;
  nome: string;
  perfil: string;
}

/** Contas do painel — traduzem e-mail/id em nome e listam os técnicos para a "nota do supervisor". */
export function useContasDoPainel() {
  return useQuery<ContaDoPainel[]>({
    queryKey: ["dashboard-contas-painel"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("usuarios").select("id_usuario, email, nome, perfil, ativo_sistema");
      if (error) throw error;
      return ((data ?? []) as { id_usuario: string; email: string | null; nome: string | null; perfil: string; ativo_sistema: boolean | null }[])
        .filter((u) => (u.nome ?? "").trim() !== "")
        .map((u) => ({ id_usuario: u.id_usuario, email: (u.email ?? "").trim(), nome: (u.nome ?? "").trim(), perfil: u.perfil }));
    },
  });
}

export interface AlteracaoAuditada {
  tabela: string;
  acao: string;
  campo: string;
  antes: unknown;
  depois: unknown;
  por: string | null;
  em: string;
}

export interface Reabertura {
  id_inspecao: string;
  reaberta_em: string;
  reaberta_por: string | null;
  reconcluida_em: string | null;
  alteracoes: AlteracaoAuditada[];
}

/** Reaberturas depois da 1ª conclusão, com a lista do que mudou (v295, pela auditoria). */
export function useReaberturas(tipo: "inspecao" | "documento") {
  return useQuery<Reabertura[]>({
    queryKey: ["dashboard-reaberturas", tipo],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("dashboard_reaberturas" as never, { p_tipo: tipo } as never);
      if (error) throw error;
      return (data ?? []) as Reabertura[];
    },
  });
}

/** Linha para documentos associados: o documento, a empresa e o responsável atual. */
export type DocumentoComEmpresa = DocumentoDaEmpresa & { elaboracao_responsavel: string | null };

/** Associações, assunções (v295) e documentos com empresa — fonte da tela de documentos associados. */
export function useAssociacoesEmpresas() {
  return useQuery<{ assoc: LinhaAssociacao[]; assuncoes: LinhaAssuncao[]; docs: DocumentoComEmpresa[] }>({
    queryKey: ["dashboard-associacoes-empresas"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const [assoc, assuncoesRes, docsBrutos] = await Promise.all([
        fetchAllRows<LinhaAssociacao>((de, ate) =>
          sb.from("inspecao_associados").select("id_inspecao, nome, created_at").order("id").range(de, ate),
        ),
        sb.rpc("dashboard_assuncoes" as never),
        fetchAllRows<{ id_inspecao: string; status: string; id_empresa: string | null; elaboracao_responsavel: string | null; empresas?: EmpresaJoin }>(
          (de, ate) =>
            sb
              .from("inspecoes")
              .select("id_inspecao, status, id_empresa, elaboracao_responsavel, empresas(nome_empresa)")
              .neq("status", "DELETADA")
              .order("id_inspecao")
              .range(de, ate),
        ),
      ]);
      if (assuncoesRes.error) throw assuncoesRes.error;
      const docs = docsBrutos.map((d) => ({
        id_inspecao: d.id_inspecao,
        status: d.status,
        id_empresa: d.id_empresa,
        nome_empresa: nomeDaEmpresa(d.empresas),
        elaboracao_responsavel: d.elaboracao_responsavel,
      }));
      return { assoc, assuncoes: (assuncoesRes.data ?? []) as LinhaAssuncao[], docs };
    },
  });
}
