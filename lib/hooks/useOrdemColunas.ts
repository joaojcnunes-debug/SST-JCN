"use client";

// Mover as colunas do quadro arrastando o título (11/11/2026). Grava gestao_status.ordem das colunas que mudaram de
// lugar — a mesma coluna que as setas de Configurar › Status gravam, com a mesma permissão (RLS de gestao_status).

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import type { GestaoStatus } from "@/lib/hooks/useGestao";
import { ordensMudadas } from "@/lib/gestao/ordem-colunas";

export function useMoverColunas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_quadro: string; colunas: GestaoStatus[]; novaOrdem: string[] }) => {
      const sb = createSupabaseBrowserClient();
      for (const m of ordensMudadas(p.colunas, p.novaOrdem)) {
        const { data, error } = await sb.from("gestao_status").update({ ordem: m.ordem } as never).eq("id", m.id).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("Sem permissão para mudar as colunas desta lista.");
      }
    },
    // As colunas trocam de lugar na hora; se a gravação falhar, voltam como estavam.
    onMutate: async (p) => {
      const chave = ["gestao-status", p.id_quadro];
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<GestaoStatus[]>(chave);
      if (antes) {
        const pos = new Map(p.novaOrdem.map((slug, i) => [slug, i]));
        qc.setQueryData<GestaoStatus[]>(
          chave,
          antes.map((s) => (pos.has(s.slug) ? { ...s, ordem: pos.get(s.slug)! } : s)).sort((a, b) => a.ordem - b.ordem),
        );
      }
      return { antes };
    },
    onError: (e, p, ctx) => {
      if (ctx?.antes) qc.setQueryData(["gestao-status", p.id_quadro], ctx.antes);
      toast.error(mensagemErro(e, "Não foi possível mudar a coluna de lugar."));
    },
    onSettled: (_d, _e, p) => {
      qc.invalidateQueries({ queryKey: ["gestao-status", p.id_quadro] });
      qc.invalidateQueries({ queryKey: ["gestao-status-todos"] });
    },
  });
}
