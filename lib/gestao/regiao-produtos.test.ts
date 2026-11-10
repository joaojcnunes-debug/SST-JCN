import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { CAMPO_PRODUTOS_ID, REGIOES, comRegiao, normUnidade, opcoesComMarcados, regiaoDasEtiquetas } from "./regiao-produtos";
import { CAMPO_PRODUTOS_ID as ID_IMPORTADOR, UNIDADES } from "./import/runrun-forms-mapa";
import { normalizarEtiquetaForm } from "./formularios";

describe("Região da tarefa (igual ao formulário do Comercial)", () => {
  test("as 6 regiões são as unidades do formulário, na mesma ordem e com a etiqueta que o formulário grava", () => {
    assert.deepEqual(REGIOES.map((r) => r.label), UNIDADES.map((u) => u.label));
    assert.deepEqual(REGIOES.map((r) => r.tag), UNIDADES.map((u) => u.tag));
    for (const r of REGIOES) assert.equal(normalizarEtiquetaForm(r.label), r.tag, r.label);
  });

  test("normUnidade espelha gestao_norm_unidade (acento, hífen, sublinhado, espaços)", () => {
    assert.equal(normUnidade("  Nova-Friburgo "), "nova friburgo");
    assert.equal(normUnidade("PIABETÁ"), "piabeta");
    assert.equal(normUnidade("campos_dos__goytacazes"), "campos dos goytacazes");
  });

  test("lê a região em qualquer grafia usada nas tarefas (medido em 10/11: nova-friburgo 637, piabetá do Runrun)", () => {
    assert.equal(regiaoDasEtiquetas(["urgente", "nova-friburgo"]), "nova friburgo");
    assert.equal(regiaoDasEtiquetas(["piabetá"]), "piabeta");
    assert.equal(regiaoDasEtiquetas(["Campos dos Goytacazes"]), "campos");
    assert.equal(regiaoDasEtiquetas(["friburgo"]), "nova friburgo");
    assert.equal(regiaoDasEtiquetas(["urgente"]), null);
    assert.equal(regiaoDasEtiquetas(null), null);
  });

  test("trocar a região tira toda grafia antiga, mantém as outras etiquetas e põe a etiqueta do formulário", () => {
    assert.deepEqual(comRegiao(["urgente", "nova-friburgo", "PGR", "friburgo"], "piabeta"), ["urgente", "PGR", "piabeta"]);
    assert.deepEqual(comRegiao(["piabetá", "urgente"], null), ["urgente"]);
    assert.deepEqual(comRegiao([], "teresopolis"), ["teresopolis"]);
    assert.throws(() => comRegiao([], "conselheiro"));
  });

  test("sem mexer na região, as etiquetas não mudam (a tela só chama comRegiao ao escolher)", () => {
    const antes = ["teresopolis", "urgente"];
    assert.equal(regiaoDasEtiquetas(antes), "teresopolis");
    assert.deepEqual(comRegiao(antes, regiaoDasEtiquetas(antes)), ["urgente", "teresopolis"]);
  });
});

describe("Produtos da tarefa", () => {
  test("o campo é o mesmo do importador do Runrun e do formulário do Comercial", () => {
    assert.equal(CAMPO_PRODUTOS_ID, ID_IMPORTADOR);
  });

  test("o que a tarefa já tem fora do catálogo continua na lista (não some sem ser desmarcado)", () => {
    assert.deepEqual(opcoesComMarcados(["PGR", "LTCAT"], ["LTCAT", "AET antiga"]), ["PGR", "LTCAT", "AET antiga"]);
    assert.deepEqual(opcoesComMarcados(["PGR"], []), ["PGR"]);
  });
});
