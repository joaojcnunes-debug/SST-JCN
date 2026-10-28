import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  concluidosPorAdm,
  concluidosPorMes,
  concluidosValidos,
  foraDoGraficoMensal,
  SEM_RESPONSAVEL,
  porAssociado,
  porSituacao,
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
  it("28/10: associada que ainda não iniciou fica em 'atribuído' (semDono), igual à lista", () => {
    const docs = [
      doc({ id_inspecao: "A", elaboracao_responsavel: "Ana", elaboracao_status: "CONCLUIDO" }),
      doc({ id_inspecao: "B", elaboracao_responsavel: "Ana", elaboracao_status: "EM_ELABORACAO" }),
      // Ana está no chip, mas não começou: a lista diz "Atribuído · Ana".
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

describe("porSituacao — donut do dashboard pela régua da lista (13/10)", () => {
  it("28/10: associado sem início vai para Atribuídos; Assumidos só com início de verdade", () => {
    const docs = [
      doc({ id_inspecao: "A", elaboracao_status: "CONCLUIDO" }),
      doc({ id_inspecao: "B", elaboracao_status: "EM_ELABORACAO" }),
      // Bia no chip, sem início: a lista diz "Atribuído · Bia".
      doc({ id_inspecao: "C", elaboracao_status: "PENDENTE" }),
      doc({ id_inspecao: "D", elaboracao_status: null, elaboracao_responsavel: "Caio" }),
      doc({ id_inspecao: "E", elaboracao_status: "PENDENTE" }),
    ];
    assert.deepEqual(porSituacao([assoc({ id_inspecao: "C", nome: "Bia" })], docs), {
      aguardandoCampo: 0,
      pendentes: 1,
      atribuidos: 2,
      assumidos: 1,
      concluidos: 1,
    });
  });

  it("inspeção em campo sem ninguém não é pendência; com associado fica 'aguardando campo' (28/10)", () => {
    const docs = [
      doc({ id_inspecao: "A", status: "EM_ANDAMENTO", elaboracao_status: null }),
      doc({ id_inspecao: "B", status: "EM_ANDAMENTO", elaboracao_status: null }),
      doc({ id_inspecao: "C", status: "DELETADA", elaboracao_status: "PENDENTE" }),
    ];
    assert.deepEqual(porSituacao([assoc({ id_inspecao: "B" }), assoc({ id_inspecao: "C" })], docs), {
      aguardandoCampo: 1,
      pendentes: 0,
      atribuidos: 0,
      assumidos: 0,
      concluidos: 0,
    });
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
    // B e C têm gente no documento, mas ninguém começou: desde 28/10 (v309) são
    // "Atribuídos" — contam em semDono, não em elaboração, como a lista diz.
    const ago = serie[serie.length - 1];
    assert.deepEqual([ago.entregues, ago.emElaboracao, ago.semDono], [1, 0, 2]);
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

describe("foraDoGraficoMensal — o cabeçalho × a soma das barras (22/09)", () => {
  it("explica a diferença pelos dois motivos, e eles fecham com ela", () => {
    const docs = [
      doc({ id_inspecao: "A" }), // associado no período: está nas barras
      doc({ id_inspecao: "B", elaboracao_responsavel: "Paulina Cunha" }), // assumido sem registro
      doc({ id_inspecao: "C" }), // associado antes da janela
      doc({ id_inspecao: "D" }), // sem dono: não conta em lugar nenhum
      doc({ id_inspecao: "E", status: "DELETADA" }),
    ];
    const assocs = [
      assoc({ id_inspecao: "A" }),
      assoc({ id_inspecao: "C", created_at: "2020-01-02T12:00:00Z" }),
      assoc({ id_inspecao: "E" }),
    ];
    const serie = serieMensalAssociacoes(assocs, docs, AGO26, 6, (abs) => rotuloMesAbs(abs), mesAbsSP);
    const r = foraDoGraficoMensal(assocs, docs, serie);
    const { comAssociacao, semAssociacao } = resumoAssociacao(assocs, docs);
    const nasBarras = serie.reduce((n, m) => n + m.total, 0);
    assert.equal(comAssociacao + semAssociacao - nasBarras, r.total);
    assert.deepEqual(r, { total: 2, semRegistro: 1, antesDoPeriodo: 1 });
  });
});

describe("documentos concluídos pelo ADM (card × detalhe)", () => {
  const c = (over: Partial<{ status: string | null; elaboracao_concluida_em: string | null; elaboracao_responsavel: string | null }> = {}) => ({
    status: "CONCLUIDA",
    elaboracao_concluida_em: "2026-08-10T12:00:00Z",
    elaboracao_responsavel: "Ana Luiza",
    ...over,
  });

  it("inspeção excluída e linha sem data de conclusão ficam fora", () => {
    const linhas = [c(), c({ status: "DELETADA" }), c({ elaboracao_concluida_em: null })];
    assert.equal(concluidosValidos(linhas).length, 1);
    assert.deepEqual(concluidosPorMes(linhas, AGO26, 2, mesAbsSP), [
      { chave: JUL26, total: 0 },
      { chave: AGO26, total: 1 },
    ]);
  });

  it("o mês é o de São Paulo: 01/09 01h UTC ainda é agosto", () => {
    const serie = concluidosPorMes([c({ elaboracao_concluida_em: "2026-09-01T01:00:00Z" })], AGO26 + 1, 2, mesAbsSP);
    assert.deepEqual(serie.map((m) => m.total), [1, 0]);
  });

  it("fora da janela não entra em mês nenhum", () => {
    const serie = concluidosPorMes([c({ elaboracao_concluida_em: "2025-01-10T12:00:00Z" })], AGO26, 6, mesAbsSP);
    assert.equal(serie.reduce((n, m) => n + m.total, 0), 0);
  });

  it("mesmo ADM com caixa, acento ou espaço diferentes é UMA barra, com a grafia mais usada", () => {
    const linhas = [
      c(),
      c(),
      c({ elaboracao_responsavel: "ana luíza" }),
      c({ elaboracao_responsavel: "  Ana   Luiza " }),
      c({ elaboracao_responsavel: "Paulina Cunha" }),
      c({ elaboracao_responsavel: "  " }),
    ];
    assert.deepEqual(concluidosPorAdm(linhas, null, mesAbsSP), [
      { adm: "Ana Luiza", total: 4 },
      { adm: "Paulina Cunha", total: 1 },
      { adm: SEM_RESPONSAVEL, total: 1 },
    ]);
  });

  it("filtra pelo mês pedido e o total do card fecha com o do detalhe", () => {
    const linhas = [c(), c({ elaboracao_concluida_em: "2026-07-05T12:00:00Z" }), c({ status: "DELETADA" })];
    assert.deepEqual(concluidosPorAdm(linhas, JUL26, mesAbsSP), [{ adm: "Ana Luiza", total: 1 }]);
    const card = concluidosPorMes(linhas, AGO26, 6, mesAbsSP).reduce((n, m) => n + m.total, 0);
    const detalhe = concluidosPorAdm(linhas, null, mesAbsSP).reduce((n, a) => n + a.total, 0);
    assert.equal(card, detalhe);
  });
});

describe("v295 — documento: 1ª conclusão e responsável daquele momento (26/10/2026)", () => {
  const mesDe = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  it("reconcluído por outra pessoa continua no mês e na pessoa da 1ª conclusão", () => {
    const linhas = [
      {
        status: "CONCLUIDA",
        elaboracao_concluida_em: "2026-10-20T12:00:00Z",
        elaboracao_responsavel: "Bruno",
        primeira_elaboracao_em: "2026-09-15T12:00:00Z",
        primeira_elaboracao_por: "Ana",
      },
    ];
    assert.deepEqual(concluidosPorAdm(linhas, 2026 * 12 + 8, mesDe), [{ adm: "Ana", total: 1 }]);
    assert.deepEqual(concluidosPorAdm(linhas, 2026 * 12 + 9, mesDe), []);
  });
  it("reaberto (sem conclusão atual) ainda conta pela 1ª conclusão", () => {
    const linhas = [
      { status: "CONCLUIDA", elaboracao_concluida_em: null, elaboracao_responsavel: null, primeira_elaboracao_em: "2026-09-15T12:00:00Z", primeira_elaboracao_por: "Ana" },
    ];
    assert.equal(concluidosValidos(linhas).length, 1);
  });
});
