import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { planejarDestinatarios } from "./helpers";

const ordenar = (p: { email: string; acao: string }[]) => [...p].sort((a, b) => a.email.localeCompare(b.email));

describe("Google Agenda: quem recebe o quê (planejarDestinatarios)", () => {
  test("tarefa normal: vinculados conectados recebem upsert", () => {
    const p = planejarDestinatarios({
      vinculados: ["a@x", "b@x"],
      comEvento: ["a@x"],
      conectados: ["a@x", "b@x"],
      ehDelete: false,
    });
    assert.deepEqual(ordenar(p), [
      { email: "a@x", acao: "upsert" },
      { email: "b@x", acao: "upsert" },
    ]);
  });

  test("TAREFA APAGADA: os vinculados sumiram em cascata, o evento do mapa é apagado", () => {
    // O caso medido na produção em 23/09: 1 evento órfão porque a lista de vinculados veio vazia.
    const p = planejarDestinatarios({ vinculados: [], comEvento: ["a@x"], conectados: ["a@x"], ehDelete: true });
    assert.deepEqual(p, [{ email: "a@x", acao: "delete" }]);
  });

  test("PESSOA TIRADA da tarefa: só o evento dela é apagado, os outros seguem", () => {
    const p = planejarDestinatarios({
      vinculados: ["b@x"],
      comEvento: ["a@x", "b@x"],
      conectados: ["a@x", "b@x"],
      ehDelete: false,
    });
    assert.deepEqual(ordenar(p), [
      { email: "a@x", acao: "delete" },
      { email: "b@x", acao: "upsert" },
    ]);
  });

  test("tarefa concluída ou sem prazo: delete para todos, vinculados ou não", () => {
    const p = planejarDestinatarios({
      vinculados: ["a@x"],
      comEvento: ["a@x", "c@x"],
      conectados: ["a@x", "c@x"],
      ehDelete: true,
    });
    assert.ok(p.every((d) => d.acao === "delete"));
    assert.equal(p.length, 2);
  });

  test("conta não conectada (ou desativada) fica de fora — não há como falar com a agenda dela", () => {
    const p = planejarDestinatarios({
      vinculados: ["a@x", "b@x"],
      comEvento: ["c@x"],
      conectados: ["a@x"],
      ehDelete: false,
    });
    assert.deepEqual(p, [{ email: "a@x", acao: "upsert" }]);
  });

  test("ninguém conectado: nada a fazer (o caso de ~toda a fila hoje)", () => {
    const p = planejarDestinatarios({ vinculados: ["a@x"], comEvento: [], conectados: [], ehDelete: false });
    assert.deepEqual(p, []);
  });

  test("mesmo e-mail vinculado e no mapa aparece uma vez só", () => {
    const p = planejarDestinatarios({ vinculados: ["a@x", "a@x"], comEvento: ["a@x"], conectados: ["a@x"], ehDelete: false });
    assert.equal(p.length, 1);
  });
});
