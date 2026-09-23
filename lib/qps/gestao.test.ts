import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { ACOES_OBRIGATORIAS } from "@/lib/drps/gestao";
import { acoesObrigatoriasQps, comInstrumento, recomendacoesMonitoramento } from "./gestao";

describe("gestão do QPS — os textos do DRPS com o nome do instrumento", () => {
  test("troca só a palavra inteira DRPS; ids do checklist ficam iguais (o jsonb é compatível)", () => {
    const qap = acoesObrigatoriasQps();
    assert.equal(qap.length, ACOES_OBRIGATORIAS.length);
    assert.deepEqual(qap.map((a) => a.id), ACOES_OBRIGATORIAS.map((a) => a.id));
    const reaplicar = qap.find((a) => a.id === "reaplicar_drps");
    assert.ok(reaplicar);
    assert.match(reaplicar.texto, /Reaplicação da? QAP|Reaplicação do QAP/);
    assert.doesNotMatch(reaplicar.texto, /DRPS/);
    assert.equal(qap.filter((a) => /DRPS/.test(a.texto)).length, 0);
  });

  test("comInstrumento não toca em palavras que só contêm DRPS", () => {
    assert.equal(comInstrumento("o DRPS e o DRPSX"), "o QAP e o DRPSX");
    assert.equal(comInstrumento("sem a sigla"), "sem a sigla");
    assert.equal(comInstrumento("DRPS", { sigla: "PER", nome: "x" }), "PER");
  });

  test("cartão Crítico do monitoramento fala do instrumento, não do DRPS", () => {
    const rec = recomendacoesMonitoramento();
    assert.match(rec["Crítico"].texto, /reavaliação do QAP em 90 dias/);
    assert.equal(Object.keys(rec).length, 4);
  });
});

describe("resumoGestaoQps — a conta do Painel de Gestão é a do DRPS", () => {
  test("percentuais e saúde geral com dados da QAP", async () => {
    const { resumoGestaoQps } = await import("./gestao");
    const r = resumoGestaoQps({
      planoDB: { id_aplicacao: "A", ano: 2026, plano: { "Programa de apoio psicológico": { meses: [true, false, false, false, false, false, false, false, false, false, false, false], responsavel: "" } }, updated_at: "" },
      monitoramentos: [
        { id_aplicacao: "A", setor: "S", id_categoria: "C1", status: "Concluido", data_intervencao: null, responsavel: null, proxima_avaliacao: null, observacoes: null, updated_at: "" },
        { id_aplicacao: "A", setor: "S", id_categoria: "C2", status: "Pendente", data_intervencao: null, responsavel: null, proxima_avaliacao: null, observacoes: null, updated_at: "" },
      ],
      revisaoDB: { id_aplicacao: "A", checklist: { reaplicar_drps: true }, equipe: {}, anotacoes: null, updated_at: "2026-09-17" },
      mesAtual: 0,
    });
    assert.equal(r.medidas.totalConfiguradas, 1);
    assert.equal(r.medidas.acoesNoMesAtual, 1);
    assert.equal(r.monitoramento.total, 2);
    assert.equal(r.monitoramento.percentual, 50);
    assert.equal(r.revisao.checklistMarcados, 1);
    assert.equal(r.saudeGeral, Math.round((r.medidas.percentual + 50 + r.revisao.percentual) / 3));
  });
});
