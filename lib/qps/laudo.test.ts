import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { linhasPlanoComConteudo, montarLaudoQps } from "./laudo";
import { TODOS_OS_SETORES } from "./gravidade";
import type { QpsAplicacao, QpsCategoria, QpsPergunta, QpsRespondente, QpsTipo } from "@/lib/supabase/types";

const tipo: QpsTipo = {
  id_tipo: "T", nome: "Questionário Psicossocial", descricao: null, escala_min: 0, escala_max: 4, ativo: true,
} as unknown as QpsTipo;
const cats: QpsCategoria[] = [
  { id_categoria: "C1", id_tipo: "T", nome: "Suporte", descricao: null, ordem: 1, fonte_geradora: "chefia" },
  { id_categoria: "C2", id_tipo: "T", nome: "Assédio", descricao: null, ordem: 2 },
];
const pergs: QpsPergunta[] = [
  { id_pergunta: "P1", id_categoria: "C1", texto: "p1", logica: "direta", ordem: 1, ativo: true },
  { id_pergunta: "P2", id_categoria: "C2", texto: "p2", logica: "invertida", ordem: 1, ativo: true },
];
const resp = (setor: string, cargo: string | null, respostas: Record<string, number>): QpsRespondente => ({
  id_respondente: Math.random().toString(36), id_aplicacao: "A", setor, cargo, respostas, lote: null, importado_em: "",
});
const ap = {
  id_aplicacao: "A", id_tipo: "T", id_empresa: "E", titulo: "QAP", status: "RASCUNHO",
  responsavel: "Sanmyo", periodo_inicio: null, periodo_fim: null, trabalhadores_previstos: 10,
  unidade_cliente: null, usuario_email: null, usuario_nome: null, observacoes_dimensoes: null,
  agravos_por_setor: { "*": "• geral", "Produção": "• ansiedade" },
  medidas_por_setor: null,
  conclusoes_por_setor: { "*": "<p>consolidado</p>", "Produção": "<p>prod</p>" },
  criado_em: "", atualizado_em: null,
} as unknown as QpsAplicacao;

describe("montarLaudoQps — o que o PDF e a prévia recebem", () => {
  const rs = [
    resp("Produção", "Operador", { P1: 4, P2: 0 }),
    resp("Produção", "Líder", { P1: 4, P2: 0 }),
    resp("Escritório", "Analista", { P1: 1, P2: 4 }),
    resp("Escritório", null, { P1: 1 }),
  ];

  test("um bloco por setor (ordem pt-BR), cargos únicos, textos pela chave do setor", () => {
    const l = montarLaudoQps({ aplicacao: ap, tipo, categorias: cats, perguntas: pergs, respondentes: rs, probabilidades: [] });
    assert.deepEqual(l.blocos.map((b) => b.setor), ["Escritório", "Produção"]);
    const prod = l.blocos[1];
    assert.equal(prod.totalRespondentes, 2);
    assert.equal(prod.cargos, "Líder, Operador");
    assert.equal(prod.agravos, "• ansiedade");
    assert.equal(prod.medidas, null);
    assert.equal(prod.conclusao, "<p>prod</p>");
    // Produção: P1 média 4 → Alta; P2 média 0 invertida → 4 → Alta
    assert.equal(prod.categorias[0].gravidade?.texto, "Alta");
    assert.equal(prod.categorias[0].fonteGeradora, "chefia");
    assert.equal(l.totalRespondentes, 4);
  });

  test("consolidado usa a chave '*' e todos os respondentes", () => {
    const l = montarLaudoQps({ aplicacao: ap, tipo, categorias: cats, perguntas: pergs, respondentes: rs, probabilidades: [] });
    assert.ok(l.consolidado);
    assert.equal(l.consolidado.setor, TODOS_OS_SETORES);
    assert.equal(l.consolidado.ehConsolidado, true);
    assert.equal(l.consolidado.totalRespondentes, 4);
    assert.equal(l.consolidado.agravos, "• geral");
    assert.equal(l.consolidado.conclusao, "<p>consolidado</p>");
  });

  test("sem respondente: nenhum bloco e consolidado null; sem tipo: categorias vazias", () => {
    const vazio = montarLaudoQps({ aplicacao: ap, tipo, categorias: cats, perguntas: pergs, respondentes: [], probabilidades: [] });
    assert.equal(vazio.blocos.length, 0);
    assert.equal(vazio.consolidado, null);
    const semTipo = montarLaudoQps({ aplicacao: ap, tipo: null, categorias: cats, perguntas: pergs, respondentes: rs, probabilidades: [] });
    assert.equal(semTipo.blocos[0].categorias.length, 0);
  });

  test("linha 5W2H em branco não imprime (mesma regra do DRPS)", () => {
    const base = { ordem: 1, acao: null, justificativa: null, onde: null, prazo: null, responsavel: null, como: null, quanto_custa: null, status: "PENDENTE" };
    assert.equal(linhasPlanoComConteudo([base, { ...base, acao: "  " }]).length, 0);
    assert.equal(linhasPlanoComConteudo([{ ...base, onde: "COSTURA" }]).length, 1);
  });
});
