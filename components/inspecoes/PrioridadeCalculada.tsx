"use client";

import { useState } from "react";
import { CalendarClock, Flag, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { gravar } from "@/lib/offline/gravar";
import {
  PRIORIDADE_INFO,
  calculadaSobe,
  ehPrioridade,
  motivosPrioridade,
  textoEspera,
} from "@/lib/inspecoes/prioridade";
import { cn, fmtData } from "@/lib/utils";
import type { Inspecao } from "@/lib/supabase/types";

/**
 * O que a prioridade MARCADA (PrioridadeCelula, v308) não mostra — 28/10/2026:
 * - a prioridade CALCULADA, quando ela passa a marcada ("Crítica · calculada"), com o porquê no
 *   balão (prazo vencido, documento vencendo, tempo parado);
 * - há quanto tempo espera ("Aberta há 12 dias", "Documento aguardando há 5 dias");
 * - o PRAZO, que quem edita a inspeção define aqui mesmo (mesma regra da prioridade marcada).
 */
export default function PrioridadeCalculada({ insp, podeEditarPrazo, compacto }: { insp: Inspecao; podeEditarPrazo?: boolean; compacto?: boolean }) {
  const [abrirPrazo, setAbrirPrazo] = useState(false);
  const auto = ehPrioridade(insp.prioridade_auto) ? insp.prioridade_auto : null;
  const motivos = motivosPrioridade(insp);
  const espera = textoEspera(insp.status, insp.dias_espera);
  const vencido = motivos.some((m) => m.startsWith("Prazo vencido"));

  return (
    <span className="mt-0.5 inline-flex flex-col items-start gap-0.5">
      {auto && calculadaSobe(insp) && (
        <span
          title={[`Prioridade calculada: ${PRIORIDADE_INFO[auto].label}`, ...motivos, "Vale a maior entre a marcada e a calculada."].join("\n")}
          className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", PRIORIDADE_INFO[auto].classe)}
        >
          <Flag className="size-3" /> {PRIORIDADE_INFO[auto].label}
          <span className="font-normal opacity-60">calculada</span>
        </span>
      )}
      {!compacto && espera && <span className="text-[11px] text-gray-400" title={motivos.join("\n") || undefined}>{espera}</span>}
      {(insp.prazo || podeEditarPrazo) && (
        <button
          type="button"
          disabled={!podeEditarPrazo}
          onClick={() => setAbrirPrazo(true)}
          className={cn(
            "inline-flex items-center gap-1 text-[11px] disabled:cursor-default",
            insp.prazo ? (vencido ? "font-medium text-red-600" : "text-gray-500") : "text-gray-300 hover:text-verde-primary",
          )}
          title={podeEditarPrazo ? "Definir o prazo" : undefined}
        >
          <CalendarClock className="size-3" /> {insp.prazo ? `prazo ${fmtData(insp.prazo)}` : "prazo"}
        </button>
      )}
      {abrirPrazo && <ModalPrazo insp={insp} onClose={() => setAbrirPrazo(false)} />}
    </span>
  );
}

/** Prazo da inspeção — grava por `gravar` como a prioridade marcada, então também funciona sem sinal. */
function ModalPrazo({ insp, onClose }: { insp: Inspecao; onClose: () => void }) {
  const qc = useQueryClient();
  const [prazo, setPrazo] = useState(insp.prazo ?? "");
  const salvar = useMutation({
    mutationFn: async (valor: string | null) => {
      const payload = { prazo: valor, updated_at: new Date().toISOString() };
      return gravar({ tabela: "inspecoes", tipo: "update", linhas: payload, filtro: { id_inspecao: insp.id_inspecao }, modulo: "inspecoes", id_documento: insp.id_inspecao });
    },
    onSuccess: (resultado) => {
      for (const k of ["inspecao", "inspecoes-lista", "inspecoes-counts", "inspecoes-atribuidas"]) qc.invalidateQueries({ queryKey: [k] });
      toast.success(resultado.destino === "SERVIDOR" ? "Prazo atualizado" : "Prazo guardado no aparelho", resultado.destino === "SERVIDOR" ? undefined : { icon: "📵" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Prazo da inspeção" size="sm">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">{insp.id_inspecao} · {insp.empresas?.nome_empresa ?? ""}</p>
        <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <p className="text-[11px] text-gray-500">
          Prazo vencido deixa a prioridade calculada em <strong>Crítica</strong>; faltando até 3 dias, <strong>Urgente</strong>; até 7 dias, <strong>Média</strong>.
          Vale a maior entre a prioridade marcada e a calculada.
        </p>
        <div className="flex justify-between gap-2">
          <button type="button" disabled={salvar.isPending || !insp.prazo} onClick={() => salvar.mutate(null)} className="text-xs text-gray-400 underline disabled:opacity-40">
            Tirar o prazo
          </button>
          <span className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="button" disabled={salvar.isPending || !prazo} onClick={() => salvar.mutate(prazo)} className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50">
              {salvar.isPending && <Loader2 className="size-3.5 animate-spin" />} Salvar
            </button>
          </span>
        </div>
      </div>
    </Modal>
  );
}
