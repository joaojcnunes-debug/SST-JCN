import { test, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  conclusaoEhAproximada,
  ehCopiaOuRevisao,
  ehRenovacao,
  mesDeConclusao,
  mesDeRealizacao,
  porTecnico,
  resumoCredito,
  serieMensal,
  type InspecaoContavel,
} from "./inspecoes";
import { mesAbsDataSP, rotuloMesAbs } from "./mes";

/**
 * Testes da régua do dashboard de inspeções.
 *
 * Cada bloco aqui corresponde a um defeito MEDIDO na base em 2026-08-24, não a
 * um risco imaginado:
 *
 *  - o gráfico contava conclusões e o título dizia inspeções (maio: 16 × 110);
 *  - cópia e revisão entravam como visita nova (13% da base);
 *  - uma concluída sem data de conclusão sumia do gráfico e aparecia na tela de
 *    detalhe (julho: 219 × 220);
 *  - visita no dia 1º do mês cairia no mês anterior se a data pura passasse
 *    pelo conversor de fuso (18 inspeções).
 */

const AGO26 = 2026 * 12 + 7; // agosto/2026

function insp(over: Partial<InspecaoContavel>): InspecaoContavel {
  return {
    status: "CONCLUIDA",
    data_inspecao: "2026-08-10",
    concluida_em: "2026-08-15T12:00:00Z",
    created_at: "2026-08-11T12:00:00Z",
    tipo_criacao: "BRANCO",
    ...over,
  };
}

const rotulo = (abs: number) => rotuloMesAbs(abs, true);

describe("data pura da visita não passa por fuso", () => {
  test("dia 1º fica no próprio mês", () => {
    // Com `new Date("2026-07-01")` isso viraria meia-noite UTC e, em São Paulo,
    // 30/06 — jogando a visita para junho. São 18 inspeções da base.
    assert.equal(mesAbsDataSP("2026-07-01"), 2026 * 12 + 6, "julho");
    assert.equal(mesAbsDataSP("2026-06-01"), 2026 * 12 + 5, "junho");
    assert.equal(mesAbsDataSP("2026-01-01"), 2026 * 12 + 0, "janeiro");
  });

  test("dia qualquer e formato inválido", () => {
    assert.equal(mesAbsDataSP("2026-08-24"), AGO26);
    assert.equal(mesAbsDataSP(null), null);
    assert.equal(mesAbsDataSP(""), null);
    assert.equal(mesAbsDataSP("nao e data"), null);
  });
});

describe("cópia e revisão não são visita nova", () => {
  test("só BRANCO é visita nova", () => {
    assert.equal(ehCopiaOuRevisao("BRANCO"), false);
    assert.equal(ehCopiaOuRevisao("COPIA_EMPRESA"), true);
    assert.equal(ehCopiaOuRevisao("REVISAO"), true);
  });

  test("nulo ou vazio conta como visita nova (registro antigo, sem o campo)", () => {
    assert.equal(ehCopiaOuRevisao(null), false);
    assert.equal(ehCopiaOuRevisao(""), false);
  });

  test("continuam contando no total, mas separadas", () => {
    const linhas = [
      insp({ tipo_criacao: "BRANCO" }),
      insp({ tipo_criacao: "COPIA_EMPRESA" }),
      insp({ tipo_criacao: "REVISAO" }),
    ];
    const [mes] = serieMensal(linhas, AGO26, 1, rotulo);
    assert.equal(mes.novas, 1);
    assert.equal(mes.copias, 2);
    assert.equal(mes.realizadas, 3, "o total não muda — só passa a ser divisível");
  });
});

describe("realizada e concluída são meses diferentes", () => {
  test("visita em maio, conclusão em agosto, conta uma vez em cada", () => {
    const linhas = [
      insp({ data_inspecao: "2026-05-20", concluida_em: "2026-08-02T12:00:00Z" }),
    ];
    const serie = serieMensal(linhas, AGO26, 6, rotulo);
    const maio = serie.find((m) => m.mes === "Mai/26")!;
    const agosto = serie.find((m) => m.mes === "Ago/26")!;
    assert.equal(maio.realizadas, 1);
    assert.equal(maio.concluidas, 0);
    assert.equal(agosto.realizadas, 0);
    assert.equal(agosto.concluidas, 1);
  });

  test("inspeção não concluída conta como realizada e nada mais", () => {
    const linhas = [insp({ status: "EM_ANDAMENTO", concluida_em: null })];
    const [mes] = serieMensal(linhas, AGO26, 1, rotulo);
    assert.equal(mes.realizadas, 1);
    assert.equal(mes.concluidas, 0);
  });
});

