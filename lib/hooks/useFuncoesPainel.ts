"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FuncaoPainel } from "@/lib/supabase/types";

/** Um cargo da lista fixa (v233, `cargos_painel`). */
export interface CargoPainel {
  cargo: string;
  ordem: number;
  /** Conselho do registro profissional (documentação): MTE, CREA, CRM, CRP ou null. */
  registro: string | null;
}

/**
 * As funções do painel (v229, `funcoes_painel`), na ordem de exibição. É o
 * padrão que uma conta nova recebe (módulos, nível, perfil, flags, unidades).
 * Lida por Sistema › Funções e pelo formulário de Usuários.
 */
export function useFuncoesPainel() {
  return useQuery({
    queryKey: ["funcoes_painel"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("funcoes_painel" as never)
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FuncaoPainel[];
    },
  });
}

/**
 * A lista fixa de cargos (v233). O banco recusa `usuarios.cargo` fora dela
 * (gatilho `usuarios_cargo_na_lista`), então todo formulário que grava cargo
 * escolhe daqui — texto livre não padroniza nada (pedido dele, 21/09).
 */
export function useCargosPainel() {
  return useQuery({
    queryKey: ["cargos_painel"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("cargos_painel" as never)
        .select("cargo, ordem, registro")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CargoPainel[];
    },
  });
}
