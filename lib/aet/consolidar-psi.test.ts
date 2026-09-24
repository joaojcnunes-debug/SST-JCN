import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  consolidarPiorCaso,
  recalcularDasRespostas,
  zonaFromMedia,
  type FatorPsiLinha,
  type RespostaQpsLike,
} from "./consolidar-psi";
import { PERGUNTAS_DEFAULT } from "./perguntas-default";

// As perguntas de verdade, não um conjunto de mentira: a lógica de cada ordem
// (direta = 6−nota) é metade da conta, e um mapa inventado no teste passaria
// verde com o app errado.
const PERGUNTAS = PERGUNTAS_DEFAULT;

const SETOR = "SET-1";

function resposta(codigo_fator: string, pergunta_ordem: number, r: number, id_setor = SETOR): RespostaQpsLike {
  return { id_setor, codigo_fator, pergunta_ordem, resposta: r };
}

function linha(over: Partial<FatorPsiLinha> & { codigo_fator: string }): FatorPsiLinha {
  return { id_setor: SETOR, avaliado: true, media: null, zona: null, ...over };
}

describe("zonaFromMedia", () => {
  test("4,0 é o piso do verde", () => {
    assert.equal(zonaFromMedia(4.0), "verde");
    assert.equal(zonaFromMedia(3.99), "amarela");
  });

  test("3,96 é AMARELA — e é o caso que o arredondamento escondia", () => {
    // numeric(3,1) guardaria 4.0 e a tabela imprimiria "4.00 · Amarela",
    // contra a própria legenda. Por isso média e zona saem do mesmo valor.
    assert.equal(zonaFromMedia(3.96), "amarela");
  });

  test("os outros dois pisos e o nulo", () => {
    assert.equal(zonaFromMedia(3.0), "amarela");
    assert.equal(zonaFromMedia(2.0), "laranja");
    assert.equal(zonaFromMedia(1.99), "vermelha");
    assert.equal(zonaFromMedia(null), null);
  });
});

