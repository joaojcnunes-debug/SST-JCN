import { test } from "node:test";
import assert from "node:assert/strict";
import { calculadaSobe, diasEntre, motivosPrioridade, pesoPrioridade, textoEspera } from "./prioridade";
import { escreverFiltros, FILTROS_VAZIOS, intervaloDoPeriodo, lerFiltros, trocarVisao } from "./filtros-url";

test("dias entre datas, sem fuso", () => {
  assert.equal(diasEntre("2026-10-28", "2026-10-30"), 2);
  assert.equal(diasEntre("2026-10-28", "2026-10-26"), -2);
  assert.equal(diasEntre("2026-12-31", "2027-01-01"), 1);
});

test("motivos da calculada: prazo vencido, documento vencendo e espera longa", () => {
  const m = motivosPrioridade({ prazo: "2026-10-26", data_validade: "2026-11-10", dias_espera: 32 }, "2026-10-28");
  assert.deepEqual(m, ["Prazo vencido há 2 dias", "Documento vence em 13 dias", "Aguardando há 32 dias"]);
  // nada esperando (entregue): sem calculada, prazo não conta
  assert.deepEqual(motivosPrioridade({ prazo: "2026-10-01", dias_espera: null }, "2026-10-28"), []);
  assert.deepEqual(motivosPrioridade({ prazo: "2026-12-01", dias_espera: 3 }, "2026-10-28"), []);
  assert.deepEqual(motivosPrioridade({ prazo: "2026-10-28", dias_espera: 1 }, "2026-10-28"), ["Prazo vence hoje"]);
});

test("escala do painel: Crítica > Urgente (GRAVE) > Média > Baixa; a calculada só sobe a marcada", () => {
  assert.ok(pesoPrioridade("CRITICA") > pesoPrioridade("GRAVE"));
  assert.ok(pesoPrioridade("GRAVE") > pesoPrioridade("MEDIA"));
  assert.equal(pesoPrioridade("URGENTE"), 0, "valor fora da escala não pesa");
  assert.equal(calculadaSobe({ prioridade: "BAIXA", prioridade_auto: "CRITICA" }), true);
  assert.equal(calculadaSobe({ prioridade: "CRITICA", prioridade_auto: "MEDIA" }), false);
  assert.equal(calculadaSobe({ prioridade: null, prioridade_auto: "BAIXA" }), true);
  assert.equal(calculadaSobe({ prioridade: null, prioridade_auto: null }), false);
});

test("texto da espera", () => {
  assert.equal(textoEspera("EM_ANDAMENTO", 12), "Aberta há 12 dias");
  assert.equal(textoEspera("CONCLUIDA", 1), "Documento aguardando há 1 dia");
  assert.equal(textoEspera("CONCLUIDA", null), null);
});

test("filtros no endereço: ida e volta, e valor inválido vira padrão", () => {
  const f = {
    ...FILTROS_VAZIOS,
    q: "chabra", tecnico: "Ledimo", minhas: true, unidade: "UNI-1", periodo: "personalizado" as const,
    de: "2026-10-01", ate: "2026-10-28", pilulas: ["CONCLUIDA" as const], documento: ["PENDENTE" as const],
    prioridade: ["CRITICA" as const, "GRAVE" as const], espera: 15, ordem: "prioridade" as const,
  };
  assert.deepEqual(lerFiltros(escreverFiltros(f)), f);
  const ruim = lerFiltros(new URLSearchParams("status=XYZ,CONCLUIDA&doc=nada&prioridade=URGENTE,GRAVE&espera=-3&ordem=foo&de=ontem"));
  assert.deepEqual(ruim.pilulas, ["CONCLUIDA"]);
  assert.deepEqual(ruim.documento, []);
  assert.deepEqual(ruim.prioridade, ["GRAVE"]);
  assert.equal(ruim.espera, 0);
  assert.equal(ruim.ordem, "recentes");
  assert.equal(ruim.de, "");
  // unidade: sem parâmetro vale a unidade ativa; com "unidade=" vazio, todas
  assert.equal(lerFiltros(new URLSearchParams(""), "UNI-A").unidade, "UNI-A");
  assert.equal(lerFiltros(new URLSearchParams("unidade="), "UNI-A").unidade, "");
  assert.equal(escreverFiltros({ ...FILTROS_VAZIOS, unidade: "" }, "UNI-A").get("unidade"), "");
  assert.equal(escreverFiltros(FILTROS_VAZIOS).toString(), "");
});

test("visão e complexidade no endereço; trocar de visão limpa o que fica escondido", () => {
  const f = { ...FILTROS_VAZIOS, visao: "associados" as const, complexidade: ["MUITO_ALTA" as const, "BAIXA" as const] };
  assert.deepEqual(lerFiltros(escreverFiltros(f)), f);
  assert.equal(lerFiltros(new URLSearchParams("visao=xyz&complexidade=ALTA,URGENTE")).visao, "");
  assert.deepEqual(lerFiltros(new URLSearchParams("complexidade=ALTA,URGENTE")).complexidade, ["ALTA"]);

  const tudo = {
    ...FILTROS_VAZIOS, tecnico: "Ledimo", associado: "Ana", documento: ["PENDENTE" as const],
    pilulas: ["CONCLUIDA" as const, "ASSOCIADOS" as const], prioridade: ["CRITICA" as const], empresa: "EMP-1",
  };
  const tec = trocarVisao(tudo, "tecnicos");
  assert.equal(tec.associado, "");
  assert.deepEqual(tec.documento, []);
  assert.deepEqual(tec.pilulas, ["CONCLUIDA"]);
  assert.equal(tec.tecnico, "Ledimo");
  assert.deepEqual(tec.prioridade, ["CRITICA"], "prioridade vale nas três");
  const assoc = trocarVisao(tudo, "associados");
  assert.equal(assoc.tecnico, "");
  assert.deepEqual(assoc.pilulas, ["ASSOCIADOS"]);
  assert.deepEqual(assoc.documento, ["PENDENTE"]);
  assert.equal(assoc.empresa, "EMP-1");
  assert.deepEqual(trocarVisao(tudo, ""), { ...tudo, visao: "" }, "Todas não limpa nada");
});

test("atalhos de período", () => {
  assert.deepEqual(intervaloDoPeriodo("7d", "2026-10-28"), { de: "2026-10-22", ate: "2026-10-28" });
  assert.deepEqual(intervaloDoPeriodo("mes", "2026-10-28"), { de: "2026-10-01", ate: "2026-10-28" });
  assert.deepEqual(intervaloDoPeriodo("mes_passado", "2026-10-28"), { de: "2026-09-01", ate: "2026-09-30" });
  assert.deepEqual(intervaloDoPeriodo("mes_passado", "2026-01-15"), { de: "2025-12-01", ate: "2025-12-31" });
  assert.deepEqual(intervaloDoPeriodo("30d", "2026-03-10"), { de: "2026-02-09", ate: "2026-03-10" });
  assert.deepEqual(intervaloDoPeriodo("", "2026-10-28"), { de: "", ate: "" });
});
