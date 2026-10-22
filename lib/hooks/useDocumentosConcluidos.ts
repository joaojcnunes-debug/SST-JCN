"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type { DocumentoConcluido } from "@/lib/dashboard/documentos";

/**
 * Documentos concluídos pelo ADM — UMA consulta para o card "Documentos por
 * Mês (ADM)" do dashboard e para a tela /dashboard/documentos-emitidos.
 *
 * A chave é a que a conclusão e a desassociação já invalidam
 * (useInspecao, useInspecaoAssociados): com ela, o card se atualiza junto com
 * o detalhe. A conta mora em lib/dashboard/documentos.
 */
export function useDocumentosConcluidos() {
  return useQuery<DocumentoConcluido[]>({
    queryKey: ["dashboard-documentos-adm"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      return fetchAllRows<DocumentoConcluido>(
        (de, ate) =>
          supabase
            .from("inspecoes")
            .select("status, elaboracao_concluida_em, elaboracao_responsavel")
            .eq("elaboracao_status", "CONCLUIDO")
            .order("id_inspecao")
            .range(de, ate),
      );
    },
  });
}
