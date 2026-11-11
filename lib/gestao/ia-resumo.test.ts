import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { montarConversa, normalizarResumo } from "./ia-resumo";

describe("Resumo dos comentários com IA", () => {
  const cs = [
    { autor: "Ana", texto: "Cliente pediu orçamento.", created_at: "2026-11-10T13:00:00Z" },
    { autor: "automacao", texto: "Movida para Em andamento", created_at: "2026-11-10T14:00:00Z" },
    { autor: "João", texto: "  Enviei   o orçamento.\n\nAguardando.  ", created_at: "2026-11-10T15:30:00Z" },
    { autor: "Ana", texto: "   ", created_at: "2026-11-10T16:00:00Z" },
  ];
  test("ordem do mais antigo ao mais novo, hora de Brasília, Automação, espaços juntos, vazio fora", () => {
    const r = montarConversa(cs);
    assert.equal(r.total, 3);
    assert.equal(r.usados, 3);
    assert.deepEqual(r.texto.split("\n"), [
      "10/11, 10:00 · Ana: Cliente pediu orçamento.",
      "10/11, 11:00 · Automação: Movida para Em andamento",
      "10/11, 12:30 · João: Enviei o orçamento. Aguardando.",
    ]);
  });
  test("passou do limite: ficam os mais novos e avisa os de fora", () => {
    const r = montarConversa(cs, 80);
    assert.equal(r.usados, 1);
    assert.match(r.texto, /^\(2 comentários mais antigos não entraram no resumo\)\n10\/11, 12:30 · João/);
  });
  test("resposta do modelo", () => {
    assert.deepEqual(normalizarResumo({ situacao: " Aguardando o cliente. ", decisoes: ["Orçamento enviado", ""], pendencias: "x", proximo_passo: "Cobrar" }), {
      situacao: "Aguardando o cliente.", decisoes: ["Orçamento enviado"], pendencias: [], proximo_passo: "Cobrar",
    });
    assert.equal(normalizarResumo({ situacao: "", decisoes: [], pendencias: [] }), null);
    assert.equal(normalizarResumo("texto"), null);
  });
});
