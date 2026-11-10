"use client";

import type React from "react";
import { Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import { PRIORIDADES, type GestaoTarefa } from "@/lib/hooks/useGestao";
import { COR_SITUACAO, ROTULO_SITUACAO, type Intervalo, type Situacao } from "@/lib/gestao/calendario";
import { cn } from "@/lib/utils";

/** Uma tarefa já pronta para o calendário: intervalo, cor e o que a tela mostra. */
export interface ItemCal {
  id: string;
  t: GestaoTarefa;
  iv: Intervalo;
  cor: string;
  feita: boolean;
  situacao: Situacao;
  editavel: boolean;
  rotulo?: string;
  resp: string[];
  statusNome?: string;
}

export interface Mostrar {
  resp: boolean;
  hora: boolean;
  lista: boolean;
}

/** O que as visões (Mês, Semana/Dia, Agenda) recebem da principal. */
export interface PropsVisao {
  itens: ItemCal[];
  mostrar: Mostrar;
  hoje: string;
  onAbrir: (t: GestaoTarefa) => void;
  onDica: (i: ItemCal | null, e?: React.MouseEvent) => void;
  arrastando: ItemCal | null;
  setArrastando: (i: ItemCal | null) => void;
  onSoltar: (dia: string, hora?: string) => void;
  onCriar?: (dia: string, hora?: string) => void;
}

/** Fundo claro na cor da tarefa (a cor vem em #rrggbb). */
export const fundo = (cor: string) => (/^#[0-9a-f]{6}$/i.test(cor) ? `${cor}26` : "rgba(148,163,184,0.15)");

export function Avatares({ nomes, max = 2, className }: { nomes: string[]; max?: number; className?: string }) {
  if (!nomes.length) return null;
  const extra = nomes.length - max;
  return (
    <span className={cn("flex shrink-0 items-center -space-x-1", className)}>
      {nomes.slice(0, max).map((n) => (
        <AvatarPessoa key={n} nome={n} className="size-4 text-[8px] ring-1 ring-white" ariaLabel={n} />
      ))}
      {extra > 0 && <span className="pl-1.5 text-[9px] font-medium text-gray-500">+{extra}</span>}
    </span>
  );
}

/** Eventos de arrastar comuns (o Firefox só arrasta com dataTransfer preenchido). */
export function propsArrastar(i: ItemCal, p: Pick<PropsVisao, "setArrastando" | "onDica">) {
  if (!i.editavel) return { draggable: false };
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", i.id);
      e.dataTransfer.effectAllowed = "move";
      p.onDica(null);
      p.setArrastando(i);
    },
    onDragEnd: () => p.setArrastando(null),
  };
}

/** A tarefa de um dia só (Mês) ou de dia inteiro (topo da Semana/Dia): bolinha ou ✓, hora, título. */
export function ChipTarefa({ i, p, className, style }: { i: ItemCal; p: PropsVisao; className?: string; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      {...propsArrastar(i, p)}
      onClick={(e) => { e.stopPropagation(); p.onAbrir(i.t); }}
      onMouseEnter={(e) => p.onDica(i, e)}
      onMouseLeave={() => p.onDica(null)}
      aria-label={i.t.titulo}
      style={style}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-gray-100",
        p.arrastando?.id === i.id && "opacity-40",
        i.feita ? "text-gray-400" : "text-gray-700",
        className,
      )}
    >
      {i.feita ? (
        <Check className="size-3 shrink-0" style={{ color: i.cor }} />
      ) : (
        <span className="size-2 shrink-0 rounded-full" style={{ background: i.cor }} />
      )}
      {p.mostrar.hora && i.iv.horaIni && <span className="shrink-0 tabular-nums text-gray-500">{i.iv.horaIni}</span>}
      {i.t.id_tarefa_pai && <span className="shrink-0 text-gray-400" title="Subtarefa">↳</span>}
      <span className={cn("min-w-0 flex-1 truncate", i.feita && "line-through")}>{i.t.titulo}</span>
      {p.mostrar.resp && <Avatares nomes={i.resp} max={1} />}
    </button>
  );
}

