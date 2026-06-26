"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, format, isSameMonth, isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSalvarTarefa, PRIORIDADES, type GestaoTarefa, type GestaoStatus } from "@/lib/hooks/useGestao";

const corPrioridade = (p: string) => PRIORIDADES.find((x) => x.value === p)?.cor ?? "#94a3b8";
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function VistaCalendario({
  tarefas,
  statuses,
  podeEditar,
  onAbrir,
}: {
  tarefas: GestaoTarefa[];
  statuses: GestaoStatus[];
  podeEditar: boolean;
  onAbrir: (t: GestaoTarefa) => void;
}) {
  const salvar = useSalvarTarefa();
  const concluidoSet = useMemo(() => new Set(statuses.filter((s) => s.tipo === "concluido").map((s) => s.slug)), [statuses]);
  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [dragId, setDragId] = useState<string | null>(null);
  const [diaHover, setDiaHover] = useState<string | null>(null);

  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mes), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(mes), { weekStartsOn: 0 });
    const arr: Date[] = [];
    let d = inicio;
    while (d <= fim) { arr.push(d); d = addDays(d, 1); }
    return arr;
  }, [mes]);

  const porDia = useMemo(() => {
    const m = new Map<string, GestaoTarefa[]>();
    for (const t of tarefas) {
      if (!t.prazo) continue;
      if (!m.has(t.prazo)) m.set(t.prazo, []);
      m.get(t.prazo)!.push(t);
    }
    return m;
  }, [tarefas]);

  const semPrazo = tarefas.filter((t) => !t.prazo).length;

  function soltar(diaKey: string) {
    setDiaHover(null);
    const t = tarefas.find((x) => x.id_tarefa === dragId);
    setDragId(null);
    if (!t || !podeEditar || t.prazo === diaKey) return;
    salvar.mutate({ id_tarefa: t.id_tarefa, id_quadro: t.id_quadro, prazo: diaKey });
  }

  return (
    <div className="mt-5 rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold capitalize text-gray-800">{format(mes, "MMMM 'de' yyyy", { locale: ptBR })}</h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMes((m) => subMonths(m, 1))} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => setMes(startOfMonth(new Date()))} className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">Hoje</button>
          <button type="button" onClick={() => setMes((m) => addMonths(m, 1))} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><ChevronRight className="size-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-gray-200 text-sm">
        {SEMANA.map((s) => (
          <div key={s} className="bg-gray-50 py-1.5 text-center text-[11px] font-semibold uppercase text-gray-500">{s}</div>
        ))}
        {dias.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const doMes = isSameMonth(d, mes);
          const lista = porDia.get(key) ?? [];
          return (
            <div
              key={key}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setDiaHover(key); } }}
              onDrop={() => soltar(key)}
              className={`min-h-[92px] bg-white p-1 transition ${doMes ? "" : "bg-gray-50/60"} ${diaHover === key ? "ring-2 ring-inset ring-verde-primary/40" : ""}`}
            >
              <div className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs ${isToday(d) ? "bg-verde-primary font-bold text-white" : doMes ? "text-gray-700" : "text-gray-300"}`}>
                {format(d, "d")}
              </div>
              <div className="space-y-1">
                {lista.map((t) => (
                  <button
                    key={t.id_tarefa}
                    type="button"
                    draggable={podeEditar}
                    onDragStart={() => setDragId(t.id_tarefa)}
                    onDragEnd={() => { setDragId(null); setDiaHover(null); }}
                    onClick={() => onAbrir(t)}
                    title={t.titulo}
                    className={`flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] hover:bg-gray-100 ${dragId === t.id_tarefa ? "opacity-40" : ""} ${concluidoSet.has(t.status) ? "text-gray-400 line-through" : "text-gray-700"}`}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: corPrioridade(t.prioridade) }} />
                    <span className="truncate">{t.titulo}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {semPrazo > 0 && (
        <p className="mt-2 text-xs text-gray-400">{semPrazo} tarefa(s) sem prazo não aparecem no calendário.</p>
      )}
      {podeEditar && <p className="mt-1 text-xs text-gray-400">Arraste uma tarefa para outro dia para mudar o prazo.</p>}
    </div>
  );
}
