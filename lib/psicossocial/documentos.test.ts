import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { ehDocumentoPsicossocial, MODULOS_DOC_PSICOSSOCIAL } from "./documentos";

/**
 * A promessa da área de Empresas do Psicossocial é uma frase só: inspeção de
 * segurança NÃO aparece ali. Estes testes são essa frase escrita como trava.
 *
 * Os valores usados são os que existem na base (medidos em 2026-09-10, 437
 * PDFs), não inventados — inclusive os dois vocabulários do mesmo campo
 * (`inspecoes` na tela de Empresas, `sst` na tela de PDFs gerados).
 */

describe("ehDocumentoPsicossocial", () => {
  test("aceita o valor REAL do DRPS, que é `drps` e não `psicossocial`", () => {
    // 247 dos 437 PDFs da base. Se este teste cair, a tela nasce vazia.
    assert.equal(ehDocumentoPsicossocial("drps"), true);
  });

  test("recusa inspeção de segurança nos DOIS nomes que ela tem", () => {
    assert.equal(ehDocumentoPsicossocial("inspecoes"), false);
    assert.equal(ehDocumentoPsicossocial("sst"), false);
  });

  test("recusa todos os outros módulos que existem na base", () => {
    for (const m of [
      "nao_conformidade",
      "aep",
      "conformidade",
      "aet",
      "apreciacao_maquinas",
      "analises_quimicos",
      "analise_quimicos",
      "inventario_maquinas",
      "frota",
      "epi",
      "equipamentos",
      "investigacao_acidente",
    ]) {
      assert.equal(ehDocumentoPsicossocial(m), false, `${m} nao deveria entrar`);
    }
  });

  test("aceita os nomes do questionário, que ainda não geram PDF mas podem", () => {
    assert.equal(ehDocumentoPsicossocial("questionarios"), true);
    assert.equal(ehDocumentoPsicossocial("questionarios_psicossociais"), true);
  });

  test("aceita `psicossocial` como reserva, mesmo sem linha na base hoje", () => {
    assert.equal(ehDocumentoPsicossocial("psicossocial"), true);
  });

  test("vazio, nulo e desconhecido ficam FORA — a régua recusa por padrão", () => {
    assert.equal(ehDocumentoPsicossocial(""), false);
    assert.equal(ehDocumentoPsicossocial("   "), false);
    assert.equal(ehDocumentoPsicossocial(null), false);
    assert.equal(ehDocumentoPsicossocial(undefined), false);
    assert.equal(ehDocumentoPsicossocial("modulo_que_alguem_criar_amanha"), false);
  });

  test("não se importa com caixa nem espaço em volta", () => {
    assert.equal(ehDocumentoPsicossocial(" DRPS "), true);
    assert.equal(ehDocumentoPsicossocial("Inspecoes"), false);
  });

  test("a lista não contém, por acidente, nenhum nome de inspeção", () => {
    const proibidos = ["inspecoes", "sst", "painel"];
    for (const p of proibidos) {
      assert.equal(
        (MODULOS_DOC_PSICOSSOCIAL as readonly string[]).includes(p),
        false,
        `${p} entrou na lista`,
      );
    }
  });
});
