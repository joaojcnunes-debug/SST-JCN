import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contarPorTipo,
  filtrarRegistro,
  montarRegistro,
  textosDoRegistro,
  codigosDoRegistro,
  type FontesDoRegistro,
} from "./registro";
import { buscar } from "../busca/texto";

/**
 * Os dados são os REAIS da produção em 22/09/2026, reduzidos: uma retirada que
 * gerou duas linhas no extrato (o caso que quebraria a fusão), uma entrada
 * manual, um ajuste, uma transferência recusada.
 */
const BASES: Record<string, string> = {
  "UNI-F7077429": "Teresópolis",
  "UNI-578CFF26": "Piabetá",
};
const ITENS: Record<string, string> = {
  "cat-mouse": "Mouse M90",
  "cat-teclado": "Teclado K120",
};
const COLABS: Record<string, string> = { "colab-1": "Lusimeg Marques" };

function fontes(over: Partial<FontesDoRegistro> = {}): FontesDoRegistro {
  return {
    movimentacoes: [],
    transferencias: [],
    entregas: [],
    devolucoes: [],
    entregaItens: [],
    devolucaoItens: [],
    nomeItem: (id) => ITENS[id] ?? id,
    nomeBase: (id) => (id ? (BASES[id] ?? id) : "—"),
    nomeColaborador: (id) => COLABS[id] ?? id,
    ...over,
  };
}

const ENTREGA = {
  id_entrega: "ent-1",
  id_unidade: "UNI-F7077429",
  id_colaborador: "colab-1",
  data_entrega: "2026-09-22",
  responsavel_entrega: "Leandro Salles",
  observacao: "Troca de teclados da técnica",
  total_itens: 2,
  criado_por: "leandro.salles@chabra.com.br",
  criado_em: "2026-09-22T12:00:46.119891+00:00",
  emitido_em: "2026-09-22T12:00:46.119891+00:00",
  cancelado_em: null,
};

/** As DUAS linhas que a retirada acima lançou no extrato — o reflexo dela no
 *  saldo, com `ref_id` apontando para a entrega. */
const LANCAMENTOS_DA_ENTREGA = [
  {
    id_movimentacao: "mov-a",
    id_catalogo: "cat-mouse",
    id_unidade: "UNI-F7077429",
    tipo: "saida" as const,
    quantidade: 1,
    origem: "entrega",
    ref_id: "ent-1",
    motivo: "Entrega ao colaborador",
    responsavel: "Leandro Salles",
    criado_por: "leandro.salles@chabra.com.br",
    criado_em: "2026-09-22T12:00:46.119891+00:00",
  },
  {
    id_movimentacao: "mov-b",
    id_catalogo: "cat-teclado",
    id_unidade: "UNI-F7077429",
    tipo: "saida" as const,
    quantidade: 1,
    origem: "entrega",
    ref_id: "ent-1",
    motivo: "Entrega ao colaborador",
    responsavel: "Leandro Salles",
    criado_por: "leandro.salles@chabra.com.br",
    criado_em: "2026-09-22T12:00:46.119891+00:00",
  },
];

const ENTRADA_MANUAL = {
  id_movimentacao: "mov-c",
  id_catalogo: "cat-teclado",
  id_unidade: "UNI-F7077429",
  tipo: "entrada" as const,
  quantidade: 5,
  origem: "manual",
  ref_id: null,
  motivo: "Entrada manual de estoque",
  responsavel: "Minimen",
  criado_por: "leandro.salles@chabra.com.br",
  criado_em: "2026-09-22T12:00:02.678178+00:00",
};

const TRANSFERENCIA = {
  id_transferencia: "TRF-B7304DE7",
  status: "recusada",
  data_hora: "2026-08-28T21:15:47.458+00:00",
  de_unidade: "Teresópolis",
  para_unidade: "Piabetá",
  de_id_unidade: "UNI-F7077429",
  para_id_unidade: "UNI-578CFF26",
  maquina_nome: "Teclado K120",
  maquina_numero_patrimonio: "0136",
  motivo: "Colaborador sem mouse e teclado apagando.",
  responsavel_nome: "Keven Vital",
  responsavel_email: "keven.vital@chabra.com.br",
  transportado_por: "Keven Vital",
};

