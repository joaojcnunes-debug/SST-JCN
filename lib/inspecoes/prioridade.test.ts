import { test } from "node:test";
import assert from "node:assert/strict";
import { diasEntre, motivosPrioridade, pesoPrioridade, textoEspera } from "./prioridade";
import { escreverFiltros, FILTROS_VAZIOS, intervaloDoPeriodo, lerFiltros } from "./filtros-url";

test("dias entre datas, sem fuso", () => {
  assert.equal(diasEntre("2026-10-28", "2026-10-30"), 2);
  assert.equal(diasEntre("2026-10-28", "2026-10-26"), -2);
  assert.equal(diasEntre("2026-12-31", "2027-01-01"), 1);
});

test("motivos: prazo vencido, documento vencendo e espera longa, com a marca manual na frente", () => {
  const m = motivosPrioridade(
    { prioridade: "BAIXA", prazo: "2026-10-26", data_validade: "2026-11-10", dias_espera: 32 },
    "2026-10-28",
  );
  assert.deepEqual(m, [
    "Marcada como Baixa pelo supervisor",
    "Prazo vencido há 2 dias",
    "Documento vence em 13 dias",
    "Aguardando há 32 dias",
  ]);
  // nada esperando (entregue): só a marca manual; prazo e espera não contam
  assert.deepEqual(motivosPrioridade({ prioridade: null, prazo: "2026-10-01", dias_espera: null }, "2026-10-28"), []);
  // espera curta e prazo longe: sem motivo
  assert.deepEqual(motivosPrioridade({ prazo: "2026-12-01", dias_espera: 3 }, "2026-10-28"), []);
  assert.deepEqual(motivosPrioridade({ prazo: "2026-10-28", dias_espera: 1 }, "2026-10-28"), ["Prazo vence hoje"]);
});

test("peso e texto da espera", () => {
  assert.ok(pesoPrioridade("URGENTE") > pesoPrioridade("ALTA"));
  assert.equal(pesoPrioridade(null), 0);
  assert.equal(textoEspera("EM_ANDAMENTO", 12), "Aberta há 12 dias");
  assert.equal(textoEspera("CONCLUIDA", 1), "Documento aguardando há 1 dia");
  assert.equal(textoEspera("CONCLUIDA", null), null);
});

test("filtros no endereço: ida e volta, e valor inválido vira padrão", () => {
  const f = {
    ...FILTROS_VAZIOS,
    q: "chabra", tecnico: "Ledimo", minhas: true, unidade: "UNI-1", periodo: "personalizado" as const,
    de: "2026-10-01", ate: "2026-10-28", pilulas: ["CONCLUIDA" as const], documento: ["PENDENTE" as const],
    prioridade: ["URGENTE" as const, "ALTA" as const], espera: 15, ordem: "prioridade" as const,
  };
  const sp = escreverFiltros(f);
  assert.deepEqual(lerFiltros(sp), f);
  const ruim = lerFiltros(new URLSearchParams("status=XYZ,CONCLUIDA&doc=nada&espera=-3&ordem=foo&de=ontem"));
  assert.deepEqual(ruim.pilulas, ["CONCLUIDA"]);
  assert.deepEqual(ruim.documento, []);
  assert.equal(ruim.espera, 0);
  assert.equal(ruim.ordem, "recentes");
  assert.equal(ruim.de, "");
  // unidade: sem parâmetro vale a unidade ativa; com "unidade=" vazio, todas
  assert.equal(lerFiltros(new URLSearchParams(""), "UNI-A").unidade, "UNI-A");
  assert.equal(lerFiltros(new URLSearchParams("unidade="), "UNI-A").unidade, "");
  assert.equal(escreverFiltros({ ...FILTROS_VAZIOS, unidade: "" }, "UNI-A").get("unidade"), "");
  assert.equal(escreverFiltros(FILTROS_VAZIOS).toString(), "");
});

test("atalhos de período", () => {
  assert.deepEqual(intervaloDoPeriodo("7d", "2026-10-28"), { de: "2026-10-22", ate: "2026-10-28" });
  assert.deepEqual(intervaloDoPeriodo("mes", "2026-10-28"), { de: "2026-10-01", ate: "2026-10-28" });
  assert.deepEqual(intervaloDoPeriodo("mes_passado", "2026-10-28"), { de: "2026-09-01", ate: "2026-09-30" });
  assert.deepEqual(intervaloDoPeriodo("mes_passado", "2026-01-15"), { de: "2025-12-01", ate: "2025-12-31" });
  assert.deepEqual(intervaloDoPeriodo("30d", "2026-03-10"), { de: "2026-02-09", ate: "2026-03-10" });
  assert.deepEqual(intervaloDoPeriodo("", "2026-10-28"), { de: "", ate: "" });
});
