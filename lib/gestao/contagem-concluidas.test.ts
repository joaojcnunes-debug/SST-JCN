import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { itensDaContagem, contarConcluidas } from "./contagem-concluidas";
import { montarSubtarefas } from "./subtarefas-vista";
import type { GestaoTarefa } from "@/lib/hooks/useGestao";

const statuses: { slug: string; tipo: "concluido" | "nao_iniciado"; ordem: number }[] = [
  { slug: "FEITO", tipo: "concluido", ordem: 3 },
  { slug: "A_FAZER", tipo: "nao_iniciado", ordem: 1 },
];
const tarefa = (id: string, extra: Partial<GestaoTarefa> = {}) =>
  ({ id_tarefa: id, id_quadro: "Q1", titulo: `T ${id}`, descricao: null, status: "A_FAZER", prioridade: "Alta", responsavel: "Mãe Dona",
     prazo: null, data_inicio: null, hora_inicio: null, hora_fim: null, id_tarefa_pai: null, ordem: 0, etiquetas: [],
     subtarefas: [], campos: {}, recorrencia: null, pontos: null, created_by: null, created_at: "2026-11-01", updated_at: null, ...extra }) as GestaoTarefa;
const linha = (id: string, extra = {}) =>
  ({ id, id_tarefa: "M1", texto: `Sub ${id}`, feito: false, ordem: 0, responsavel_email: null, id_tarefa_filha: null, created_at: "2026-11-02", ...extra });
const subs = (maes: GestaoTarefa[], linhas: ReturnType<typeof linha>[], filhas: GestaoTarefa[] = []) =>
  montarSubtarefas({ maes, linhas, filhas, statuses: statuses as never, nomeDe: (e) => (e === "ana@x" ? "Ana" : null) });

describe("contagem de tarefas feitas", () => {
  test("mãe com 3 subtarefas, tudo concluído = 4", () => {
    const maes = [tarefa("M1", { status: "FEITO" })];
    const s = subs(maes, [linha("S1", { feito: true }), linha("S2", { feito: true }), linha("S3", { feito: true })]);
    const c = contarConcluidas(itensDaContagem(maes, s), statuses);
    assert.equal(c.total, 4);
    assert.equal(c.concluidas, 4);
    assert.equal(c.subtarefasConcluidas, 3);
  });

  test("subtarefa fechada conta mesmo com a mãe aberta", () => {
    const maes = [tarefa("M1")];
    const c = contarConcluidas(itensDaContagem(maes, subs(maes, [linha("S1", { feito: true }), linha("S2")])), statuses);
    assert.equal(c.total, 3);
    assert.equal(c.concluidas, 1);
  });

  test("crédito: responsável da subtarefa; sem ele, o da mãe", () => {
    const maes = [tarefa("M1")];
    const s = subs(maes, [linha("S1", { feito: true, responsavel_email: "ana@x" }), linha("S2", { feito: true })]);
    const c = contarConcluidas(itensDaContagem(maes, s), statuses);
    assert.deepEqual(c.porPessoa, [{ nome: "Ana", concluidas: 1 }, { nome: "Mãe Dona", concluidas: 1 }]);
  });

  test("filha já aberta conta pelo próprio status e não repete a linha", () => {
    const maes = [tarefa("M1")];
    const filha = tarefa("F1", { id_tarefa_pai: "M1", status: "FEITO", responsavel: "Bia" });
    const s = subs(maes, [linha("S1", { id_tarefa_filha: "F1" })], [filha]);
    const c = contarConcluidas(itensDaContagem(maes, s), statuses);
    assert.equal(c.total, 2);
    assert.deepEqual(c.porPessoa, [{ nome: "Bia", concluidas: 1 }]);
  });

  test("vários responsáveis: conta para cada um; sem ninguém vira 'Sem responsável'", () => {
    const maes = [tarefa("M1", { status: "FEITO", responsavel: "Ana, Bia" }), tarefa("M2", { status: "FEITO", responsavel: null })];
    const c = contarConcluidas(itensDaContagem(maes, []), statuses);
    assert.equal(c.concluidas, 2);
    assert.deepEqual(c.porPessoa.map((p) => p.nome).sort(), ["Ana", "Bia", "Sem responsável"]);
  });

  test("item repetido entre tarefas e subtarefas entra uma vez só", () => {
    const maes = [tarefa("M1", { status: "FEITO" })];
    assert.equal(itensDaContagem(maes, maes).length, 1);
  });
});
