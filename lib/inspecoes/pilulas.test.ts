import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { alternarPilula, contarPilulas, pessoasDaLinha, separarSelecao, type LinhaContagem } from "./pilulas";

// Uma base pequena com os casos que a régua precisa distinguir: pessoa só
// associada, pessoa só responsável, as duas ao mesmo tempo, nome em branco
// (não é ninguém), responsável apagado para '' (v237) e inspeção sem ninguém.
const base: LinhaContagem[] = [
  { status: "CONCLUIDA", elaboracao_responsavel: "Paulina Cunha", inspecao_associados: [{ nome: "Paulina Cunha" }] },
  { status: "CONCLUIDA", elaboracao_responsavel: "paulina cunha", inspecao_associados: [{ nome: "Ana Luiza" }] },
  { status: "CONCLUIDA", elaboracao_responsavel: null, inspecao_associados: [{ nome: "Ana Luiza" }] },
  { status: "EM_ANDAMENTO", elaboracao_responsavel: "Sirlei Lopes", inspecao_associados: [] },
  { status: "CONCLUIDA", elaboracao_responsavel: "", inspecao_associados: [{ nome: " " }] },
  { status: "RASCUNHO", elaboracao_responsavel: null, inspecao_associados: null },
];

describe("contarPilulas", () => {
  it("conta o status e, em Associados, só quem tem alguém no documento", () => {
    const c = contarPilulas(base, "");
    assert.deepEqual(c.status, { Todos: 6, RASCUNHO: 1, EM_ANDAMENTO: 1, CONCLUIDA: 4, ASSOCIADOS: 4, NAO_ASSOCIADOS: 2 });
  });

  it("Não associados é o avesso de Associados: os dois somam Todos", () => {
    const c = contarPilulas(base, "").status;
    assert.equal(c.ASSOCIADOS + c.NAO_ASSOCIADOS, c.Todos);
  });

  it("a caixa de texto vale para todas as pílulas, como no servidor: pedaço do nome, sem caixa, associado OU responsável", () => {
    assert.deepEqual(contarPilulas(base, "ana").status, { Todos: 2, RASCUNHO: 0, EM_ANDAMENTO: 0, CONCLUIDA: 2, ASSOCIADOS: 2, NAO_ASSOCIADOS: 0 });
    assert.equal(contarPilulas(base, "sirlei").status.EM_ANDAMENTO, 1);
    // Menos de 2 letras não filtra (mesma regra do idsPorAssociado)
    assert.equal(contarPilulas(base, "p").status.Todos, 6);
  });
});

describe("pessoasDaLinha", () => {
  it("une associados e responsável sem repetir, ignorando caixa e nome em branco", () => {
    assert.deepEqual(pessoasDaLinha(base[0]), ["Paulina Cunha"]);
    assert.deepEqual(pessoasDaLinha(base[1]), ["Ana Luiza", "paulina cunha"]);
    assert.deepEqual(pessoasDaLinha(base[4]), []);
    assert.deepEqual(pessoasDaLinha(base[5]), []);
  });
});

describe("várias pílulas ao mesmo tempo (21/10)", () => {
  it("status somam, associação cruza: Não associados + Em Andamento", () => {
    const sel = separarSelecao(["NAO_ASSOCIADOS", "EM_ANDAMENTO"]);
    const c = contarPilulas(base, "", sel);
    // base: a única em andamento (Sirlei) TEM responsável → nenhuma casa.
    assert.equal(c.selecionadas, 0);
    // Cada pílula conta dentro do outro grupo: entre as não associadas há 1 concluída e 1 rascunho.
    assert.equal(c.status.CONCLUIDA, 1);
    assert.equal(c.status.RASCUNHO, 1);
    assert.equal(c.status.EM_ANDAMENTO, 0);
    // Associação conta só entre as em andamento.
    assert.equal(c.status.ASSOCIADOS, 1);
    assert.equal(c.status.NAO_ASSOCIADOS, 0);
    // Todos continua o total, para o botão de limpar.
    assert.equal(c.status.Todos, 6);
  });

  it("dois status do mesmo grupo somam", () => {
    const c = contarPilulas(base, "", separarSelecao(["RASCUNHO", "CONCLUIDA"]));
    assert.equal(c.selecionadas, 5);
  });

  it("sem nada marcado, selecionadas = Todos", () => {
    assert.equal(contarPilulas(base, "").selecionadas, 6);
  });
});

describe("alternarPilula", () => {
  it("marca, desmarca e Todos limpa", () => {
    assert.deepEqual(alternarPilula([], "NAO_ASSOCIADOS"), ["NAO_ASSOCIADOS"]);
    assert.deepEqual(alternarPilula(["NAO_ASSOCIADOS"], "EM_ANDAMENTO"), ["EM_ANDAMENTO", "NAO_ASSOCIADOS"]);
    assert.deepEqual(alternarPilula(["EM_ANDAMENTO", "NAO_ASSOCIADOS"], "EM_ANDAMENTO"), ["NAO_ASSOCIADOS"]);
    assert.deepEqual(alternarPilula(["EM_ANDAMENTO", "NAO_ASSOCIADOS"], "Todos"), []);
  });

  it("o grupo inteiro marcado é o mesmo que não filtrar: volta a vazio", () => {
    assert.deepEqual(alternarPilula(["ASSOCIADOS"], "NAO_ASSOCIADOS"), []);
    assert.deepEqual(alternarPilula(["RASCUNHO", "EM_ANDAMENTO", "ASSOCIADOS"], "CONCLUIDA"), ["ASSOCIADOS"]);
  });
});
