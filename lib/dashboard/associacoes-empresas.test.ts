import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  acumuladoPorPessoa,
  empresasAssociadasPorMes,
  empresasPorPessoa,
  eventosDeAssociacao,
  semDataDeAssociacao,
} from "./associacoes-empresas";

// mês absoluto = ano*12 + mês(0..11); para o teste basta o mês do ISO.
const mesDe = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
const SET = 2026 * 12 + 8;
const OUT = 2026 * 12 + 9;

const docs = [
  { id_inspecao: "I1", status: "CONCLUIDA", id_empresa: "E1", nome_empresa: "Alfa" },
  { id_inspecao: "I2", status: "CONCLUIDA", id_empresa: "E1", nome_empresa: "Alfa" },
  { id_inspecao: "I3", status: "CONCLUIDA", id_empresa: "E2", nome_empresa: "Beta" },
  { id_inspecao: "I4", status: "DELETADA", id_empresa: "E3", nome_empresa: "Gama" },
  { id_inspecao: "I5", status: "CONCLUIDA", id_empresa: "E4", nome_empresa: "Delta" },
];

describe("associações por empresa", () => {
  test("mesma empresa em dois documentos no mês conta 1; mês seguinte conta de novo", () => {
    const ev = eventosDeAssociacao(
      [
        { id_inspecao: "I1", nome: "Ana Souza", created_at: "2026-09-02T10:00:00Z" },
        { id_inspecao: "I2", nome: "ana souza", created_at: "2026-09-20T10:00:00Z" },
        { id_inspecao: "I3", nome: "Ana Souza", created_at: "2026-10-01T10:00:00Z" },
      ],
      [],
      docs,
      mesDe,
    );
    assert.deepEqual(empresasPorPessoa(ev, SET), [{ pessoa: "Ana Souza", total: 1 }]);
    assert.deepEqual(empresasPorPessoa(ev, OUT), [{ pessoa: "Ana Souza", total: 1 }]);
    assert.deepEqual(empresasAssociadasPorMes(ev, OUT, 2), [{ chave: SET, total: 1 }, { chave: OUT, total: 1 }]);
  });

  test("assumir pelo botão depois de associado não conta outra vez; sem associação, vale a data em que assumiu", () => {
    const ev = eventosDeAssociacao(
      [{ id_inspecao: "I1", nome: "Ana Souza", created_at: "2026-09-02T10:00:00Z" }],
      [
        { id_inspecao: "I1", responsavel: "Ana Souza", assumido_em: "2026-10-05T10:00:00Z" },
        { id_inspecao: "I5", responsavel: "Bruno Lima", assumido_em: "2026-10-06T10:00:00Z" },
      ],
      docs,
      mesDe,
    );
    assert.deepEqual(empresasPorPessoa(ev, OUT), [{ pessoa: "Bruno Lima", total: 1 }]);
    assert.deepEqual(empresasPorPessoa(ev, SET), [{ pessoa: "Ana Souza", total: 1 }]);
  });

  test("documento excluído não entra; acumulado soma os meses até o escolhido", () => {
    const ev = eventosDeAssociacao(
      [
        { id_inspecao: "I1", nome: "Ana Souza", created_at: "2026-09-02T10:00:00Z" },
        { id_inspecao: "I3", nome: "Ana Souza", created_at: "2026-10-01T10:00:00Z" },
        { id_inspecao: "I4", nome: "Ana Souza", created_at: "2026-10-01T10:00:00Z" },
      ],
      [],
      docs,
      mesDe,
    );
    assert.deepEqual(acumuladoPorPessoa(ev, SET), [{ pessoa: "Ana Souza", total: 1 }]);
    assert.deepEqual(acumuladoPorPessoa(ev, OUT), [{ pessoa: "Ana Souza", total: 2 }]);
  });

  test("conta os documentos com responsável e sem data nenhuma", () => {
    const ev = eventosDeAssociacao([], [], docs, mesDe);
    const n = semDataDeAssociacao(
      [{ ...docs[0], elaboracao_responsavel: "Ana" }, { ...docs[2], elaboracao_responsavel: "" }],
      ev,
    );
    assert.equal(n, 1);
  });
});

describe("v297 — associação excluída depois", () => {
  test("conta no mês em que aconteceu (vem da auditoria como associacao_removida)", () => {
    const ev = eventosDeAssociacao(
      [],
      [{ id_inspecao: "I3", responsavel: "Ana Souza", assumido_em: "2026-09-05T10:00:00Z", origem: "associacao_removida" }],
      docs,
      mesDe,
    );
    assert.equal(ev.length, 1);
    assert.equal(ev[0].origem, "associacao");
    assert.equal(ev[0].mes, SET);
    assert.deepEqual(empresasPorPessoa(ev, SET), [{ pessoa: "Ana Souza", total: 1 }]);
  });
  test("removida e associada de novo: vale a 1ª data, a empresa conta uma vez", () => {
    const ev = eventosDeAssociacao(
      [{ id_inspecao: "I3", nome: "Ana Souza", created_at: "2026-10-02T10:00:00Z" }],
      [{ id_inspecao: "I3", responsavel: "Ana Souza", assumido_em: "2026-09-05T10:00:00Z", origem: "associacao_removida" }],
      docs,
      mesDe,
    );
    assert.equal(ev.length, 1);
    assert.equal(ev[0].mes, SET);
    assert.deepEqual(acumuladoPorPessoa(ev, OUT), [{ pessoa: "Ana Souza", total: 1 }]);
  });
});
