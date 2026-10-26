import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { acaoCompleta, acoesCompletas, acoesDaRegra, agendaValida, regraCompleta } from "./automacao-completa";

describe("automação completa (mesma regra do banco, v297)", () => {
  test("sem tipo ou tipo desconhecido não roda", () => {
    assert.equal(acaoCompleta(null), false);
    assert.equal(acaoCompleta({}), false);
    assert.equal(acaoCompleta({ tipo: "xyz" }), false);
  });
  test("ações que precisam de valor", () => {
    assert.equal(acaoCompleta({ tipo: "mover_status" }), false);
    assert.equal(acaoCompleta({ tipo: "mover_status", valor: "CONCLUIDO" }), true);
    assert.equal(acaoCompleta({ tipo: "definir_responsavel", valor: "  " }), false);
    assert.equal(acaoCompleta({ tipo: "definir_responsavel", valor: "Ana" }), true);
  });
  test("ações que precisam de destino, campo, modelo ou e-mails", () => {
    assert.equal(acaoCompleta({ tipo: "criar_tarefa_quadro" }), false);
    assert.equal(acaoCompleta({ tipo: "mover_tarefa_quadro", id_quadro_destino: "QDR-1" }), true);
    assert.equal(acaoCompleta({ tipo: "definir_campo", campo_id: "c1" }), true);
    assert.equal(acaoCompleta({ tipo: "criar_subtarefas_modelo" }), false);
    assert.equal(acaoCompleta({ tipo: "adicionar_vinculados", emails: [] }), false);
    assert.equal(acaoCompleta({ tipo: "adicionar_vinculados", emails: ["a@b.com"] }), true);
  });
  test("notificar e solicitar aprovação só precisam do tipo", () => {
    assert.equal(acaoCompleta({ tipo: "notificar" }), true);
    assert.equal(acaoCompleta({ tipo: "solicitar_aprovacao" }), true);
  });
});

describe("v298 — ações novas e lista de ações", () => {
  test("comentar, e-mail, prazo e etiquetas", () => {
    assert.equal(acaoCompleta({ tipo: "comentar", texto: " " }), false);
    assert.equal(acaoCompleta({ tipo: "comentar", texto: "Olá {titulo}" }), true);
    assert.equal(acaoCompleta({ tipo: "enviar_email", assunto: "X" }), false);
    assert.equal(acaoCompleta({ tipo: "enviar_email", assunto: "X", para: "responsaveis" }), true);
    assert.equal(acaoCompleta({ tipo: "enviar_email", assunto: "X", emails: ["a@b.com"] }), true);
    assert.equal(acaoCompleta({ tipo: "enviar_email", para: "vinculados" }), false);
    assert.equal(acaoCompleta({ tipo: "definir_prazo", dias: "3" }), true);
    assert.equal(acaoCompleta({ tipo: "definir_prazo", dias: "-2" }), true);
    assert.equal(acaoCompleta({ tipo: "definir_prazo", dias: "3,5" }), false);
    assert.equal(acaoCompleta({ tipo: "adicionar_etiqueta", valor: "" }), false);
    assert.equal(acaoCompleta({ tipo: "remover_etiqueta", valor: "urgente" }), true);
    assert.equal(acaoCompleta({ tipo: "concluir" }), true);
    assert.equal(acaoCompleta({ tipo: "duplicar_tarefa" }), true);
  });
  test("a regra só fica completa com todas as ações completas", () => {
    assert.equal(acoesCompletas([]), false);
    assert.equal(acoesCompletas([{ tipo: "concluir" }, { tipo: "comentar", texto: "" }]), false);
    assert.equal(acoesCompletas([{ tipo: "concluir" }, { tipo: "comentar", texto: "ok" }]), true);
  });
  test("regra antiga (acao única) vira lista de uma ação", () => {
    assert.deepEqual(acoesDaRegra({ acoes: [], acao: { tipo: "notificar" } }), [{ tipo: "notificar" }]);
    assert.deepEqual(acoesDaRegra({ acoes: [{ tipo: "concluir" }], acao: { tipo: "notificar" } }), [{ tipo: "concluir" }]);
    assert.deepEqual(acoesDaRegra({ acao: {} }), []);
  });
});

describe("v299 — tempo e cobrança", () => {
  test("aguardar precisa de quantidade inteira > 0 e unidade horas/dias", () => {
    assert.equal(acaoCompleta({ tipo: "aguardar", quantidade: "2", unidade: "dias" }), true);
    assert.equal(acaoCompleta({ tipo: "aguardar", quantidade: "3" }), true);
    assert.equal(acaoCompleta({ tipo: "aguardar", quantidade: "0", unidade: "horas" }), false);
    assert.equal(acaoCompleta({ tipo: "aguardar", quantidade: "2", unidade: "semanas" }), false);
  });
  test("agenda: hora HH:MM e frequência com o que precisa", () => {
    assert.equal(agendaValida({ freq: "diaria", hora: "08:00" }), true);
    assert.equal(agendaValida({ freq: "diaria", hora: "8:00" }), false);
    assert.equal(agendaValida({ freq: "semanal", hora: "08:00" }), false);
    assert.equal(agendaValida({ freq: "semanal", hora: "08:00", dias_semana: [1] }), true);
    assert.equal(agendaValida({ freq: "mensal", hora: "23:59", dia_mes: "ultimo" }), true);
    assert.equal(agendaValida({ freq: "mensal", hora: "08:00", dia_mes: "32" }), false);
  });
  test("regra agendada que cria tarefa: precisa do título; ações são opcionais", () => {
    const agenda = { freq: "dias_uteis", hora: "07:30" };
    assert.equal(regraCompleta("agendado", { agenda, modo: "criar_tarefa", modelo_tarefa: { titulo: "Rotina {data}" } }, []), true);
    assert.equal(regraCompleta("agendado", { agenda, modo: "criar_tarefa", modelo_tarefa: { titulo: " " } }, []), false);
    assert.equal(regraCompleta("agendado", { agenda, modo: "cada_tarefa" }, []), false);
    assert.equal(regraCompleta("agendado", { agenda }, [{ tipo: "concluir" }]), true);
  });
  test("tarefa parada precisa da quantidade", () => {
    assert.equal(regraCompleta("tarefa_parada", { parada: { quantidade: "3" } }, [{ tipo: "notificar" }]), true);
    assert.equal(regraCompleta("tarefa_parada", {}, [{ tipo: "notificar" }]), false);
  });
});

describe("v300 — rodízio e botão manual", () => {
  test("rodízio precisa de pessoas e de um modo conhecido", () => {
    assert.equal(acaoCompleta({ tipo: "atribuir_rodizio", emails: [] }), false);
    assert.equal(acaoCompleta({ tipo: "atribuir_rodizio", emails: ["a@b.com"] }), true);
    assert.equal(acaoCompleta({ tipo: "atribuir_rodizio", emails: ["a@b.com"], modo: "menor_carga" }), true);
    assert.equal(acaoCompleta({ tipo: "atribuir_rodizio", emails: ["a@b.com"], modo: "sorteio" }), false);
  });
  test("botão manual só precisa das ações completas", () => {
    assert.equal(regraCompleta("manual", {}, [{ tipo: "concluir" }]), true);
    assert.equal(regraCompleta("manual", {}, []), false);
  });
});
