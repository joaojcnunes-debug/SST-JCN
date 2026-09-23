import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { contarPilulas, pessoasDaLinha, type LinhaContagem } from "./pilulas";

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
    assert.deepEqual(c.status, { Todos: 6, RASCUNHO: 1, EM_ANDAMENTO: 1, CONCLUIDA: 4, ASSOCIADOS: 4 });
  });

  it("a caixa de texto vale para todas as pílulas, como no servidor: pedaço do nome, sem caixa, associado OU responsável", () => {
    assert.deepEqual(contarPilulas(base, "ana").status, { Todos: 2, RASCUNHO: 0, EM_ANDAMENTO: 0, CONCLUIDA: 2, ASSOCIADOS: 2 });
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
