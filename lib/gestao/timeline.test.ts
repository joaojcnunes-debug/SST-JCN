import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeTimeline,
  descreverMovimentacao,
  type ComentarioRow,
  type HistoricoRow,
  type TimelineItem,
} from "./timeline";

function cmt(over: Partial<ComentarioRow> = {}): ComentarioRow {
  return {
    id_comentario: "CMT-1",
    id_tarefa: "T-1",
    autor: "Ana",
    texto: "oi",
    created_at: "2026-09-15T10:00:00.000Z",
    ...over,
  };
}

function hist(over: Partial<HistoricoRow> = {}): HistoricoRow {
  return {
    id: 1,
    id_tarefa: "T-1",
    ator: "Ana",
    tipo: "status",
    campo: "status",
    de: "A_FAZER",
    para: "FAZENDO",
    created_at: "2026-09-15T10:00:00.000Z",
    ...over,
  };
}

describe("mergeTimeline", () => {
  test("mescla as duas fontes numa lista única", () => {
    const out = mergeTimeline([cmt()], [hist()]);
    assert.equal(out.length, 2);
  });

  test("ordena por created_at ascendente (mais antigo primeiro)", () => {
    const out = mergeTimeline(
      [
        cmt({ id_comentario: "C2", created_at: "2026-09-15T12:00:00.000Z", texto: "b" }),
        cmt({ id_comentario: "C1", created_at: "2026-09-15T08:00:00.000Z", texto: "a" }),
      ],
      [hist({ id: 9, created_at: "2026-09-15T10:00:00.000Z" })],
    );
    assert.deepEqual(
      out.map((i) => i.created_at),
      [
        "2026-09-15T08:00:00.000Z",
        "2026-09-15T10:00:00.000Z",
        "2026-09-15T12:00:00.000Z",
      ],
    );
  });

  test("ordem desc inverte o eixo temporal", () => {
    const out = mergeTimeline(
      [cmt({ id_comentario: "C1", created_at: "2026-09-15T08:00:00.000Z" })],
      [hist({ id: 9, created_at: "2026-09-15T12:00:00.000Z" })],
      "desc",
    );
    assert.equal(out[0].created_at, "2026-09-15T12:00:00.000Z");
    assert.equal(out[1].created_at, "2026-09-15T08:00:00.000Z");
  });

  test("empate de timestamp é determinístico (comentário antes de movimentação) e independe da direção", () => {
    const ts = "2026-09-15T10:00:00.000Z";
    const asc = mergeTimeline([cmt({ created_at: ts })], [hist({ created_at: ts })], "asc");
    const desc = mergeTimeline([cmt({ created_at: ts })], [hist({ created_at: ts })], "desc");
    assert.equal(asc[0].kind, "comentario");
    assert.equal(asc[1].kind, "movimentacao");
    assert.equal(desc[0].kind, "comentario");
    assert.equal(desc[1].kind, "movimentacao");
  });

  test("chaves são estáveis e distinguem as fontes", () => {
    const out = mergeTimeline([cmt({ id_comentario: "CMT-9" })], [hist({ id: 9 })]);
    const keys = out.map((i) => i.key).sort();
    assert.deepEqual(keys, ["cmt:CMT-9", "hist:9"]);
  });

  test("preserva texto e campos de/para no mapeamento", () => {
    const out = mergeTimeline([cmt({ texto: "linha1\nlinha2" })], [hist({ de: "X", para: "Y" })]);
    const c = out.find((i) => i.kind === "comentario") as Extract<TimelineItem, { kind: "comentario" }>;
    const m = out.find((i) => i.kind === "movimentacao") as Extract<TimelineItem, { kind: "movimentacao" }>;
    assert.equal(c.texto, "linha1\nlinha2");
    assert.equal(m.de, "X");
    assert.equal(m.para, "Y");
  });

  test("listas vazias → resultado vazio", () => {
    assert.deepEqual(mergeTimeline([], []), []);
  });
});

describe("descreverMovimentacao", () => {
  const mv = (over: Partial<Extract<TimelineItem, { kind: "movimentacao" }>> = {}) =>
    ({
      key: "hist:1",
      kind: "movimentacao" as const,
      ator: "Ana",
      created_at: "2026-09-15T10:00:00.000Z",
      tipo: "status",
      de: "A_FAZER",
      para: "FAZENDO",
      ...over,
    });

  test("criada", () => {
    assert.equal(descreverMovimentacao(mv({ tipo: "criada", de: null, para: null })), "criou a tarefa");
  });

  test("status usa o resolvedor de nome amigável quando fornecido", () => {
    const nome = (s: string | null) => (s === "A_FAZER" ? "A fazer" : s === "FAZENDO" ? "Fazendo" : s ?? "—");
    assert.equal(descreverMovimentacao(mv({ tipo: "status" }), nome), "moveu de A fazer para Fazendo");
  });

  test("status sem resolvedor mostra o valor cru", () => {
    assert.equal(descreverMovimentacao(mv({ tipo: "status" })), "moveu de A_FAZER para FAZENDO");
  });

  test("prazo/prioridade/titulo/data_inicio formatam A → B", () => {
    assert.equal(descreverMovimentacao(mv({ tipo: "prazo", de: "2026-01-01", para: "2026-02-01" })), "prazo: 2026-01-01 → 2026-02-01");
    assert.equal(descreverMovimentacao(mv({ tipo: "prioridade", de: "Baixa", para: "Alta" })), "prioridade: Baixa → Alta");
    assert.equal(descreverMovimentacao(mv({ tipo: "titulo", de: "X", para: "Y" })), 'renomeou: "X" → "Y"');
    assert.equal(descreverMovimentacao(mv({ tipo: "data_inicio", de: "2026-01-01", para: "2026-01-05" })), "início: 2026-01-01 → 2026-01-05");
  });

  test("valores nulos viram travessão", () => {
    assert.equal(descreverMovimentacao(mv({ tipo: "prazo", de: null, para: "2026-02-01" })), "prazo: — → 2026-02-01");
  });
});
