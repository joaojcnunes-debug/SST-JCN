"use client";

import { useEffect, useState } from "react";
import { Play, Square, Plus, Trash2 } from "lucide-react";
import { useUserStore } from "@/lib/store";
import {
  useTempoTarefa, useTimerAtivo, useIniciarTempo, usePararTempo, useAddTempoManual, useExcluirTempo,
  formatarDuracao, totalSegundos, iniciais,
} from "@/lib/hooks/useGestao";

export default function TempoTracker({ idTarefa, podeEditar }: { idTarefa: string; podeEditar: boolean }) {
  const email = useUserStore((s) => s.user?.email ?? null);
  const { data: entries = [] } = useTempoTarefa(idTarefa);
  const { data: timerAtivo } = useTimerAtivo();
  const iniciar = useIniciarTempo();
  const parar = usePararTempo();
  const manual = useAddTempoManual();
  const excluir = useExcluirTempo();
  const [agora, setAgora] = useState(() => Date.now());
  const [h, setH] = useState("");
  const [m, setM] = useState("");

  const rodandoAqui = entries.find((e) => !e.fim && e.usuario_email === email) ?? null;

  useEffect(() => {
    if (!rodandoAqui) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rodandoAqui]);

  const total = totalSegundos(entries, agora);

  function toggle() {
    if (rodandoAqui) parar.mutate({ id: rodandoAqui.id, id_tarefa: idTarefa, inicio: rodandoAqui.inicio });
    else iniciar.mutate({ id_tarefa: idTarefa });
  }
  function addManual() {
    const seg = (parseInt(h || "0", 10) * 3600) + (parseInt(m || "0", 10) * 60);
    if (seg <= 0) return;
    manual.mutate({ id_tarefa: idTarefa, segundos: seg }, { onSuccess: () => { setH(""); setM(""); } });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">Tempo · total {formatarDuracao(total)}</label>
        {podeEditar && (
          <button type="button" onClick={toggle} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${rodandoAqui ? "bg-red-600 hover:bg-red-700" : "bg-verde-primary hover:bg-verde-accent"}`}>
            {rodandoAqui
              ? <><Square className="size-3.5" /> Parar ({formatarDuracao(Math.round((agora - new Date(rodandoAqui.inicio).getTime()) / 1000))})</>
              : <><Play className="size-3.5" /> Iniciar</>}
          </button>
        )}
      </div>
      {timerAtivo && timerAtivo.id_tarefa !== idTarefa && (
        <p className="text-[11px] text-amber-600">Você tem um cronômetro rodando em outra tarefa — iniciar aqui vai pará-lo.</p>
      )}
      {podeEditar && (
        <div className="flex items-center gap-1.5">
          <Plus className="size-4 text-gray-300" />
          <input type="number" min="0" value={h} onChange={(e) => setH(e.target.value)} placeholder="h" className="w-14 rounded border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none" />
          <input type="number" min="0" max="59" value={m} onChange={(e) => setM(e.target.value)} placeholder="min" className="w-16 rounded border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none" />
          <button type="button" onClick={addManual} className="rounded-md bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200">Lançar</button>
        </div>
      )}
      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.id} className="group flex items-center gap-2 text-sm">
            <span className="flex size-5 items-center justify-center rounded-full bg-verde-light text-[9px] font-bold text-verde-primary" title={e.usuario_email}>{iniciais(e.usuario_email)}</span>
            <span className="text-gray-700">{e.fim ? formatarDuracao(e.segundos ?? 0) : `${formatarDuracao(Math.round((agora - new Date(e.inicio).getTime()) / 1000))} (rodando)`}</span>
            {e.manual && <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">manual</span>}
            <span className="ml-auto text-[11px] text-gray-400">{new Date(e.inicio).toLocaleDateString("pt-BR")}</span>
            {podeEditar && <button type="button" onClick={() => excluir.mutate(e.id)} className="text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"><Trash2 className="size-3.5" /></button>}
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-gray-400">Sem apontamentos.</p>}
      </div>
    </div>
  );
}
