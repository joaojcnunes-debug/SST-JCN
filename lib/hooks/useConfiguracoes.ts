"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import {
  MEIOS_PROPAGACAO_DEFAULT,
  SITUACOES_DEFAULT,
  TEMPOS_EXPOSICAO_DEFAULT,
  TECNICAS_DEFAULT,
} from "@/lib/constants";

export interface Configs {
  probabilidades: string[];
  severidades: string[];
  meios_propagacao: string[];
  situacoes: string[];
  tempos_exposicao: string[];
  tecnicas: string[];
  logo_url: string;
}

const DEFAULTS: Configs = {
  probabilidades: ["Improvável", "Remoto", "Ocasional", "Provável", "Frequente"],
  severidades: ["Insignificante", "Marginal", "Crítico", "Catastrófico"],
  meios_propagacao: MEIOS_PROPAGACAO_DEFAULT,
  situacoes: SITUACOES_DEFAULT,
  tempos_exposicao: TEMPOS_EXPOSICAO_DEFAULT,
  tecnicas: TECNICAS_DEFAULT,
  logo_url: "",
};

export function useConfiguracoes() {
  return useQuery({
    queryKey: ["configuracoes"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Configs> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("configuracoes")
        .select("chave, valor");
      if (error) throw error;

      const out: Configs = { ...DEFAULTS };
      const rows = (data ?? []) as unknown as Array<{
        chave: string;
        valor: unknown;
      }>;
      for (const row of rows) {
        const key = row.chave as keyof Configs;
        if (key in DEFAULTS) {
          // logo_url é string; o resto é array.
          if (key === "logo_url") {
            out.logo_url =
              typeof row.valor === "string" ? row.valor : DEFAULTS.logo_url;
          } else if (Array.isArray(row.valor)) {
            (out[key] as string[]) = row.valor as string[];
          }
        }
      }
      return out;
    },
  });
}

export function useSaveConfig() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async ({
      chave,
      valor,
    }: {
      chave: keyof Configs;
      valor: unknown;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const row = {
        chave,
        valor,
        updated_at: new Date().toISOString(),
        updated_by: user?.email ?? null,
      };
      const { error } = await supabase
        .from("configuracoes")
        .upsert(row as never, { onConflict: "chave" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["configuracoes"] });
      toast.success("Configuração salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
