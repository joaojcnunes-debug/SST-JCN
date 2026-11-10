import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ordenarTarefas, proximaOrdem, valorOrdem, campoTemValor, type TarefaOrdenavel } from "./ordenar-coluna";

const T = (titulo: string, extra: Partial<TarefaOrdenavel> = {}): TarefaOrdenavel => ({
  titulo, prazo: null, data_inicio: null, created_at: "2026-11-01T10:00:00Z", prioridade: "Media", origem: null, ...extra,
});
const titulos = (l: TarefaOrdenavel[]) => l.map((t) => t.titulo);

describe("ordenarTarefas (Ordenar por, menu da coluna)", () => {
  const L = [
    T("Bravo", { prazo: "2026-11-20", origem: { client: "Teresópolis", project: "Implementação", tipo: "Médio" } }),
    T("alfa", { prazo: null, data_inicio: "2026-11-02", origem: { client: "Campos" } }),
    T("Charlie", { prazo: "2026-11-05", data_inicio: "2026-11-01", prioridade: "Alta", created_at: "2026-10-01T10:00:00Z" }),
    T("Delta", { prazo: "2026-11-05", origem: { client: "", tipo: "Baixo" } }),
  ];
  test("manual / sem ordem devolve a ordem do quadro", () => {
    assert.deepEqual(titulos(ordenarTarefas(L, null)), ["Bravo", "alfa", "Charlie", "Delta"]);
    assert.deepEqual(titulos(ordenarTarefas(L, { campo: "manual", dir: "asc" })), ["Bravo", "alfa", "Charlie", "Delta"]);
  });
  test("entrega desejada: mais próxima primeiro; empate mantém a ordem; sem prazo no fim", () => {
    assert.deepEqual(titulos(ordenarTarefas(L, { campo: "entrega", dir: "asc" })), ["Charlie", "Delta", "Bravo", "alfa"]);
    assert.deepEqual(titulos(ordenarTarefas(L, { campo: "entrega", dir: "desc" })), ["Bravo", "Charlie", "Delta", "alfa"]);
  });
  test("título: ordem alfabética sem diferenciar maiúscula", () => {
    assert.deepEqual(titulos(ordenarTarefas(L, { campo: "titulo", dir: "asc" })), ["alfa", "Bravo", "Charlie", "Delta"]);
  });
  test("cliente vem do Runrun; vazio vai para o fim nos dois sentidos", () => {
    assert.deepEqual(titulos(ordenarTarefas(L, { campo: "cliente", dir: "asc" })), ["alfa", "Bravo", "Charlie", "Delta"]);
    assert.deepEqual(titulos(ordenarTarefas(L, { campo: "cliente", dir: "desc" })), ["Bravo", "alfa", "Charlie", "Delta"]);
  });
  test("tipo: o do Runrun; tarefa da Gestão cai na prioridade", () => {
    assert.equal(valorOrdem(L[0], "tipo"), "Médio");
    assert.equal(valorOrdem(L[2], "tipo"), "Alta");
    assert.deepEqual(titulos(ordenarTarefas(L, { campo: "tipo", dir: "asc" })), ["Charlie", "Delta", "alfa", "Bravo"]);
  });
  test("criada em e início desejado", () => {
    assert.deepEqual(titulos(ordenarTarefas(L, { campo: "criada", dir: "asc" })), ["Charlie", "Bravo", "alfa", "Delta"]);
    assert.deepEqual(titulos(ordenarTarefas(L, { campo: "inicio", dir: "asc" })), ["Charlie", "alfa", "Bravo", "Delta"]);
  });
  test("não altera a lista recebida", () => {
    const copia = [...L];
    ordenarTarefas(L, { campo: "titulo", dir: "desc" });
    assert.deepEqual(L, copia);
  });
});

describe("proximaOrdem / campoTemValor", () => {
  test("mesmo campo inverte; outro campo começa crescente; manual limpa", () => {
    assert.deepEqual(proximaOrdem(null, "entrega"), { campo: "entrega", dir: "asc" });
    assert.deepEqual(proximaOrdem({ campo: "entrega", dir: "asc" }, "entrega"), { campo: "entrega", dir: "desc" });
    assert.deepEqual(proximaOrdem({ campo: "entrega", dir: "desc" }, "titulo"), { campo: "titulo", dir: "asc" });
    assert.equal(proximaOrdem({ campo: "titulo", dir: "asc" }, "manual"), null);
  });
  test("projeto só conta quando alguma tarefa tem", () => {
    assert.equal(campoTemValor([T("a"), T("b", { origem: { project: "Implementação" } })], "projeto"), true);
    assert.equal(campoTemValor([T("a"), T("b", { origem: { client: "X" } })], "projeto"), false);
  });
});
