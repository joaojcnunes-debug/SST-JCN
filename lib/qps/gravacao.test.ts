import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { exigeLinhaGravada } from "./gravacao";
import { podeEditarLinhaDaUnidade } from "../acesso/linha-por-unidade";

/**
 * Detector das duas metades do "não salva" medido em 2026-10-06:
 *  1. o PostgREST devolvia 2xx com 0 linhas e o cliente comemorava;
 *  2. a tela oferecia o lápis para quem a policy do banco recusa.
 * Se alguém reverter qualquer uma das duas, estes testes reprovam.
 */

describe("exigeLinhaGravada", () => {
  test("0 linhas é falha, com código que chega ao usuário", () => {
    assert.throws(
      () => exigeLinhaGravada([], "alteração"),
      (e: unknown) => {
        assert.equal((e as { code?: string }).code, "nao_gravou");
        assert.match((e as Error).message, /não foi gravada/);
        return true;
      },
    );
  });

  test("lista vazia é o caso real: PATCH barrado pela RLS volta 2xx e vazio", () => {
    assert.throws(() => exigeLinhaGravada([], "mudança de status"), /mudança de status/);
    assert.throws(() => exigeLinhaGravada([], "remoção"), /remoção/);
  });

  test("null e undefined também são falha (nunca tratar como sucesso)", () => {
    assert.throws(() => exigeLinhaGravada(null, "alteração"));
    assert.throws(() => exigeLinhaGravada(undefined, "alteração"));
  });

  test("1 linha de volta passa sem lançar", () => {
    assert.doesNotThrow(() => exigeLinhaGravada([{ id_aplicacao: "abc" }], "alteração"));
  });
});

describe("podeEditarLinhaDaUnidade", () => {
  const UNI = "UNI-A3455481";
  const OUTRA = "UNI-0D976D64";
  const tecnico = { perfil: "Tecnico" as const, ativo_sistema: true, unidades: [UNI] };

  test("Admin edita qualquer linha, inclusive de unidade que não tem", () => {
    const admin = { perfil: "Admin" as const, ativo_sistema: true, unidades: [] };
    assert.equal(podeEditarLinhaDaUnidade(admin, OUTRA), true);
  });

  test("Visualizador nunca edita, mesmo com a unidade na lista", () => {
    // caller_pode_editar() é perfil IN ('Admin','Tecnico') e NÃO lê pode_editar
    // — existe Visualizador em produção com as três flags em true.
    const vis = { perfil: "Visualizador" as const, ativo_sistema: true, unidades: [UNI] };
    assert.equal(podeEditarLinhaDaUnidade(vis, UNI), false);
  });

  test("Técnico edita a linha da unidade dele", () => {
    assert.equal(podeEditarLinhaDaUnidade(tecnico, UNI), true);
  });

  test("Técnico NÃO edita a linha de unidade alheia", () => {
    assert.equal(podeEditarLinhaDaUnidade(tecnico, OUTRA), false);
  });

  test("empresa SEM unidade é editável por todos — o banco faz id_unidade is null OR ...", () => {
    // v75/v76: "toda empresa nasce sem unidade (=visível a todos)". Inverter
    // isto some com o lápis de quem o banco autoriza. A FK é `on delete set
    // null`: apagar uma unidade zera a coluna de todas as empresas dela.
    assert.equal(podeEditarLinhaDaUnidade(tecnico, null), true);
  });

  test("empresa ainda carregando não reprova", () => {
    assert.equal(podeEditarLinhaDaUnidade(tecnico, undefined), true);
  });

  test("conta inativa não edita", () => {
    const inativo = { perfil: "Tecnico" as const, ativo_sistema: false, unidades: [UNI] };
    assert.equal(podeEditarLinhaDaUnidade(inativo, UNI), false);
  });

  test("sem sessão não edita", () => {
    assert.equal(podeEditarLinhaDaUnidade(null, UNI), false);
  });
});
