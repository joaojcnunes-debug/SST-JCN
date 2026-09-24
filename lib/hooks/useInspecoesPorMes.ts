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
export function useInspecoesPorMes() {
  return useQuery<MesInspecoes[]>({
    queryKey: ["inspecoes-por-mes"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const linhas = await fetchAllRows<InspecaoContavel>(
        (de, ate) =>
          supabase
            .from("inspecoes")
            .select("status, data_inspecao, concluida_em, created_at, tipo_criacao")
            .neq("status", "DELETADA")
            .range(de, ate),
      );
      return serieMensal(linhas, mesAbsAgoraSP(), 6, (abs) => rotuloMesAbs(abs));
    },
  });
}
