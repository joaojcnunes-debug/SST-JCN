/**
 * Exportação dos relatórios da escala em XLSX (Fase 7).
 *
 * Espelha a aba "Resumo Anual" da planilha, em três abas:
 *   1. Por unidade — a matriz unidade × supervisor
 *   2. Por mês — dias com escala definida em cada mês
 *   3. Por situação — home office, folga, férias… o que a matriz não mostra
 *
 * Números saem como NÚMERO, não como texto: a pessoa vai somar, filtrar e
 * fazer gráfico em cima disso, e célula numérica em texto quebra tudo isso em
 * silêncio. Foi a lição da exportação do inventário.
 *
 * Diferente do inventário, aqui NÃO se esconde coluna vazia: um supervisor com
 * zero dias numa unidade é informação — é justamente o que se quer enxergar.
 * Esconder a coluna faria a matriz mentir sobre quem está na equipe.
 */

import * as XLSX from "xlsx";
import { rotuloSupervisor, type Matriz } from "./relatorios";
import type { EscalaSupervisor, SituacaoEscala } from "./tipos";

type Celula = string | number;

function matrizParaLinhas(
  matriz: Matriz,
  supervisores: EscalaSupervisor[],
  tituloDaPrimeiraColuna: string
): Celula[][] {
  const cabecalho: Celula[] = [
    tituloDaPrimeiraColuna,
    ...supervisores.map(rotuloSupervisor),
    "Total",
  ];

  const corpo = matriz.linhas.map((l): Celula[] => [
    l.rotulo,
    ...supervisores.map((s) => l.porSupervisor[s.id_supervisor] ?? 0),
    l.total,
  ]);

  const rodape: Celula[] = [
    "Total geral",
    ...supervisores.map((s) => matriz.totalPorSupervisor[s.id_supervisor] ?? 0),
    matriz.totalGeral,
  ];

  return [cabecalho, ...corpo, rodape];
}

function larguras(supervisores: EscalaSupervisor[], primeira = 22) {
  return [
    { wch: primeira },
    ...supervisores.map((s) => ({ wch: Math.max(12, rotuloSupervisor(s).length + 2) })),
    { wch: 10 },
  ];
}

export interface EntradaXlsx {
  periodo: string;
  supervisores: EscalaSupervisor[];
  unidades: Matriz;
  meses: Matriz;
  situacoes: { situacao: SituacaoEscala; dias: number }[];
}

export function montarXlsxDaEscala(e: EntradaXlsx): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // ── 1. Por unidade ────────────────────────────────────────────────────────
  const porUnidade = [
    [`ESCALA DE SUPERVISORES — DIAS POR UNIDADE — ${e.periodo}`],
    ["Um dia em mais de uma unidade conta em cada uma delas."],
    [],
    ...matrizParaLinhas(e.unidades, e.supervisores, "Unidade"),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(porUnidade);
  ws1["!cols"] = larguras(e.supervisores);
  XLSX.utils.book_append_sheet(wb, ws1, "Por unidade");

  // ── 2. Por mês ────────────────────────────────────────────────────────────
  const porMes = [
    [`ESCALA DE SUPERVISORES — DIAS COM ESCALA DEFINIDA — ${e.periodo}`],
    ["Conta o dia uma vez, com unidade ou situação — menos o feriado, que a planilha também não contava."],
    [],
    ...matrizParaLinhas(e.meses, e.supervisores, "Mês"),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(porMes);
  ws2["!cols"] = larguras(e.supervisores, 14);
  XLSX.utils.book_append_sheet(wb, ws2, "Por mês");

  // ── 3. Por situação ───────────────────────────────────────────────────────
  const porSituacao: Celula[][] = [
    [`DIAS FORA DE UNIDADE — ${e.periodo}`],
    [],
    ["Situação", "Dias"],
    ...e.situacoes.map((s): Celula[] => [s.situacao, s.dias]),
  ];
  if (e.situacoes.length === 0) porSituacao.push(["Nenhum dia fora de unidade no período", 0]);
  const ws3 = XLSX.utils.aoa_to_sheet(porSituacao);
  ws3["!cols"] = [{ wch: 22 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Por situação");

  return wb;
}

/** Dispara o download no navegador. */
export function baixarXlsxDaEscala(e: EntradaXlsx) {
  const wb = montarXlsxDaEscala(e);
  const nome = `escala-supervisores-${e.periodo.replace(/[^\w-]+/g, "-").toLowerCase()}.xlsx`;
  XLSX.writeFile(wb, nome);
}
