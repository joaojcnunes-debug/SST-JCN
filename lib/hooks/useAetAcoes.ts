"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { mensagemErro } from "@/lib/errors";
import { useUserStore } from "@/lib/store";
import { ACAO_PADRAO, acaoCentralDeAetAcao, acoesEnviaveis } from "@/lib/aet/acoes";
import type { SetorPlanoLike } from "@/lib/aet/acoes";
import type {
  Acao5W2H,
  AetAcao,
  StatusAcaoApreciacao,
  PrioridadeAcaoApreciacao,
} from "@/lib/supabase/types";

// Plano de Ação 5W2H do laudo AET (aet_acoes, v207). Espelho de
// useInvestigacaoAcoes: standalone, morre com o relatório. A cópia para o
// acoes_5w2h central é OPCIONAL e explícita — o botão "Enviar para o Plano de
// Ação do PGR" (v208), no fim deste arquivo.

const KEY = (id: string) => ["aet-acoes", id];

export function useAetAcoes(id_relatorio: string | null | undefined) {
  return useQuery({
    queryKey: KEY(id_relatorio ?? ""),
    enabled: !!id_relatorio,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aet_acoes")
        .select("*")
        .eq("id_relatorio", id_relatorio!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AetAcao[];
    },
  });
}

export interface CriarAetAcaoInput {
  id_relatorio: string;
  id_setor?: string | null;
  ordem: number;
  what_acao?: string;
  why_justificativa?: string | null;
  where_local?: string | null;
  when_prazo?: string | null;
  who_responsavel?: string | null;
  how_metodo?: string | null;
  how_much_custo?: string | null;
  prioridade?: PrioridadeAcaoApreciacao;
}

export function useCriarAetAcao() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (input: CriarAetAcaoInput) => {
      const supabase = createSupabaseBrowserClient();
      const row: AetAcao = {
        id_acao: gerarId("AAC"),
        id_relatorio: input.id_relatorio,
        id_setor: input.id_setor ?? null,
        ordem: input.ordem,
        what_acao: input.what_acao?.trim() || ACAO_PADRAO,
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
      const { error } = await supabase.from("aet_acoes").insert(row as never);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: KEY(row.id_relatorio) }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export interface AtualizarAetAcaoInput {
  id_relatorio: string;
  id_acao: string;
  id_setor?: string | null;
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
}

export function useAtualizarAetAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: AtualizarAetAcaoInput) => {
      const supabase = createSupabaseBrowserClient();
      const { id_relatorio, id_acao, ...rest } = params;
      void id_relatorio; // só usado no onSuccess (via params) p/ invalidar o cache
      const patch: Partial<AetAcao> = {
        ...rest,
        updated_at: new Date().toISOString(),
      };
      if (params.status === "Concluida" && !params.data_conclusao) {
        patch.data_conclusao = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase
        .from("aet_acoes")
        .update(patch as never)
        .eq("id_acao", id_acao);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => qc.invalidateQueries({ queryKey: KEY(params.id_relatorio) }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useExcluirAetAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id_relatorio: string; id_acao: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_acoes")
        .delete()
        .eq("id_acao", params.id_acao);
      if (error) throw error;
      return params;
    },
    onSuccess: (params) => qc.invalidateQueries({ queryKey: KEY(params.id_relatorio) }),
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ─── Porta para o Plano de Ação do PGR (acoes_5w2h central) — v208 ──────────

const KEY_CENTRAL = (id: string) => ["aet-acoes-no-central", id];

/**
 * Quais ações deste laudo já foram copiadas para o plano central — para a
 * tela marcar "no PGR" e o botão contar só o que falta. Lê a marca de origem
 * (`id_aet_acao`) do acoes_5w2h; a RLS de lá vale por empresa, a mesma do AET.
 */
export function useAetAcoesNoPlanoCentral(id_relatorio: string | null | undefined, acoes: AetAcao[]) {
  const ids = acoes.map((a) => a.id_acao).sort();
  return useQuery({
    queryKey: [...KEY_CENTRAL(id_relatorio ?? ""), ids.join(",")],
    enabled: !!id_relatorio && ids.length > 0,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("acoes_5w2h")
        .select("id_aet_acao")
        .in("id_aet_acao", ids);
      if (error) throw error;
      return new Set(
        ((data ?? []) as { id_aet_acao: string | null }[])
          .map((r) => r.id_aet_acao)
          .filter(Boolean) as string[],
      );
    },
  });
}

export interface ResultadoEnvioAetCentral {
  enviadas: number;
  ignoradas: number;
}

/**
 * Copia as ações do AET para o `acoes_5w2h` central (o Plano de Ação do PGR),
 * marcando a origem em `id_aet_acao`. Espelho de useEnviarAcoesParaPlanoAcao
 * (Apreciação, v67) e useEnviarRiscosParaPlanoAcao (Inspeção, v184): dedupe
 * pela origem antes de inserir, e o índice único parcial do banco segura a
 * corrida entre duas abas (23505 → recontar e inserir só o que faltou).
 * Canceladas não vão.
 */
export function useEnviarAetAcoesParaPlanoAcao() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (params: {
      id_relatorio: string;
      idEmpresa: string;
      referencia: string;
      setores: SetorPlanoLike[];
      acoes: AetAcao[];
    }): Promise<ResultadoEnvioAetCentral> => {
      const supabase = createSupabaseBrowserClient();
      const candidatas = acoesEnviaveis(params.acoes);
      if (candidatas.length === 0) return { enviadas: 0, ignoradas: 0 };

      const jaEnviadas = async (ids: string[]) => {
        const { data, error } = await supabase
          .from("acoes_5w2h")
          .select("id_aet_acao")
          .in("id_aet_acao", ids);
        if (error) throw error;
        return new Set(
          ((data ?? []) as { id_aet_acao: string | null }[])
            .map((r) => r.id_aet_acao)
            .filter(Boolean) as string[],
        );
      };

      const hoje = new Date().toISOString().slice(0, 10);
      const montar = (as: AetAcao[]): Acao5W2H[] =>
        as.map((a) =>
          acaoCentralDeAetAcao(a, {
            idEmpresa: params.idEmpresa,
            referencia: params.referencia,
            setores: params.setores,
            createdBy: user?.email ?? null,
            hoje,
          }),
        );

      const antes = await jaEnviadas(candidatas.map((a) => a.id_acao));
      const faltam = candidatas.filter((a) => !antes.has(a.id_acao));
      if (faltam.length === 0) return { enviadas: 0, ignoradas: candidatas.length };

      const { error } = await supabase.from("acoes_5w2h").insert(montar(faltam) as never);
      if (!error) return { enviadas: faltam.length, ignoradas: candidatas.length - faltam.length };

      if ((error as { code?: string }).code !== "23505") throw error;
      // Outra aba chegou antes em alguma: reconta e insere só o que restou.
      const agora = await jaEnviadas(faltam.map((a) => a.id_acao));
      const restantes = faltam.filter((a) => !agora.has(a.id_acao));
      if (restantes.length > 0) {
        const { error: e2 } = await supabase.from("acoes_5w2h").insert(montar(restantes) as never);
        if (e2) throw e2;
      }
      return { enviadas: restantes.length, ignoradas: candidatas.length - restantes.length };
    },
    onSuccess: (_r, params) => {
      qc.invalidateQueries({ queryKey: KEY_CENTRAL(params.id_relatorio) });
      qc.invalidateQueries({ queryKey: ["acoes-5w2h"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}
