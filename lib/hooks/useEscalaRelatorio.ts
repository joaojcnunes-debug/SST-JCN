"use client";

/**
 * Leitura do período para os relatórios (Fase 7).
 *
 * POR QUE NÃO REUSAR `useEscalaDias`: aquele hook é do mês, e a tela de
 * relatórios precisa do ANO inteiro quando ninguém escolhe mês. Chamar o hook
 * mensal doze vezes seriam doze idas ao servidor para montar uma tabela; e
 * chamar os dois em paralelo, deixando um ocioso, gastaria uma consulta à toa a
 * cada troca de período. Uma consulta só, com o intervalo certo.
 *
 * O ano inteiro é uma varredura grande — com a equipe cheia, algo perto de
 * 1.300 linhas. `staleTime` de 5 min evita refazê-la a cada ida e volta entre
 * as abas do módulo; escala fechada não muda de minuto em minuto.
 */

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { intervaloDoMes } from "@/lib/escala/datas";
import type { EscalaDia } from "@/lib/escala/tipos";

export const CHAVE_PERIODO = ["escala", "dias-periodo"] as const;

/** `mes` nulo = o ano inteiro. */
export function useEscalaDiasDoPeriodo(ano: number, mes: number | null) {
  const { inicio, fim } =
    mes === null ? { inicio: `${ano}-01-01`, fim: `${ano}-12-31` } : intervaloDoMes(ano, mes);

  return useQuery({
    queryKey: [...CHAVE_PERIODO, inicio, fim],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("escala_dias")
        .select("*")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EscalaDia[];
    },
  });
}
