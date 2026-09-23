/**
 * Dias úteis de UMA unidade, num mês — a régua da Escala de Supervisores
 * aplicada à Produtividade.
 *
 * Não inventa uma régua nova: reaproveita `diasUteisDoMes` de
 * `lib/escala/regras` (segunda a sexta, menos feriado ou ponto facultativo
 * nacional/estadual — o facultativo bloqueia igual a feriado, ver
 * `lib/escala/gerar.ts`) e acrescenta o que a regra da escala deixa de fora
 * de propósito: o feriado MUNICIPAL, que lá "alcança só parte da equipe" e
 * aqui alcança a unidade inteira, porque a unidade É o município.
 *
 * ⚠️ Em 16/09/2026 não existe feriado municipal cadastrado. A conta sai só
 * com nacional + estadual, e a tela tem que dizer isso — senão o número
 * parece mais preciso do que é.
 *
 * Server-safe: sem `"use client"`, sem banco. É o que permite o teste.
 */

import { diasUteisDoMes } from "@/lib/escala/regras";
import type { EscalaFeriado } from "@/lib/escala/tipos";

/**
 * Mesma comparação de `feriadoMunicipalEm` (gerar.ts): sem caixa e sem espaço
 * nas pontas, porque o município é digitado à mão nos dois lugares.
 */
function normalizarMunicipio(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Corta as datas em `ate` (inclusive). Sem `ate`, devolve tudo.
 *
 * É o que faz o mês EM CURSO contar só os dias úteis já vividos: sem isso o
 * número do mês corrente saía deflacionado — em 16/09/2026 setembro dividia
 * por 21 dias úteis com 11 decorridos (JCN Consultoria 0,28 em vez de ~0,5). Pedido
 * dele em 17/09. Hoje entra no divisor porque a visita de hoje já está no
 * numerador.
 */
function ateInclusive(datas: string[], ate?: string | null): string[] {
  return ate ? datas.filter((d) => d <= ate) : datas;
}

/**
 * Dias úteis gerais do mês (nacional + estadual, sem desconto municipal) — o
 * que vale para a JCN Consultoria inteira. É a régua da Escala, reexportada com o nome
 * que a Produtividade usa. `ate` corta em hoje (mês em curso).
 */
export function diasUteisDoMesGeral(
  ano: number,
  mes: number,
  feriados: EscalaFeriado[],
  ate?: string | null,
): string[] {
  return ateInclusive(diasUteisDoMes(ano, mes, feriados), ate);
}

export interface DiasUteisDaUnidade {
  /** As datas com expediente, em ordem. */
  datas: string[];
  /** Quantos feriados municipais do município foram descontados. */
  municipaisDescontados: number;
}

/**
 * Dias úteis da unidade: os gerais do mês, menos os feriados municipais do
 * município dela. Unidade sem município (config da escala vazia) fica só com
 * os gerais — não há como saber o que descontar. Com `ate`, o corte vem ANTES
 * do desconto: feriado municipal que ainda vai acontecer não conta como
 * descontado.
 */
export function diasUteisDaUnidade(
  ano: number,
  mes: number,
  feriados: EscalaFeriado[],
  municipio: string | null | undefined,
  ate?: string | null,
): DiasUteisDaUnidade {
  const gerais = diasUteisDoMesGeral(ano, mes, feriados, ate);
  const alvo = municipio ? normalizarMunicipio(municipio) : null;
  if (!alvo) return { datas: gerais, municipaisDescontados: 0 };

  const municipais = new Set(
    feriados
      .filter(
        (f) =>
          f.abrangencia === "municipal" &&
          !!f.municipio &&
          normalizarMunicipio(f.municipio) === alvo,
      )
      .map((f) => f.data),
  );
  const datas = gerais.filter((d) => !municipais.has(d));
  return { datas, municipaisDescontados: gerais.length - datas.length };
}

/** Há algum feriado municipal cadastrado (em qualquer município)? */
export function temFeriadoMunicipalCadastrado(feriados: EscalaFeriado[]): boolean {
  return feriados.some((f) => f.abrangencia === "municipal");
}
