"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { MODULOS_EMPRESA, type ModuloEmpresa } from "@/lib/supabase/types";
import type { LinhaClassificada } from "@/lib/empresas/importar-empresas";

// Toda empresa é habilitada em todos os quadros (filtro por módulo removido).
const TODOS_MODULOS: ModuloEmpresa[] = MODULOS_EMPRESA.map((m) => m.value);

const LOTE = 100;

/** Insere as linhas válidas em `empresas`, em lotes, com ids EMP gerados. */
export function useImportarEmpresas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linhas: LinhaClassificada[]) => {
      const supabase = createSupabaseBrowserClient();
      const now = new Date().toISOString();

      const rows = linhas.map((l) => ({
        id_empresa: gerarId("EMP"),
        nome_empresa: l.nome_empresa.trim(),
        razao_social: l.razao_social,
        cnpj: l.cnpj,
        grau_risco: l.grau_risco,
        id_unidade: l.id_unidade,
        municipio: l.municipio,
        uf: l.uf,
        cep: l.cep,
        telefone: l.telefone,
        email: l.email,
        logradouro: l.logradouro,
        numero: l.numero,
        bairro: l.bairro,
        status: "Ativo",
        modulos_habilitados: TODOS_MODULOS,
        created_at: now,
        updated_at: now,
      }));

      for (let i = 0; i < rows.length; i += LOTE) {
        const lote = rows.slice(i, i + LOTE);
        const { error } = await supabase.from("empresas").insert(lote as never);
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["visao-geral-unidades"] });
    },
  });
}
