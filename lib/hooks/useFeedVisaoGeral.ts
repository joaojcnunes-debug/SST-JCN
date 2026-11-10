"use client";

// Feed "Acontecendo agora" da Visão geral (Etapa 5 do plano-skin-viva; janela e vínculo na 0.3.261, do Painel): os 15 últimos eventos da trilha de auditoria
// LIGADOS A UM DOCUMENTO (doc_id), o trabalho de SST sem o barulho da Gestão e das telas de
// sistema. A RLS da v316 mostra a cada pessoa só os documentos que ela abre.
// Atualiza a cada 30 s com a aba visível (o React Query pausa com a aba em segundo plano).
//
// POR QUE A JANELA DE DIAS E O FILTRO DE VÍNCULO. Para quem não é da Presença, a RLS consulta o
// documento linha a linha (`auditoria_doc_visivel`). Sem limite, quem enxerga pouca coisa faria o
// banco varrer a trilha inteira até achar 15 eventos. Os dois filtros cortam essa varredura.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import type { AuditoriaEvento } from "@/lib/supabase/types";

export const FEED_LIMITE = 15;
export const FEED_INTERVALO_MS = 30_000;
export const FEED_JANELA_DIAS = 14;

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
  const user = useUserStore((s) => s.user);
  const vinculos =
    user?.perfil === "Tecnico" && user.empresas_vinculadas?.length ? user.empresas_vinculadas : null;

  return useQuery({
    queryKey: ["visao-geral-feed", vinculos],
    refetchInterval: FEED_INTERVALO_MS,
    staleTime: 15_000,
    // A tela já mostra o próprio aviso de erro. Sem isto, o toast global das queries
    // repetiria a cada 30 s enquanto a consulta falhasse.
    meta: { silent: true },
    queryFn: async (): Promise<EventoFeed[]> => {
      const sb = createSupabaseBrowserClient();
      const desde = new Date(Date.now() - FEED_JANELA_DIAS * 86_400_000).toISOString();
      let q = sb
        .from("auditoria_eventos" as never)
        .select(
          "id, ocorrido_em, tabela, registro_id, acao, titulo, id_empresa, usuario_email, usuario_role, usuario_origem, campos_alterados, doc_tabela, doc_id",
        )
        .not("doc_id", "is", null)
        .gte("ocorrido_em", desde);
      if (vinculos) q = q.in("id_empresa", vinculos);
      const { data, error } = await q
        .order("ocorrido_em", { ascending: false })
        .order("id", { ascending: false })
        .limit(FEED_LIMITE);
      if (error) throw error;
      return (data ?? []) as unknown as EventoFeed[];
    },
  });
}
