"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Empresa, ModuloEmpresa } from "@/lib/supabase/types";
import { useUserStore } from "@/lib/store";

async function fetchEmpresas(
  empresasVinculadas: string[] | null,
  modulo: ModuloEmpresa | null
) {
  const supabase = createSupabaseBrowserClient();
  let q = supabase.from("empresas").select("*").order("nome_empresa");
  if (empresasVinculadas && empresasVinculadas.length > 0) {
    q = q.in("id_empresa", empresasVinculadas);
  }
  if (modulo) {
    // contains array — só empresas com `modulo` em modulos_habilitados
    q = q.contains("modulos_habilitados", [modulo]);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Empresa[];
}

/**
 * Lista empresas. Se `modulo` for passado, filtra só as habilitadas naquele
 * módulo (Painel SST, Psicossocial, Conformidade, Análise de Químicos).
 * Quando omitido, retorna todas — usado em telas administrativas/cadastro.
 */
export function useEmpresas(modulo?: ModuloEmpresa) {
  const user = useUserStore((s) => s.user);
  // Tecnico com vínculos limita a lista; Admin/Visualizador veem tudo.
  const vinculos =
    user?.perfil === "Tecnico" &&
    user.empresas_vinculadas &&
    user.empresas_vinculadas.length > 0
      ? user.empresas_vinculadas
      : null;

  return useQuery({
    queryKey: ["empresas", vinculos, modulo ?? null],
    queryFn: () => fetchEmpresas(vinculos, modulo ?? null),
  });
}

export function useEmpresa(id: string | null | undefined) {
  return useQuery({
    queryKey: ["empresa", id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("id_empresa", id!)
        .single();
      if (error) throw error;
      return data as unknown as Empresa;
    },
  });
}

export function useAtualizarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id_empresa: string } & Partial<Empresa>) => {
      const { id_empresa, ...patch } = payload;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("empresas")
        .update(patch as never)
        .eq("id_empresa", id_empresa);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["empresa", variables.id_empresa] });
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
  });
}
