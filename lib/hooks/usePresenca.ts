"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PresencaBloco, PresencaResumoRow } from "@/lib/presenca/regras";
import type { UsoDiaRow } from "@/lib/presenca/relatorio";
import type { AuditoriaEvento } from "@/lib/supabase/types";

/**
 * Leitura da presença (v218/v219) — só Admin recebe linhas; os demais, lista vazia.
 * O card e a tela reconsultam a cada minuto porque o dado muda a cada minuto.
 */

type Resposta<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

type RpcClient = {
  rpc: {
    (fn: "presenca_resumo", args: { p_dia: string | null }): Resposta<PresencaResumoRow[]>;
    (fn: "presenca_uso_mensal", args: { p_mes: string; p_email: string | null }): Resposta<UsoDiaRow[]>;
    (fn: "presenca_trilha", args: { p_email: string; p_de: string; p_ate: string; p_ultimos: number }): Resposta<TrilhaDiaRow[]>;
    (fn: "presenca_encerrar_sessao", args: { p_email: string }): Resposta<number>;
    (fn: "presenca_limpar", args: { p_dias: number }): Resposta<number>;
  };
};

function rpc(): RpcClient {
  return createSupabaseBrowserClient() as unknown as RpcClient;
}

/** Resumo do dia por pessoa. `dia` em YYYY-MM-DD (RJ); undefined = hoje. */
export function usePresencaResumo(dia?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["presenca-resumo", dia ?? "hoje"] as const,
    queryFn: async () => {
      const { data, error } = await rpc().rpc("presenca_resumo", { p_dia: dia ?? null });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: opts?.enabled ?? true,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Blocos de 5 min de uma pessoa entre duas datas (ISO). Para a tela de detalhe. */
export function usePresencaBlocos(email: string | null, deIso: string, ateIso: string) {
  return useQuery({
    queryKey: ["presenca-blocos", email, deIso, ateIso] as const,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("presenca_pings" as never)
        .select("bloco, primeiro_em, ultimo_em, pings, origem")
        .eq("usuario_email", email as never)
        .gte("bloco", deIso)
        .lt("bloco", ateIso)
        .order("bloco", { ascending: true })
        .limit(3000);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as PresencaBloco[];
    },
    enabled: !!email,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Minutos ativos por dia do mês (`mes` = YYYY-MM); `email` null = toda a equipe. */
export function usePresencaUsoMensal(mes: string, email: string | null) {
  return useQuery({
    queryKey: ["presenca-uso-mensal", mes, email ?? "equipe"] as const,
    queryFn: async () => {
      const { data, error } = await rpc().rpc("presenca_uso_mensal", { p_mes: `${mes}-01`, p_email: email });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
}

export interface TrilhaDiaRow {
  dia: string;
  total: number;
  /** Os N últimos eventos do dia, já reduzidos ao que descreverEvento/rotaDoRegistro leem. */
  ultimos: AuditoriaEvento[];
}

/** Por dia (YYYY-MM-DD, RJ): quantos eventos na auditoria e os 2 últimos. */
export function usePresencaTrilha(email: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: ["presenca-trilha", email, de, ate] as const,
    queryFn: async () => {
      const { data, error } = await rpc().rpc("presenca_trilha", { p_email: email ?? "", p_de: de, p_ate: ate, p_ultimos: 2 });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!email,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Admin derruba a sessão de alguém. Devolve quantas sessões do GoTrue apagou. */
export function usePresencaEncerrarSessao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await rpc().rpc("presenca_encerrar_sessao", { p_email: email });
      if (error) throw new Error(error.message);
      return data ?? 0;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["presenca-resumo"] });
    },
  });
}

const CHAVE_LIMPEZA = "painel-presenca-ultima-limpeza";
/** Guarda 6 meses (decisão dele em 16/09/2026). */
export const RETENCAO_DIAS = 180;

/**
 * Limpeza oportunista: sem pg_cron na produção, quem apaga o que passou de
 * 6 meses é o navegador do Admin que abre a tela — no máximo uma vez por dia
 * por navegador. Erro é silêncio: limpar não pode atrapalhar a leitura.
 */
export function useLimpezaPresenca(ligado: boolean) {
  useEffect(() => {
    if (!ligado) return;
    const hoje = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(CHAVE_LIMPEZA) === hoje) return;
    } catch {
      /* sem localStorage: tenta assim mesmo */
    }
    void (async () => {
      try {
        const { error } = await rpc().rpc("presenca_limpar", { p_dias: RETENCAO_DIAS });
        if (!error) localStorage.setItem(CHAVE_LIMPEZA, hoje);
      } catch {
        /* silêncio */
      }
    })();
  }, [ligado]);
}
