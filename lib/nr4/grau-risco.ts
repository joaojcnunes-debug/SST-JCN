"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Grau de risco da NR-4 a partir do CNAE.
 *
 * O grau não é julgamento: o Anexo I da NR-4 dá, para cada classe CNAE, um
 * grau de 1 a 4. Como a busca por CNPJ já traz o CNAE da Receita, o grau sai
 * de graça — a tabela `cnae_grau_risco` (v141) responde.
 */

/**
 * Converte um CNAE em classe de 5 dígitos, que é a granularidade da norma.
 *
 * A Receita devolve a SUBCLASSE de 7 dígitos (`4511102`); a NR-4 trabalha na
 * CLASSE de 5 (`45.11-1`). Como a subclasse é a classe mais 2 dígitos,
 * truncar resolve. Aceita com ou sem máscara porque o campo é livre e há
 * cadastro antigo gravado nos dois formatos.
 *
 * Devolve null quando não sobra número suficiente para ser um CNAE.
 */
export function classeDoCnae(cnae: string | null | undefined): string | null {
  const d = (cnae ?? "").replace(/\D/g, "");
  return d.length >= 5 ? d.slice(0, 5) : null;
}

export interface GrauNorma {
  grau_risco: number;
  denominacao: string;
}

/**
 * Consulta o que a norma diz para este CNAE. `null` quando o CNAE não existe
 * no Anexo I — caso real: CNAE de versão mais nova que a 2.0, ou lixo digitado
 * no campo (há cadastro com CNPJ no lugar do CNAE).
 *
 * A tabela nunca muda fora de uma migration, então o cache não expira.
 */
export function useGrauRiscoNorma(cnae: string | null | undefined) {
  const classe = classeDoCnae(cnae);
  return useQuery({
    queryKey: ["cnae-grau-risco", classe],
    enabled: !!classe,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<GrauNorma | null> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("cnae_grau_risco")
        .select("grau_risco, denominacao")
        .eq("cnae_classe", classe!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as GrauNorma | null) ?? null;
    },
  });
}