describe("montarRegistro — uma linha por ato", () => {
  it("a retirada e os dois lançamentos que ela gerou viram UMA linha", () => {
    const r = montarRegistro(
      fontes({
        entregas: [ENTREGA],
        entregaItens: [
          { id_entrega: "ent-1", nome_equipamento: "Mouse M90", numero_serie: null, numero_patrimonio: null, quantidade: 1 },
          { id_entrega: "ent-1", nome_equipamento: "Teclado K120", numero_serie: null, numero_patrimonio: "0136", quantidade: 1 },
        ],
        movimentacoes: LANCAMENTOS_DA_ENTREGA,
      }),
    );
    assert.equal(r.length, 1, "empilhar as listas daria 3 linhas para 1 acontecimento");
    assert.equal(r[0].tipo, "entrega");
    assert.equal(r[0].lancamentos, 2, "os dois lançamentos ficam contados na linha");
    assert.equal(r[0].quantidade, 2);
    assert.equal(r[0].pessoa, "Lusimeg Marques");
    assert.equal(r[0].situacao?.rotulo, "Emitida");
  });

  it("lançamento sem ato é um ato por si só", () => {
    const r = montarRegistro(fontes({ movimentacoes: [ENTRADA_MANUAL] }));
    assert.equal(r.length, 1);
    assert.equal(r[0].tipo, "manual");
    assert.equal(r[0].sinal, "+");
    assert.equal(r[0].quantidade, 5);
    assert.equal(r[0].itens[0].nome, "Teclado K120");
  });

  it("lançamento ÓRFÃO (aponta para ato que a tela não carregou) não some", () => {
    const orfao = { ...LANCAMENTOS_DA_ENTREGA[0], ref_id: "ent-que-nao-veio" };
    const r = montarRegistro(fontes({ movimentacoes: [orfao] }));
    assert.equal(r.length, 1, "sumir em silêncio é pior do que aparecer sem o dono");
    assert.equal(r[0].tipo, "entrega");
  });

  it("transferência é UMA linha, de → para, sem sinal", () => {
    const r = montarRegistro(fontes({ transferencias: [TRANSFERENCIA] }));
    assert.equal(r.length, 1);
    assert.equal(r[0].base, "Teresópolis");
    assert.equal(r[0].baseDestino, "Piabetá");
    assert.equal(r[0].sinal, null, "o item trocou de lugar; o total da JCN Consultoria não mudou");
    assert.equal(r[0].situacao?.rotulo, "Recusada");
    assert.equal(r[0].termo?.tipo, "transferencia");
  });

  it("ordena do mais recente para o mais antigo, pela data do ato", () => {
    const r = montarRegistro(
      fontes({
        entregas: [ENTREGA],
        movimentacoes: [ENTRADA_MANUAL],
        transferencias: [TRANSFERENCIA],
      }),
    );
    assert.deepEqual(
      r.map((l) => l.tipo),
      ["entrega", "manual", "transferencia"],
    );
  });
});

describe("filtrarRegistro", () => {
  const linhas = montarRegistro(
    fontes({
      entregas: [ENTREGA],
      movimentacoes: [ENTRADA_MANUAL],
      transferencias: [TRANSFERENCIA],
    }),
  );

  it("filtra por tipo", () => {
    const r = filtrarRegistro(linhas, { base: "TODAS", tipo: "entrega" });
    assert.equal(r.length, 1);
    assert.equal(r[0].tipo, "entrega");
  });

  it("a base do DESTINO também pega a transferência", () => {
    const r = filtrarRegistro(linhas, { base: "UNI-578CFF26", tipo: "TODOS" });
    assert.equal(r.length, 1, "esconder a transferência que chegou seria esconder metade do movimento");
    assert.equal(r[0].tipo, "transferencia");
  });

  it("filtra por período, pelo dia do ato", () => {
    const r = filtrarRegistro(linhas, { base: "TODAS", tipo: "TODOS", de: "2026-09-01" });
    assert.equal(r.length, 2);
    const so28 = filtrarRegistro(linhas, {
      base: "TODAS",
      tipo: "TODOS",
      de: "2026-08-28",
      ate: "2026-08-28",
    });
    assert.equal(so28.length, 1);
    assert.equal(so28[0].tipo, "transferencia");
  });

  it("conta por tipo para as pílulas", () => {
    assert.deepEqual(contarPorTipo(linhas), { entrega: 1, manual: 1, transferencia: 1 });
  });
});

describe("busca tolerante sobre o registro", () => {
  const linhas = montarRegistro(
    fontes({
      entregas: [ENTREGA],
      entregaItens: [
        { id_entrega: "ent-1", nome_equipamento: "Teclado K120", numero_serie: null, numero_patrimonio: "0136", quantidade: 1 },
      ],
      movimentacoes: [ENTRADA_MANUAL],
      transferencias: [TRANSFERENCIA],
    }),
  );
  const procurar = (q: string) =>
    buscar(linhas, q, textosDoRegistro, {
      codigos: codigosDoRegistro,
      manterOrdem: true,
    });

  it("acha a retirada pelo nome do item que está DENTRO dela", () => {
    const r = procurar("teclado");
    assert.ok(r.itens.some((l) => l.tipo === "entrega"), "o teclado é item da retirada, não o assunto dela");
    assert.equal(r.aproximado, false);
  });

  it("acha pelo nome do colaborador", () => {
    const r = procurar("lusimeg");
    assert.equal(r.itens.length, 1);
    assert.equal(r.itens[0].tipo, "entrega");
  });

  it("acha pela plaqueta, com ou sem zero à esquerda digitado", () => {
    assert.ok(procurar("0136").itens.length > 0);
    assert.ok(procurar("136").itens.length > 0);
  });

  it("perdoa erro de digitação e mantém a ordem da tabela", () => {
    const r = procurar("terezopolis");
    assert.ok(r.itens.length > 0, "a base é Teresópolis; quem digita de ouvido erra o s/z");
  });

  it("acha a transferência pelo código TRF", () => {
    const r = procurar("TRF-B7304DE7");
    assert.equal(r.itens.length, 1);
    assert.equal(r.itens[0].tipo, "transferencia");
  });
});
