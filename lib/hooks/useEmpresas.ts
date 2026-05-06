"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Empresa } from "@/lib/supabase/types";
import { useUserStore } from "@/lib/store";

async function fetchEmpresas(empresasVinculadas: string[] | null) {
  const supabase = createSupabaseBrowserClient();
  let q = supabase.from("empresas").select("*").order("nome_empresa");
  if (empresasVinculadas && empresasVinculadas.length > 0) {
    q = q.in("id_empresa", empresasVinculadas);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Empresa[];
}

export function useEmpresas() {
  const user = useUserStore((s) => s.user);
  // Tecnico com vínculos limita a lista; Admin/Visualizador veem tudo.
  const vinculos =
    user?.perfil === "Tecnico" &&
    user.empresas_vinculadas &&
    user.empresas_vinculadas.length > 0
      ? user.empresas_vinculadas
      : null;

  return useQuery({
    queryKey: ["empresas", vinculos],
    queryFn: () => fetchEmpresas(vinculos),
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