describe("concluída SEM data de conclusão não some", () => {
  test("cai no created_at em vez de ser descartada", () => {
    // Era o caso da INS-DF6A59F2: o card mostrava 219 em julho e a tela de
    // detalhe, 220. O fallback existia nos dois, mas a consulta do card
    // filtrava por `concluida_em >= X` e nulo nunca passa na comparação.
    const linha = insp({
      concluida_em: null,
      created_at: "2026-07-30T12:00:00Z",
      data_inspecao: "2026-07-29",
    });
    assert.equal(mesDeConclusao(linha), 2026 * 12 + 6, "julho, pelo created_at");

    const serie = serieMensal([linha], AGO26, 6, rotulo);
    const julho = serie.find((m) => m.mes === "Jul/26")!;
    assert.equal(julho.concluidas, 1);
  });

  test("só CONCLUIDA tem mês de conclusão", () => {
    assert.equal(mesDeConclusao(insp({ status: "EM_ANDAMENTO" })), null);
    assert.equal(mesDeConclusao(insp({ status: "CONCLUIDA" })), AGO26);
  });
});

describe("a janela de meses", () => {
  test("fora da janela não entra, e nada estoura o array", () => {
    const linhas = [
      insp({ data_inspecao: "2020-01-05", concluida_em: "2020-01-06T12:00:00Z" }),
      insp({ data_inspecao: "2030-01-05", concluida_em: "2030-01-06T12:00:00Z" }),
      insp({ data_inspecao: "2026-08-05" }),
    ];
    const serie = serieMensal(linhas, AGO26, 6, rotulo);
    assert.equal(serie.length, 6);
    assert.equal(serie.reduce((s, m) => s + m.realizadas, 0), 1);
    assert.equal(serie.reduce((s, m) => s + m.concluidas, 0), 1);
  });

  test("deletada não entra em nada", () => {
    const serie = serieMensal([insp({ status: "DELETADA" })], AGO26, 1, rotulo);
    assert.equal(serie[0].realizadas, 0);
    assert.equal(serie[0].concluidas, 0);
  });

  test("sem data de visita não conta como realizada", () => {
    const serie = serieMensal([insp({ data_inspecao: null })], AGO26, 1, rotulo);
    assert.equal(serie[0].realizadas, 0);
    assert.equal(serie[0].concluidas, 1, "mas a conclusão continua valendo");
  });

  test("os rótulos vêm na ordem, terminando no mês atual", () => {
    const serie = serieMensal([], AGO26, 3, rotulo);
    assert.deepEqual(serie.map((m) => m.mes), ["Jun/26", "Jul/26", "Ago/26"]);
  });
});

describe("por técnico", () => {
  test("separa visita nova de cópia, e ordena pelo total", () => {
    const linhas = [
      insp({ responsavel: "Ana", tipo_criacao: "BRANCO" }),
      insp({ responsavel: "Ana", tipo_criacao: "COPIA_EMPRESA" }),
      insp({ responsavel: "Ana", tipo_criacao: "COPIA_EMPRESA" }),
      insp({ responsavel: "Bruno", tipo_criacao: "BRANCO" }),
    ];
    const r = porTecnico(linhas);
    assert.equal(r[0].tecnico, "Ana");
    assert.deepEqual({ novas: r[0].novas, copias: r[0].copias, total: r[0].total }, { novas: 1, copias: 2, total: 3 });
    assert.equal(r[1].tecnico, "Bruno");
  });

  test("sem responsável vira um grupo próprio, não some", () => {
    const r = porTecnico([insp({ responsavel: null }), insp({ responsavel: "  " })]);
    assert.equal(r.length, 1);
    assert.equal(r[0].tecnico, "Sem responsável");
    assert.equal(r[0].total, 2);
  });
});

describe("mês de realização", () => {
  test("lê a data pura, não o instante de criação", () => {
    assert.equal(mesDeRealizacao(insp({ data_inspecao: "2026-06-01" })), 2026 * 12 + 5);
    assert.equal(mesDeRealizacao(insp({ data_inspecao: null })), null);
  });
});

// ─── Contagem por técnico depois da decisão de 2026-08-25 ──────────────────

