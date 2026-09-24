import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  porAssociado,
  resumoAssociacao,
  serieMensalAssociacoes,
  type AssociacaoDoc,
  type DocumentoContavel,
} from "./documentos";
import { mesAbsSP, rotuloMesAbs } from "./mes";

/**
 * Testes da régua de documentos (elaboração no SGG).
 *
 * Cada bloco corresponde a um defeito MEDIDO na base em 2026-08-27:
 *
 *  - a tela de detalhe usava só `inspecao_associados` e perdia os 109
 *    documentos cujo responsável de elaboração não tem linha lá — trocando a
 *    ordem do pódio (Paulina 49 no donut × 25 na tela, atrás da Syang);
 *  - associação de inspeção deletada entrava na conta;
 *  - dois associados no mesmo documento contavam dois documentos.
 */

const AGO26 = 2026 * 12 + 7;
const JUL26 = AGO26 - 1;

function doc(over: Partial<DocumentoContavel> = {}): DocumentoContavel {
  return {
    id_inspecao: "INS-1",
    status: "CONCLUIDA",
    elaboracao_responsavel: null,
    elaboracao_status: "CONCLUIDO",
    ...over,
  };
}
function assoc(over: Partial<AssociacaoDoc> = {}): AssociacaoDoc {
  return { id_inspecao: "INS-1", nome: "Ana Luiza", created_at: "2026-08-10T12:00:00Z", ...over };
}

const OPC = { mes: null, mesDe: mesAbsSP };

describe("porAssociado", () => {
  it("une as duas fontes: o dono do documento conta mesmo sem linha de associação", () => {
    const docs = [
      doc({ id_inspecao: "A", elaboracao_responsavel: "Paulina Cunha" }),
      doc({ id_inspecao: "B", elaboracao_responsavel: "Paulina Cunha" }),
    ];
    const r = porAssociado([assoc({ id_inspecao: "A", nome: "Paulina Cunha" })], docs, OPC);
    assert.equal(r.length, 1);
    // Era esse o defeito: só o documento A aparecia.
    assert.equal(r[0].total, 2);
    assert.equal(r[0].semAssociacao, 1);
  });

  it("não conta o mesmo documento duas vezes quando a pessoa está nas duas fontes", () => {
    const docs = [doc({ id_inspecao: "A", elaboracao_responsavel: "Ana Luiza" })];
    const r = porAssociado([assoc({ id_inspecao: "A", nome: "Ana Luiza" })], docs, OPC);
    assert.equal(r[0].total, 1);
    assert.equal(r[0].semAssociacao, 0);
  });

  it("sem ninguém com o documento, os dois associados contam (regra 2)", () => {
    const docs = [doc({ id_inspecao: "A", elaboracao_responsavel: null })];
    const r = porAssociado(
      [assoc({ id_inspecao: "A", nome: "Ana Luiza" }), assoc({ id_inspecao: "A", nome: "Syang Almeida" })],
      docs,
      OPC,
    );
    assert.deepEqual(
      r.map((p) => [p.nome, p.total]),
      [["Ana Luiza", 1], ["Syang Almeida", 1]],
    );
  });

  it("ignora associação de inspeção deletada — e de inspeção que não existe mais", () => {
    const docs = [doc({ id_inspecao: "A", status: "DELETADA" })];
    const r = porAssociado(
      [assoc({ id_inspecao: "A" }), assoc({ id_inspecao: "FANTASMA" })],
      docs,
      OPC,
    );
    assert.deepEqual(r, []);
  });

  it("mesma pessoa com caixa diferente é uma linha só", () => {
    const docs = [doc({ id_inspecao: "A" }), doc({ id_inspecao: "B" })];
    const r = porAssociado(
      [assoc({ id_inspecao: "A", nome: "Ana Luiza" }), assoc({ id_inspecao: "B", nome: "ANA LUIZA" })],
      docs,
      OPC,
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].total, 2);
  });

  it("nome vazio não vira pessoa", () => {
    const docs = [doc({ id_inspecao: "A" })];
    assert.deepEqual(porAssociado([assoc({ id_inspecao: "A", nome: "  " })], docs, OPC), []);
  });

  it("no recorte por mês só entra quem tem data — e o crédito por responsável fica de fora", () => {
    const docs = [
      doc({ id_inspecao: "A", elaboracao_responsavel: "Paulina Cunha" }),
      doc({ id_inspecao: "B", elaboracao_responsavel: "Paulina Cunha" }),
    ];
    const associacoes = [
      assoc({ id_inspecao: "A", nome: "Paulina Cunha", created_at: "2026-08-10T12:00:00Z" }),
      assoc({ id_inspecao: "B", nome: "Paulina Cunha", created_at: "2026-07-10T12:00:00Z" }),
    ];
    assert.equal(porAssociado(associacoes, docs, { mes: AGO26, mesDe: mesAbsSP })[0].total, 1);
    assert.equal(porAssociado(associacoes, docs, { mes: JUL26, mesDe: mesAbsSP })[0].total, 1);
    assert.equal(porAssociado(associacoes, docs, OPC)[0].total, 2);
  });

  it("ordena pelo TOTAL de documentos associados (15/09)", () => {
    const docs = [doc({ id_inspecao: "A" }), doc({ id_inspecao: "B" }), doc({ id_inspecao: "C" })];
    const r = porAssociado(
      [
        assoc({ id_inspecao: "A", nome: "Syang Almeida" }),
        assoc({ id_inspecao: "A", nome: "Ana Luiza" }),
        assoc({ id_inspecao: "B", nome: "Ana Luiza" }),
        assoc({ id_inspecao: "C", nome: "Ana Luiza" }),
      ],
      docs,
      OPC,
    );
    assert.deepEqual(r.map((p) => p.nome), ["Ana Luiza", "Syang Almeida"]);
  });
});

