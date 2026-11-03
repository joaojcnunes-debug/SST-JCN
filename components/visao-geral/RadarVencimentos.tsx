"use client";

// Radar de vencimentos (Etapa 5 do docs/plano-skin-viva-jcn.md): anéis por urgência — vencidos no
// centro, depois "até 30 dias" e "até 60 dias". Cada documento é um ponto na cor da urgência;
// passar o mouse mostra o quê e de quem, clicar abre. Os vencidos pulsam (parado com "reduzir
// movimento"). Ao lado, o contador de riscos altos (que não têm data e por isso não entram aqui).

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { VencimentoItem } from "@/lib/hooks/useVencimentos";
import { useRiscosAltos } from "@/lib/hooks/useRiscosAltos";

const TAM = 220;
const C = TAM / 2;
// Faixas de raio (px): vencido no miolo, depois 30 e 60 dias.
const FAIXA = { vencido: [10, 38], ate30: [44, 72], ate60: [78, 104] } as const;
const COR = { vencido: "#ef4444", ate30: "#f59e0b", ate60: "#eab308" } as const;
const ANGULO_DOURADO = 2.399963; // espalha os pontos sem empilhar

type Faixa = keyof typeof FAIXA;

function faixaDe(dias: number): Faixa | null {
  if (dias < 0) return "vencido";
  if (dias <= 30) return "ate30";
  if (dias <= 60) return "ate60";
  return null;
}

function texto(v: VencimentoItem): string {
  const quando = v.dias < 0 ? `vencido há ${Math.abs(v.dias)} dia(s)` : v.dias === 0 ? "vence hoje" : `vence em ${v.dias} dia(s)`;
  return `${v.tipo} — ${v.empresaNome ?? "Sem empresa"} · ${quando}`;
}

export default function RadarVencimentos({ vencidos, vencendo }: { vencidos: VencimentoItem[]; vencendo: VencimentoItem[] }) {
  const { data: riscosAltos, isLoading: carregandoRiscos } = useRiscosAltos();
  const contagem: Record<Faixa, number> = { vencido: 0, ate30: 0, ate60: 0 };
  const pontos = [...vencidos, ...vencendo]
    .map((v) => ({ v, f: faixaDe(v.dias) }))
    .filter((p): p is { v: VencimentoItem; f: Faixa } => p.f !== null)
    .map(({ v, f }) => {
      const i = contagem[f]++;
      const [r0, r1] = FAIXA[f];
      // Dentro da faixa: o mais urgente mais perto do centro.
      const frac = f === "vencido" ? Math.max(0, 1 - Math.min(Math.abs(v.dias), 60) / 60) : f === "ate30" ? v.dias / 30 : (v.dias - 30) / 30;
      const r = f === "vencido" ? r1 - frac * (r1 - r0) : r0 + frac * (r1 - r0);
      const a = i * ANGULO_DOURADO;
      return { v, f, x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
    });

  return (
    <section className="reveal-up rounded-2xl border border-gray-200 bg-white p-5 shadow-sm print:hidden">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Radar de vencimentos</p>
      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
        <svg viewBox={`0 0 ${TAM} ${TAM}`} className="size-[200px] shrink-0" role="img" aria-label="Radar de vencimentos por urgência">
          {[FAIXA.ate60[1], FAIXA.ate30[1], FAIXA.vencido[1]].map((r) => (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeDasharray="3 4" />
          ))}
          <circle cx={C} cy={C} r={FAIXA.vencido[1]} fill="#ef4444" opacity="0.06" />
          {pontos.map(({ v, f, x, y }, i) => (
            <Link key={`${v.href}-${i}`} href={v.href}>
              <circle cx={x} cy={y} r={5} fill={COR[f]} className={f === "vencido" ? "radar-pulsa" : undefined}>
                <title>{texto(v)}</title>
              </circle>
            </Link>
          ))}
          {pontos.length === 0 && (
            <text x={C} y={C + 4} textAnchor="middle" className="fill-gray-400 text-[11px]">
              Nada a vencer
            </text>
          )}
        </svg>
        <div className="w-full space-y-1.5 text-xs">
          <Legenda cor={COR.vencido} rotulo="Vencidos (centro)" n={contagem.vencido} />
          <Legenda cor={COR.ate30} rotulo="Vencem em até 30 dias" n={contagem.ate30} />
          <Legenda cor={COR.ate60} rotulo="Vencem em 31 a 60 dias" n={contagem.ate60} />
          <Link
            href="/inspecoes"
            className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-700 transition-colors hover:bg-red-100"
            title="Riscos com nível Alto ou Muito Alto nas inspeções"
          >
            <AlertTriangle className="size-4 shrink-0" />
            <span className="flex-1">Riscos altos</span>
            <span className="text-base font-bold tabular-nums">{carregandoRiscos ? "…" : riscosAltos ?? 0}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Legenda({ cor, rotulo, n }: { cor: string; rotulo: string; n: number }) {
  return (
    <p className="flex items-center gap-2 text-gray-600">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
      <span className="flex-1">{rotulo}</span>
      <span className="font-semibold tabular-nums text-gray-900">{n}</span>
    </p>
  );
}
