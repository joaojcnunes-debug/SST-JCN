/**
 * Relatório de uso mensal da Presença (v219) — o que a tela desenha a partir de
 * `presenca_uso_mensal()`: uma barra por dia (todos os dias do mês, zero onde
 * ninguém entrou) ou por semana (segunda a domingo, cortada no mês), e os
 * totais do rodapé. Tudo em dia civil do RJ, que é como o banco agrega.
 */

export interface UsoDiaRow {
  dia: string; // YYYY-MM-DD
  minutos: number;
  pessoas: number;
  entrou_em: string | null;
  saiu_em: string | null;
}

export interface PontoDia {
  dia: string;
  /** "1", "2", … — o que vai no eixo. */
  rotulo: string;
  minutos: number;
  pessoas: number;
  fimDeSemana: boolean;
  /** Dia ainda não chegou (mês corrente): barra não é desenhada. */
  futuro: boolean;
  entrou: string | null;
  saiu: string | null;
}

export interface PontoSemana {
  /** "S1", "S2", … */
  rotulo: string;
  de: string;
  ate: string;
  minutos: number;
  diasComUso: number;
  pessoasMax: number;
}

export interface TotaisMes {
  totalMinutos: number;
  diasComUso: number;
  mediaPorDiaComUso: number;
  pico: { dia: string; minutos: number; pessoas: number } | null;
}

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function partes(mes: string): { ano: number; m: number } {
  const [a, b] = mes.split("-");
  return { ano: Number(a), m: Number(b) };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-09" → "Setembro 2026". */
export function rotuloMes(mes: string): string {
  const { ano, m } = partes(mes);
  return `${NOMES_MES[m - 1] ?? mes} ${ano}`;
}

export function mesAnterior(mes: string): string {
  const { ano, m } = partes(mes);
  return m === 1 ? `${ano - 1}-12` : `${ano}-${pad2(m - 1)}`;
}

export function mesSeguinte(mes: string): string {
  const { ano, m } = partes(mes);
  return m === 12 ? `${ano + 1}-01` : `${ano}-${pad2(m + 1)}`;
}

/** Quantos dias tem o mês. */
export function diasNoMes(mes: string): number {
  const { ano, m } = partes(mes);
  return new Date(Date.UTC(ano, m, 0)).getUTCDate();
}

/** 0 = domingo … 6 = sábado, do dia civil, sem depender do fuso da máquina. */
export function diaDaSemana(dia: string): number {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** "2026-09-05" → "05/09". */
export function diaCurto(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/**
 * Todos os dias do mês, com o dado do banco onde houver. `hoje` (YYYY-MM-DD, RJ)
 * decide o que é futuro.
 */
export function seriePorDia(mes: string, rows: UsoDiaRow[], hoje: string): PontoDia[] {
  const porDia = new Map(rows.map((r) => [r.dia, r]));
  const n = diasNoMes(mes);
  const pontos: PontoDia[] = [];
  for (let d = 1; d <= n; d++) {
    const dia = `${mes}-${pad2(d)}`;
    const r = porDia.get(dia);
    const dow = diaDaSemana(dia);
    pontos.push({
      dia,
      rotulo: String(d),
      minutos: r?.minutos ?? 0,
      pessoas: r?.pessoas ?? 0,
      fimDeSemana: dow === 0 || dow === 6,
      futuro: dia > hoje,
      entrou: r?.entrou_em ?? null,
      saiu: r?.saiu_em ?? null,
    });
  }
  return pontos;
}

/**
 * Semanas de segunda a domingo, cortadas nas bordas do mês. A primeira semana
 * pode começar num dia que não é segunda (o dia 1), e a última terminar antes
 * do domingo.
 */
export function seriePorSemana(pontos: PontoDia[]): PontoSemana[] {
  const semanas: PontoSemana[] = [];
  let atual: PontoSemana | null = null;
  for (const p of pontos) {
    const dow = diaDaSemana(p.dia);
    if (!atual || dow === 1) {
      atual = { rotulo: `S${semanas.length + 1}`, de: p.dia, ate: p.dia, minutos: 0, diasComUso: 0, pessoasMax: 0 };
      semanas.push(atual);
    }
    atual.ate = p.dia;
    atual.minutos += p.minutos;
    if (p.minutos > 0) atual.diasComUso++;
    atual.pessoasMax = Math.max(atual.pessoasMax, p.pessoas);
  }
  return semanas;
}

export function totaisDoMes(pontos: PontoDia[]): TotaisMes {
  let totalMinutos = 0;
  let diasComUso = 0;
  let pico: TotaisMes["pico"] = null;
  for (const p of pontos) {
    totalMinutos += p.minutos;
    if (p.minutos > 0) diasComUso++;
    if (p.minutos > 0 && (!pico || p.minutos > pico.minutos)) {
      pico = { dia: p.dia, minutos: p.minutos, pessoas: p.pessoas };
    }
  }
  return {
    totalMinutos,
    diasComUso,
    mediaPorDiaComUso: diasComUso ? Math.round(totalMinutos / diasComUso) : 0,
    pico,
  };
}

/** Minutos → horas decimais para o eixo (2 casas evitam barra "0" para 20 min). */
export function horasDecimais(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}
