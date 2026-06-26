"use client";

import { useMemo } from "react";
import { Flag, CalendarClock, List } from "lucide-react";
import { PRIORIDADES, type GestaoTarefa, type GestaoStatus, type GestaoQuadro } from "@/lib/hooks/useGestao";

const corPrioridade = (p: string) => PRIORIDADES.find((x) => x.value === p)?.cor ?? "#94a3b8";
const labelPrioridade = (p: string) => PRIORIDADES.find((x) => x.value === p)?.label ?? p;
function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - hoje.getTime()) / 86_400_000);
}
const fmtPrazo = (iso: string) => { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a.slice(2)}`; };

export default function MinhasTarefas({
  tarefas,
  quadros,
  statusMap,
  onAbrir,
}: {
  tarefas: GestaoTarefa[];
  quadros: GestaoQuadro[];
  statusMap: Map<string, GestaoStatus>;
  onAbrir: (t: GestaoTarefa) => void;
}) {
  const nomeQuadro = useMemo(() => new Map(quadros.map((q) => [q.id_quadro, q.nome])), [quadros]);

  const grupos = useMemo(() => {
    const m = new Map<string, GestaoTarefa[]>();
    for (const t of tarefas) {
      if (!m.has(t.id_quadro)) m.set(t.id_quadro, []);
      m.get(t.id_quadro)!.push(t);
    }
    return [...m.entries()]
      .map(([id, ts]) => ({ id, nome: nomeQuadro.get(id) ?? "Lista", ts }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [tarefas, nomeQuadro]);

  if (tarefas.length === 0) {
    return <div className="mt-6 rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">Você não tem tarefas atribuídas.</div>;
  }

  return (
    <div className="mt-5 space-y-5">
      {grupos.map((g) => (
        <div key={g.id}>
          <div className="mb-1.5 flex items-center gap-2 px-1">
            <List className="size-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">{g.nome}</p>
            <span className="rounded-full bg-gray-200 px-1.5 text-[11px] font-semibold text-gray-600">{g.ts.length}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {g.ts.map((t) => {
              const st = statusMap.get(`${t.id_quadro}|${t.status}`);
              const concl = st?.tipo === "concluido";
              const dias = t.prazo ? diasAte(t.prazo) : null;
              const atrasada = dias != null && dias < 0 && !concl;
              const prioAlta = t.prioridade === "Alta" || t.prioridade === "Urgente";
              return (
                <button key={t.id_tarefa} type="button" onClick={() => onAbrir(t)} className="flex w-full items-center gap-3 border-t border-gray-100 px-3 py-2.5 text-left first:border-t-0 hover:bg-gray-50">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: corPrioridade(t.prioridade) }} title={`Prioridade: ${labelPrioridade(t.prioridade)}`} />
                  <span className={`min-w-0 flex-1 truncate text-sm font-medium ${concl ? "text-gray-400 line-through" : "text-gray-800"}`}>{t.titulo}</span>
                  {prioAlta && <span className="hidden items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold sm:inline-flex" style={{ background: corPrioridade(t.prioridade) + "1a", color: corPrioridade(t.prioridade) }}><Flag className="size-3" /> {labelPrioridade(t.prioridade)}</span>}
                  {st && <span className="hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline" style={{ background: (st.cor ?? "#999") + "22", color: st.cor }}>{st.nome}</span>}
                  {t.prazo && (
                    <span className={`inline-flex shrink-0 items-center gap-1 text-xs ${atrasada ? "font-medium text-red-600" : "text-gray-500"}`}>
                      <CalendarClock className="size-3.5" /> {fmtPrazo(t.prazo)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
