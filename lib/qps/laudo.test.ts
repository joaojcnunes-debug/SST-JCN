import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  linhasPlanoComConteudo,
  marcarTabelasLargas,
  montarLaudoQps,
  paragrafosDoTexto,
  pendenciasDoLaudo,
} from "./laudo";
import { periodoDaColeta } from "./variaveis";
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

describe("v263 — checklist do psicólogo (FLOC × DRPS V.L. COURI)", () => {
  test("agravos/medidas: um parágrafo por item, inicial maiúscula e ponto final", () => {
    assert.deepEqual(
      paragrafosDoTexto("• estresse ocupacional, ansiedade\n• revisar metas;\n\n•   apoio da liderança."),
      ["Estresse ocupacional, ansiedade.", "Revisar metas;", "Apoio da liderança."],
    );
    assert.deepEqual(paragrafosDoTexto(null), []);
    assert.deepEqual(paragrafosDoTexto("  "), []);
  });

  const linha = (n: number, tag = "td") => `<tr>${`<${tag} colspan="1" rowspan="1"><p>x</p></${tag}>`.repeat(n)}</tr>`;
  test("tabela de 5+ colunas vai para a folha deitada; 4 colunas fica em pé", () => {
    const larga = `<table><tbody>${linha(8, "th")}${linha(8)}</tbody></table>`;
    const estreita = `<table><tbody>${linha(4)}</tbody></table>`;
    const html = marcarTabelasLargas(`<p>a</p>${estreita}${larga}`);
    assert.equal((html.match(/qps-tabela-paisagem/g) ?? []).length, 1);
    assert.ok(html.indexOf("qps-tabela-paisagem") > html.indexOf(estreita));
    assert.equal(marcarTabelasLargas(`<table><tr><td colspan="5">x</td></tr></table>`).includes("paisagem"), true);
  });

  test("plano de ação de 5 colunas (Prioridade/Fator/Onde/Fontes/Medidas) sai deitado", () => {
    const plano = `<table><tbody>${linha(5, "th")}${linha(5)}${linha(5)}</tbody></table>`;
    assert.equal(marcarTabelasLargas(`<p>Plano</p>${plano}`).includes(`<div class="qps-tabela-paisagem">${plano}</div>`), true);
  });

  test("parágrafos vazios do fim (o <p></p> que o editor deixa após a tabela) saem — era a folha em branco", () => {
    const html = marcarTabelasLargas('<p>texto</p><table><tr><td>a</td></tr></table><p style="text-align: justify;"></p><p><br></p>  <p>&nbsp;</p>');
    assert.ok(html.endsWith("</table>"));
    assert.equal(marcarTabelasLargas("<p></p><p>meio</p><p></p><p>fim</p>"), "<p></p><p>meio</p><p></p><p>fim</p>");
    assert.equal(marcarTabelasLargas(null), "");
  });

  test("período: o digitado vale; o que falta sai das datas das respostas (dia de Brasília)", () => {
    const carimbos = ["2026-07-21T13:00:00Z", "2026-08-13T01:30:00Z", null, "lixo"];
    assert.deepEqual(periodoDaColeta({ periodo_inicio: null, periodo_fim: null }, carimbos), { inicio: "2026-07-21", fim: "2026-08-12" });
    assert.deepEqual(periodoDaColeta({ periodo_inicio: "2026-07-01", periodo_fim: null }, carimbos), { inicio: "2026-07-01", fim: "2026-08-12" });
    assert.deepEqual(periodoDaColeta({ periodo_inicio: null, periodo_fim: null }, []), { inicio: null, fim: null });
  });

  test("pendências: aponta o que a equipe não preencheu e cala o que está completo", () => {
    const rs = [resp("Produção", null, { P1: 1, P2: 2 }), resp("Adm", null, { P1: 0, P2: 4 })];
    const l = montarLaudoQps({ aplicacao: ap, tipo, categorias: cats, perguntas: pergs, respondentes: rs, probabilidades: [] });
    const p = pendenciasDoLaudo({ laudo: l, periodo: { inicio: null, fim: null }, temCargo: false });
    const campos = p.map((x) => x.campo);
    assert.ok(campos.includes("Período da coleta"));
    assert.ok(campos.includes("Data da conclusão (capa)"));
    assert.ok(campos.includes("Funções dos trabalhadores"));
    assert.ok(campos.includes("Fontes geradoras do risco")); // "Assédio" sem fonte
    assert.match(p.find((x) => x.campo === "Possíveis agravos à saúde mental")!.detalhe!, /Adm/);
    assert.ok(!campos.includes("Conclusão Técnica Consolidada"));
    const completo = pendenciasDoLaudo({
      laudo: { ...l, aplicacao: { ...l.aplicacao, data_conclusao: "2026-09-29" } },
      periodo: { inicio: "2026-09-01", fim: "2026-09-10" },
      temCargo: true,
    }).map((x) => x.campo);
    assert.ok(!completo.includes("Período da coleta") && !completo.includes("Data da conclusão (capa)"));
  });
});