describe("de quem é o documento", () => {
  it("quem largou deixa de contar: o crédito é de quem assumiu depois", () => {
    // Regra dada pelo Sanmyo em 27/08. A linha antiga em inspecao_associados
    // fica para sempre — ela é histórico, não título de propriedade.
    const docs = [doc({ id_inspecao: "A", elaboracao_responsavel: "Thamirys Vieira" })];
    const r = porAssociado(
      [
        assoc({ id_inspecao: "A", nome: "Emilia dos Reis" }),
        assoc({ id_inspecao: "A", nome: "Thamirys Vieira" }),
      ],
      docs,
      OPC,
    );
    assert.deepEqual(r.map((p) => [p.nome, p.total]), [["Thamirys Vieira", 1]]);
  });

  it("o dono conta mesmo sem nunca ter passado pela tabela de associados", () => {
    const docs = [doc({ id_inspecao: "A", elaboracao_responsavel: "Paulina Cunha" })];
    const r = porAssociado([], docs, OPC);
    assert.deepEqual([r[0].nome, r[0].total, r[0].semAssociacao], ["Paulina Cunha", 1, 0 + 1]);
  });

  it("documento sem dono e sem associado não conta para ninguém", () => {
    const docs = [doc({ id_inspecao: "A", elaboracao_responsavel: null })];
    assert.deepEqual(porAssociado([], docs, OPC), []);
  });

  it("reentrada da mesma pessoa vale pela PRIMEIRA data", () => {
    const docs = [doc({ id_inspecao: "A", elaboracao_responsavel: "Ana Luiza" })];
    const associacoes = [
      assoc({ id_inspecao: "A", nome: "Ana Luiza", created_at: "2026-08-20T12:00:00Z" }),
      assoc({ id_inspecao: "A", nome: "Ana Luiza", created_at: "2026-07-05T12:00:00Z" }),
    ];
    assert.equal(porAssociado(associacoes, docs, { mes: JUL26, mesDe: mesAbsSP })[0].total, 1);
    assert.deepEqual(porAssociado(associacoes, docs, { mes: AGO26, mesDe: mesAbsSP }), []);
  });
});

describe("entregue × em aberto", () => {
  it("documento assumido e não concluído entra no total, mas não em entregues", () => {
    const docs = [
      doc({ id_inspecao: "A", elaboracao_status: "CONCLUIDO" }),
      doc({ id_inspecao: "B", elaboracao_status: "EM_ELABORACAO" }),
      doc({ id_inspecao: "C", elaboracao_status: null }),
    ];
    const r = porAssociado(
      ["A", "B", "C"].map((id) => assoc({ id_inspecao: id, nome: "Ana Luiza" })),
      docs,
      OPC,
    );
    assert.deepEqual(
      [r[0].total, r[0].entregues, r[0].emAberto],
      [3, 1, 2],
    );
  });

  it("quem tem mais documentos associados fica na frente, mesmo entregando menos (15/09)", () => {
    // Até 15/09 valia o contrário (caso de 27/08: 95 assumidos × 57 entregues
    // no topo). Ele pediu "apenas quantos documentos o usuário foi associado";
    // `entregues` continua calculado e separado, só não manda na ordem.
    const docs = [
      doc({ id_inspecao: "A", elaboracao_status: "EM_ELABORACAO" }),
      doc({ id_inspecao: "B", elaboracao_status: "EM_ELABORACAO" }),
      doc({ id_inspecao: "C", elaboracao_status: "EM_ELABORACAO" }),
      doc({ id_inspecao: "D", elaboracao_status: "CONCLUIDO" }),
      doc({ id_inspecao: "E", elaboracao_status: "CONCLUIDO" }),
    ];
    const r = porAssociado(
      [
        assoc({ id_inspecao: "A", nome: "Assume Muito" }),
        assoc({ id_inspecao: "B", nome: "Assume Muito" }),
        assoc({ id_inspecao: "C", nome: "Assume Muito" }),
        assoc({ id_inspecao: "D", nome: "Entrega" }),
        assoc({ id_inspecao: "E", nome: "Entrega" }),
      ],
      docs,
      OPC,
    );
    assert.deepEqual(r.map((p) => [p.nome, p.total, p.entregues]), [
      ["Assume Muito", 3, 0],
      ["Entrega", 2, 2],
    ]);
  });
});

