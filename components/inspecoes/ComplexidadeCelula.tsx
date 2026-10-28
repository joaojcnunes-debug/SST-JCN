"use client";

import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { gravar } from "@/lib/offline/gravar";
import { cn } from "@/lib/utils";
import { COMPLEXIDADES, COMPLEXIDADE_INFO, ehComplexidade, type ComplexidadeInspecao } from "@/lib/inspecoes/complexidade";

/**
 * Coluna "Complexidade" da lista (v308, 28/10/2026) — a mesma mecânica da PrioridadeCelula: quem
 * edita troca ali mesmo (grava por `gravar`, então também funciona sem sinal); os demais só veem.
 */
export default function ComplexidadeCelula({
  id,
  valor,
  podeEditar,
}: {
  id: string;
  valor: string | null | undefined;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const atual = ehComplexidade(valor) ? valor : null;
  const salvar = useMutation({
    mutationFn: async (complexidade: ComplexidadeInspecao | null) =>
      gravar({
        tabela: "inspecoes",
        tipo: "update",
        linhas: { complexidade, updated_at: new Date().toISOString() },
        filtro: { id_inspecao: id },
        modulo: "inspecoes",
        id_documento: id,
      }).then((resultado) => ({ resultado, complexidade })),
    onSuccess: ({ resultado, complexidade }) => {
      const rotulo = complexidade ? COMPLEXIDADE_INFO[complexidade].label : "não definida";
      for (const k of ["inspecao", "inspecoes-lista", "inspecoes-counts", "inspecoes-atribuidas"]) qc.invalidateQueries({ queryKey: [k] });
      if (resultado.destino === "SERVIDOR") toast.success(`Complexidade: ${rotulo}`);
      else toast.success(`Complexidade (${rotulo}) guardada no aparelho`, { icon: "📵" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!podeEditar) {
    return atual ? (
      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", COMPLEXIDADE_INFO[atual].classe)}>
        {COMPLEXIDADE_INFO[atual].label}
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
        onChange={(e) => salvar.mutate(ehComplexidade(e.target.value) ? e.target.value : null)}
        aria-label="Complexidade da inspeção"
        title="Complexidade desta inspeção"
        className={cn(
          "cursor-pointer rounded-full border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-verde-primary/30 disabled:opacity-60",
          atual ? COMPLEXIDADE_INFO[atual].classe : "border-dashed border-gray-300 bg-white text-gray-400",
        )}
      >
        <option value="" className="bg-white text-gray-700">—</option>
        {COMPLEXIDADES.map((c) => (
          <option key={c} value={c} className="bg-white text-gray-700">{COMPLEXIDADE_INFO[c].label}</option>
        ))}
      </select>
      {salvar.isPending && <Loader2 className="size-3 animate-spin text-gray-400" />}
    </span>
  );
}
