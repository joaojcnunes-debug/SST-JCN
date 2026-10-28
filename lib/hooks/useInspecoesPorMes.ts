"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { mesAbsAgoraSP, rotuloMesAbs } from "@/lib/dashboard/mes";
import { serieMensal, type InspecaoContavel, type MesInspecoes } from "@/lib/dashboard/inspecoes";

/**
 * Inspeções por mês — os últimos 6 meses, pela régua de lib/dashboard/inspecoes.
 *
 * Um hook só porque eram DUAS contas para o mesmo gráfico: o card do dashboard
 * chamava `serieMensal`, e o mini "Inspeções por mês" da tela Início contava
 * por conta própria pela data da VISITA (via useLaudosValidade). Em 15/09 o
 * card passou a contar concluídas pela data de conclusão e o Início ficou
 * para trás — agosto: 153 num, 140 no outro. Agora os dois leem daqui.
 *
 * A consulta não filtra por `concluida_em` de propósito: linha com valor nulo
 * nunca passa numa comparação, e o fallback para `created_at` mora na régua.
 */
export function useInspecoesPorMes(naUnidade?: (idEmpresa: string | null | undefined) => boolean) {
  return useQuery<(InspecaoContavel & { id_empresa: string | null })[], Error, MesInspecoes[]>({
    queryKey: ["inspecoes-por-mes"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      return fetchAllRows<InspecaoContavel & { id_empresa: string | null }>(
        (de, ate) =>
          supabase
            .from("inspecoes")
            // primeira_conclusao_em (v295): a reaberta continua no mês da 1ª conclusão.
            .select("status, data_inspecao, concluida_em, primeira_conclusao_em, created_at, tipo_criacao, id_empresa")
            .neq("status", "DELETADA")
            .order("id_inspecao")
            .range(de, ate),
      );
    },
    // 28/10: o Dashboard recorta pela unidade (a mesma do detalhe); a tela Início manda todas.
    select: (linhas) =>
      serieMensal(naUnidade ? linhas.filter((l) => naUnidade(l.id_empresa)) : linhas, mesAbsAgoraSP(), 6, (abs) => rotuloMesAbs(abs)),
  });
}
