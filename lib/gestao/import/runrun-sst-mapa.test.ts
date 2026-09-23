import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mapearBoardSST, slugEtapaSST, unidadeDe, camposDe, type RRTaskSST, type RRUser } from "./runrun-sst-mapa";
import { CAMPO_PRODUTOS_ID, CAMPO_TIPO_CLIENTE_ID, QUADRO_SST_ENTRADA } from "./runrun-forms-mapa";

const users = new Map<string, RRUser>([
  ["isabela-esteves", { id: "isabela-esteves", email: "Isabela.Esteves@chabra.com.br" }],
  ["elaine-maia", { id: "elaine-maia", email: "elaine@chabra.com.br" }],
  ["sem-email", { id: "sem-email", email: null }],
]);
const base = (p: Partial<RRTaskSST> & { id: number; title: string }): RRTaskSST => ({
  is_closed: false, board_stage_name: "Empresas Novas", created_at: "2026-03-01T10:00:00-03:00", ...p,
});

describe("slugEtapaSST", () => {
  test("15 etapas do board + acento/caixa; desconhecida = null", () => {
    assert.equal(slugEtapaSST("Concluída"), "CONCLUIDA");
    assert.equal(slugEtapaSST("ELABORAÇÃO DOS PROGRAMAS"), "ELABORACAO_PROGRAMAS");
    assert.equal(slugEtapaSST("Inativas/Inadimplentes"), "INATIVAS_INADIMPLENTES");
    assert.equal(slugEtapaSST("Avaliações de Quantitativos"), "AVAL_QUANTITATIVOS");
    assert.equal(slugEtapaSST("Etapa Nova"), null);
  });
});

describe("unidadeDe", () => {
  const pai = base({ id: 1, title: "EMPRESA A", tags_data: [{ name: "Teresópolis" }] });
  const paiCliente = base({ id: 2, title: "EMPRESA B", client_name: "Nova Friburgo" });
  const filha = base({ id: 3, title: "PGR", is_subtask: true, parent_task_id: 2 });
  const orfa = base({ id: 4, title: "Procuração eletrônica" });
  const porId = new Map([pai, paiCliente, filha, orfa].map((t) => [t.id, t]));
  test("tag > cliente > pai; 'Friburgo' casa 'nova friburgo'; sem nada = null", () => {
    assert.deepEqual(unidadeDe(pai, porId), { id_quadro: "QDR-CBDD056A", tag: "teresopolis", via: "tag" });
    assert.deepEqual(unidadeDe(paiCliente, porId), { id_quadro: "QDR-7D4CA761", tag: "nova friburgo", via: "cliente" });
    assert.deepEqual(unidadeDe(filha, porId), { id_quadro: "QDR-7D4CA761", tag: "nova friburgo", via: "pai" });
    assert.equal(unidadeDe(orfa, porId), null);
    assert.equal(unidadeDe(base({ id: 9, title: "x", client_name: "Friburgo" }), porId)?.tag, "nova friburgo");
  });
});

describe("camposDe", () => {
  test("Produtos (multi) e Tipo de Cliente nos ids globais; vazio quando não há", () => {
    const t = base({ id: 1, title: "x", custom_fields: { custom_86: [{ label: "PGR" }, { label: "LTCAT" }], custom_100: { label: "Mensal" } } });
    assert.deepEqual(camposDe(t), { [CAMPO_PRODUTOS_ID]: ["PGR", "LTCAT"], [CAMPO_TIPO_CLIENTE_ID]: "Mensal" });
    assert.deepEqual(camposDe(base({ id: 2, title: "y" })), {});
  });
});

