"use client";

// Dados do módulo Comercial (2026-10-05). Vêm da RPC `comercial_dados` (v267),
// que devolve as AEPs entregues ao cliente, a última inspeção concluída (v268)
// e a situação dos documentos de cada empresa — o comercial não precisa ter os módulos AEP/AET/DRPS liberados.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizarRelatorio } from "@/lib/hooks/useAep";
import {
  montarComercial,
  type CertificadoEmpresa,
  type DocEmpresa,
  type InspecaoComercial,
} from "@/lib/comercial/oportunidades";

export function useComercial() {
  return useQuery({
    queryKey: ["comercial-dados"],
    queryFn: async () => {
      const { data, error } = await createSupabaseBrowserClient().rpc("comercial_dados" as never);
      if (error) throw error;
      const r = (data ?? {}) as {
        aeps?: unknown[];
        docs?: DocEmpresa[];
        inspecoes?: InspecaoComercial[];
        certificados?: CertificadoEmpresa[];
      };
      const aeps = (r.aeps ?? []).map((a) => {
        const x = a as { entregue_em?: string | null; enviado_por?: string | null };
        // normalizarRelatorio mantém os demais campos (inclusive liberado_comercial_*).
        return { ...normalizarRelatorio(a), entregue_em: x.entregue_em ?? null, enviado_por: x.enviado_por ?? null };
      });
      return montarComercial(aeps, r.docs ?? [], r.inspecoes ?? [], r.certificados ?? []);
    },
  });
}
