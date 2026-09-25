"use client";

// Catálogo de fontes geradoras digitadas na Análise (v262). Uma fonte nova
// digitada num relatório vira opção, para aquele tópico/categoria, em TODOS
// os relatórios. Ver `lib/psicossocial/fontes.ts`.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ModuloFonte = "drps" | "qps";

// Tabela nova, ainda fora do tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseBrowserClient() as any; }

/** chave (índice do tópico / id_categoria) → fontes do catálogo. */
export function useCatalogoFontes(modulo: ModuloFonte) {
  return useQuery({
    queryKey: ["fontes-geradoras", modulo],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data, error } = await db()
        .from("psi_fontes_geradoras")
        .select("chave, texto")
        .eq("modulo", modulo)
        .order("criado_em");
      if (error) throw error;
      const out: Record<string, string[]> = {};
      for (const r of (data ?? []) as { chave: string; texto: string }[]) {
        (out[r.chave] ??= []).push(r.texto);
      }
      return out;
    },
  });
}

/** Guarda fontes novas no catálogo. Repetida (índice único) é ignorada. */
export function useAdicionarFontesCatalogo(modulo: ModuloFonte) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { chave: string | number; textos: string[] }) => {
      for (const texto of args.textos) {
        const { error } = await db()
          .from("psi_fontes_geradoras")
          .insert({ modulo, chave: String(args.chave), texto: texto.trim() });
        // 23505 = já está no catálogo (outra pessoa digitou antes): tudo certo.
        if (error && String(error.code) !== "23505") throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["fontes-geradoras", modulo] }),
  });
}
