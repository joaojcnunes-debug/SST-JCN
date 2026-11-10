"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { addDays, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ehVariosDias, faixasDoPeriodo } from "@/lib/gestao/calendario";
import { BarraTarefa, ChipTarefa, type ItemCal, type PropsVisao } from "./comum";
import { cn } from "@/lib/utils";

const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
/** Tarefas de um dia só que cabem na célula; o resto vira "+N mais" (abre o dia). */
const MAX_NO_DIA = 4;

const porHora = (a: ItemCal, b: ItemCal) =>
  (a.iv.horaIni ?? "").localeCompare(b.iv.horaIni ?? "") || a.t.titulo.localeCompare(b.t.titulo, "pt-BR");

export default function CalMes({ p, mes, onVerDia }: { p: PropsVisao; mes: Date; onVerDia: (dia: Date) => void }) {
  const [alvo, setAlvo] = useState<string | null>(null);

  const semanas = useMemo(() => {
    const out: Date[][] = [];
    let d = startOfWeek(startOfMonth(mes), { weekStartsOn: 1 });
    const fim = endOfWeek(endOfMonth(mes), { weekStartsOn: 1 });
    while (d <= fim) {
      out.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
      d = addDays(d, 7);
    }
    return out;
  }, [mes]);

  const variosDias = useMemo(() => p.itens.filter((i) => ehVariosDias(i.iv)), [p.itens]);
  const porDia = useMemo(() => {
    const m = new Map<string, ItemCal[]>();
    for (const i of p.itens) {
      if (ehVariosDias(i.iv)) continue;
      if (!m.has(i.iv.inicio)) m.set(i.iv.inicio, []);
      m.get(i.iv.inicio)!.push(i);
    }
    for (const l of m.values()) l.sort(porHora);
    return m;
  }, [p.itens]);
  const porId = useMemo(() => new Map(p.itens.map((i) => [i.id, i])), [p.itens]);

  function colunaDoMouse(e: React.DragEvent, semana: Date[]) {
    const r = e.currentTarget.getBoundingClientRect();
    const col = Math.max(0, Math.min(6, Math.floor(((e.clientX - r.left) / r.width) * 7)));
    return format(semana[col], "yyyy-MM-dd");
  }

  return (
    <div className="overflow-hidden rounded-lg border-l border-t border-gray-200 text-sm">
      <div className="grid grid-cols-7">
        {SEMANA.map((s) => (
          <div key={s} className="border-b border-r border-gray-200 bg-gray-50 py-1.5 text-center text-[11px] font-semibold uppercase text-gray-500">{s}</div>
        ))}
      </div>
      {semanas.map((semana) => {
        const ini = format(semana[0], "yyyy-MM-dd");
        const faixas = faixasDoPeriodo(variosDias.map((i) => ({ id: i.id, inicio: i.iv.inicio, fim: i.iv.fim })), ini, 7);
        const pistas = faixas.reduce((n, f) => Math.max(n, f.linha + 1), 0);
        return (
          <div
            key={ini}
            className="grid grid-cols-7"
            style={{ gridTemplateRows: pistas ? `26px repeat(${pistas}, 22px) minmax(64px, auto)` : "26px minmax(64px, auto)" }}
            onDragOver={(e) => { if (!p.arrastando) return; e.preventDefault(); setAlvo(colunaDoMouse(e, semana)); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setAlvo(null); }}
            onDrop={(e) => { e.preventDefault(); const dia = colunaDoMouse(e, semana); setAlvo(null); p.onSoltar(dia); }}
          >
            {semana.map((d, c) => {
              const key = format(d, "yyyy-MM-dd");
              const doMes = isSameMonth(d, mes);
              return (
                <div
                  key={key}
                  onClick={p.onCriar ? () => p.onCriar!(key) : undefined}
                  title={p.onCriar ? "Clique para criar uma tarefa neste dia" : undefined}
                  style={{ gridColumn: c + 1, gridRow: "1 / -1" }}
                  className={cn(
                    "group border-b border-r border-gray-200 transition",
                    doMes ? "bg-white" : "bg-gray-50/70",
                    p.onCriar && "cursor-pointer hover:bg-gray-50",
                    alvo === key && "ring-2 ring-inset ring-marca-primary/50",
                  )}
                >
                  <div className="flex items-center justify-between px-1 pt-1">
                    <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", key === p.hoje ? "bg-marca-primary font-bold text-white" : doMes ? "text-gray-700" : "text-gray-300")}>
                      {format(d, "d")}
                    </span>
                    {p.onCriar && <Plus className="size-3.5 text-gray-300 opacity-0 group-hover:opacity-100" />}
                  </div>
                </div>
              );
            })}

            {faixas.map((f) => {
              const i = porId.get(f.id)!;
              return (
                <BarraTarefa
                  key={f.id}
                  i={i}
                  p={p}
                  cortadaIni={f.cortadaIni}
                  cortadaFim={f.cortadaFim}
                  style={{ gridColumn: `${f.col0 + 1} / ${f.col1 + 2}`, gridRow: f.linha + 2, height: 20, alignSelf: "center" }}
                />
              );
            })}

            {semana.map((d, c) => {
              const key = format(d, "yyyy-MM-dd");
              const lista = porDia.get(key) ?? [];
              if (!lista.length) return null;
              const mais = lista.length - MAX_NO_DIA;
              return (
                <div key={`i-${key}`} style={{ gridColumn: c + 1, gridRow: pistas + 2 }} className="pointer-events-none z-[1] min-w-0 space-y-0.5 px-1 pb-1">
                  {lista.slice(0, mais > 0 ? MAX_NO_DIA - 1 : MAX_NO_DIA).map((i) => (
                    <ChipTarefa key={i.id} i={i} p={p} className="pointer-events-auto" />
                  ))}
                  {mais > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onVerDia(d); }}
                      className="pointer-events-auto w-full rounded px-1 py-0.5 text-left text-[11px] font-medium text-marca-primary hover:bg-marca-light"
                    >
                      + {mais + 1} mais
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