/** Barra de vários dias (Mês e topo da Semana/Dia), posicionada pela grade de quem usa. */
export function BarraTarefa({ i, p, cortadaIni, cortadaFim, style }: { i: ItemCal; p: PropsVisao; cortadaIni: boolean; cortadaFim: boolean; style: React.CSSProperties }) {
  return (
    <button
      type="button"
      {...propsArrastar(i, p)}
      onClick={(e) => { e.stopPropagation(); p.onAbrir(i.t); }}
      onMouseEnter={(e) => p.onDica(i, e)}
      onMouseLeave={() => p.onDica(null)}
      aria-label={i.t.titulo}
      style={{ ...style, background: fundo(i.cor), borderLeft: cortadaIni ? undefined : `3px solid ${i.cor}` }}
      className={cn(
        "z-[1] mx-0.5 flex min-w-0 items-center gap-1 overflow-hidden px-1.5 text-left text-[11px] font-medium text-gray-800 hover:brightness-95",
        cortadaIni ? "rounded-l-none" : "rounded-l",
        cortadaFim ? "rounded-r-none" : "rounded-r",
        p.arrastando?.id === i.id && "opacity-40",
        i.feita && "text-gray-400",
      )}
    >
      {i.feita && <Check className="size-3 shrink-0" style={{ color: i.cor }} />}
      {p.mostrar.hora && i.iv.horaIni && !cortadaIni && <span className="shrink-0 tabular-nums text-gray-500">{i.iv.horaIni}</span>}
      {i.t.id_tarefa_pai && <span className="shrink-0 text-gray-400" title="Subtarefa">↳</span>}
      <span className={cn("min-w-0 flex-1 truncate", i.feita && "line-through")}>{i.t.titulo}</span>
      {p.mostrar.resp && <Avatares nomes={i.resp} />}
    </button>
  );
}

const dataBr = (d: string, h: string | null) => `${format(parseISO(d), "dd/MM/yyyy")}${h ? ` ${h}` : ""}`;

/** A dica ao passar o mouse (como no Runrun): situação, datas, responsáveis, prioridade. */
export function DicaTarefa({ i, x, y }: { i: ItemCal; x: number; y: number }) {
  const largura = 288;
  const left = typeof window !== "undefined" ? Math.min(x + 14, window.innerWidth - largura - 8) : x;
  const top = typeof window !== "undefined" ? Math.min(y + 14, window.innerHeight - 200) : y;
  const prio = PRIORIDADES.find((p) => p.value === i.t.prioridade);
  const linha = (rotulo: string, valor: React.ReactNode) => (
    <p className="flex gap-1.5"><span className="shrink-0 font-semibold text-gray-700">{rotulo}:</span><span className="min-w-0 text-gray-600">{valor}</span></p>
  );
  return (
    <div role="tooltip" className="pointer-events-none fixed z-[70] space-y-0.5 rounded-lg border border-gray-200 bg-white p-2.5 text-xs shadow-lg" style={{ left, top, width: largura }}>
      <p className="mb-1 text-sm font-semibold leading-snug text-gray-900">{i.t.titulo}</p>
      {i.t.id_tarefa_pai && i.t.titulo_mae && linha("Subtarefa de", i.t.titulo_mae)}
      {i.rotulo && linha("Lista", i.rotulo)}
      {linha("Situação", <span style={{ color: COR_SITUACAO[i.situacao] }} className="font-medium">{ROTULO_SITUACAO[i.situacao]}</span>)}
      {i.statusNome && linha("Status", i.statusNome)}
      {i.iv.inicio !== i.iv.fim || i.iv.horaIni ? linha("Início", dataBr(i.iv.inicio, i.iv.horaIni)) : null}
      {linha("Prazo", dataBr(i.iv.fim, i.iv.horaFim))}
      {linha("Responsáveis", i.resp.length ? i.resp.join(", ") : "—")}
      {prio && linha("Prioridade", <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: prio.cor }} />{prio.label}</span>)}
    </div>
  );
}
