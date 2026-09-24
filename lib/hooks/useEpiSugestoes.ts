"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface EpiSugestao {
  tipo: string;
  descricao: string;
  usos: number;
}

/**
 * Sugestões do campo de EPI/EPC da inspeção (view `v_epi_sugestoes`, v161).
 *
 * A lista sai do que JÁ foi cadastrado em `epi_epc`, não de um catálogo digitado
 * à mão — por isso ela se mantém sozinha conforme o pessoal cadastra. A view já
 * corta os nomes usados menos de 3 vezes (digitação avulsa) e respeita a RLS,
 * então cada usuário só vê sugestão vinda de empresa que ele pode ver.
 *
 * Isto é sugestão, não trava: o formulário aceita texto livre.
 */
export function useEpiSugestoes(tipo: "EPI" | "EPC") {
  return useQuery({
    queryKey: ["epi-sugestoes", tipo],
    // A lista muda devagar (só quando alguém cadastra um EPI novo) e é lida toda
    // vez que o modal abre — meia hora de cache evita ida ao banco a cada clique.
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("v_epi_sugestoes")
        .select("*")
        .eq("tipo", tipo)
        .order("usos", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as EpiSugestao[]).map((r) => r.descricao);
    },
  });
}
