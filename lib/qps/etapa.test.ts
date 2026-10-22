import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { etapaDaAplicacao, statusEncerrado } from "./etapa";

/**
 * A etapa da aplicação é o que a tela de Resumo usa para dizer "onde o
 * trabalho está" e para decidir quem entra no alerta de aplicação parada.
 *
 * Estes testes existem por causa da v206, que criou o status
 * `ENVIADO_CLIENTE`. A regra antiga só conhecia `CONCLUIDO` como fim de fila,
 * e um status novo entrando pela porta do quadro de arrastar teria mandado
 * aplicação ENTREGUE de volta para a coluna de quem nem começou.
 */

const base = { nRespondentes: 0 };

describe("etapaDaAplicacao", () => {
  test("rascunho sem respondente está em coleta", () => {
    assert.equal(
      etapaDaAplicacao({ ...base, status: "RASCUNHO" }),
      "COLETA",
    );
  });

  test("com respondente e não encerrada está em análise", () => {
    assert.equal(
      etapaDaAplicacao({ status: "EM_ANDAMENTO", nRespondentes: 12 }),
      "ANALISE",
    );
  });

  test("status concluído encerra, mesmo sem respondente nenhum", () => {
    assert.equal(
      etapaDaAplicacao({ ...base, status: "CONCLUIDO" }),
      "CONCLUIDO",
    );
  });

  // 🔑 A trava da v206.
  test("enviado ao cliente também é fim de fila", () => {
    assert.equal(
      etapaDaAplicacao({ status: "ENVIADO_CLIENTE", nRespondentes: 40 }),
      "CONCLUIDO",
    );
  });

  test("enviado ao cliente NÃO volta para coleta por não ter respondente", () => {
    // Este é o caso que o alerta de "parada há mais de 30 dias" pegaria.
    assert.equal(
      etapaDaAplicacao({ ...base, status: "ENVIADO_CLIENTE" }),
      "CONCLUIDO",
    );
  });

  test("um respondente já tira da coleta, mesmo em rascunho", () => {
    assert.equal(
      etapaDaAplicacao({ status: "RASCUNHO", nRespondentes: 1 }),
      "ANALISE",
    );
  });
});

describe("statusEncerrado", () => {
  test("concluído e enviado são encerrados; os outros não", () => {
    assert.equal(statusEncerrado("CONCLUIDO"), true);
    assert.equal(statusEncerrado("ENVIADO_CLIENTE"), true);
    assert.equal(statusEncerrado("RASCUNHO"), false);
    assert.equal(statusEncerrado("EM_ANDAMENTO"), false);
  });
});
