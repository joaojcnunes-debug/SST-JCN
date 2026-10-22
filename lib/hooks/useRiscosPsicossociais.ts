"use client";

// Riscos Psicossociais por empresa — a conta mora em
// lib/riscos-psicossociais/carregar.ts (o PDF do servidor usa a mesma).

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { carregarRiscosPsicossociais, type EmpresaRisco } from "@/lib/riscos-psicossociais/carregar";

export * from "@/lib/riscos-psicossociais/carregar";

export function useRiscosPsicossociais() {
  return useQuery({
    queryKey: ["riscos-psicossociais"],
    staleTime: 60_000,
    queryFn: (): Promise<EmpresaRisco[]> => carregarRiscosPsicossociais(createSupabaseBrowserClient()),
  });
}
