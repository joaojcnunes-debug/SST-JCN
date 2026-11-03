"use client";

// Feed "Acontecendo agora" da Visão geral (Etapa 5 do plano-skin-viva): os 15 últimos eventos da
// trilha de auditoria LIGADOS A UM DOCUMENTO (doc_id) — o trabalho de SST, sem o barulho da
// Gestão e das telas de sistema. A RLS da v316 mostra a cada pessoa só os documentos que ela abre.
// Atualiza a cada 30 s com a aba visível (o React Query pausa com a aba em segundo plano).

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuditoriaEvento } from "@/lib/supabase/types";

export const FEED_LIMITE = 15;
export const FEED_INTERVALO_MS = 30_000;

export type EventoFeed = Pick<
  AuditoriaEvento,
  | "id"
  | "ocorrido_em"
  | "tabela"
  | "registro_id"
  | "acao"
  | "titulo"
  | "id_empresa"
  | "usuario_email"
  | "usuario_role"
  | "usuario_origem"
  | "campos_alterados"
  | "doc_tabela"
  | "doc_id"
>;

export function useFeedVisaoGeral() {
  return useQuery({
    queryKey: ["visao-geral-feed"],
    refetchInterval: FEED_INTERVALO_MS,
    staleTime: 15_000,
    queryFn: async (): Promise<EventoFeed[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("auditoria_eventos" as never)
        .select(
          "id, ocorrido_em, tabela, registro_id, acao, titulo, id_empresa, usuario_email, usuario_role, usuario_origem, campos_alterados, doc_tabela, doc_id",
        )
        .not("doc_id", "is", null)
        .order("id", { ascending: false })
        .limit(FEED_LIMITE);
      if (error) throw error;
      return (data ?? []) as unknown as EventoFeed[];
    },
  });
}
