"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FatiaStatus } from "@/components/visao-geral/GraficosVisaoGeral";

/** Distribuição das inspeções por status (exclui deletadas), para o donut. */
export function useInspecoesStatus() {
  return useQuery<FatiaStatus[]>({
    queryKey: ["inspecoes-status"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("inspecoes")
        .select("status")
        .neq("status", "DELETADA");
      if (error) throw error;
      const c: Record<string, number> = {};
      for (const r of (data ?? []) as { status: string | null }[]) {
        const s = r.status ?? "RASCUNHO";
        c[s] = (c[s] ?? 0) + 1;
      }
      return [
        { label: "Concluídas", valor: c.CONCLUIDA ?? 0, cor: "#16a34a" },
        { label: "Em andamento", valor: c.EM_ANDAMENTO ?? 0, cor: "#f59e0b" },
        { label: "Rascunho", valor: c.RASCUNHO ?? 0, cor: "#94a3b8" },
      ].filter((f) => f.valor > 0);
    },
  });
}