describe("o que não foi entregue, separado", () => {
  it("distingue o que está na mão dela do que voltou para a fila", () => {
    const docs = [
      doc({ id_inspecao: "A", elaboracao_responsavel: "Ana", elaboracao_status: "CONCLUIDO" }),
      doc({ id_inspecao: "B", elaboracao_responsavel: "Ana", elaboracao_status: "EM_ELABORACAO" }),
      // Sem dono: conta para quem passou, mas não é trabalho em curso dela.
      doc({ id_inspecao: "C", elaboracao_responsavel: null, elaboracao_status: "PENDENTE" }),
    ];
    const r = porAssociado(
      ["A", "B", "C"].map((id) => assoc({ id_inspecao: id, nome: "Ana" })),
      docs,
      OPC,
    );
    assert.deepEqual(
      [r[0].total, r[0].entregues, r[0].emElaboracao, r[0].semDono, r[0].emAberto],
      [3, 1, 1, 1, 2],
    );
  });

  it("entregues + em elaboração + sem dono fecha com o total", () => {
    const docs = [
      doc({ id_inspecao: "A", elaboracao_responsavel: "Bia", elaboracao_status: "CONCLUIDO" }),
      doc({ id_inspecao: "B", elaboracao_responsavel: "Bia", elaboracao_status: "EM_ELABORACAO" }),
    ];
    for (const p of porAssociado([], docs, OPC)) {
      assert.equal(p.entregues + p.emElaboracao + p.semDono, p.total);
      assert.equal(p.emAberto, p.emElaboracao + p.semDono);
    }
  });
});

describe("resumoAssociacao", () => {
  it("separa o que tem registro de associação do que só tem responsável", () => {
    const docs = [
      doc({ id_inspecao: "A", elaboracao_responsavel: "Ana Luiza" }),
      doc({ id_inspecao: "B", elaboracao_responsavel: "Paulina Cunha" }),
      doc({ id_inspecao: "C" }),
    ];
    const r = resumoAssociacao([assoc({ id_inspecao: "A", nome: "Ana Luiza" })], docs);
    assert.deepEqual(r, { comAssociacao: 1, semAssociacao: 1 });
  });
});

describe("serieMensalAssociacoes — safra do mês", () => {
  it("o mês é a PRIMEIRA entrada, e a barra mede o que já saiu", () => {
    const docs = [
      doc({ id_inspecao: "A", elaboracao_status: "CONCLUIDO" }),
      doc({ id_inspecao: "B", elaboracao_status: "EM_ELABORACAO" }),
    ];
    const serie = serieMensalAssociacoes(
      [
        assoc({ id_inspecao: "A", nome: "Ana", created_at: "2026-07-02T12:00:00Z" }),
        // 2ª entrada no mesmo documento, mês seguinte: não cria outra safra.
        assoc({ id_inspecao: "A", nome: "Syang", created_at: "2026-08-03T12:00:00Z" }),
        assoc({ id_inspecao: "B", nome: "Ana", created_at: "2026-07-03T12:00:00Z" }),
      ],
      docs,
      AGO26,
      6,
      (abs) => rotuloMesAbs(abs),
      mesAbsSP,
    );
    const jul = serie[serie.length - 2];
    const ago = serie[serie.length - 1];
    assert.deepEqual([jul.total, jul.entregues, jul.emElaboracao], [2, 1, 1]);
    assert.deepEqual([ago.total, ago.entregues], [0, 0]);
  });

  it("os três estados fecham com o total do mês", () => {
    const docs = [
      doc({ id_inspecao: "A", elaboracao_status: "CONCLUIDO" }),
      doc({ id_inspecao: "B", elaboracao_status: "PENDENTE" }),
      doc({ id_inspecao: "C", elaboracao_status: null }),
    ];
    const serie = serieMensalAssociacoes(
      ["A", "B", "C"].map((id) => assoc({ id_inspecao: id })),
      docs,
      AGO26,
      6,
      (abs) => rotuloMesAbs(abs),
      mesAbsSP,
    );
    for (const m of serie) {
      assert.equal(m.entregues + m.emElaboracao + m.semDono, m.total);
    }
    assert.equal(serie[serie.length - 1].semDono, 2);
  });

  it("inspeção deletada e mês fora da janela não entram", () => {
    const docs = [doc({ id_inspecao: "A", status: "DELETADA" }), doc({ id_inspecao: "B" })];
    const serie = serieMensalAssociacoes(
      [
        assoc({ id_inspecao: "A" }),
        assoc({ id_inspecao: "B", created_at: "2020-01-02T12:00:00Z" }),
      ],
      docs,
      AGO26,
      6,
      (abs) => rotuloMesAbs(abs),
      mesAbsSP,
    );
    assert.equal(serie.reduce((s, m) => s + m.total, 0), 0);
  });
});
