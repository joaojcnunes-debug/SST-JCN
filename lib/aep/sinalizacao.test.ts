import { test } from "node:test";
import assert from "node:assert/strict";

import { montarSinalizacao, piorNivel, recomendaQuestionario } from "./sinalizacao";
import type { AepRelatorio } from "@/lib/supabase/types";

function rel(id: string, empresa: string, data: string, setores: unknown[]): AepRelatorio {
  return {
    id_relatorio: id,
    id_empresa: empresa,
    status: "RASCUNHO",
    data_elaboracao: data,
    responsavel_elaboracao: "Fulano",
    empresas: { nome_empresa: "Empresa " + empresa, cnpj: null },
    setores,
  } as unknown as AepRelatorio;
}

const setorComAssedio = {
  id: "s1",
  nome_setor: "ADM",
  checklist_organizacional: { assedio: "sim", subcarga: "nao" },
  sinais_organizacional: { assedio: ["tom_agressivo"] },
  aiha_organizacional: { assedio: { probabilidade: "Exposição moderada", severidade: "Irreversíveis", nivel: "Moderado" } },
  observacoes_checklist: { assedio: " gritos " },
};

test("agrupa por empresa e só entra setor com fator Sim", () => {
  const r = montarSinalizacao([
    rel("A1", "E1", "2026-01-01", [setorComAssedio, { id: "s2", nome_setor: "X", checklist_organizacional: { assedio: "nao" } }]),
    rel("A2", "E1", "2026-03-01", [setorComAssedio]),
    rel("A3", "E2", "2026-02-01", [{ id: "s3", nome_setor: "Y", checklist_organizacional: { assedio: "nao" } }]),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].avaliacoes.length, 2);
  assert.equal(r[0].avaliacoes[0].idRelatorio, "A2"); // mais recente primeiro
  assert.equal(r[0].totalSetores, 2);
  assert.equal(r[0].pior, "Moderado");
});

test("fator traz rótulo, sinais, observação e nível", () => {
  const [e] = montarSinalizacao([rel("A1", "E1", "2026-01-01", [setorComAssedio])]);
  const f = e.avaliacoes[0].setores[0].fatores[0];
  assert.equal(f.label, "Assédio de qualquer natureza no trabalho");
  assert.deepEqual(f.sinais, ["Tom agressivo, irônico ou humilhante"]);
  assert.equal(f.observacao, "gritos");
  assert.equal(f.nivel, "Moderado");
});

test("fator sem nível calculado não mostra probabilidade/severidade", () => {
  const [e] = montarSinalizacao([
    rel("A1", "E1", "2026-01-01", [{
      ...setorComAssedio,
      aiha_organizacional: { assedio: { probabilidade: "Não há exposição", severidade: "Pouca importância", nivel: null } },
    }]),
  ]);
  const f = e.avaliacoes[0].setores[0].fatores[0];
  assert.equal(f.nivel, null);
  assert.equal(f.probabilidade, null);
});

test("pior nível", () => {
  assert.equal(piorNivel(["Baixo", null, "Alto", "Moderado"]), "Alto");
  assert.equal(piorNivel([null, undefined]), null);
});

test("DRPS/Questionário a partir de 3 alertas organizacionais; AET e quem enviou vêm da AEP mais recente", () => {
  const tres = { ...setorComAssedio, checklist_organizacional: { assedio: "sim", sobrecarga: "sim", baixo_controle: "sim" }, necessita_aet: true };
  assert.equal(recomendaQuestionario([setorComAssedio] as never), false);
  assert.equal(recomendaQuestionario([tres] as never), true);
  const [e] = montarSinalizacao([
    { ...rel("A1", "E1", "2026-01-01", [setorComAssedio]), entregue_em: "2026-01-05", enviado_por: "Ana" },
    { ...rel("A2", "E1", "2026-02-01", [tres]), entregue_em: "2026-02-05", enviado_por: null, id_inspecao: "INS-1" } as never,
  ]);
  assert.equal(e.precisaQuestionario, true);
  assert.equal(e.precisaAet, true);
  assert.equal(e.realizadaPor, "Fulano");
  assert.equal(e.enviadoPor, null);
  assert.equal(e.temInspecao, true);
});
