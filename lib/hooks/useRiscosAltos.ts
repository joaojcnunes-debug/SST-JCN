"use client";

// Contador de riscos altos ao lado do radar da Visão geral (Etapa 5 do plano-skin-viva):
// riscos "Alto" e "Muito Alto" de inspeções não excluídas. Os riscos não têm data, por isso ficam
// fora do radar de vencimentos (decisão do João, 03/11/2026). A RLS recorta as empresas.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const NIVEIS_ALTOS = ["Alto", "Muito Alto"];

export function useRiscosAltos() {
  return useQuery({
    queryKey: ["visao-geral-riscos-altos"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<number> => {
      const sb = createSupabaseBrowserClient();
      const { count, error } = await sb
        .from("riscos")
        .select("id_risco, inspecoes!inner(status)", { count: "exact", head: true })
        .in("nivel_risco", NIVEIS_ALTOS)
        .neq("inspecoes.status", "DELETADA");
      if (error) throw error;
      return count ?? 0;
    },
  });
}
