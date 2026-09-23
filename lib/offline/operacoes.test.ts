import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  atualizarOperacao,
  enfileirar,
  guardarDocumentoCache,
  guardarImagem,
  lerDocumentoCache,
  lerImagem,
  limparEnviadas,
  listarOperacoes,
  listarProntasParaEnviar,
  marcarImagemEnviada,
  operacaoPendenteQueCria,
  temOperacaoPendente,
} from "./operacoes";
import { ehDuplicidade, ehErroDeRede } from "./rede";

/**
 * Testes da fila offline.
 *
 * COBREM O QUE JÁ QUEBROU. Não são testes de fachada: cada bloco aqui existe
 * porque a revisão de 20/08 encontrou um defeito naquele ponto exato. A ordem
 * das dependências, a faxina e o escopo da trava foram os três lugares onde a
 * lógica estava errada de um jeito que só apareceria no campo, sem rede, com o
 * técnico sem ter a quem perguntar.
 *
 * NÃO cobrem o motor de envio (`sincronizar.ts`): ele fala com o PostgREST, e
 * testá-lo aqui exigiria um dublê do cliente inteiro. O que dá para verificar
 * sem servidor é a mecânica da fila — que é onde os erros estavam.
 */

/** Limpa a fila entre os testes: o IndexedDB é o mesmo para todos. */
async function zerarFila() {
  for (const o of await listarOperacoes()) {
    await atualizarOperacao(o.id, { status: "ENVIADA", ultima_tentativa: "1970-01-01T00:00:00.000Z" });
  }
  await limparEnviadas(0);
  assert.equal((await listarOperacoes()).length, 0, "a fila deveria estar vazia");
}

const base = {
  tabela: "riscos",
  tipo: "insert" as const,
  modulo: "inspecoes",
  id_documento: "INS-1",
};

describe("ordem e dependência", () => {
  beforeEach(zerarFila);

  test("sem dependência, entra na fila pronta para enviar", async () => {
    await enfileirar({ ...base, linhas: [{ id_risco: "RSC-1" }] });
    assert.equal((await listarProntasParaEnviar()).length, 1);
  });

  test("com dependência não enviada, NÃO fica pronta", async () => {
    const setor = await enfileirar({ ...base, tabela: "setores", linhas: [{ id_setor: "SET-1" }] });
    await enfileirar({ ...base, linhas: [{ id_risco: "RSC-1" }], depende_de: [setor] });

    const prontas = await listarProntasParaEnviar();
    assert.equal(prontas.length, 1, "só o setor deveria estar pronto");
    assert.equal(prontas[0].tabela, "setores");
  });

  test("depois que a dependência sobe, a dependente libera", async () => {
    const setor = await enfileirar({ ...base, tabela: "setores", linhas: [{ id_setor: "SET-1" }] });
    await enfileirar({ ...base, linhas: [{ id_risco: "RSC-1" }], depende_de: [setor] });

    await atualizarOperacao(setor, { status: "ENVIADA" });

    const prontas = await listarProntasParaEnviar();
    assert.equal(prontas.length, 1);
    assert.equal(prontas[0].tabela, "riscos");
  });

  /**
   * O defeito: `limparEnviadas` apaga o que já subiu. Uma operação que
   * dependesse de algo faxinado ficava PENDENTE para sempre, invisível, sem
   * explicação na tela.
   */
  test("dependência que já foi faxinada conta como resolvida", async () => {
    const setor = await enfileirar({ ...base, tabela: "setores", linhas: [{ id_setor: "SET-1" }] });
    await enfileirar({ ...base, linhas: [{ id_risco: "RSC-1" }], depende_de: [setor] });

    await atualizarOperacao(setor, {
      status: "ENVIADA",
      ultima_tentativa: "1970-01-01T00:00:00.000Z",
    });
    await limparEnviadas(0);

    const prontas = await listarProntasParaEnviar();
    assert.equal(prontas.length, 1, "o risco deveria destravar, e não ficar preso para sempre");
    assert.equal(prontas[0].tabela, "riscos");
  });

  test("no teto de tentativas, some das prontas", async () => {
    const id = await enfileirar({ ...base, linhas: [{ id_risco: "RSC-1" }] });
    await atualizarOperacao(id, { tentativas: 5 });
    assert.equal((await listarProntasParaEnviar()).length, 0);
  });

  test("a lista sai em ordem de criação", async () => {
    await enfileirar({ ...base, tabela: "setores", linhas: [{}] });
    await new Promise((r) => setTimeout(r, 5));
    await enfileirar({ ...base, tabela: "cargos", linhas: [{}] });

    const todas = await listarOperacoes();
    assert.deepEqual(todas.map((o) => o.tabela), ["setores", "cargos"]);
  });
});

