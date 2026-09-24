"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { BalaoGrafico } from "@/components/ui/BalaoGrafico";
import { usePresencaUsoMensal } from "@/lib/hooks/usePresenca";
import { diaLocal, formatarMinutos, horaLocal } from "@/lib/presenca/regras";
import {
  diaCurto,
  horasDecimais,
  mesAnterior,
  mesSeguinte,
  rotuloMes,
  seriePorDia,
  seriePorSemana,
  totaisDoMes,
  type PontoDia,
  type PontoSemana,
} from "@/lib/presenca/relatorio";
import { cn } from "@/lib/utils";

/**
 * Relatório de uso mensal (v219): horas ativas no painel por dia ou por semana,
 * da equipe inteira ou de uma pessoa. Uma série, um tom — o verde da casa, o
 * mesmo do "Inspeções por mês" do Início. Fim de semana em tom claro (o rótulo
 * do eixo já diz o dia; a cor só reforça). Dia futuro não ganha barra.
 */

const COR = "#0284c7";
const COR_FIM_DE_SEMANA = "#9ED9C0";

type Modo = "dia" | "semana";

function mesAtualRJ(): string {
  return diaLocal(new Date()).slice(0, 7);
}

function diaExtenso(dia: string): string {
  return new Date(`${dia}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default function RelatorioUso({
  email,
  nome,
  onVerEquipe,
}: {
  /** null = toda a equipe. */
  email: string | null;
  nome: string | null;
  onVerEquipe: () => void;
}) {
  const [mes, setMes] = useState(mesAtualRJ);
  const [modo, setModo] = useState<Modo>("dia");
  const { data, isLoading, error } = usePresencaUsoMensal(mes, email);

  const hoje = diaLocal(new Date());
  const pontos = useMemo(() => seriePorDia(mes, data ?? [], hoje), [mes, data, hoje]);
  const semanas = useMemo(() => seriePorSemana(pontos), [pontos]);
  const totais = useMemo(() => totaisDoMes(pontos), [pontos]);
  const mesCorrente = mes >= mesAtualRJ();
  const equipe = email === null;

  // Memoizados: array novo a cada render faz o recharts reanimar as barras do
  // zero a cada passada do mouse (o balão re-renderiza o componente).
  const dadosDia = useMemo(() => pontos.map((p) => ({ ...p, horas: p.futuro ? null : horasDecimais(p.minutos) })), [pontos]);
  const dadosSemana = useMemo(() => semanas.map((s) => ({ ...s, horas: horasDecimais(s.minutos) })), [semanas]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Relatório de uso</h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMes(mesAnterior(mes))}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[120px] text-center text-sm font-medium text-gray-800">{rotuloMes(mes)}</span>
          <button
            type="button"
            onClick={() => setMes(mesSeguinte(mes))}
            disabled={mesCorrente}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Mês seguinte"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-gray-200 p-0.5 text-xs">
          {(["dia", "semana"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition-colors",
                modo === m ? "bg-verde-primary/10 text-verde-primary" : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {m === "dia" ? "Por dia" : "Por semana"}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <span>
            Pessoa:{" "}
            <strong className="font-semibold text-gray-800">{equipe ? "Toda a equipe" : nome ?? email}</strong>
          </span>
          {!equipe && (
            <button type="button" onClick={onVerEquipe} className="font-medium text-verde-primary hover:underline">
              ver equipe
            </button>
          )}
        </div>
      </header>

      {error ? (
        <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Não deu para ler o relatório. {error.message}
        </div>
      ) : (
        <>
          <div className="relative h-[220px] px-2 pt-3">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-sm text-gray-400">
                <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              {modo === "dia" ? (
                <BarChart key="dia" data={dadosDia} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                  <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                    tickFormatter={(v: number) => `${v}h`}
                    allowDecimals={false}
                  />
                  <Tooltip cursor={{ fill: "var(--surface-3)" }} content={<BalaoDia equipe={equipe} />} />
                  {/* Sem animação: cada re-render da página (relógio de 30 s, reconsulta)
                      recria as Cells e o recharts reanimava do zero — a barra vivia "curta". */}
                  <Bar dataKey="horas" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                    {dadosDia.map((p) => (
                      <Cell key={p.dia} fill={p.fimDeSemana ? COR_FIM_DE_SEMANA : COR} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart key="semana" data={dadosSemana} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                    tickFormatter={(v: number) => `${v}h`}
                    allowDecimals={false}
                  />
                  <Tooltip cursor={{ fill: "var(--surface-3)" }} content={<BalaoSemana equipe={equipe} />} />
                  <Bar dataKey="horas" fill={COR} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
            <span>
              Total do mês <strong className="font-semibold text-gray-900">{formatarMinutos(totais.totalMinutos)}</strong>
            </span>
            <span>
              <strong className="font-semibold text-gray-900">{totais.diasComUso}</strong>{" "}
              {totais.diasComUso === 1 ? "dia" : "dias"} com uso
            </span>
            {totais.diasComUso > 0 && (
              <span>
                Média por dia com uso{" "}
                <strong className="font-semibold text-gray-900">{formatarMinutos(totais.mediaPorDiaComUso)}</strong>
              </span>
            )}
            {totais.pico && (
              <span>
                Pico {diaCurto(totais.pico.dia)}{" "}
                <strong className="font-semibold text-gray-900">{formatarMinutos(totais.pico.minutos)}</strong>
                {equipe && ` · ${totais.pico.pessoas} ${totais.pico.pessoas === 1 ? "pessoa" : "pessoas"}`}
              </span>
            )}
            {modo === "dia" && (
              <span className="ml-auto inline-flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-sm" style={{ background: COR_FIM_DE_SEMANA }} />
                fim de semana
              </span>
            )}
          </footer>
        </>
      )}
    </section>
  );
}

function Linha({ texto, valor }: { texto: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span style={{ color: "var(--text-muted)" }}>{texto}</span>
      <span className="font-semibold" style={{ color: "var(--text-strong)" }}>
        {valor}
      </span>
    </div>
  );
}

function BalaoDia({ active, payload, equipe }: { active?: boolean; payload?: { payload?: PontoDia }[]; equipe: boolean }) {
  const p = active ? payload?.[0]?.payload : undefined;
  // O gráfico troca de modo no mesmo lugar do JSX: sem a checagem, o balão de
  // um modo pode receber a linha do outro e derrubar a página inteira.
  if (!p || typeof p.dia !== "string" || p.futuro) return null;
  return (
    <BalaoGrafico titulo={diaExtenso(p.dia)}>
      <Linha texto="Ativo no painel" valor={p.minutos > 0 ? formatarMinutos(p.minutos) : "sem uso"} />
      {equipe ? (
        <Linha texto="Pessoas" valor={String(p.pessoas)} />
      ) : (
        p.entrou && <Linha texto="Entrou → parou" valor={`${horaLocal(p.entrou)} → ${horaLocal(p.saiu)}`} />
      )}
    </BalaoGrafico>
  );
}

function BalaoSemana({ active, payload, equipe }: { active?: boolean; payload?: { payload?: PontoSemana }[]; equipe: boolean }) {
  const s = active ? payload?.[0]?.payload : undefined;
  if (!s || typeof s.de !== "string") return null;
  return (
    <BalaoGrafico titulo={`${s.rotulo} · ${diaCurto(s.de)} – ${diaCurto(s.ate)}`}>
      <Linha texto="Ativo no painel" valor={formatarMinutos(s.minutos)} />
      <Linha texto="Dias com uso" valor={String(s.diasComUso)} />
      {equipe && <Linha texto="Pessoas (máx. no dia)" valor={String(s.pessoasMax)} />}
    </BalaoGrafico>
  );
}
