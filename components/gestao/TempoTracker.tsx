"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Clock, Play, Square, Plus, Trash2 } from "lucide-react";
import { useUserStore } from "@/lib/store";
import {
  useTempoTarefa, useTimerAtivo, useIniciarTempo, usePararTempo, useAddTempoManual, useExcluirTempo,
  formatarDuracao, totalSegundos, iniciais,
  type GestaoTempo,
} from "@/lib/hooks/useGestao";

/** Hora atual que só anda enquanto a tarefa tem cronômetro rodando. */
function useRelogio(ativo: boolean) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ativo]);
  return agora;
}

const decorrido = (e: GestaoTempo, agora: number) => Math.round((agora - new Date(e.inicio).getTime()) / 1000);

/** Iniciar/Parar do rodapé da tarefa, ao lado do Salvar. */
export function BotaoTempo({ idTarefa, compacto = false }: { idTarefa: string; compacto?: boolean }) {
  const email = useUserStore((s) => s.user?.email ?? null);
  const { data: entries = [] } = useTempoTarefa(idTarefa);
  const iniciar = useIniciarTempo();
  const parar = usePararTempo();
  const rodandoAqui = entries.find((e) => !e.fim && e.usuario_email === email) ?? null;
  const agora = useRelogio(!!rodandoAqui);
  const ocupado = iniciar.isPending || parar.isPending;

  function toggle() {
    if (rodandoAqui) parar.mutate({ id: rodandoAqui.id, id_tarefa: idTarefa, inicio: rodandoAqui.inicio });
    else iniciar.mutate({ id_tarefa: idTarefa });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={ocupado}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold disabled:opacity-50 ${compacto ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"} ${
        rodandoAqui
          ? "bg-red-600 text-white hover:bg-red-700"
          : "border border-marca-primary text-marca-primary hover:bg-marca-light/50"
      }`}
    >
      {rodandoAqui
        ? <><Square className="size-3.5" /> Parar ({formatarDuracao(decorrido(rodandoAqui, agora))})</>
        : <><Play className="size-3.5" /> Iniciar</>}
    </button>
  );
}

/** Registro de tempo da tarefa: uma linha com o total; os apontamentos abrem ao clicar.
 *  `semRotulo`: no painel de campos da janela, onde a linha já diz "Tempo gasto" (só o total, em letra normal). */
export function RegistroTempo({ idTarefa, podeEditar, semRotulo = false }: { idTarefa: string; podeEditar: boolean; semRotulo?: boolean }) {
  const { data: entries = [] } = useTempoTarefa(idTarefa);
  const { data: timerAtivo } = useTimerAtivo();
  const manual = useAddTempoManual();
  const excluir = useExcluirTempo();
  const agora = useRelogio(entries.some((e) => !e.fim));
  const [aberto, setAberto] = useState(false);
  const [h, setH] = useState("");
  const [m, setM] = useState("");

  const total = totalSegundos(entries, agora);
  const rodando = entries.some((e) => !e.fim);

  function addManual() {
    const seg = (parseInt(h || "0", 10) * 3600) + (parseInt(m || "0", 10) * 60);
    if (seg <= 0) return;
    manual.mutate({ id_tarefa: idTarefa, segundos: seg }, { onSuccess: () => { setH(""); setM(""); } });
  }

  return (
    <div className={`${semRotulo ? "text-sm" : "text-xs"} text-gray-500`}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-label={semRotulo ? `Tempo gasto: ${formatarDuracao(total)}. Ver apontamentos` : undefined} className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-gray-50">
        {!semRotulo && <Clock className="size-3.5 shrink-0" />}
        <span>{!semRotulo && "Tempo: "}<span className="font-medium text-gray-700">{formatarDuracao(total)}</span></span>
        {rodando && <span className="font-medium text-red-600">· rodando</span>}
        <ChevronDown className={`size-3.5 shrink-0 transition ${aberto ? "rotate-180" : ""}`} />
      </button>
      {podeEditar && timerAtivo && timerAtivo.id_tarefa !== idTarefa && (
        <p className="mt-0.5 px-1 text-[11px] text-amber-600">Você tem um cronômetro rodando em outra tarefa: iniciar aqui vai pará-lo.</p>
      )}
      {aberto && (
        <div className="mt-1.5 space-y-2 rounded-md border border-gray-200 p-2">
          {podeEditar && (
            <div className="flex items-center gap-1.5">
              <Plus className="size-4 text-gray-300" />
              <input type="number" min="0" value={h} onChange={(e) => setH(e.target.value)} placeholder="h" aria-label="Horas" className="w-14 rounded border border-gray-200 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none" />
              <input type="number" min="0" max="59" value={m} onChange={(e) => setM(e.target.value)} placeholder="min" aria-label="Minutos" className="w-16 rounded border border-gray-200 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none" />
              <button type="button" onClick={addManual} disabled={manual.isPending} className="rounded-md bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50">Lançar</button>
            </div>
          )}
          <div className="space-y-1">
            {entries.map((e) => (
              <div key={e.id} className="group flex items-center gap-2 text-sm">
                <span className="flex size-5 items-center justify-center rounded-full bg-marca-light text-[9px] font-bold text-marca-primary" title={e.usuario_email}>{iniciais(e.usuario_email)}</span>
                <span className="text-gray-700">{e.fim ? formatarDuracao(e.segundos ?? 0) : `${formatarDuracao(decorrido(e, agora))} (rodando)`}</span>
                {e.manual && <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">manual</span>}
                <span className="ml-auto text-[11px] text-gray-400">{new Date(e.inicio).toLocaleDateString("pt-BR")}</span>
                {podeEditar && (
                  <button
                    type="button"
                    aria-label="Excluir apontamento"
                    onClick={() => excluir.mutate({ id: e.id, id_tarefa: idTarefa, segundos: e.fim ? e.segundos ?? 0 : decorrido(e, agora) })}
                    className="text-gray-300 opacity-0 transition hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {entries.length === 0 && <p className="text-gray-400">Sem apontamentos.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
