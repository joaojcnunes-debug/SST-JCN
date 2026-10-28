"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useDefinirPrioridade } from "@/lib/hooks/useInspecoesAtribuidas";
import { COR_PRIORIDADE, PRIORIDADES, ROTULO_PRIORIDADE, motivosPrioridade, type Prioridade } from "@/lib/inspecoes/prioridade";
import { cn, fmtData } from "@/lib/utils";
import type { Inspecao } from "@/lib/supabase/types";

/**
 * Prioridade manual e prazo de uma inspeção (v306) — só supervisor (o banco confere). A prioridade
 * que vale é a MAIOR entre esta e a automática: marcar "Baixa" não esconde um prazo vencido.
 */
export default function ModalPrioridade({ insp, onClose }: { insp: Inspecao; onClose: () => void }) {
  const salvar = useDefinirPrioridade();
  const [prioridade, setPrioridade] = useState<Prioridade | "">((insp.prioridade as Prioridade) ?? "");
  const [prazo, setPrazo] = useState(insp.prazo ?? "");
  const auto = insp.prioridade_auto as Prioridade | null | undefined;
  const motivosAuto = motivosPrioridade({ ...insp, prioridade: null });

  return (
    <Modal open onClose={onClose} title="Prioridade e prazo" size="sm">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          {insp.id_inspecao} · {insp.empresas?.nome_empresa ?? ""}
        </p>
        <div className="rounded-md bg-gray-50 p-2.5 text-xs text-gray-600">
          <p>
            <strong>Automática:</strong> {auto ? ROTULO_PRIORIDADE[auto] : "nada esperando (sem prioridade)"}
          </p>
          {motivosAuto.length > 0 && <p className="mt-0.5 text-gray-500">{motivosAuto.join(" · ")}</p>}
          <p className="mt-1 text-gray-500">Vale a maior entre a sua e a automática: o atraso nunca fica escondido.</p>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Prioridade do supervisor</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setPrioridade("")} className={cn("rounded-full border px-2.5 py-1 text-xs", !prioridade ? "border-verde-primary bg-verde-light font-medium text-verde-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50")}>
              Sem (só a automática)
            </button>
            {PRIORIDADES.map((p) => (
              <button key={p} type="button" onClick={() => setPrioridade(p)} className={cn("rounded-full px-2.5 py-1 text-xs ring-1", prioridade === p ? cn(COR_PRIORIDADE[p], "font-semibold ring-2") : "text-gray-600 ring-gray-200 hover:bg-gray-50")}>
                {ROTULO_PRIORIDADE[p]}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">Prazo</span>
          <div className="flex items-center gap-2">
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            {prazo && <button type="button" onClick={() => setPrazo("")} className="text-xs text-gray-400 underline">tirar prazo</button>}
          </div>
          <span className="mt-1 block text-[11px] text-gray-400">Prazo vencido vira Urgente; faltando 3 dias, Alta; 7 dias, Média.</span>
        </label>
        {insp.prioridade_definida_por && (
          <p className="text-[11px] text-gray-400">
            Definida por {insp.prioridade_definida_por}
            {insp.prioridade_definida_em ? ` em ${fmtData(insp.prioridade_definida_em)}` : ""}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button
            type="button"
            disabled={salvar.isPending}
            onClick={() => salvar.mutate({ id_inspecao: insp.id_inspecao, prioridade: prioridade || null, prazo: prazo || null }, { onSuccess: onClose })}
            className="rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
