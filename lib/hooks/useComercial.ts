"use client";

// Dados do módulo Comercial (2026-10-05). Vêm da RPC `comercial_dados` (v267),
// que só devolve AEPs entregues ao cliente e a situação dos documentos de cada
// empresa — o comercial não precisa ter os módulos AEP/AET/DRPS liberados.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizarRelatorio } from "@/lib/hooks/useAep";
import { montarComercial, type DocEmpresa } from "@/lib/comercial/oportunidades";

export function useComercial() {
  return useQuery({
    queryKey: ["comercial-dados"],
    queryFn: async () => {
      const { data, error } = await createSupabaseBrowserClient().rpc("comercial_dados" as never);
      if (error) throw error;
      const r = (data ?? {}) as { aeps?: unknown[]; docs?: DocEmpresa[] };
      const aeps = (r.aeps ?? []).map((a) => {
        const x = a as { entregue_em?: string | null; enviado_por?: string | null };
        return { ...normalizarRelatorio(a), entregue_em: x.entregue_em ?? null, enviado_por: x.enviado_por ?? null };
      });
      return montarComercial(aeps, r.docs ?? []);
    },
  });
}
