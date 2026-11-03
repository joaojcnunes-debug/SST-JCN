"use client";

// Ações 5W2H para o Pulso de segurança da Visão geral (Etapa 4 do plano-skin-viva): só status e
// prazo, de todas as empresas que a pessoa enxerga (a RLS recorta; o técnico com vínculo vê as
// dele, como nas outras listas). A conta mora em lib/visao-geral/pulso.ts.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { useUserStore } from "@/lib/store";
import type { AcaoPulso } from "@/lib/visao-geral/pulso";

export function useAcoesPulso() {
  const user = useUserStore((s) => s.user);
  const vinculos =
    user?.perfil === "Tecnico" && user.empresas_vinculadas?.length ? user.empresas_vinculadas : null;

  return useQuery({
    queryKey: ["acoes-5w2h", "pulso", vinculos],
    staleTime: 60_000,
    queryFn: async (): Promise<AcaoPulso[]> => {
      const sb = createSupabaseBrowserClient();
      return fetchAllRows<AcaoPulso>((de, ate) => {
        let q = sb.from("acoes_5w2h").select("status, when_prazo").order("id_acao").range(de, ate);
        if (vinculos) q = q.in("id_empresa", vinculos);
        return q as never;
      });
    },
  });
}
