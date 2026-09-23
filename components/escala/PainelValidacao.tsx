"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Loader2,
  Settings,
  ShieldQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEscalaRegras, useEscalaSupervisores, useUnidadesDaEscala } from "@/lib/hooks/useEscalaCadastro";
import { useEscalaFeriados } from "@/lib/hooks/useEscalaFeriados";
import { useEscalaDias } from "@/lib/hooks/useEscalaDias";
import { useEscalaStore } from "@/lib/escala/store";
import { avaliarRegras, diasUteisDoMes, type SituacaoRegra } from "@/lib/escala/regras";
import { rotuloMes } from "@/lib/escala/datas";

/**
 * Conferência do mês (Fase 6) — o "OK / REVISAR" que na planilha morava
 * embaixo do padrão semanal.
 *
 * DUAS DIFERENÇAS em relação à planilha, e as duas são de propósito:
 *
 * 1. **Confere o MÊS, não o padrão.** A planilha só sabia olhar o padrão, que
 *    não conhece feriado nem exceção. Aqui a régua passa pelos dias que
 *    realmente existem — que é onde os problemas aparecem.
 * 2. **"Dia útil" desconta feriado.** Janeiro tem 22 dias de semana e 21 com
 *    expediente. Contar o feriado faria toda regra acusar falta num dia em que
 *    ninguém trabalhou, e um painel que grita à toa é um painel que se aprende
 *    a ignorar.
 */

const VISUAL: Record<
  SituacaoRegra,
  { rotulo: string; icone: typeof CheckCircle2; caixa: string; texto: string }
> = {
  ok: {
    rotulo: "OK",
    icone: CheckCircle2,
    caixa: "border-emerald-200 bg-emerald-50",
    texto: "text-emerald-700",
  },
  revisar: {
    rotulo: "REVISAR",
    icone: AlertTriangle,
    caixa: "border-amber-200 bg-amber-50",
    texto: "text-amber-800",
  },
  nao_configurada: {
    rotulo: "NÃO CONFIGURADA",
    icone: Settings,
    caixa: "border-gray-200 bg-gray-50",
    texto: "text-gray-600",
  },
  desconhecida: {
    rotulo: "NÃO AVALIADA",
    icone: CircleHelp,
    caixa: "border-gray-200 bg-gray-50",
    texto: "text-gray-600",
  },
};

export default function PainelValidacao() {
  const ano = useEscalaStore((s) => s.ano);
  const mes = useEscalaStore((s) => s.mes);
  const mesAnterior = useEscalaStore((s) => s.mesAnterior);
  const proximoMes = useEscalaStore((s) => s.proximoMes);
  const irParaHoje = useEscalaStore((s) => s.irParaHoje);

  const { data: supervisores = [] } = useEscalaSupervisores(true);
  const { data: unidades = [] } = useUnidadesDaEscala(true);
  const { data: feriados = [] } = useEscalaFeriados(ano);
  const { data: regras = [], isLoading: carRegras } = useEscalaRegras();
  const { data: dias = [], isLoading: carDias } = useEscalaDias(ano, mes);

  const resultados = useMemo(
    () => avaliarRegras({ ano, mes, supervisores, dias, feriados, unidades, regras }),
    [ano, mes, supervisores, dias, feriados, unidades, regras]
  );

  const uteis = useMemo(() => diasUteisDoMes(ano, mes, feriados), [ano, mes, feriados]);
  const aRevisar = resultados.filter((r) => r.situacao === "revisar").length;
  const inativas = regras.filter((r) => !r.ativa).length;

  if (carRegras || carDias) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" />
        Conferindo o mês...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={mesAnterior}
            className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[10rem] text-center text-lg font-bold text-gray-900 first-letter:uppercase">
            {rotuloMes(ano, mes)}
          </span>
          <button
            type="button"
            onClick={proximoMes}
            className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={irParaHoje}
            className="ml-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Hoje
          </button>
        </div>

        <span className="text-xs text-gray-500">
          <strong className="tabular-nums text-gray-900">{uteis.length}</strong> dias com
          expediente neste mês
        </span>
      </div>

      {/* ── Veredito de uma linha ────────────────────────── */}
      {resultados.length > 0 && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border p-3 text-sm",
            aRevisar > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          )}
        >
          {aRevisar > 0 ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          )}
          <span>
            {aRevisar > 0 ? (
              <>
                <strong>
                  {aRevisar === 1 ? "1 regra pede revisão" : `${aRevisar} regras pedem revisão`}
                </strong>{" "}
                em {rotuloMes(ano, mes)}.
              </>
            ) : (
              <>
                <strong>Nenhuma regra ativa foi violada</strong> em {rotuloMes(ano, mes)}.
              </>
            )}
          </span>
        </div>
      )}

      {/* ── Uma caixa por regra ──────────────────────────── */}
      {resultados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <ShieldQuestion className="mx-auto mb-2 size-7 text-gray-300" />
          <p className="font-medium text-gray-700">Nenhuma regra ativa</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            Sem regra ligada, esta tela não tem o que conferir — e não achar nada não é o
            mesmo que estar tudo certo. As regras ficam na aba Regras da{" "}
            <Link href="/escala/configuracao" className="font-medium text-[#0E7490] underline">
              Configuração
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {resultados.map((r) => {
            const v = VISUAL[r.situacao];
            const Icone = v.icone;
            return (
              <div key={r.id_regra} className={cn("rounded-lg border p-3", v.caixa)}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Icone className={cn("mt-0.5 size-4 shrink-0", v.texto)} />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{r.descricao}</p>
                      <p className="mt-0.5 text-sm text-gray-600">{r.resumo}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full bg-white/70 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide",
                      v.texto
                    )}
                  >
                    {v.rotulo}
                  </span>
                </div>

                {r.ocorrencias.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 pl-6">
                    {r.ocorrencias.map((o) => (
                      <span
                        key={o}
                        className="rounded border border-white/80 bg-white/70 px-1.5 py-0.5 font-mono text-[11px] text-gray-700"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {inativas > 0 && (
        <p className="text-xs text-gray-500">
          {inativas === 1 ? "1 regra está desligada" : `${inativas} regras estão desligadas`} e não
          entra{inativas === 1 ? "" : "m"} nesta conferência.
        </p>
      )}
    </div>
  );
}
