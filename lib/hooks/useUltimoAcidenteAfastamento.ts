"use client";

// Data do último acidente COM afastamento que a pessoa enxerga — base do contador "dias sem
// acidente com afastamento" da Visão geral (Etapa 3 do plano-skin-viva). A RLS recorta as
// empresas; o técnico com vínculo vê só as dele (mesma regra da lista de investigações).

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";

export function useUltimoAcidenteAfastamento() {
  const user = useUserStore((s) => s.user);
  const vinculos =
    user?.perfil === "Tecnico" && user.empresas_vinculadas?.length ? user.empresas_vinculadas : null;

  return useQuery({
    queryKey: ["ultimo-acidente-afastamento", vinculos],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const sb = createSupabaseBrowserClient();
      let q = sb
        .from("investigacoes_acidente")
        .select("data_acidente")
        .eq("houve_afastamento", true)
        .neq("status", "DELETADA")
        .not("data_acidente", "is", null)
        .order("data_acidente", { ascending: false })
        .limit(1);
      if (vinculos) q = q.in("id_empresa", vinculos);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as { data_acidente: string | null }[])[0]?.data_acidente ?? null;
    },
  });
}