describe("porTecnico — soma as duas fontes", () => {
  const CADASTRO = ["Nathan Ferreira", "Elaine Maia de Oliveira", "Daniele Alves"];

  const insp = (id: string, quemAbriu: string, tipo: string | null = "BRANCO") => ({
    id_inspecao: id,
    status: "CONCLUIDA",
    data_inspecao: "2026-07-10",
    concluida_em: "2026-07-11T12:00:00Z",
    created_at: "2026-07-10T12:00:00Z",
    tipo_criacao: tipo,
    responsavel: quemAbriu,
  });

  it("com técnico de campo, conta ELE e não quem abriu", () => {
    const r = porTecnico([insp("I1", "Phelipe Klein")], {
      tecnicosDeCampo: new Map([["I1", ["Elaine Maia"]]]),
      cadastro: CADASTRO,
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].tecnico, "Elaine Maia de Oliveira");
    assert.equal(r[0].semRegistro, 0);
  });

  it("dois técnicos na mesma inspeção contam UMA inteira para cada", () => {
    const r = porTecnico([insp("I1", "Nathan Ferreira")], {
      tecnicosDeCampo: new Map([["I1", ["Nathan Ferreira", "Elaine Maia"]]]),
      cadastro: CADASTRO,
    });
    assert.deepEqual(
      r.map((t) => [t.tecnico, t.total]).sort(),
      [["Elaine Maia de Oliveira", 1], ["Nathan Ferreira", 1]].sort(),
    );
  });

  it("a mesma pessoa escrita de dois jeitos não vira duas barras", () => {
    const r = porTecnico([insp("I1", "Nathan Ferreira")], {
      tecnicosDeCampo: new Map([["I1", ["Elaine Maia", "Elaine Maia de Oliveira"]]]),
      cadastro: CADASTRO,
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].total, 1);
  });

  it("sem registro de campo, cai em quem abriu — e MARCA que caiu", () => {
    // É o caso da Daniele: 40 inspeções sem a aba preenchida. Trocar a fonte
    // por completo a derrubaria de 41 para 1.
    const r = porTecnico([insp("I1", "Daniele Alves")], {
      tecnicosDeCampo: new Map(),
      cadastro: CADASTRO,
    });
    assert.equal(r[0].tecnico, "Daniele Alves");
    assert.equal(r[0].total, 1);
    assert.equal(r[0].semRegistro, 1);
  });

  it("cópia continua separada de visita nova", () => {
    const r = porTecnico([insp("I1", "Nathan Ferreira", "COPIA_EMPRESA")], {
      tecnicosDeCampo: new Map([["I1", ["Nathan Ferreira"]]]),
      cadastro: CADASTRO,
    });
    assert.equal(r[0].copias, 1);
    assert.equal(r[0].novas, 0);
  });

  it("sem nenhuma opção, o comportamento antigo continua de pé", () => {
    const r = porTecnico([insp("I1", "Nathan Ferreira")]);
    assert.equal(r[0].tecnico, "Nathan Ferreira");
    assert.equal(r[0].total, 1);
  });

  it("resumoCredito conta o buraco de preenchimento", () => {
    const rows = [insp("I1", "A"), insp("I2", "B"), insp("I3", "C")];
    const c = resumoCredito(rows, new Map([["I1", ["Nathan Ferreira"]]]));
    assert.deepEqual(c, { comRegistro: 1, semRegistro: 2 });
  });

  /**
   * FASE B (2026-09-10) — o dashboard passa a PREFERIR o vínculo gravado pela
   * v204 em vez de deduzir quem é a pessoa a partir do texto digitado.
   *
   * Os testes acima ficaram intocados de propósito: eles mandam `string` puro,
   * o formato de antes, e continuar passando é o que prova que a Fase B não
   * mexeu no caminho antigo.
   */
  const CONTAS = [
    { id_usuario: "USR-1", nome: "Nathan Ferreira" },
    { id_usuario: "USR-2", nome: "Elaine Maia de Oliveira" },
    { id_usuario: "USR-3", nome: "Daniele Alves" },
  ];

  it("com vínculo gravado, o texto digitado NÃO importa mais", () => {
    // A 45ª grafia que apareceu na base em 10/09 é exatamente este caso: um
    // jeito de escrever que o tradutor não alcança. Com o vínculo, alcança.
    const r = porTecnico([insp("I1", "Phelipe Klein")], {
      tecnicosDeCampo: new Map([
        ["I1", [{ digitado: "elaininha da seguranca", idUsuario: "USR-2" }]],
      ]),
      cadastro: CADASTRO,
      contas: CONTAS,
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].tecnico, "Elaine Maia de Oliveira");
    assert.equal(r[0].semRegistro, 0);
  });

  it("o vínculo GANHA do tradutor quando os dois responderiam", () => {
    const r = porTecnico([insp("I1", "Phelipe Klein")], {
      tecnicosDeCampo: new Map([
        // O texto casaria com o Nathan; o vínculo diz que foi a Elaine.
        ["I1", [{ digitado: "Nathan Ferreira", idUsuario: "USR-2" }]],
      ]),
      cadastro: CADASTRO,
      contas: CONTAS,
    });
    assert.equal(r[0].tecnico, "Elaine Maia de Oliveira");
  });

  it("linha SEM vínculo continua caindo no tradutor", () => {
    const r = porTecnico([insp("I1", "Phelipe Klein")], {
      tecnicosDeCampo: new Map([
        ["I1", [{ digitado: "Elaine Maia", idUsuario: null }]],
      ]),
      cadastro: CADASTRO,
      contas: CONTAS,
    });
    assert.equal(r[0].tecnico, "Elaine Maia de Oliveira");
  });

  it("vínculo e grafia da MESMA pessoa não viram duas barras", () => {
    const r = porTecnico([insp("I1", "Phelipe Klein")], {
      tecnicosDeCampo: new Map([
        [
          "I1",
          [
            { digitado: "Elaine Maia", idUsuario: "USR-2" },
            { digitado: "Elaine Maia de Oliveira", idUsuario: null },
          ],
        ],
      ]),
      cadastro: CADASTRO,
      contas: CONTAS,
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].total, 1);
  });

  it("id gravado que não está na lista de contas NÃO some do gráfico", () => {
    // A lista de contas é uma consulta a mais; se ela falhar, o pior que pode
    // acontecer é voltar ao comportamento antigo -- nunca perder a pessoa.
    const r = porTecnico([insp("I1", "Phelipe Klein")], {
      tecnicosDeCampo: new Map([
        ["I1", [{ digitado: "Elaine Maia", idUsuario: "USR-INEXISTENTE" }]],
      ]),
      cadastro: CADASTRO,
      contas: CONTAS,
    });
    assert.equal(r[0].tecnico, "Elaine Maia de Oliveira");
  });

  it("sem a lista de contas, o vínculo é ignorado e vale o texto", () => {
    const r = porTecnico([insp("I1", "Phelipe Klein")], {
      tecnicosDeCampo: new Map([
        ["I1", [{ digitado: "Elaine Maia", idUsuario: "USR-2" }]],
      ]),
      cadastro: CADASTRO,
    });
    assert.equal(r[0].tecnico, "Elaine Maia de Oliveira");
  });

  it("o PLANO B sobrevive à Fase B — é o caso da Daniele", () => {
    // 158 das 680 inspeções (medido em 10/09) não têm linha de responsáveis
    // nenhuma. Se a Fase B tivesse trocado a fonte, todas elas sairiam do
    // gráfico. Este teste é a trava contra isso.
    const r = porTecnico([insp("I1", "Daniele Alves")], {
      tecnicosDeCampo: new Map(),
      cadastro: CADASTRO,
      contas: CONTAS,
    });
    assert.equal(r[0].tecnico, "Daniele Alves");
    assert.equal(r[0].total, 1);
    assert.equal(r[0].semRegistro, 1);
  });

  it("linha com texto vazio e vínculo nulo não credita ninguém de campo", () => {
    const r = porTecnico([insp("I1", "Daniele Alves")], {
      tecnicosDeCampo: new Map([["I1", [{ digitado: "  ", idUsuario: null }]]]),
      cadastro: CADASTRO,
      contas: CONTAS,
    });
    assert.equal(r[0].tecnico, "Daniele Alves");
    assert.equal(r[0].semRegistro, 1);
  });

  it("resumoCredito entende a forma nova sem mudar de resposta", () => {
    const rows = [insp("I1", "A"), insp("I2", "B")];
    const c = resumoCredito(
      rows,
      new Map([["I1", [{ digitado: "Nathan Ferreira", idUsuario: "USR-1" }]]]),
    );
    assert.deepEqual(c, { comRegistro: 1, semRegistro: 1 });
  });
});

