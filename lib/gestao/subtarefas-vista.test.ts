import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { montarSubtarefas, statusDoFeito, itensMostrar } from "./subtarefas-vista";
import type { GestaoTarefa } from "@/lib/hooks/useGestao";

const statuses = [
  { slug: "FEITO", tipo: "concluido", ordem: 3 },
  { slug: "A_FAZER", tipo: "nao_iniciado", ordem: 1 },
  { slug: "ANDANDO", tipo: "ativo", ordem: 2 },
];
const tarefa = (id: string, extra: Partial<GestaoTarefa> = {}) =>
  ({ id_tarefa: id, id_quadro: "Q1", titulo: `T ${id}`, descricao: "desc", status: "ANDANDO", prioridade: "Alta", responsavel: "Fulano",
     prazo: "2026-10-30", data_inicio: null, hora_inicio: null, hora_fim: null, id_tarefa_pai: null, ordem: 0, etiquetas: ["x"],
     subtarefas: [], campos: { a: 1 }, recorrencia: null, pontos: 3, created_by: null, created_at: "2026-10-01", updated_at: null, ...extra }) as GestaoTarefa;

describe("statusDoFeito", () => {
  test("feito → 1º concluído; pendente → 1º não iniciado", () => {
    assert.equal(statusDoFeito(statuses as never, true), "FEITO");
    assert.equal(statusDoFeito(statuses as never, false), "A_FAZER");
  });
});

describe("montarSubtarefas", () => {
  const maes = [tarefa("M1")];
  const linha = (id: string, extra = {}) => ({ id, id_tarefa: "M1", texto: `Sub ${id}`, feito: false, ordem: 2, responsavel_email: null, id_tarefa_filha: null, created_at: "2026-10-02", ...extra });

  test("linha sem filha vira cartão de exibição, sem herdar prazo/etiquetas/descrição", () => {
    const [s] = montarSubtarefas({ maes, linhas: [linha("S1", { responsavel_email: "a@x" })], filhas: [], statuses: statuses as never, nomeDe: () => "Ana" });
    assert.equal(s.id_tarefa, "SUB:S1");
    assert.equal(s.sub_linha, "S1");
    assert.equal(s.id_tarefa_pai, "M1");
    assert.equal(s.titulo_mae, "T M1");
    assert.equal(s.titulo, "Sub S1");
    assert.equal(s.status, "A_FAZER");
    assert.equal(s.responsavel, "Ana");
    assert.equal(s.prazo, null);
    assert.deepEqual(s.etiquetas, []);
    assert.equal(s.descricao, null);
    assert.equal(s.prioridade, "Alta");
  });
  test("linha com filha usa a filha (real), com o título da mãe", () => {
    const filha = tarefa("F1", { id_tarefa_pai: "M1", titulo: "Filha" });
    const r = montarSubtarefas({ maes, linhas: [linha("S1", { id_tarefa_filha: "F1" })], filhas: [filha], statuses: statuses as never, nomeDe: () => null });
    assert.equal(r.length, 1);
    assert.equal(r[0].id_tarefa, "F1");
    assert.equal(r[0].sub_linha, undefined);
    assert.equal(r[0].titulo_mae, "T M1");
  });
  test("linha de mãe fora do quadro é ignorada", () => {
    const r = montarSubtarefas({ maes, linhas: [linha("S9", { id_tarefa: "OUTRA" })], filhas: [], statuses: statuses as never, nomeDe: () => null });
    assert.equal(r.length, 0);
  });
});

describe("itensMostrar", () => {
  test("tarefas, subtarefas ou as duas", () => {
    const t = [tarefa("A")], s = [tarefa("B")];
    assert.deepEqual(itensMostrar("tarefas", t, s).map((x) => x.id_tarefa), ["A"]);
    assert.deepEqual(itensMostrar("subtarefas", t, s).map((x) => x.id_tarefa), ["B"]);
    assert.deepEqual(itensMostrar("ambas", t, s).map((x) => x.id_tarefa), ["A", "B"]);
  });
});
