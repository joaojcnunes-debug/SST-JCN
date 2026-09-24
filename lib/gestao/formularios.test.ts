import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { perguntaVisivel, faltando, comporTitulo, normalizarEtiquetaForm, dependentesDe, temCiclo, ordemExibicao, type PerguntaBase } from "./formularios";

const P: PerguntaBase[] = [
  { id: "a", label: "Houve afastamento?", obrigatorio: true, tipo: "selecao", opcoes: ["Sim", "Não"] },
  { id: "b", label: "Dias de afastamento", obrigatorio: true, tipo: "texto", condicao: { pergunta: "a", opcao: "Sim" } },
  { id: "c", label: "Motivo", obrigatorio: true, tipo: "texto_longo", condicao: { pergunta: "b", opcao: "x" } },
  { id: "d", label: "Produtos", obrigatorio: false, tipo: "multipla", opcoes: ["PGR", "PCMSO"] },
  { id: "e", label: "Detalhe PGR", obrigatorio: true, tipo: "texto", condicao: { pergunta: "d", opcao: "PGR" } },
  { label: "Sem id (form antigo)", obrigatorio: false, tipo: "texto" },
];

describe("perguntaVisivel (F1.5 condicional)", () => {
  test("sem condição = visível; condição satisfeita = visível; não satisfeita = oculta", () => {
    assert.equal(perguntaVisivel(P[0], P, ["Sim"]), true);
    assert.equal(perguntaVisivel(P[1], P, ["Sim"]), true);
    assert.equal(perguntaVisivel(P[1], P, ["Não"]), false);
    assert.equal(perguntaVisivel(P[1], P, []), false);
  });
  test("origem oculta esconde a cadeia; múltipla usa 'contém'", () => {
    assert.equal(perguntaVisivel(P[2], P, ["Não", "x"]), false); // b oculta → c oculta mesmo com b='x'
    assert.equal(perguntaVisivel(P[2], P, ["Sim", "x"]), true);
    assert.equal(perguntaVisivel(P[4], P, ["", "", "", ["PCMSO", "PGR"]]), true);
    assert.equal(perguntaVisivel(P[4], P, ["", "", "", ["PCMSO"]]), false);
  });
  test("condição apontando para id inexistente = oculta (não vaza)", () => {
    const q: PerguntaBase = { id: "z", label: "?", obrigatorio: false, condicao: { pergunta: "nao-existe", opcao: "Sim" } };
    assert.equal(perguntaVisivel(q, P, []), false);
  });
});

describe("faltando (obrigatórias só entre as visíveis)", () => {
  test("oculta obrigatória não bloqueia; visível obrigatória vazia bloqueia", () => {
    assert.deepEqual(faltando(P, ["Não"]).map((p) => p.id), []);
    assert.deepEqual(faltando(P, ["Sim"]).map((p) => p.id), ["b"]);
    assert.deepEqual(faltando(P, ["Sim", "3"]).map((p) => p.id), []);
    assert.deepEqual(faltando(P, ["Sim", "x", "", ["PGR"], ""]).map((p) => p.id), ["c", "e"]);
  });
});

describe("comporTitulo (task_title_composition_pattern)", () => {
  const Q: PerguntaBase[] = [{ id: "rs", label: "Razão Social", obrigatorio: true }, { id: "cnpj", label: "CNPJ", obrigatorio: true }];
  test("junta as partes com ' - ', ignora vazias, cai no título do form", () => {
    assert.equal(comporTitulo(["p:rs", "p:cnpj"], "Cadastro", Q, ["ACME", "12.345"]), "ACME - 12.345");
    assert.equal(comporTitulo(["p:rs", "p:cnpj"], "Cadastro", Q, ["ACME", ""]), "ACME");
    assert.equal(comporTitulo(["form_title", "p:rs"], "Cadastro", Q, ["ACME"]), "Cadastro - ACME");
    assert.equal(comporTitulo(["p:nada"], "Cadastro", Q, ["ACME"]), "Cadastro");
    assert.equal(comporTitulo(null, "Cadastro", Q, ["ACME"]), "");
    assert.equal(comporTitulo([], "Cadastro", Q, ["ACME"]), "");
  });
  test("resposta múltipla vira lista; corta em 200", () => {
    const M: PerguntaBase[] = [{ id: "m", label: "Produtos", obrigatorio: false, tipo: "multipla" }];
    assert.equal(comporTitulo(["p:m"], "F", M, [["PGR", "PCMSO"]]), "PGR, PCMSO");
    assert.equal(comporTitulo(["p:m"], "F", M, ["x".repeat(500)]).length, 200);
  });
});

