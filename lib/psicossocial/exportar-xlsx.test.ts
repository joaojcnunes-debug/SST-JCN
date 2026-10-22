import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { montarXlsxAepPsicossocial, montarXlsxRiscosPsicossociais, type AvaliacaoAepXlsx } from "./exportar-xlsx";
import type { AvaliacaoRisco } from "@/lib/riscos-psicossociais/carregar";

function linhas(wb: XLSX.WorkBook, aba: string): unknown[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: "" });
}

const riscos: AvaliacaoRisco[] = [
  {
    fonte: "DRPS",
    id: "DRPS-1",
    titulo: "DRPS 2026",
    status: "CONCLUIDO",
    data: "2026-09-15",
    responsavel: "Ana",
    setores: [
      {
        setor: "Produção",
        respondentes: 12,
        fatores: [
          { nome: "Sobrecarga", fonteGeradora: "Metas", nivel: "Alto" },
          { nome: "Assédio", fonteGeradora: null, nivel: "Baixo" },
        ],
        agravos: ["Ansiedade", "Burnout"],
        medidas: [],
        contagem: { Baixo: 1, Médio: 0, Alto: 1, Crítico: 0 },
        pior: "Alto",
      },
    ],
  },
];

describe("Excel de Riscos Psicossociais", () => {
  const wb = montarXlsxRiscosPsicossociais("Padaria", [["CNPJ", "00.000.000/0001-00"], ["E-mail", null]], riscos);

  test("uma linha por risco, com avaliação e setor repetidos", () => {
    const l = linhas(wb, "Riscos por setor");
    assert.equal(l.length, 3);
    assert.deepEqual(l[1].slice(0, 9), ["DRPS", "DRPS 2026", "Concluído", "15/09/2026", "Ana", "Produção", 12, "Sobrecarga", "Alto"]);
    assert.equal(l[2][7], "Assédio");
    assert.equal(l[2][9], "—");
  });

  test("medidas e agravos do setor em cada linha; vazio vira Não informado", () => {
    const l = linhas(wb, "Riscos por setor");
    assert.equal(l[1][10], "Não informado");
    assert.equal(l[2][11], "Ansiedade\nBurnout");
  });

  test("aba Empresa com o cadastro; vazio vira —", () => {
    const l = linhas(wb, "Empresa");
    assert.equal(l[1][0], "Padaria");
    assert.deepEqual(l.slice(4), [["CNPJ", "00.000.000/0001-00"], ["E-mail", "—"]]);
  });
});

describe("Excel da AEP", () => {
  const avaliacoes: AvaliacaoAepXlsx[] = [
    {
      idRelatorio: "AEP-1",
      data: null,
      idInspecao: null,
      responsavel: "Bruno",
      enviadoPor: null,
      precisaAet: true,
      precisaQuestionario: true,
      status: "CONCLUIDO",
      questionario: { rotulo: "Necessário", detalhe: "Sem DRPS", tom: "alerta", pendente: true },
      setores: [
        {
          id: "S1",
          nome: "Caixa",
          pior: "Alto",
          fatores: [
            { key: "f1", label: "Ritmo", nivel: "Alto", probabilidade: "Provável", severidade: "Alta", sinais: ["Filas", "Pausas curtas"], observacao: "Pico no almoço", confianca: "baixa" as never },
            { key: "f2", label: "Autonomia", nivel: null, probabilidade: null, severidade: null, sinais: [], observacao: null },
          ],
        },
      ],
    },
  ];
  const wb = montarXlsxAepPsicossocial("Padaria", [], avaliacoes);

  test("uma linha por fator; sem inspeção e sem cálculo aparecem escritos", () => {
    const l = linhas(wb, "Fatores por setor");
    assert.equal(l.length, 3);
    assert.deepEqual(l[1], [
      "Concluída", "Sem inspeção", "Bruno", "Sem inspeção", "Necessário — Sem DRPS", "Necessária",
      "Caixa", "Alto", "Ritmo", "Alto", "Provável", "Alta", "Filas\nPausas curtas", "Pico no almoço",
    ]);
    assert.deepEqual(l[2].slice(9), ["Não calculado", "—", "—", "Nenhum sinal marcado", ""]);
  });

  test("a Confiança (uso interno) não vai para a planilha", () => {
    assert.ok(!linhas(wb, "Fatores por setor")[0].some((c) => String(c).includes("Confiança")));
  });
});
