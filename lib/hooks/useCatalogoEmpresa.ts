"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Setores e cargos já cadastrados de uma empresa (das inspeções) — sugestões. */
export function useCatalogoEmpresa(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["catalogo-empresa", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const ordenar = (arr: (string | null)[]) =>
        [...new Set(arr.map((s) => (s ?? "").trim()).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b, "pt-BR"),
        );

      const [setRes, cargoRes] = await Promise.all([
        sb.from("setores").select("setor_ghe").eq("id_empresa", idEmpresa!),
        sb.from("cargos").select("cargo").eq("id_empresa", idEmpresa!),
      ]);

      return {
        setores: ordenar(((setRes.data ?? []) as { setor_ghe: string | null }[]).map((s) => s.setor_ghe)),
        cargos: ordenar(((cargoRes.data ?? []) as { cargo: string | null }[]).map((c) => c.cargo)),
      };
    },
  });
}