describe("normalizarEtiquetaForm (tag como as automações esperam)", () => {
  test("minúsculas, sem acento, espaço preservado e colapsado", () => {
    assert.equal(normalizarEtiquetaForm("Teresópolis"), "teresopolis");
    assert.equal(normalizarEtiquetaForm("  Nova   Friburgo "), "nova friburgo");
    assert.equal(normalizarEtiquetaForm("Piabetá"), "piabeta");
    assert.equal(normalizarEtiquetaForm(""), "");
  });
});

describe("ciclo de condição (ressalva R1 do portão)", () => {
  const C: PerguntaBase[] = [
    { id: "a", label: "A", obrigatorio: true, tipo: "selecao", opcoes: ["x"], condicao: { pergunta: "b", opcao: "x" } },
    { id: "b", label: "B", obrigatorio: true, tipo: "selecao", opcoes: ["x"], condicao: { pergunta: "a", opcao: "x" } },
    { id: "s", label: "S", obrigatorio: true, tipo: "selecao", opcoes: ["x"], condicao: { pergunta: "s", opcao: "x" } },
    { id: "ok", label: "OK", obrigatorio: true, tipo: "texto" },
  ];
  test("A↔B e auto-referência ficam ocultas sem estourar a pilha; obrigatórias ocultas não bloqueiam", () => {
    assert.equal(perguntaVisivel(C[0], C, ["x", "x", "x"]), false);
    assert.equal(perguntaVisivel(C[1], C, ["x", "x", "x"]), false);
    assert.equal(perguntaVisivel(C[2], C, ["x", "x", "x"]), false);
    assert.deepEqual(faltando(C, []).map((p) => p.id), ["ok"]);
  });
  test("dependentesDe / temCiclo", () => {
    assert.deepEqual([...dependentesDe("a", C)].sort(), ["a", "b"]);
    assert.equal(temCiclo(C), true);
    assert.equal(temCiclo(P), false);
    assert.deepEqual([...dependentesDe("a", P)].sort(), ["b", "c"]);
  });
});

describe("ordemExibicao (condicional logo após a origem)", () => {
  test("filhos seguem a origem, cadeia respeitada, cada índice uma vez, órfãs no fim", () => {
    const Q: PerguntaBase[] = [
      { id: "anexo", label: "Anexar CAT", obrigatorio: false, condicao: { pergunta: "cat", opcao: "Sim" } },
      { id: "rs", label: "Razão Social", obrigatorio: true },
      { id: "cat", label: "CAT?", obrigatorio: true, tipo: "selecao", opcoes: ["Sim", "Não"] },
      { id: "num", label: "Nº CAT", obrigatorio: false, condicao: { pergunta: "anexo", opcao: "x" } },
      { id: "orfa", label: "?", obrigatorio: false, condicao: { pergunta: "nao-existe", opcao: "x" } },
      { id: "fim", label: "Obs", obrigatorio: false },
    ];
    assert.deepEqual(ordemExibicao(Q), [1, 2, 0, 3, 5, 4]);
    assert.deepEqual(ordemExibicao(P), [0, 1, 2, 3, 4, 5]);
  });
});
