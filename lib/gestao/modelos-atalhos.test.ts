import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { aplicarModelo, resumoModelo, somarDiasUteis, type EstadoNovaTarefa } from "./modelos";
import { acaoDaTecla } from "./atalhos";

const vazio: EstadoNovaTarefa = { titulo: "", descricao: "", prioridade: "Media", prazo: "", etiquetas: [], checklist: [], subtarefas: [] };
const visita = {
  titulo: "Visita técnica",
  descricao: "Levar EPI e o roteiro.",
  checklist: ["Fotos", "Assinatura do cliente"],
  itens: [{ texto: "Agendar com a empresa" }],
  prioridade: "Alta",
  etiquetas: ["campo"],
  prazo_dias: 3,
  prazo_uteis: true,
};

describe("Modelo de tarefa", () => {
  test("tarefa vazia recebe tudo do modelo", () => {
    const r = aplicarModelo(vazio, visita, "2026-11-13"); // sexta
    assert.equal(r.titulo, "Visita técnica");
    assert.equal(r.descricao, "Levar EPI e o roteiro.");
    assert.deepEqual(r.checklist, ["Fotos", "Assinatura do cliente"]);
    assert.deepEqual(r.subtarefas, [{ texto: "Agendar com a empresa", feito: false, responsavel_email: null }]);
    assert.equal(r.prioridade, "Alta");
    assert.deepEqual(r.etiquetas, ["campo"]);
    assert.equal(r.prazo, "2026-11-18"); // sexta + 3 úteis = quarta
  });
  test("não apaga o que a pessoa escreveu e não repete itens", () => {
    const meu = { ...vazio, titulo: "Visita na ACME", descricao: "Portão 2.", checklist: ["fotos"], etiquetas: ["Campo"], prazo: "2026-12-01" };
    const r = aplicarModelo(meu, { ...visita, prazo_dias: null }, "2026-11-13");
    assert.equal(r.titulo, "Visita na ACME");
    assert.equal(r.descricao, "Portão 2.\n\nLevar EPI e o roteiro.");
    assert.deepEqual(r.checklist, ["fotos", "Assinatura do cliente"]);
    assert.deepEqual(r.etiquetas, ["Campo"]);
    assert.equal(r.prazo, "2026-12-01");
    // aplicar de novo não duplica a descrição
    assert.equal(aplicarModelo(r, visita, "2026-11-13").descricao, r.descricao);
  });
  test("dias corridos e úteis", () => {
    assert.equal(aplicarModelo(vazio, { titulo: "x", prazo_dias: 3 }, "2026-11-13").prazo, "2026-11-16");
    assert.equal(somarDiasUteis("2026-11-13", 1), "2026-11-16");
    assert.equal(somarDiasUteis("2026-11-13", 0), "2026-11-13");
  });
  test("resumo", () => {
    assert.equal(resumoModelo(visita), "descrição · 2 itens no checklist · 1 subtarefa · prazo em 3 dias úteis");
    assert.equal(resumoModelo({ titulo: "x" }), "vazio");
  });
});

describe("Atalhos do quadro", () => {
  const corpo = { tagName: "BODY" };
  test("no cartão", () => {
    assert.equal(acaoDaTecla({ key: " ", alvo: corpo }, true), "me_atribuir");
    assert.equal(acaoDaTecla({ key: "d", alvo: corpo }, true), "prazo");
    assert.equal(acaoDaTecla({ key: "L", alvo: corpo }, true), "etiqueta");
    assert.equal(acaoDaTecla({ key: "Enter", alvo: corpo }, true), "abrir");
  });
  test("sem cartão sob o mouse só valem os gerais", () => {
    assert.equal(acaoDaTecla({ key: " ", alvo: corpo }, false), null);
    assert.equal(acaoDaTecla({ key: "d", alvo: corpo }, false), null);
    assert.equal(acaoDaTecla({ key: "n", alvo: corpo }, false), "nova");
    assert.equal(acaoDaTecla({ key: "/", alvo: corpo }, false), "buscar");
    assert.equal(acaoDaTecla({ key: "?", alvo: corpo }, false), "ajuda");
  });
  test("digitando, com Ctrl ou num botão focado, não rouba a tecla", () => {
    assert.equal(acaoDaTecla({ key: "d", alvo: { tagName: "INPUT" } }, true), null);
    assert.equal(acaoDaTecla({ key: "n", alvo: { tagName: "DIV", isContentEditable: true } }, true), null);
    assert.equal(acaoDaTecla({ key: "d", ctrlKey: true, alvo: corpo }, true), null);
    assert.equal(acaoDaTecla({ key: " ", alvo: { tagName: "BUTTON" } }, true), null);
    assert.equal(acaoDaTecla({ key: "Enter", alvo: { tagName: "A" } }, true), null);
    assert.equal(acaoDaTecla({ key: "d", alvo: { tagName: "BUTTON" } }, true), "prazo");
    assert.equal(acaoDaTecla({ key: "n", repeat: true, alvo: corpo }, true), null);
  });
});
