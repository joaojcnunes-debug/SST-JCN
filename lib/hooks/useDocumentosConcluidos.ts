"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type { DocumentoConcluido } from "@/lib/dashboard/documentos";

/** Documento concluído com a empresa (para a página da pessoa). */
export type DocumentoConcluidoComEmpresa = DocumentoConcluido & {
  id_inspecao: string;
  id_empresa?: string | null;
  empresas?: { nome_empresa: string | null } | { nome_empresa: string | null }[] | null;
};

/**
 * Documentos concluídos pelo ADM — UMA consulta para o card "Documentos por
 * Mês (ADM)" do dashboard, para a tela /dashboard/documentos-emitidos e para a
 * página da pessoa.
 *
 * A chave é a que a conclusão e a desassociação já invalidam
 * (useInspecao, useInspecaoAssociados): com ela, o card se atualiza junto com
 * o detalhe. A conta mora em lib/dashboard/documentos.
 *
 * v295 (26/10/2026): entra também o documento REABERTO depois da 1ª conclusão
 * (`primeira_elaboracao_em` preenchida) — a contagem fica no mês e na pessoa da
 * 1ª conclusão.
 */
export function useDocumentosConcluidos() {
  return useQuery<DocumentoConcluidoComEmpresa[]>({
    queryKey: ["dashboard-documentos-adm"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      return fetchAllRows<DocumentoConcluidoComEmpresa>(
        (de, ate) =>
          supabase
            .from("inspecoes")
            .select(
              "id_inspecao, status, elaboracao_concluida_em, elaboracao_responsavel, primeira_elaboracao_em, primeira_elaboracao_por, id_empresa, empresas(nome_empresa)",
            )
            .or("elaboracao_status.eq.CONCLUIDO,primeira_elaboracao_em.not.is.null")
            .order("id_inspecao")
            .range(de, ate),
      );
    },
  });
}
