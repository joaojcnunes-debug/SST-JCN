"use client";

// Contador de riscos altos ao lado do radar da Visão geral (Etapa 5 do plano-skin-viva; vínculo na 0.3.261, do Painel): riscos "Alto" e
// "Muito Alto" de inspeções não excluídas. Os riscos não têm data, por isso ficam fora do radar
// de vencimentos (decisão do João, 03/11/2026). A RLS recorta as empresas; o técnico com vínculo conta só as dele, como nas
// outras listas.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";

export const NIVEIS_ALTOS = ["Alto", "Muito Alto"];

export function useRiscosAltos() {
  const user = useUserStore((s) => s.user);
  const vinculos =
    user?.perfil === "Tecnico" && user.empresas_vinculadas?.length ? user.empresas_vinculadas : null;

  return useQuery({
    queryKey: ["visao-geral-riscos-altos", vinculos],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<number> => {
      const sb = createSupabaseBrowserClient();
      let q = sb
        .from("riscos")
        .select("id_risco, inspecoes!inner(status, id_empresa)", { count: "exact", head: true })
        .in("nivel_risco", NIVEIS_ALTOS)
        .neq("inspecoes.status", "DELETADA");
      if (vinculos) q = q.in("inspecoes.id_empresa", vinculos);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}
