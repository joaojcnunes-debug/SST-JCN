/**
 * Datas puras (`YYYY-MM-DD`) do módulo Escala.
 *
 * ⚠️ A ARMADILHA QUE ESTE ARQUIVO EXISTE PARA EVITAR: `new Date("2026-01-05")`
 * é parseado como **meia-noite UTC**. Em UTC-3, `.getDay()` devolve o dia
 * ANTERIOR — uma segunda-feira vira domingo, e o padrão semanal inteiro anda uma
 * casa. Todo parse aqui ancora ao MEIO-DIA local (`T12:00:00`), que sobrevive a
 * qualquer fuso entre UTC-11 e UTC+11.
 *
 * O mesmo vale na volta: nada aqui usa `toISOString()`, que reconverte para UTC.
 */

import type { DiaUtilSemana } from "./tipos";

const pad = (n: number) => String(n).padStart(2, "0");

/** Monta a data pura sem passar por fuso. `mes` é 1..12. */
export function dataPura(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/**
 * A data pura de HOJE no fuso do Rio (America/Sao_Paulo), onde quer que a
 * página rode. `sv-SE` devolve `YYYY-MM-DD` direto — sem `toISOString()`, que
 * reconverteria para UTC e, depois das 21h, já diria amanhã.
 */
export function hojeDataPura(agora: Date = new Date()): string {
  return agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/** Parse ancorado ao meio-dia local. Use SEMPRE isto, nunca `new Date(iso)`. */
export function paraDataLocal(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/** Dia da semana ISO: 1 = segunda … 7 = domingo. */
export function diaSemanaIso(iso: string): number {
  const d = paraDataLocal(iso).getDay(); // 0 = domingo
  return d === 0 ? 7 : d;
}

/** Segunda a sexta. Feriado NÃO é considerado aqui — isso é outra pergunta. */
export function ehDiaUtil(iso: string): boolean {
  return diaSemanaIso(iso) <= 5;
}

/** O dia útil (1..5) da data, ou null se for sábado/domingo. */
export function diaUtilDe(iso: string): DiaUtilSemana | null {
  const d = diaSemanaIso(iso);
  return d <= 5 ? (d as DiaUtilSemana) : null;
}

/** Quantos dias tem o mês. `mes` é 1..12; cobre fevereiro e ano bissexto. */
export function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/**
 * Primeiro e último dia do mês, como datas puras. É o intervalo que as consultas
 * de grade mensal usam (`data >= inicio and data <= fim`).
 */
export function intervaloDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  return {
    inicio: dataPura(ano, mes, 1),
    fim: dataPura(ano, mes, diasNoMes(ano, mes)),
  };
}

/** Todas as datas do mês, em ordem — inclusive fim de semana. */
export function diasDoMes(ano: number, mes: number): string[] {
  const total = diasNoMes(ano, mes);
  const out: string[] = [];
  for (let d = 1; d <= total; d++) out.push(dataPura(ano, mes, d));
  return out;
}

export const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "janeiro de 2026". `mes` é 1..12. */
export function rotuloMes(ano: number, mes: number): string {
  return `${MESES_PT[mes - 1]} de ${ano}`;
}
