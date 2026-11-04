import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ordensParaSalvar } from "./ordem-perguntas";

describe("ordensParaSalvar", () => {
  test("excluir uma pergunta NÃO renumera as outras — fica o buraco", () => {
    // Era o defeito: com `ordem: i + 1`, tirar a 2 fazia a 3 virar 2 e as
    // respostas da antiga 2 passarem a contar para ela.
    const r = ordensParaSalvar([{ ordem: 1 }, { ordem: 3 }, { ordem: 4 }]);
    assert.deepEqual(r.map((p) => p.ordem), [1, 3, 4]);
  });

  test("pergunta nova recebe maior + 1, mesmo inserida no meio", () => {
    const r = ordensParaSalvar([{ ordem: 1 }, { ordem: 0 }, { ordem: 2 }]);
    assert.deepEqual(r.map((p) => p.ordem), [1, 3, 2]);
  });

  test("várias novas recebem números seguidos, na ordem em que aparecem", () => {
    const r = ordensParaSalvar([{ ordem: 5 }, {}, { ordem: null }]);
    assert.deepEqual(r.map((p) => p.ordem), [5, 6, 7]);
  });

  test("não reaproveita número que já tem resposta gravada", () => {
    // Apagou a 50 (que tinha respostas) e criou outra: não pode ser 50 de novo.
    const r = ordensParaSalvar([{ ordem: 49 }, { ordem: 0 }], 50);
    assert.deepEqual(r.map((p) => p.ordem), [49, 51]);
  });

  test("ordem repetida fica com a primeira; a outra vira nova", () => {
    const r = ordensParaSalvar([{ ordem: 2 }, { ordem: 2 }]);
    assert.deepEqual(r.map((p) => p.ordem), [2, 3]);
  });

  test("lista vazia devolve vazia; os outros campos passam intactos", () => {
    assert.deepEqual(ordensParaSalvar([]), []);
    const [p] = ordensParaSalvar([{ ordem: 7, texto: "x", codigo_fator: "F01" }]);
    assert.deepEqual(p, { ordem: 7, texto: "x", codigo_fator: "F01" });
  });
});
