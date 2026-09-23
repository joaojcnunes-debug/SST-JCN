"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  mergeTimeline,
  type ComentarioRow,
  type HistoricoRow,
  type TimelineItem,
} from "@/lib/gestao/timeline";

export type { TimelineItem } from "@/lib/gestao/timeline";
export { descreverMovimentacao } from "@/lib/gestao/timeline";

/**
 * Linha do tempo unificada de uma tarefa: comentários (gestao_comentarios) + movimentações
 * (gestao_tarefa_historico), ambas RLS-gated via PostgREST, mescladas por created_at.
 * A mescla é a função PURA mergeTimeline (lib/gestao/timeline) — testada offline.
 */
export function useTarefaHistorico(idTarefa: string | null | undefined) {
  return useQuery({
    queryKey: ["gestao-tarefa-timeline", idTarefa],
    enabled: !!idTarefa,
    queryFn: async (): Promise<TimelineItem[]> => {
      const sb = createSupabaseBrowserClient();
      const [coment, hist] = await Promise.all([
        sb
          .from("gestao_comentarios")
          .select("id_comentario,id_tarefa,autor,texto,created_at")
          .eq("id_tarefa", idTarefa!)
          .order("created_at", { ascending: true }),
        sb
          .from("gestao_tarefa_historico")
          .select("id,id_tarefa,ator,tipo,campo,de,para,created_at")
          .eq("id_tarefa", idTarefa!)
          .order("created_at", { ascending: true }),
      ]);
      if (coment.error) throw coment.error;
      if (hist.error) throw hist.error;
      return mergeTimeline(
        (coment.data ?? []) as unknown as ComentarioRow[],
        (hist.data ?? []) as unknown as HistoricoRow[],
        "asc",
      );
    },
  });
}
