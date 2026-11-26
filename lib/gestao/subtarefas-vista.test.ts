import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { montarSubtarefas, statusDoFeito, itensMostrar, trocarMaesPorMinhasSubtarefas } from "./subtarefas-vista";
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

describe("só as próprias: subtarefa no lugar do cartão (0.3.320)", () => {
  const mae = (id: string, extra: Partial<GestaoTarefa> = {}) => ({ id_tarefa: id, titulo: id, status: "A_FAZER", id_tarefa_pai: null, ...extra }) as GestaoTarefa;
  const sub = (id: string, pai: string, linha?: string) => ({ id_tarefa: id, titulo: "sub " + id, status: "A_FAZER", id_tarefa_pai: pai, sub_linha: linha, titulo_mae: pai }) as GestaoTarefa;
  const vinc: Record<string, { usuario_email: string; tipo: string; origem?: string | null }[]> = {
    M1: [{ usuario_email: "jp@x.com", tipo: "seguidor", origem: "subtarefa-mae" }],
    M2: [{ usuario_email: "jp@x.com", tipo: "responsavel", origem: "app" }],
    M3: [{ usuario_email: "jp@x.com", tipo: "seguidor", origem: "subtarefa-mae" }],
    F1: [{ usuario_email: "jp@x.com", tipo: "responsavel", origem: "subtarefa" }],
  };
  const base = {
    tarefas: [mae("M1"), mae("M2"), mae("M3"), mae("M4")],
    subtarefas: [sub("SUB:L1", "M1", "L1"), sub("SUB:L2", "M1", "L2"), sub("F1", "M1"), sub("SUB:L3", "M2", "L3"), sub("SUB:L4", "M3", "L4")],
    linhas: [{ id: "L1", responsavel_email: "JP@x.com" }, { id: "L2", responsavel_email: "outro@x.com" }, { id: "L3", responsavel_email: "jp@x.com" }, { id: "L4", responsavel_email: "outro@x.com" }],
    eu: "jp@x.com",
    vinculadosDe: (id: string) => vinc[id] ?? [],
  };
  test("cartão só pela subtarefa vira as subtarefas DELE; vínculo direto mantém o cartão", () => {
    const r = trocarMaesPorMinhasSubtarefas(base);
    assert.deepEqual(r.tarefas.map((t) => t.id_tarefa), ["M2", "M3", "M4"]);
    assert.deepEqual(r.minhas.map((t) => t.id_tarefa), ["SUB:L1", "F1"]);
  });
  test("criou o cartão ou sem e-mail: nada muda", () => {
    assert.equal(trocarMaesPorMinhasSubtarefas({ ...base, criouEu: (t) => t.id_tarefa === "M1" }).minhas.length, 0);
    assert.equal(trocarMaesPorMinhasSubtarefas({ ...base, eu: null }).tarefas.length, 4);
  });
});
