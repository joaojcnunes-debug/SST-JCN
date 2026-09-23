import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  algumaVisivel,
  mesclarChecklist,
  paraOBanco,
  perguntaOculta,
  textoEhOPadrao,
  type ChecklistPerguntaLike,
} from "./checklist";

const PADRAO: ChecklistPerguntaLike[] = [
  { slug: "uso_cadeira", secao: "Postura", tipo: "tristate", label: "Há cadeira disponível?" },
  { slug: "cadeira_adequada", secao: "Postura", tipo: "tristate", label: "A cadeira é estofada e revestida?" },
  { slug: "organizacao_trabalho", secao: "Organização do Trabalho", tipo: "texto", label: "As normas de produção…" },
];

describe("paraOBanco", () => {
  test("grava só as colunas que a tabela tem — `tipo` fica fora", () => {
    // Era exatamente o `tipo` que devolvia
    // "PGRST204 Could not find the 'tipo' column" em todo Salvar.
    const linha = paraOBanco({ slug: "uso_cadeira", secao: "Postura", tipo: "tristate", label: "x" });
    assert.deepEqual(Object.keys(linha).sort(), ["label", "oculta", "secao", "slug"]);
    assert.equal("tipo" in linha, false);
  });

  test("`oculta` sai sempre booleano — nunca undefined", () => {
    // A coluna é NOT NULL (v209): mandar undefined viraria erro de gravação.
    assert.equal(paraOBanco({ slug: "a", secao: "b", label: "c" }).oculta, false);
    assert.equal(paraOBanco({ slug: "a", secao: "b", label: "c", oculta: true }).oculta, true);
  });
});

describe("mesclarChecklist", () => {
  test("tabela vazia devolve o padrão inteiro", () => {
    assert.deepEqual(mesclarChecklist(PADRAO, []), PADRAO);
    assert.deepEqual(mesclarChecklist(PADRAO, null), PADRAO);
  });

  test("uma pergunta salva NÃO esconde as outras", () => {
    // O defeito antigo: `data.length > 0 ? data : PADRAO` fazia a tela de
    // configuração passar a exibir uma única pergunta.
    const r = mesclarChecklist(PADRAO, [
      { slug: "cadeira_adequada", secao: "Postura", label: "O assento possui altura ajustável?" },
    ]);
    assert.equal(r.length, 3);
    assert.equal(r[1].label, "O assento possui altura ajustável?");
    assert.equal(r[0].label, "Há cadeira disponível?");
    assert.equal(r[2].label, "As normas de produção…");
  });

  test("o `tipo` sobrevive: vem do padrão, porque o banco não o guarda", () => {
    const r = mesclarChecklist(PADRAO, [
      { slug: "organizacao_trabalho", secao: "Organização do Trabalho", label: "Texto novo" },
    ]);
    const texto = r.find((p) => p.slug === "organizacao_trabalho");
    assert.equal(texto?.tipo, "texto", "sem isto a tela renderizaria caixa de 1 linha no lugar do parágrafo");
  });

  test("pergunta adicionada na tela entra como tristate", () => {
    // Sem o tipo ela desapareceria da tela de análise do AET, que filtra as
    // perguntas adicionadas por `tipo`.
    const r = mesclarChecklist(PADRAO, [
      { slug: "postura_1789000000000", secao: "Postura", label: "Pergunta nova" },
    ]);
    assert.equal(r.length, 4);
    assert.equal(r[3].slug, "postura_1789000000000");
    assert.equal(r[3].tipo, "tristate");
  });

  test("a ordem do padrão é preservada — é a que a tela e o PDF seguem", () => {
    const r = mesclarChecklist(PADRAO, [
      { slug: "nova_z", secao: "Postura", label: "Z" },
      { slug: "organizacao_trabalho", secao: "Organização do Trabalho", label: "T" },
      { slug: "uso_cadeira", secao: "Postura", label: "U" },
    ]);
    assert.deepEqual(r.map((p) => p.slug), [
      "uso_cadeira", "cadeira_adequada", "organizacao_trabalho", "nova_z",
    ]);
  });

  test("a secao também pode ser trocada pelo banco", () => {
    const r = mesclarChecklist(PADRAO, [
      { slug: "uso_cadeira", secao: "Ritmo de Trabalho", label: "Há cadeira disponível?" },
    ]);
    assert.equal(r[0].secao, "Ritmo de Trabalho");
  });
});

describe("textoEhOPadrao", () => {
  test("diz se há edição para restaurar", () => {
    assert.equal(textoEhOPadrao(PADRAO, "uso_cadeira", "Há cadeira disponível?"), true);
    assert.equal(textoEhOPadrao(PADRAO, "uso_cadeira", "Outro texto"), false);
  });

  test("espaço em volta não conta como edição", () => {
    assert.equal(textoEhOPadrao(PADRAO, "uso_cadeira", "  Há cadeira disponível?  "), true);
  });

  test("slug que não é padrão nunca tem padrão para restaurar", () => {
    assert.equal(textoEhOPadrao(PADRAO, "postura_1789000000000", "qualquer"), false);
  });
});

describe("perguntaOculta e algumaVisivel (v209)", () => {
  const linhas = [
    { slug: "uso_cadeira", label: "x", secao: "Postura", oculta: true },
    { slug: "monitor", label: "y", secao: "Postura", oculta: false },
    { slug: "cadeira_adequada", label: "z", secao: "Postura" },
  ];

  test("só a linha que DIZ oculta está oculta", () => {
    assert.equal(perguntaOculta(linhas, "uso_cadeira"), true);
    assert.equal(perguntaOculta(linhas, "monitor"), false);
  });

  test("🔑 linha ausente é VISÍVEL, nunca excluída", () => {
    // A diferença que evita uma gravação incompleta sumir com a pergunta de
    // todos os laudos em silêncio — ver o cabeçalho da v209.
    assert.equal(perguntaOculta(linhas, "pausas_formais"), false);
    assert.equal(perguntaOculta([], "uso_cadeira"), false);
  });

  test("`oculta` nulo ou ausente na linha também é visível", () => {
    assert.equal(perguntaOculta(linhas, "cadeira_adequada"), false);
    assert.equal(perguntaOculta([{ slug: "a", oculta: null }], "a"), false);
  });

  test("a seção só desaparece quando TODAS as suas linhas somem", () => {
    assert.equal(algumaVisivel(linhas, ["uso_cadeira", "monitor"]), true);
    assert.equal(algumaVisivel(linhas, ["uso_cadeira"]), false);
    assert.equal(algumaVisivel(linhas, ["uso_cadeira", "pausas_formais"]), true, "slug sem linha conta como visível");
  });
});

describe("mesclarChecklist carrega a exclusão", () => {
  test("a marca do banco chega em quem desenha o laudo", () => {
    const base: ChecklistPerguntaLike[] = [
      { slug: "uso_cadeira", secao: "Postura", tipo: "tristate", label: "Padrão" },
    ];
    const r = mesclarChecklist(base, [
      { slug: "uso_cadeira", secao: "Postura", label: "Padrão", oculta: true },
    ]);
    assert.equal(r[0].oculta, true);
  });

  test("pergunta adicionada também pode ser marcada", () => {
    const base: ChecklistPerguntaLike[] = [
      { slug: "uso_cadeira", secao: "Postura", tipo: "tristate", label: "Padrão" },
    ];
    const r = mesclarChecklist(base, [
      { slug: "nova_1", secao: "Postura", label: "Nova", oculta: true },
    ]);
    assert.equal(r[1].oculta, true);
    assert.equal(r[1].tipo, "tristate");
  });
});
