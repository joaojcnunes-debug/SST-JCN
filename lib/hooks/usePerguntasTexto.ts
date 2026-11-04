"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Chave → texto de TODAS as perguntas customizadas (do tipo e do modelo de risco).
 * O risco grava as respostas pela chave (`respostas_custom`); quem imprime precisa do texto
 * (0.3.229: o PGR imprimia a chave). Serve também para não repetir chave entre tipo e
 * modelo: as duas respostas iriam para a mesma chave e uma apagaria a outra.
 */
export function usePerguntasTexto() {
  return useQuery({
    queryKey: ["perguntas-texto-todas"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const [t, m] = await Promise.all([
        supabase.from("perguntas_tipo_risco").select("chave, texto"),
        supabase.from("perguntas_modelo_risco").select("chave, texto"),
      ]);
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      const mapa = new Map<string, string>();
      for (const p of [...(t.data ?? []), ...(m.data ?? [])] as { chave: string; texto: string }[]) {
        if (!mapa.has(p.chave)) mapa.set(p.chave, p.texto);
      }
      return mapa;
    },
  });
}