describe("trava da fila, por documento", () => {
  beforeEach(zerarFila);

  /**
   * O defeito: a trava era global. Uma operação parada numa inspeção empurrava
   * para a fila TODA gravação do painel — inclusive de módulos sem relação.
   */
  test("pendência num documento não trava outro", async () => {
    await enfileirar({ ...base, id_documento: "INS-1", linhas: [{}] });

    assert.equal(await temOperacaoPendente("INS-1"), true);
    assert.equal(await temOperacaoPendente("RNC-9"), false, "outro documento não pode ser afetado");
  });

  test("operação recusada não trava o documento para sempre", async () => {
    const id = await enfileirar({ ...base, id_documento: "INS-1", linhas: [{}] });
    await atualizarOperacao(id, { status: "RECUSADA" });

    assert.equal(
      await temOperacaoPendente("INS-1"),
      false,
      "um erro de três dias atrás não pode manter o documento offline",
    );
  });
});

describe("faxina", () => {
  beforeEach(zerarFila);

  /**
   * O defeito: a idade era medida pela CRIAÇÃO. Uma operação capturada há dez
   * dias e enviada agora perdia o recibo na hora — justo a que o técnico mais
   * quer ver confirmada ao voltar para a base.
   */
  test("a idade conta a partir do envio, não da criação", async () => {
    const id = await enfileirar({ ...base, linhas: [{}] });
    await atualizarOperacao(id, {
      status: "ENVIADA",
      criado_em: "2020-01-01T00:00:00.000Z", // capturada há muito tempo
      ultima_tentativa: new Date().toISOString(), // mas enviada agora
    });

    await limparEnviadas(7);
    assert.equal((await listarOperacoes()).length, 1, "o recibo de hoje não pode ser apagado");
  });

  test("leva as fotos junto", async () => {
    const idImagem = await guardarImagem(new Blob(["x"]), "fotos/a.jpg");
    const id = await enfileirar({ ...base, linhas: [{}], imagens: [idImagem] });
    await atualizarOperacao(id, {
      status: "ENVIADA",
      ultima_tentativa: "1970-01-01T00:00:00.000Z",
    });

    await limparEnviadas(0);

    assert.equal(await lerImagem(idImagem), null, "sem isto o celular enche em semanas");
  });

  test("não toca no que ainda não subiu", async () => {
    await enfileirar({ ...base, linhas: [{}] });
    await limparEnviadas(0);
    assert.equal((await listarOperacoes()).length, 1);
  });
});

describe("quem cria a linha", () => {
  beforeEach(zerarFila);

  test("acha a operação pendente que cria o setor", async () => {
    const id = await enfileirar({
      ...base,
      tabela: "setores",
      linhas: [{ id_setor: "SET-7" }],
    });
    assert.equal(await operacaoPendenteQueCria("setores", "id_setor", "SET-7"), id);
  });

  test("devolve null quando o setor já existe no banco", async () => {
    assert.equal(await operacaoPendenteQueCria("setores", "id_setor", "SET-INEXISTENTE"), null);
  });

  test("ignora o que já subiu", async () => {
    const id = await enfileirar({
      ...base,
      tabela: "setores",
      linhas: [{ id_setor: "SET-7" }],
    });
    await atualizarOperacao(id, { status: "ENVIADA" });
    assert.equal(await operacaoPendenteQueCria("setores", "id_setor", "SET-7"), null);
  });
});

describe("imagens e cache", () => {
  test("marcar como enviada evita o reenvio do binário", async () => {
    const id = await guardarImagem(new Blob(["conteudo"]), "fotos/b.jpg");
    assert.equal((await lerImagem(id))?.enviada, false);

    await marcarImagemEnviada(id);
    assert.equal((await lerImagem(id))?.enviada, true);
  });

  test("o documento guardado volta inteiro", async () => {
    await guardarDocumentoCache("INS-42", { setores: [{ id_setor: "SET-1" }] });
    const lido = await lerDocumentoCache<{ setores: { id_setor: string }[] }>("INS-42");
    assert.equal(lido?.dados.setores[0].id_setor, "SET-1");
    assert.ok(lido?.baixado_em, "sem a data a tela não sabe dizer quando foi levado");
  });

  test("documento nunca levado devolve null, e não um objeto vazio", async () => {
    assert.equal(await lerDocumentoCache("INS-QUE-NAO-EXISTE"), null);
  });
});

describe("classificação de erro", () => {
  /**
   * A regra mais importante de todo o offline: chamar queda de rede de
   * "recusado" faz o técnico achar que perdeu o trabalho.
   */
  test("TypeError do fetch é queda de rede", () => {
    assert.equal(ehErroDeRede(new TypeError("Failed to fetch")), true);
  });

  test("recusa do banco NÃO é queda de rede", () => {
    assert.equal(ehErroDeRede({ code: "23514", message: "check constraint" }), false);
  });

  test("violação de chave primária é sucesso disfarçado", () => {
    assert.equal(ehDuplicidade({ code: "23505" }), true);
    assert.equal(ehDuplicidade({ code: "23514" }), false);
  });
});