/**
 * A data de conclusão só é carimbada desde a v154 (04/08/2026). O que é
 * anterior herdou `updated_at` no backfill — a última alteração, não a
 * conclusão. Medido em 2026-08-27: 371 das 492 concluídas são assim, e julho
 * aparece com 220 conclusões (219 estimadas) contra 148 visitas.
 */
describe("conclusão com data estimada (backfill v154)", () => {
  it("antes da v154 é estimada; depois é carimbo real", () => {
    assert.equal(conclusaoEhAproximada(insp({ concluida_em: "2026-07-30T12:00:00Z" })), true);
    assert.equal(conclusaoEhAproximada(insp({ concluida_em: "2026-08-20T12:00:00Z" })), false);
  });

  it("concluída sem data nenhuma é estimada — cai no created_at", () => {
    assert.equal(conclusaoEhAproximada(insp({ concluida_em: null })), true);
  });

  it("inspeção não concluída não tem data de conclusão para estimar", () => {
    assert.equal(
      conclusaoEhAproximada(insp({ status: "EM_ANDAMENTO", concluida_em: null })),
      false,
    );
  });

  it("a série separa as duas e o total continua sendo a soma", () => {
    const linhas = [
      insp({ data_inspecao: "2026-06-02", concluida_em: "2026-07-10T12:00:00Z" }), // estimada
      insp({ data_inspecao: "2026-07-02", concluida_em: "2026-07-11T12:00:00Z" }), // estimada
      insp({ data_inspecao: "2026-08-02", concluida_em: "2026-08-20T12:00:00Z" }), // real
    ];
    const serie = serieMensal(linhas, AGO26, 6, (abs) => rotuloMesAbs(abs));
    const jul = serie[serie.length - 2];
    const ago = serie[serie.length - 1];
    assert.deepEqual(
      [jul.concluidas, jul.concluidasReais, jul.concluidasAprox],
      [2, 0, 2],
    );
    assert.deepEqual(
      [ago.concluidas, ago.concluidasReais, ago.concluidasAprox],
      [1, 1, 0],
    );
    for (const m of serie) {
      assert.equal(m.concluidas, m.concluidasReais + m.concluidasAprox);
    }
  });

  /**
   * A safra do mês — pedido de 08/09 para o balão do gráfico.
   *
   * O que estes testes travam é a diferença entre as duas leituras. Antes de
   * existirem estas parcelas, "quantas de agosto ainda estão abertas?" só teria
   * uma resposta à mão: `realizadas - concluidas`. Ela é ERRADA, e o primeiro
   * teste é o contraexemplo — as duas contam coortes diferentes e a subtração
   * chega a dar negativo.
   */
  it("a safra fica no mês da VISITA, não no da finalização", () => {
    const serie = serieMensal(
      [insp({ data_inspecao: "2026-05-04", concluida_em: "2026-08-20T12:00:00Z" })],
      AGO26,
      6,
      (abs) => rotuloMesAbs(abs),
    );
    const maio = serie[serie.length - 4];
    const ago = serie[serie.length - 1];

    assert.deepEqual(
      [maio.realizadas, maio.safraConcluidas, maio.safraEmAberto],
      [1, 1, 0],
      "a visita de maio já fechou: conta em maio",
    );
    assert.deepEqual(
      [ago.realizadas, ago.concluidas, ago.safraConcluidas, ago.safraEmAberto],
      [0, 1, 0, 0],
      "agosto recebe a CONCLUSÃO, mas nenhuma safra — não houve visita",
    );
    // O contraexemplo: em agosto a subtração daria -1.
    assert.equal(ago.realizadas - ago.concluidas, -1);
  });

  it("em aberto junta Rascunho e Em andamento, e nunca Deletada", () => {
    const serie = serieMensal(
      [
        insp({ status: "CONCLUIDA" }),
        insp({ status: "EM_ANDAMENTO", concluida_em: null }),
        insp({ status: "RASCUNHO", concluida_em: null }),
        insp({ status: "DELETADA", concluida_em: null }),
      ],
      AGO26,
      6,
      (abs) => rotuloMesAbs(abs),
    );
    const ago = serie[serie.length - 1];
    assert.deepEqual(
      [ago.safraConcluidas, ago.safraEmAberto, ago.realizadas],
      [1, 2, 3],
      "'Em andamento' sozinho deixaria o rascunho de fora",
    );
  });

  it("as duas parcelas da safra sempre fecham com as realizadas", () => {
    const serie = serieMensal(
      [
        insp({ data_inspecao: "2026-06-02", status: "EM_ANDAMENTO", concluida_em: null }),
        insp({ data_inspecao: "2026-07-02", tipo_criacao: "COPIA_EMPRESA" }),
        insp({ data_inspecao: "2026-08-02", status: "RASCUNHO", concluida_em: null }),
        insp({ data_inspecao: "2026-08-03" }),
      ],
      AGO26,
      6,
      (abs) => rotuloMesAbs(abs),
    );
    for (const m of serie) {
      assert.equal(
        m.safraConcluidas + m.safraEmAberto,
        m.realizadas,
        `${m.mes}: a safra tem que fechar com as realizadas`,
      );
    }
  });
});

