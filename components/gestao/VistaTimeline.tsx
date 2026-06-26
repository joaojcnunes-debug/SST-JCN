"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  parseISO, eachDayOfInterval, differenceInCalendarDays,
  addDays, subDays, format, isWeekend, isToday, isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { PRIORIDADES, type GestaoTarefa, type GestaoStatus, type GestaoDependencia } from "@/lib/hooks/useGestao";

const corPrioridade = (p: string) => PRIORIDADES.find((x) => x.value === p)?.cor ?? "#94a3b8";
const COLW = 30;       // largura por dia (px)
const LABELW = 220;    // coluna de títulos (px)
const ROWH = 38;       // altura de linha (px)

export default function VistaTimeline({
  tarefas,
  statuses,
  dependencias = [],
  onAbrir,
}: {
  tarefas: GestaoTarefa[];
  statuses: GestaoStatus[];
  dependencias?: GestaoDependencia[];
  onAbrir: (t: GestaoTarefa) => void;
}) {
  const concluidoSet = useMemo(() => new Set(statuses.filter((s) => s.tipo === "concluido").map((s) => s.slug)), [statuses]);
  const dated = useMemo(() => tarefas.filter((t) => t.prazo || t.data_inicio), [tarefas]);
  const semData = tarefas.length - dated.length;

  const { dias, inicio } = useMemo(() => {
    const todas = dated.flatMap((t) => [t.data_inicio, t.prazo].filter(Boolean) as string[]);
    if (todas.length === 0) return { dias: [] as Date[], inicio: null as Date | null };
    const minStr = todas.reduce((a, b) => (a < b ? a : b));
    const maxStr = todas.reduce((a, b) => (a > b ? a : b));
    const start = subDays(parseISO(minStr), 2);
    const end = addDays(parseISO(maxStr), 2);
    return { dias: eachDayOfInterval({ start, end }), inicio: start };
  }, [dated]);

  // Geometria de cada barra (para desenhar as setas de dependência).
  const geo = useMemo(() => {
    const m = new Map<string, { x0: number; x1: number; y: number }>();
    if (!inicio) return m;
    dated.forEach((t, r) => {
      const s = t.data_inicio ?? t.prazo!;
      const e = t.prazo ?? t.data_inicio!;
      const startIdx = Math.max(0, differenceInCalendarDays(parseISO(s), inicio));
      const span = Math.max(1, differenceInCalendarDays(parseISO(e), parseISO(s)) + 1);
      m.set(t.id_tarefa, { x0: LABELW + startIdx * COLW, x1: LABELW + (startIdx + span) * COLW, y: r * ROWH + ROWH / 2 });
    });
    return m;
  }, [dated, inicio]);

  const setas = useMemo(
    () => dependencias.filter((d) => geo.has(d.id_tarefa) && geo.has(d.depende_de)),
    [dependencias, geo],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!inicio || dias.length === 0 || !scrollRef.current) return;
    const hojeIdx = differenceInCalendarDays(new Date(), inicio);
    if (hojeIdx > 0) scrollRef.current.scrollLeft = Math.max(0, hojeIdx * COLW + LABELW - 250);
  }, [dias, inicio]);

  if (dated.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        Nenhuma tarefa com data de início ou prazo para exibir na timeline.
      </div>
    );
  }

  const largura = dias.length * COLW;

  return (
    <div ref={scrollRef} className="mt-5 overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <div style={{ minWidth: LABELW + largura }}>
        {/* Cabeçalho: meses + dias */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <div className="shrink-0 px-3 py-2 text-xs font-semibold uppercase text-gray-500" style={{ width: LABELW }}>Tarefa</div>
          <div className="relative" style={{ width: largura, height: 40 }}>
            {/* faixa de meses */}
            {dias.map((d, i) => (
              (i === 0 || !isSameMonth(d, dias[i - 1])) && (
                <div key={`m-${i}`} className="absolute top-0 px-1 text-[10px] font-semibold uppercase text-gray-400" style={{ left: i * COLW }}>
                  {format(d, "MMM", { locale: ptBR })}
                </div>
              )
            ))}
            {/* dias */}
            {dias.map((d, i) => (
              <div key={i} className={`absolute bottom-0 flex h-5 items-center justify-center text-[10px] ${isWeekend(d) ? "text-gray-300" : "text-gray-500"}`} style={{ left: i * COLW, width: COLW }}>
                {format(d, "d")}
              </div>
            ))}
          </div>
        </div>

        {/* Linhas */}
        <div className="relative">
        {dated.map((t) => {
          const s = t.data_inicio ?? t.prazo!;
          const e = t.prazo ?? t.data_inicio!;
          const startIdx = Math.max(0, differenceInCalendarDays(parseISO(s), inicio!));
          const span = Math.max(1, differenceInCalendarDays(parseISO(e), parseISO(s)) + 1);
          const cor = corPrioridade(t.prioridade);
          const concluido = concluidoSet.has(t.status);
          return (
            <div key={t.id_tarefa} className="flex border-b border-gray-100 hover:bg-gray-50/60" style={{ height: ROWH }}>
              <button type="button" onClick={() => onAbrir(t)} className="shrink-0 truncate px-3 text-left text-sm text-gray-700 hover:text-verde-primary" style={{ width: LABELW }} title={t.titulo}>
                {t.titulo}
              </button>
              <div className="relative" style={{ width: largura }}>
                {/* listras de fim de semana */}
                {dias.map((d, i) => isWeekend(d) && (
                  <div key={i} className="absolute top-0 h-full bg-gray-50" style={{ left: i * COLW, width: COLW }} />
                ))}
                {/* linha de hoje */}
                {dias.map((d, i) => isToday(d) && (
                  <div key={`t-${i}`} className="absolute top-0 z-10 h-full w-px bg-verde-primary/50" style={{ left: i * COLW + COLW / 2 }} />
                ))}
                {/* barra */}
                <button
                  type="button"
                  onClick={() => onAbrir(t)}
                  title={`${t.titulo}${t.data_inicio ? ` · início ${t.data_inicio}` : ""}${t.prazo ? ` · prazo ${t.prazo}` : ""}`}
                  className={`absolute top-1/2 z-[5] flex -translate-y-1/2 items-center rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition hover:brightness-110 ${concluido ? "opacity-60" : ""}`}
                  style={{ left: startIdx * COLW + 2, width: span * COLW - 4, height: 22, background: cor }}
                >
                  <span className="truncate">{t.titulo}</span>
                </button>
              </div>
            </div>
          );
        })}
        {setas.length > 0 && (
          <svg className="pointer-events-none absolute left-0 top-0 z-20" width={LABELW + largura} height={dated.length * ROWH}>
            <defs>
              <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
              </marker>
            </defs>
            {setas.map((d) => {
              const A = geo.get(d.id_tarefa)!;   // depende de B
              const B = geo.get(d.depende_de)!;  // pré-requisito
              return <path key={d.id} d={`M ${B.x1} ${B.y} C ${B.x1 + 24} ${B.y}, ${A.x0 - 24} ${A.y}, ${A.x0} ${A.y}`} stroke="#94a3b8" strokeWidth={1.5} fill="none" markerEnd="url(#dep-arrow)" />;
            })}
          </svg>
        )}
        </div>
      </div>

      {semData > 0 && (
        <p className="px-3 py-2 text-xs text-gray-400">{semData} tarefa(s) sem datas não aparecem na timeline.</p>
      )}
    </div>
  );
}