describe("mapearBoardSST", () => {
  const tasks: RRTaskSST[] = [
    base({ id: 10, title: "EMPRESA A", tags_data: [{ name: "campos" }], type_name: "Verificar com o Supervisor", board_stage_name: "Revisões a Fazer",
      assignments: [{ assignee_id: "isabela-esteves" }, { assignee_id: "elaine-maia" }], user_id: "sem-email", subtask_ids: [12, 11],
      custom_fields: { custom_86: [{ label: "PGR" }] }, desired_date: "2026-10-01T00:00:00-03:00", board_stage_position: 5e12 }),
    base({ id: 11, title: "PGR", is_subtask: true, parent_task_id: 10, board_stage_name: "Concluída", is_closed: true, assignments: [{ assignee_id: "elaine-maia" }] }),
    base({ id: 12, title: "Agendar Visita", is_subtask: true, parent_task_id: 10, board_stage_name: "Agendado", user_id: "sem-email" }),
    base({ id: 20, title: "SEM UNIDADE", board_stage_name: "Avaliações de Quantitativos", type_name: "Emergência", is_urgent: false, user_id: "sem-email", user_name: "Leana Carvalho" }),
    base({ id: 30, title: "ORFA", is_subtask: true, parent_task_id: 999 }),
    base({ id: 40, title: "ETAPA ESTRANHA", board_stage_name: "Limbo" }),
  ];
  const r = mapearBoardSST(tasks, users, new Map([[10, "<p>Olá <b>mundo</b></p>"]]));
  test("pai vira tarefa na unidade com status/prioridade/etiquetas/campos/prazo/descrição", () => {
    const t = r.tarefas.find((x) => x.runrun_id === 10)!;
    assert.equal(t.id_tarefa, "RRN-10"); assert.equal(t.id_quadro, "QDR-82EB39A0"); assert.equal(t.status, "REVISOES_A_FAZER");
    assert.equal(t.prioridade, "Alta"); assert.deepEqual(t.etiquetas, ["campos", "verificar-supervisor"]);
    assert.deepEqual(t.campos, { [CAMPO_PRODUTOS_ID]: ["PGR"] }); assert.equal(t.prazo, "2026-10-01"); assert.equal(t.ordem, 5);
    assert.equal(t.descricao, "Olá mundo"); assert.equal(t.origem.unidade_via, "tag");
  });
  test("filhas viram subtarefas do pai (ordem do subtask_ids, feito, etapa, responsável); órfã vai ao log", () => {
    const s = r.subtarefas.filter((x) => x.id_tarefa === "RRN-10").sort((a, b) => a.ordem - b.ordem);
    assert.deepEqual(s.map((x) => [x.id, x.texto, x.feito, x.etapa, x.ordem, x.responsavel_email]), [
      ["SRR-12", "Agendar Visita", false, "AGENDADO", 0, null],
      ["SRR-11", "PGR", true, "CONCLUIDA", 1, "elaine@chabra.com.br"],
    ]);
    assert.equal(r.log.filter((l) => l.resultado === "sem_pai").length, 1);
  });
  test("vínculos: 1º alocado responsável, demais seguidores, user_id seguidor; sem e-mail → log; e-mail em minúsculas", () => {
    const v = r.vinculos.filter((x) => x.id_tarefa === "RRN-10");
    assert.deepEqual(v, [{ id_tarefa: "RRN-10", email: "isabela.esteves@chabra.com.br", tipo: "responsavel" }, { id_tarefa: "RRN-10", email: "elaine@chabra.com.br", tipo: "seguidor" }]);
    assert.ok(r.log.some((l) => l.resultado === "nao_casado" && l.detalhe.includes("sem-email")));
  });
  test("sem unidade → SST — Entrada com status necessário; Emergência → Urgente; etapa desconhecida → log e não vira tarefa", () => {
    const t = r.tarefas.find((x) => x.runrun_id === 20)!;
    assert.equal(t.id_quadro, QUADRO_SST_ENTRADA); assert.equal(t.status, "AVAL_QUANTITATIVOS"); assert.equal(t.prioridade, "Urgente");
    assert.equal(t.responsavel, "Leana Carvalho (sem conta)"); // desligada: nome legado no card, sem vínculo
    assert.equal(r.tarefas.find((x) => x.runrun_id === 10)!.responsavel, null); // tem vínculo por e-mail
    assert.ok(r.statusNecessarios.some((s) => s.id_quadro === QUADRO_SST_ENTRADA && s.slug === "AVAL_QUANTITATIVOS" && s.nome === "Avaliações de Quantitativos"));
    assert.equal(r.tarefas.some((x) => x.runrun_id === 40), false);
    assert.equal(r.stats.etapa_desconhecida, 1); assert.equal(r.stats.sem_unidade, 1); assert.equal(r.stats.pais, 3);
  });
});