/**
 * O destino da visita: das inspeções creditadas a cada pessoa, quantas já
 * viraram documento entregue ao cliente. Pedido em 27/08 para o bloco que
 * aparece ao passar o mouse na barra do técnico.
 */
describe("documento entregue × em aberto, por técnico", () => {
  it("separa nos três estados — entregue, em elaboração e ninguém pegou", () => {
    const linhas = [
      insp({ id_inspecao: "A", responsavel: "Nathalia", elaboracao_status: "CONCLUIDO" }),
      insp({ id_inspecao: "B", responsavel: "Nathalia", elaboracao_status: "EM_ELABORACAO" }),
      insp({ id_inspecao: "C", responsavel: "Nathalia", elaboracao_status: null }),
      insp({ id_inspecao: "D", responsavel: "Nathalia", elaboracao_status: "PENDENTE" }),
    ];
    const [t] = porTecnico(linhas);
    assert.deepEqual(
      [t.total, t.docEntregue, t.docEmElaboracao, t.docNaoIniciado],
      [4, 1, 1, 2],
    );
  });

  it("os três estados fecham com o total, sempre", () => {
    const linhas = [
      insp({ id_inspecao: "A", responsavel: "Ana", elaboracao_status: "CONCLUIDO" }),
      insp({ id_inspecao: "B", responsavel: "Ana", tipo_criacao: "COPIA_EMPRESA" }),
      insp({ id_inspecao: "C", responsavel: "Bia", elaboracao_status: "PENDENTE" }),
    ];
    for (const t of porTecnico(linhas)) {
      assert.equal(t.docEntregue + t.docEmElaboracao + t.docNaoIniciado, t.total);
    }
  });

  it("os dois técnicos de uma visita dividida recebem o mesmo destino", () => {
    const linhas = [insp({ id_inspecao: "A", elaboracao_status: "CONCLUIDO" })];
    const mapa = new Map([["A", ["Nathan Ferreira", "Elaine Maia"]]]);
    const r = porTecnico(linhas, { tecnicosDeCampo: mapa, cadastro: [] });
    assert.equal(r.length, 2);
    for (const t of r) assert.deepEqual([t.total, t.docEntregue], [1, 1]);
  });
});

