"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cobreDia, rotuloHorario } from "@/lib/gestao/calendario";
import { Avatares, type ItemCal, type PropsVisao } from "./comum";
import { cn } from "@/lib/utils";

/** Agenda (como no Runrun): o mês em lista, dia a dia; tarefa de vários dias aparece em cada dia. */
export default function CalAgenda({ p, mes }: { p: PropsVisao; mes: Date }) {
  const dias = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(mes), end: endOfMonth(mes) })
      .map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const lista = p.itens
          .filter((i) => cobreDia(i.iv, key))
          .sort((a, b) => {
            // dia inteiro e vários dias primeiro; depois pelo horário
            const ha = a.iv.horaIni && a.iv.inicio === a.iv.fim ? a.iv.horaIni : "";
            const hb = b.iv.horaIni && b.iv.inicio === b.iv.fim ? b.iv.horaIni : "";
            return ha.localeCompare(hb) || a.t.titulo.localeCompare(b.t.titulo, "pt-BR");
          });
        return { d, key, lista };
      })
      .filter((x) => x.lista.length > 0);
  }, [p.itens, mes]);

  if (!dias.length) {
    return <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">Nenhuma tarefa com data neste mês.</div>;
  }

  const horario = (i: ItemCal, key: string) => {
    if (i.iv.inicio === i.iv.fim) return rotuloHorario(i.iv);
    if (key === i.iv.inicio && i.iv.horaIni) return `a partir de ${i.iv.horaIni}`;
    if (key === i.iv.fim && i.iv.horaFim) return `até ${i.iv.horaFim}`;
    return "Dia inteiro";
  };

  return (
    <div className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200">
      {dias.map(({ d, key, lista }) => (
        <div key={key} className="flex flex-col gap-1 p-2 sm:flex-row sm:gap-3">
          <div className={cn("w-32 shrink-0 px-1 pt-1", key === p.hoje && "text-marca-primary")}>
            <p className="text-sm font-semibold">{format(d, "d 'de' MMMM", { locale: ptBR })}</p>
            <p className="text-xs text-gray-500 first-letter:uppercase">{key === p.hoje ? "Hoje" : format(d, "EEEE", { locale: ptBR })}</p>
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            {lista.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => p.onAbrir(i.t)}
                onMouseEnter={(e) => p.onDica(i, e)}
                onMouseLeave={() => p.onDica(null)}
                className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-gray-50"
              >
                {p.mostrar.hora && <span className="w-28 shrink-0 text-xs tabular-nums text-gray-500">{horario(i, key)}</span>}
                {i.feita ? (
                  <Check className="size-3.5 shrink-0" style={{ color: i.cor }} />
                ) : (
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.cor }} />
                )}
                <span className={cn("min-w-0 truncate font-medium", i.feita ? "text-gray-400 line-through" : "text-gray-800")}>{i.t.titulo}</span>
                {p.mostrar.lista && i.rotulo && <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">· {i.rotulo}</span>}
                {p.mostrar.resp && <Avatares nomes={i.resp} max={3} className="ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
