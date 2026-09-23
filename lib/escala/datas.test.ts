import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  dataPura,
  diaSemanaIso,
  diaUtilDe,
  diasDoMes,
  diasNoMes,
  ehDiaUtil,
  intervaloDoMes,
  rotuloMes,
} from "./datas";
import { alocacaoParaColunas, colunasParaAlocacao, type Alocacao } from "./tipos";

describe("datas puras da escala", () => {
  test("dia da semana NAO desliza por fuso", () => {
    // 05/01/2026 e segunda. Com `new Date("2026-01-05").getDay()` em UTC-3 daria
    // domingo, e o padrao semanal inteiro andaria uma casa.
    assert.equal(diaSemanaIso("2026-01-05"), 1);
    assert.equal(diaSemanaIso("2026-01-09"), 5);
    assert.equal(diaSemanaIso("2026-01-10"), 6);
    assert.equal(diaSemanaIso("2026-01-11"), 7);
  });

  test("dia util e segunda a sexta", () => {
    assert.equal(ehDiaUtil("2026-01-05"), true);
    assert.equal(ehDiaUtil("2026-01-09"), true);
    assert.equal(ehDiaUtil("2026-01-10"), false);
    assert.equal(ehDiaUtil("2026-01-11"), false);
  });

  test("diaUtilDe devolve null no fim de semana", () => {
    assert.equal(diaUtilDe("2026-01-07"), 3);
    assert.equal(diaUtilDe("2026-01-10"), null);
  });

  test("fevereiro e ano bissexto", () => {
    assert.equal(diasNoMes(2026, 2), 28);
    assert.equal(diasNoMes(2028, 2), 29); // bissexto
    assert.equal(diasNoMes(2100, 2), 28); // secular nao bissexto
    assert.equal(diasNoMes(2000, 2), 29); // secular bissexto
  });

  test("intervalo do mes fecha no ultimo dia", () => {
    assert.deepEqual(intervaloDoMes(2026, 1), { inicio: "2026-01-01", fim: "2026-01-31" });
    assert.deepEqual(intervaloDoMes(2026, 2), { inicio: "2026-02-01", fim: "2026-02-28" });
    assert.deepEqual(intervaloDoMes(2028, 2), { inicio: "2028-02-01", fim: "2028-02-29" });
    assert.deepEqual(intervaloDoMes(2026, 12), { inicio: "2026-12-01", fim: "2026-12-31" });
  });

  test("janeiro de 2026 tem 22 dias uteis -- a planilha diz 21 porque desconta o feriado", () => {
    const uteis = diasDoMes(2026, 1).filter(ehDiaUtil);
    assert.equal(uteis.length, 22);
    // A aba Resumo Anual diz 21 para janeiro: sao os 22 dias uteis MENOS o
    // feriado de 01/01 (uma quinta). "Dia util" e "dia com escala" nao sao a
    // mesma pergunta -- quem contar feriado como dia util infla o mes inteiro.
    assert.equal(uteis.length - 1, 21);
  });

  test("o ano de 2026 tem 261 dias uteis", () => {
    let total = 0;
    for (let m = 1; m <= 12; m++) total += diasDoMes(2026, m).filter(ehDiaUtil).length;
    // 261 uteis - 13 feriados em dia util = 248, o total do Resumo Anual da planilha.
    assert.equal(total, 261);
  });

  test("dataPura preenche com zero e nao passa por fuso", () => {
    assert.equal(dataPura(2026, 1, 5), "2026-01-05");
    assert.equal(dataPura(2026, 12, 25), "2026-12-25");
  });

  test("rotulo do mes", () => {
    assert.equal(rotuloMes(2026, 3), "março de 2026");
  });
});

describe("alocacao respeita o XOR do banco", () => {
  test("unidades zeram a situacao", () => {
    assert.deepEqual(alocacaoParaColunas({ tipo: "unidades", unidade_ids: ["UNI-1", "UNI-2"] }), {
      unidade_ids: ["UNI-1", "UNI-2"],
      situacao: null,
    });
  });

  test("situacao zera as unidades", () => {
    assert.deepEqual(alocacaoParaColunas({ tipo: "situacao", situacao: "Home office" }), {
      unidade_ids: [],
      situacao: "Home office",
    });
  });

  test("ida e volta preserva", () => {
    const a: Alocacao = { tipo: "unidades", unidade_ids: ["UNI-1"] };
    assert.deepEqual(colunasParaAlocacao(alocacaoParaColunas(a)), a);
    const b: Alocacao = { tipo: "situacao", situacao: "Férias" };
    assert.deepEqual(colunasParaAlocacao(alocacaoParaColunas(b)), b);
  });

  test("linha vazia devolve null em vez de mentir", () => {
    assert.equal(colunasParaAlocacao({ unidade_ids: [], situacao: null }), null);
    assert.equal(colunasParaAlocacao({ unidade_ids: null, situacao: null }), null);
  });
});