describe("renovação de documento não é inspeção (23/09)", () => {
  // 48 concluídas de 15–21/09 eram só o administrativo registrando a empresa
  // ou a data dos documentos. Elas não podem entrar em gráfico nenhum.
  const renov = insp({ tipo_criacao: "RENOVACAO", id_inspecao: "R" });
  const visita = insp({ tipo_criacao: "BRANCO", id_inspecao: "V", responsavel: "Ana" });

  it("renovação não é cópia — senão contaria separado, e não é para contar", () => {
    assert.equal(ehRenovacao("RENOVACAO"), true);
    assert.equal(ehRenovacao(" renovacao "), true);
    assert.equal(ehRenovacao("BRANCO"), false);
    assert.equal(ehRenovacao(null), false);
    assert.equal(ehCopiaOuRevisao("RENOVACAO"), false);
    assert.equal(ehCopiaOuRevisao("COPIA_EMPRESA"), true);
  });

  it("não tem mês de visita nem de conclusão", () => {
    assert.equal(mesDeConclusao(renov), null);
    assert.equal(mesDeRealizacao(renov), null);
    assert.equal(mesDeConclusao(visita), AGO26);
  });

  it("a série mensal ignora a renovação por inteiro", () => {
    const [ago] = serieMensal([renov, visita], AGO26, 1, rotulo);
    assert.equal(ago.realizadas, 1);
    assert.equal(ago.novas, 1);
    assert.equal(ago.copias, 0);
    assert.equal(ago.concluidas, 1);
    assert.equal(ago.safraConcluidas + ago.safraEmAberto, ago.realizadas);
  });

  it("ninguém é creditado pela renovação", () => {
    const r = porTecnico([{ ...renov, responsavel: "Emilia" }, visita]);
    assert.deepEqual(r.map((t) => [t.tecnico, t.total]), [["Ana", 1]]);
  });
});
