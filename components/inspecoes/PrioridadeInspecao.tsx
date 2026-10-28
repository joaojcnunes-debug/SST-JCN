"use client";

import { Flag, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { gravar } from "@/lib/offline/gravar";
import { cn } from "@/lib/utils";
import { ehPrioridade, PRIORIDADES, PRIORIDADE_INFO, type PrioridadeInspecao } from "@/lib/inspecoes/prioridade";
import type { InspecaoFull } from "@/lib/hooks/useInspecao";

/**
 * Prioridade da inspeção (v308). Pedido de 22/10, afinado no mesmo dia: a
 * prioridade se EDITA na coluna da lista de Inspeções (PrioridadeCelula); no
 * cabeçalho da inspeção ela só aparece (PrioridadeSelo).
 */

/** Grava por `gravar` como o Concluir, então também funciona sem sinal. */
function useSalvarPrioridade(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prioridade: PrioridadeInspecao | null) => {
      const payload = { prioridade, updated_at: new Date().toISOString() };
      const resultado = await gravar({
        tabela: "inspecoes",
        tipo: "update",
        linhas: payload,
        filtro: { id_inspecao: id },
        modulo: "inspecoes",
        id_documento: id,
      });
      return { resultado, payload };
    },
    onSuccess: ({ resultado, payload }) => {
      const rotulo = payload.prioridade ? PRIORIDADE_INFO[payload.prioridade].label : "sem prioridade";
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", id] });
        qc.invalidateQueries({ queryKey: ["inspecoes-lista"] });
        qc.invalidateQueries({ queryKey: ["inspecoes-counts"] });
        toast.success(`Prioridade: ${rotulo}`);
        return;
      }
      qc.setQueryData<InspecaoFull>(["inspecao", id], (antigo) =>
        antigo ? { ...antigo, inspecao: { ...antigo.inspecao, ...payload } } : antigo,
      );
      toast.success(`Prioridade (${rotulo}) guardada no aparelho`, { icon: "📵" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Coluna "Prioridade" da lista: quem edita troca ali mesmo; os demais só veem. */
export function PrioridadeCelula({
  id,
  valor,
  podeEditar,
}: {
  id: string;
  valor: string | null | undefined;
  podeEditar: boolean;
}) {
  const salvar = useSalvarPrioridade(id);
  const atual = ehPrioridade(valor) ? valor : null;

  if (!podeEditar) {
    return atual ? (
      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", PRIORIDADE_INFO[atual].classe)}>
        {PRIORIDADE_INFO[atual].label}
      </span>
    ) : (
      <span className="text-gray-300">—</span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={atual ?? ""}
        disabled={salvar.isPending}
        onChange={(e) => salvar.mutate(ehPrioridade(e.target.value) ? e.target.value : null)}
        aria-label="Prioridade da inspeção"
        title="Prioridade desta inspeção"
        className={cn(
          "cursor-pointer rounded-full border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-verde-primary/30 disabled:opacity-60",
          atual ? PRIORIDADE_INFO[atual].classe : "border-dashed border-gray-300 bg-white text-gray-400",
        )}
      >
        <option value="" className="bg-white text-gray-700">—</option>
        {PRIORIDADES.map((p) => (
          <option key={p} value={p} className="bg-white text-gray-700">{PRIORIDADE_INFO[p].label}</option>
        ))}
      </select>
      {salvar.isPending && <Loader2 className="size-3 animate-spin text-gray-400" />}
    </span>
  );
}

/** Cabeçalho da inspeção: só mostra (a edição mora na lista). */
export default function PrioridadeSelo({ valor }: { valor: string | null | undefined }) {
  const atual = ehPrioridade(valor) ? valor : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold",
        atual ? PRIORIDADE_INFO[atual].classe : "border-gray-200 bg-white text-gray-400",
      )}
      title="A prioridade é definida na lista de Inspeções"
    >
      <Flag className="size-4" /> Prioridade: {atual ? PRIORIDADE_INFO[atual].label : "não definida"}
    </span>
  );
}
