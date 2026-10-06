"use client";

// Coleta anônima por QR Code da AEP, dentro do QPS (v273). Ver
// lib/qps/triagem-anonima.ts. Cada setor da AEP pode ter um link; todos os
// links de uma AEP ficam numa mesma aplicação QPS do tipo "Triagem anônima
// AEP (13 fatores)", que aparece no módulo QPS da empresa.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { mensagemErro } from "@/lib/errors";
import {
  FATOR_POR_CATEGORIA,
  ID_TIPO_TRIAGEM,
  VALIDADE_PADRAO_DIAS,
  gerarToken,
  type ResultadoColeta,
} from "@/lib/qps/triagem-anonima";

// As tabelas/funções da v273 ainda não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createSupabaseBrowserClient() as any;

export interface ColetaAnonima {
  id_coleta: string;
  token: string;
  id_aplicacao: string;
  id_relatorio_aep: string | null;
  id_setor_aep: string | null;
  setor: string;
  expira_em: string;
  ativo: boolean;
  max_respostas: number;
  criado_por: string | null;
  criado_em: string;
}

const KEY = (id: string) => ["coletas-anonimas", id] as const;

export function useColetasDaAep(idRelatorio: string | null | undefined) {
  return useQuery({
    queryKey: KEY(idRelatorio ?? ""),
    enabled: !!idRelatorio,
    queryFn: async () => {
      const { data, error } = await db()
        .from("qps_coletas_anonimas")
        .select("*")
        .eq("id_relatorio_aep", idRelatorio)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ColetaAnonima[];
    },
  });
}

const idColeta = () =>
  `QCA-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

export function useCriarColetaAnonima() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (a: {
      idRelatorio: string;
      idEmpresa: string;
      empresaNome?: string | null;
      idSetor: string;
      setorNome: string;
      dias?: number;
      idAplicacaoExistente?: string | null;
    }) => {
      const sb = db();
      const hoje = new Date();
      const expira = new Date(hoje.getTime() + (a.dias ?? VALIDADE_PADRAO_DIAS) * 86400000).toISOString().slice(0, 10);
      let idAplicacao = a.idAplicacaoExistente ?? null;
      if (!idAplicacao) {
        // Uma aplicação QPS por AEP, com todos os setores dentro.
        const { data, error } = await sb
          .from("qps_aplicacoes")
          .insert({
            id_tipo: ID_TIPO_TRIAGEM,
            id_empresa: a.idEmpresa,
            titulo: `Triagem anônima AEP${a.empresaNome ? ` — ${a.empresaNome}` : ""}`,
            status: "EM_ANDAMENTO",
            responsavel: user?.nome ?? null,
            usuario_email: user?.email ?? null,
            usuario_nome: user?.nome ?? null,
            periodo_inicio: hoje.toISOString().slice(0, 10),
            data_elaboracao: hoje.toISOString().slice(0, 10),
          })
          .select("id_aplicacao")
          .single();
        if (error) throw error;
        idAplicacao = (data as { id_aplicacao: string }).id_aplicacao;
      }
      const { error } = await sb.from("qps_coletas_anonimas").insert({
        id_coleta: idColeta(),
        token: gerarToken(),
        id_aplicacao: idAplicacao,
        id_relatorio_aep: a.idRelatorio,
        id_setor_aep: a.idSetor,
        setor: a.setorNome || "Setor",
        expira_em: expira,
        criado_por: user?.nome ?? user?.email ?? null,
      });
      if (error) throw error;
      return a.idRelatorio;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: KEY(id) });
      toast.success("Link anônimo criado");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao criar o link anônimo")),
  });
}

export function useAtualizarColetaAnonima() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { idColeta: string; idRelatorio: string; patch: Partial<Pick<ColetaAnonima, "ativo" | "expira_em">> }) => {
      const { error } = await db().from("qps_coletas_anonimas").update(a.patch).eq("id_coleta", a.idColeta);
      if (error) throw error;
      return a.idRelatorio;
    },
    onSuccess: (id) => qc.invalidateQueries({ queryKey: KEY(id) }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao atualizar o link")),
  });
}

/** Agregado com k-anonimato (≥ 5), pela função do banco. */
export function useResultadoColeta(idColeta: string | null | undefined) {
  return useQuery({
    queryKey: ["coleta-anonima-resultado", idColeta],
    enabled: !!idColeta,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db().rpc("qps_resultado_coleta", { p_id_coleta: idColeta });
      if (error) throw error;
      return data as ResultadoColeta;
    },
  });
}

/** Comentários livres (só equipe, só com ≥ 5 respostas). Sob demanda. */
export async function buscarComentariosColeta(idColeta: string): Promise<string[]> {
  const { data, error } = await db().rpc("qps_comentarios_coleta", { p_id_coleta: idColeta });
  if (error) throw error;
  return (data ?? []) as string[];
}

/** Pergunta → fator, pelo tipo QPS da triagem (texto editável no QPS). */
export function usePerguntasTriagem() {
  return useQuery({
    queryKey: ["triagem-anonima-perguntas"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await db()
        .from("qps_perguntas")
        .select("id_pergunta, id_categoria, qps_categorias!inner(id_tipo)")
        .eq("qps_categorias.id_tipo", ID_TIPO_TRIAGEM);
      if (error) throw error;
      const mapa: Record<string, string> = {};
      for (const p of (data ?? []) as { id_pergunta: string; id_categoria: string }[]) {
        const f = FATOR_POR_CATEGORIA[p.id_categoria];
        if (f) mapa[p.id_pergunta] = f;
      }
      return mapa;
    },
  });
}
