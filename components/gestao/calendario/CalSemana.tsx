"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { blocoDe, colunasDosBlocos, ehComHorario, faixasDoPeriodo, horaDe, rotuloHorario } from "@/lib/gestao/calendario";
import { Avatares, BarraTarefa, ChipTarefa, fundo, propsArrastar, type ItemCal, type PropsVisao } from "./comum";
import { cn } from "@/lib/utils";

/** Altura de uma hora na grade (px). */
const H = 48;
const GUTTER = 52;
const HORAS = Array.from({ length: 24 }, (_, h) => h);

/** Semana (7 dias) ou Dia (1 dia): faixa "dia inteiro" no topo e a grade de horários embaixo. */
export default function CalSemana({ p, dias }: { p: PropsVisao; dias: Date[] }) {
  const n = dias.length;
  const keys = useMemo(() => dias.map((d) => format(d, "yyyy-MM-dd")), [dias]);
  const rolagem = useRef<HTMLDivElement>(null);
  const [alvoTopo, setAlvoTopo] = useState<string | null>(null);
  const [alvoGrade, setAlvoGrade] = useState<{ dia: string; min: number } | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Topo: tarefas de vários dias e as de dia inteiro. Grade: um dia só, com hora.
  const doTopo = useMemo(() => p.itens.filter((i) => !ehComHorario(i.iv)), [p.itens]);
  const faixas = useMemo(
    () => faixasDoPeriodo(doTopo.map((i) => ({ id: i.id, inicio: i.iv.inicio, fim: i.iv.fim })), keys[0], n),
    [doTopo, keys, n],
  );
  const pistas = faixas.reduce((m, f) => Math.max(m, f.linha + 1), 0);
  const porId = useMemo(() => new Map(p.itens.map((i) => [i.id, i])), [p.itens]);

  const blocosPorDia = useMemo(() => {
    const m = new Map<string, { i: ItemCal; ini: number; fim: number; col: number; ncols: number }[]>();
    for (const k of keys) {
      const doDia = p.itens.filter((i) => ehComHorario(i.iv) && i.iv.inicio === k).map((i) => ({ i, ...blocoDe(i.iv) }));
      const cols = colunasDosBlocos(doDia.map((b) => ({ id: b.i.id, ini: b.ini, fim: b.fim })));
      m.set(k, doDia.map((b) => ({ ...b, ...(cols.get(b.i.id) ?? { col: 0, ncols: 1 }) })));
    }
    return m;
  }, [p.itens, keys]);

  // Abre rolado para o primeiro horário com tarefa (ou 07:00, o que vier antes).
  const primeiro = useMemo(() => {
    let min = 7 * 60;
    for (const l of blocosPorDia.values()) for (const b of l) min = Math.min(min, b.ini);
    return min;
  }, [blocosPorDia]);
  useEffect(() => {
    if (rolagem.current) rolagem.current.scrollTop = Math.max(0, ((primeiro - 30) / 60) * H);
    // só ao trocar de período: não pular enquanto a pessoa rola
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys[0], n]);

  function colunaDe(e: React.MouseEvent | React.DragEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    const col = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)));
    return { dia: keys[col], y: e.clientY - r.top };
  }
  const minutoDe = (y: number, passo: number) => Math.max(0, Math.min(24 * 60 - passo, Math.round(((y / H) * 60) / passo) * passo));

  const hojeNaTela = keys.indexOf(p.hoje);
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  const cols = `${GUTTER}px repeat(${n}, minmax(0, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <div style={{ minWidth: n > 1 ? 760 : undefined }}>
        {/* Cabeçalho dos dias */}
        <div className="grid border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: cols }}>
          <div />
          {dias.map((d, c) => (
            <div key={keys[c]} className="border-l border-gray-200 py-1.5 text-center text-xs font-semibold text-gray-600">
              <span className={cn("inline-block rounded-full px-2 py-0.5 first-letter:uppercase", keys[c] === p.hoje && "bg-marca-primary text-white")}>
                {format(d, n > 1 ? "EEE d/MM" : "EEEE, d 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
          ))}
        </div>

        {/* Dia inteiro e vários dias */}
        <div
          className="grid border-b border-gray-200"
          style={{ gridTemplateColumns: cols, gridTemplateRows: `repeat(${Math.max(1, pistas)}, 24px)` }}
          onDragOver={(e) => {
            if (!p.arrastando) return;
            e.preventDefault();
            const r = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - r.left - GUTTER;
            const col = Math.max(0, Math.min(n - 1, Math.floor((x / (r.width - GUTTER)) * n)));
            setAlvoTopo(keys[col]);
          }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setAlvoTopo(null); }}
          onDrop={(e) => { e.preventDefault(); const dia = alvoTopo; setAlvoTopo(null); if (dia) p.onSoltar(dia); }}
        >
          <div className="flex items-start justify-center pt-1 text-gray-400" style={{ gridColumn: 1, gridRow: "1 / -1" }} title="Dia inteiro">
            <Clock className="size-3.5" />
          </div>
          {keys.map((k, c) => (
            <div
              key={k}
              onClick={p.onCriar ? () => p.onCriar!(k) : undefined}
              title={p.onCriar ? "Clique para criar uma tarefa de dia inteiro" : undefined}
              className={cn("border-l border-gray-200", p.onCriar && "cursor-pointer hover:bg-gray-50", alvoTopo === k && "bg-marca-light/60")}
              style={{ gridColumn: c + 2, gridRow: "1 / -1" }}
            />
          ))}
          {faixas.map((f) => {
            const i = porId.get(f.id)!;
            const umDia = f.col0 === f.col1 && !f.cortadaIni && !f.cortadaFim && i.iv.inicio === i.iv.fim;
            const pos = { gridColumn: `${f.col0 + 2} / ${f.col1 + 3}`, gridRow: f.linha + 1, alignSelf: "center" as const };
            return umDia ? (
              <ChipTarefa key={f.id} i={i} p={p} className="z-[1] mx-0.5 w-auto" style={pos} />
            ) : (
              <BarraTarefa key={f.id} i={i} p={p} cortadaIni={f.cortadaIni} cortadaFim={f.cortadaFim} style={{ ...pos, height: 20 }} />
            );
          })}
        </div>

        {/* Grade de horários */}
        <div ref={rolagem} className="max-h-[620px] overflow-y-auto">
          <div className="relative grid" style={{ gridTemplateColumns: cols, height: 24 * H }}>
            <div className="relative" style={{ gridColumn: 1 }}>
              {HORAS.map((h) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-gray-400" style={{ top: h * H }}>
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>
            <div
              className="relative"
              style={{ gridColumn: `2 / ${n + 2}` }}
              onClick={(e) => {
                if (!p.onCriar || e.target !== e.currentTarget) return;
                const { dia, y } = colunaDe(e);
                // a meia hora em que a pessoa clicou (9:20 → 9:00)
                p.onCriar(dia, horaDe(Math.min(23 * 60 + 30, Math.floor(((y / H) * 60) / 30) * 30)));
              }}
              onDragOver={(e) => {
                if (!p.arrastando) return;
                e.preventDefault();
                const { dia, y } = colunaDe(e);
                setAlvoGrade({ dia, min: minutoDe(y, 15) });
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setAlvoGrade(null); }}
              onDrop={(e) => {
                e.preventDefault();
                const { dia, y } = colunaDe(e);
                setAlvoGrade(null);
                p.onSoltar(dia, horaDe(minutoDe(y, 15)));
              }}
            >
              {/* linhas das horas e divisões dos dias (não pegam clique) */}
              {HORAS.map((h) => (
                <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-gray-100" style={{ top: h * H }} />
              ))}
              <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                {keys.map((k) => <div key={k} className="border-l border-gray-200" />)}
              </div>

              {keys.map((k, c) => (
                <div key={k} className="pointer-events-none absolute inset-y-0" style={{ left: `${(c / n) * 100}%`, width: `${100 / n}%` }}>
                  {(blocosPorDia.get(k) ?? []).map(({ i, ini, fim, col, ncols }) => {
                    const alto = Math.max(((fim - ini) / 60) * H, 22);
                    return (
                      <button
                        key={i.id}
                        type="button"
                        {...propsArrastar(i, p)}
                        onClick={(e) => { e.stopPropagation(); p.onAbrir(i.t); }}
                        onMouseEnter={(e) => p.onDica(i, e)}
                        onMouseLeave={() => p.onDica(null)}
                        aria-label={i.t.titulo}
                        className={cn(
                          "pointer-events-auto absolute flex flex-col items-stretch justify-start overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight text-gray-800 shadow-sm hover:z-10 hover:brightness-95",
                          p.arrastando?.id === i.id && "opacity-40",
                          i.feita && "opacity-60",
                        )}
                        style={{
                          top: (ini / 60) * H + 1,
                          height: alto - 2,
                          left: `calc(${(col / ncols) * 100}% + 2px)`,
                          width: `calc(${100 / ncols}% - 4px)`,
                          background: fundo(i.cor),
                          borderLeft: `3px solid ${i.cor}`,
                        }}
                      >
                        <span className={cn("flex items-start gap-1 font-medium", i.feita && "line-through")}>
                          {i.feita && <Check className="mt-px size-3 shrink-0" style={{ color: i.cor }} />}
                          <span className={alto >= 44 ? "line-clamp-2" : "truncate"}>{i.t.titulo}</span>
                        </span>
                        {alto >= 34 && (p.mostrar.hora || p.mostrar.resp) && (
                          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                            {p.mostrar.hora && <span className="truncate whitespace-nowrap tabular-nums">{rotuloHorario(i.iv)}</span>}
                            {p.mostrar.resp && <Avatares nomes={i.resp} className="ml-auto" />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {hojeNaTela >= 0 && (
                <div className="pointer-events-none absolute z-20" style={{ top: (minAgora / 60) * H, left: `${(hojeNaTela / n) * 100}%`, width: `${100 / n}%` }}>
                  <div className="relative border-t-2 border-red-500">
                    <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-red-500" />
                  </div>
                </div>
              )}

              {alvoGrade && (
                <div
                  className="pointer-events-none absolute z-20 border-t-2 border-dashed border-marca-primary"
                  style={{ top: (alvoGrade.min / 60) * H, left: `${(keys.indexOf(alvoGrade.dia) / n) * 100}%`, width: `${100 / n}%` }}
                >
                  <span className="absolute -top-4 left-1 rounded bg-marca-primary px-1 text-[10px] font-semibold text-white">{horaDe(alvoGrade.min)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
