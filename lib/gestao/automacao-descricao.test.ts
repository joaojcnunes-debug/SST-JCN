import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { descreverAcao, descreverCondicao, descreverGatilho, descreverRegra, nomeLegivel, responsaveisDaAcao, rotuloPrimeiraEtapa, GATILHOS, type Nomes } from "./automacao-descricao";

const n: Nomes = {
  etapas: { EMPRESAS_NOVAS: "Empresas Novas", AG_AGENDAMENTO: "Aguardando Agendamento", AG_APROVACAO: "Aguardando Aprovação", INSPECAO_PENDENTE: "Inspeção Pendente" },
  quadros: { "QDR-G": "Guapimirim", "QDR-C": "Comercial" },
  etapasDeQuadro: { "QDR-G": { EMPRESAS_NOVAS: "Empresas Novas", AG_AGENDAMENTO: "Aguardando Agendamento" } },
  campos: { prod: "Produtos" },
  modelos: { entrada: "Entrada" },
  pessoas: { "isabela.esteves@chabra.com.br": "Isabela Esteves", "giovanna.terrason@chabra.com.br": "Giovanna Terrason" },
};

describe("automação em português (11/11)", () => {
  test("gatilhos de subtarefa existem nos três grupos pedidos", () => {
    const grupos = new Set(GATILHOS.filter((g) => g.value.startsWith("subtarefa_")).map((g) => g.grupo));
    assert.deepEqual([...grupos].sort(), ["Subtarefa · datas", "Subtarefa · pessoas", "Subtarefa · tarefa"]);
    assert.equal(GATILHOS.filter((g) => g.value.startsWith("subtarefa_")).length, 10);
  });
  test("quando: etapa pela condição plana e prazos", () => {
    assert.equal(descreverGatilho({ gatilho: "status_muda", condicao: { para: "AG_AGENDAMENTO" }, acoes: [] }, n), 'Quando o cartão entra em "Aguardando Agendamento"');
    assert.equal(descreverGatilho({ gatilho: "subtarefa_entrega_proxima", condicao: {}, acoes: [] }, n), "Quando faltam 3 dia(s) para a entrega desejada de uma subtarefa");
    assert.equal(descreverGatilho({ gatilho: "tarefa_aprovada", acoes: [] }, n), "Quando o cartão é aprovado");
  });
  test("se: etapas, etiquetas e campo multi", () => {
    const c = { all: [
      { op: "in", campo: "status", valor: ["EMPRESAS_NOVAS", "INSPECAO_PENDENTE"] },
      { op: "in", campo: "etiqueta", valor: ["guapimirim"] },
      { op: "nao_contem", campo: "campo:prod", valor: "AET" },
    ] };
    assert.equal(descreverCondicao(c, n), 'o cartão está em "Empresas Novas" ou "Inspeção Pendente", tem a etiqueta guapimirim e Produtos não contém "AET"');
  });
  test("então: criar cartão sem etapa mostra a 1ª etapa do destino com o nome do quadro", () => {
    assert.equal(descreverAcao({ tipo: "criar_tarefa_quadro", id_quadro_destino: "QDR-G" }, n), 'Cria um cartão em "Empresas Novas de Guapimirim"');
    assert.equal(rotuloPrimeiraEtapa("QDR-G", "Empresas Novas", n), "Empresas Novas de Guapimirim");
    assert.equal(rotuloPrimeiraEtapa("@unidade", "Empresas Novas", n), "Empresas Novas (1ª etapa do quadro da unidade)");
  });
  test("então: pessoas pelo nome, aprovação e se completo", () => {
    assert.equal(descreverAcao({ tipo: "adicionar_vinculados", vinculo_tipo: "responsavel", emails: ["isabela.esteves@chabra.com.br", "giovanna.terrason@chabra.com.br"] }, n),
      "Coloca Isabela Esteves e Giovanna Terrason como responsáveis");
    assert.equal(descreverAcao({ tipo: "solicitar_aprovacao" }, n), "Pede aprovação (qualquer gestor)");
    assert.equal(descreverAcao({ tipo: "mover_status_se_completo", valor: "AG_APROVACAO" }, n),
      'Se todas as subtarefas estiverem concluídas, move o cartão para "Aguardando Aprovação"');
  });
  test("v367: subtarefas dos Produtos e ações em cada subtarefa", () => {
    assert.equal(descreverAcao({ tipo: "criar_subtarefas_produtos" }, n), "Cria uma subtarefa para cada Produto marcado");
    assert.equal(descreverAcao({ tipo: "criar_subtarefas_produtos", produtos: ["PGR", "PCMSO"], responsavel_email: "isabela.esteves@chabra.com.br" }, n),
      'Cria uma subtarefa para cada Produto marcado (só PGR ou PCMSO), com Isabela Esteves como responsável');
    assert.equal(descreverAcao({ tipo: "concluir", alvo: "subtarefas" }, n), "Em cada subtarefa: conclui a subtarefa");
    assert.equal(descreverAcao({ tipo: "comentar", texto: "Oi", alvo: "subtarefas", condicao: { all: [{ campo: "subtarefa", op: "contains", valor: "PGR" }] } }, n),
      'Em cada subtarefa: comenta na subtarefa: "Oi" — só se o nome da subtarefa contém "PGR"');
  });
  test("regra inteira numa frase", () => {
    const r = { gatilho: "subtarefa_concluida", condicao: { all: [{ op: "in", campo: "status", valor: ["EMPRESAS_NOVAS"] }] },
      acoes: [{ tipo: "mover_status", valor: "AG_AGENDAMENTO" }] };
    assert.equal(descreverRegra(r, n), 'Quando uma subtarefa é concluída, se o cartão está em "Empresas Novas": move o cartão para "Aguardando Agendamento".');
  });
  test("nome legível tira prefixo técnico e a cidade repetida", () => {
    assert.equal(nomeLegivel("[SST-Esteira] Teresópolis · 2. Procuração concluída → Aguardando Agendamento", "Teresópolis"), "Procuração concluída → Aguardando Agendamento");
    assert.equal(nomeLegivel("Nova automação", "Teresópolis"), "Nova automação");
  });
});

describe("0.3.323 (v371): subtarefa com várias responsáveis", () => {
  const isa = "isabela.esteves@chabra.com.br", gio = "giovanna.terrason@chabra.com.br";
  test("modelo com duas responsáveis", () => {
    assert.equal(
      descreverAcao({ tipo: "criar_subtarefas_modelo", modelo_slug: "entrada", responsavel_email: isa, responsaveis_emails: [isa, gio] }, n),
      "Cria as subtarefas do modelo \"Entrada\", com Isabela Esteves e Giovanna Terrason como responsáveis",
    );
  });
  test("regra antiga (só responsavel_email) continua igual", () => {
    assert.equal(descreverAcao({ tipo: "criar_subtarefas_modelo", modelo_slug: "entrada", responsavel_email: isa }, n),
      "Cria as subtarefas do modelo \"Entrada\", com Isabela Esteves como responsável");
    assert.deepEqual(responsaveisDaAcao({ responsavel_email: " Isabela.Esteves@chabra.com.br " }), [isa]);
  });
  test("lista vale sobre o campo único, sem repetir", () => {
    assert.deepEqual(responsaveisDaAcao({ responsavel_email: isa, responsaveis_emails: [gio, isa, gio] }), [gio, isa]);
    assert.deepEqual(responsaveisDaAcao({}), []);
    assert.match(descreverAcao({ tipo: "criar_subtarefas_produtos", responsaveis_emails: [isa, gio] }, n), /com Isabela Esteves e Giovanna Terrason como responsáveis$/);
  });
});