describe("recalcularDasRespostas", () => {
  // O laudo do setor CONDOMÍNIO, medido na produção em 11/09: o banco tinha
  // 4.3 nos dois fatores (numeric(3,1)) e o quadro geral imprimia "4.30" para
  // os dois. Os valores exatos são 17/4 e 13/3.
  const respostasCondominio: RespostaQpsLike[] = [
    // F03 — ordens 11(direta) 12(inv) 13(direta) 14(inv) → 4+5+4+4 = 17
    resposta("F03", 11, 2),
    resposta("F03", 12, 5),
    resposta("F03", 13, 2),
    resposta("F03", 14, 4),
    // F05 — ordens 19(inv) 20(inv) 21(direta) → 4+5+4 = 13
    resposta("F05", 19, 4),
    resposta("F05", 20, 5),
    resposta("F05", 21, 2),
  ];

  test("F03 e F05 deixam de sair com a MESMA média", () => {
    const [f03, f05] = recalcularDasRespostas(
      [linha({ codigo_fator: "F03", media: 4.3, zona: "verde" }), linha({ codigo_fator: "F05", media: 4.3, zona: "verde" })],
      PERGUNTAS,
      respostasCondominio,
    );
    assert.equal(f03.media, 4.25);
    assert.equal(f05.media, 4.33);
    assert.notEqual(f03.media, f05.media);
  });

  test("a zona vem do mesmo valor recalculado", () => {
    const [f03] = recalcularDasRespostas(
      [linha({ codigo_fator: "F03", media: 4.3, zona: "verde" })],
      PERGUNTAS,
      respostasCondominio,
    );
    assert.equal(f03.zona, "verde");
  });

  test("retrato velho é substituído — o F01 gravado 2.0 com 1 de 5 respostas", () => {
    // Caso real da base: alguém salvou o fator, depois mexeu nas respostas, e
    // o gravado congelou em 2.0/laranja (Nível PGR "Alto") valendo 4.0/verde.
    const [f01] = recalcularDasRespostas(
      [linha({ codigo_fator: "F01", media: 2, zona: "laranja" })],
      PERGUNTAS,
      [resposta("F01", 2, 4)],
    );
    assert.equal(f01.media, 4);
    assert.equal(f01.zona, "verde");
  });

  test("F13 não é recalculado: não tem média e a zona é escolhida à mão", () => {
    const [f13] = recalcularDasRespostas(
      [linha({ codigo_fator: "F13", media: null, zona: "amarela" })],
      PERGUNTAS,
      // Respostas de F13 EXISTEM na base (a tela grava as ordens 48–50), então
      // sem a exceção o recálculo inventaria uma média que o laudo não usa.
      [resposta("F13", 48, 2), resposta("F13", 49, 2), resposta("F13", 50, 4)],
    );
    assert.equal(f13.media, null);
    assert.equal(f13.zona, "amarela");
  });

  test('sem resposta nenhuma, o fator sai "—" — o gravado NÃO é repetido', () => {
    // Até 22/09/2026 este teste afirmava o contrário ("o gravado é mantido"),
    // com o argumento de que repetir era melhor que inventar. Mas "—" não é
    // invenção, é "não medido" — e a tabela por setor do MESMO laudo já omitia
    // o fator nesse caso. O documento dizia duas coisas sobre o mesmo par.
    const [f09] = recalcularDasRespostas(
      [linha({ codigo_fator: "F09", media: 3.2, zona: "amarela" })],
      PERGUNTAS,
      [],
    );
    assert.equal(f09.media, null);
    assert.equal(f09.zona, null);
  });

  test("a zona cai JUNTO com a média — não sobra tarja colorida órfã", () => {
    // Zerar só a média deixaria "— · Laranja · Alto": zona e Nível PGR
    // pintando o laudo a partir de nada.
    const [f12] = recalcularDasRespostas(
      [linha({ codigo_fator: "F12", media: 2.3, zona: "laranja" })],
      PERGUNTAS,
      [],
    );
    assert.equal(f12.media, null);
    assert.equal(f12.zona, null);
  });

  test("fantasma sem resposta PERDE do valor real de outro setor no pior caso", () => {
    // O caso medido na produção em 22/09: F01 gravado 2.0/laranja num setor
    // que nunca respondeu, contra 4.0/verde real noutro. O quadro geral é o
    // pior caso, então o fantasma subia o laudo inteiro para o Nível "Alto".
    const geral = consolidarPiorCaso(
      recalcularDasRespostas(
        [
          linha({ codigo_fator: "F01", media: 2, zona: "laranja", id_setor: "SET-2" }),
          linha({ codigo_fator: "F01", media: 4, zona: "verde" }),
        ],
        PERGUNTAS,
        // Respostas só do setor padrão; SET-2 não respondeu nada.
        [resposta("F01", 1, 2), resposta("F01", 2, 4), resposta("F01", 3, 4),
         resposta("F01", 4, 2), resposta("F01", 5, 4)],
      ),
    );
    assert.equal(geral.length, 1);
    assert.equal(geral[0].zona, "verde");
  });

  test("resposta de OUTRO setor não entra na conta", () => {
    const [f05] = recalcularDasRespostas(
      [linha({ codigo_fator: "F05", media: 4.3, zona: "verde" })],
      PERGUNTAS,
      [...respostasCondominio, resposta("F05", 19, 1, "SET-2")],
    );
    assert.equal(f05.media, 4.33);
  });
});

describe("recalcular ANTES de consolidar", () => {
  test("o pior setor é escolhido pelo valor exato, não pelo retrato velho", () => {
    const linhas: FatorPsiLinha[] = [
      // Setor A: gravado laranja (retrato velho) mas as respostas dão 5,0.
      { id_setor: "A", codigo_fator: "F05", avaliado: true, media: 2, zona: "laranja" },
      // Setor B: gravado e exato batem em 3,33 (amarela) — é o pior de verdade.
      { id_setor: "B", codigo_fator: "F05", avaliado: true, media: 3.3, zona: "amarela" },
    ];
    const respostas: RespostaQpsLike[] = [
      resposta("F05", 19, 5, "A"),
      resposta("F05", 20, 5, "A"),
      resposta("F05", 21, 1, "A"),
      resposta("F05", 19, 3, "B"),
      resposta("F05", 20, 4, "B"),
      resposta("F05", 21, 3, "B"),
    ];

    const semRecalculo = consolidarPiorCaso(linhas);
    assert.equal(semRecalculo[0].id_setor, "A", "sem recálculo, o retrato velho ganha");

    const comRecalculo = consolidarPiorCaso(recalcularDasRespostas(linhas, PERGUNTAS, respostas));
    assert.equal(comRecalculo[0].id_setor, "B");
    assert.equal(comRecalculo[0].media, 3.33);
    assert.equal(comRecalculo[0].zona, "amarela");
  });
});
