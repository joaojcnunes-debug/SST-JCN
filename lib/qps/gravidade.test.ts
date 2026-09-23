import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  SETOR_TODA_APLICACAO,
  TODOS_OS_SETORES,
  calcularAnaliseSetor,
  calcularPerguntaGravidade,
  listarSetoresQps,
  mediaParaDominioDrps,
  probabilidadeEfetiva,
} from "./gravidade";
import type { QpsCategoria, QpsPergunta, QpsProbabilidade } from "@/lib/supabase/types";

/**
 * A régua do DRPS aplicada ao QPS (14/09/2026). Estes testes travam três
 * promessas feitas ao Sanmyo antes de ele pedir "a mesma régua":
 *
 * 1. É A MESMA CONTA DO DRPS, pergunta a pergunta: ROUNDUP, depois 4 − x se
 *    invertida, depois os cortes ≥3 / 2 / ≤1 — inclusive a assimetria
 *    conhecida (o ROUNDUP acontece ANTES da inversão).
 * 2. A PROBABILIDADE É DELE: ajuste do setor > geral da aplicação (setor "*")
 *    > Baixa, e a matriz 3×3 tem Crítico.
 * 3. Em 0–4 a régua é idêntica à do DRPS; noutra faixa a média é levada a
 *    0–4 antes — nunca aplicada crua.
 *
 * Os números de referência vieram da prévia lado a lado na aplicação real
 * "QAP - FLOC TEXTIL INDUSTRIA" (113 respondentes), calculada com as funções
 * compiladas do próprio painel — não com uma cópia da fórmula.
 */

const pergunta = (
  id: string,
  logica: "direta" | "invertida",
  extra: Partial<QpsPergunta> = {},
): QpsPergunta =>
  ({
    id_pergunta: id,
    id_categoria: "C1",
    texto: `Pergunta ${id}`,
    logica,
    ordem: Number(id.replace(/\D/g, "")) || 1,
    ativo: true,
    opcoes: null,
    ...extra,
  }) as QpsPergunta;

const categoria = (id: string, nome = id, extra: Partial<QpsCategoria> = {}): QpsCategoria =>
  ({ id_categoria: id, id_tipo: "T", nome, descricao: null, ordem: 1, ...extra }) as QpsCategoria;

const resp = (setor: string, respostas: Record<string, number>) => ({ setor, respostas });

describe("calcularPerguntaGravidade — a conta do DRPS, pergunta a pergunta", () => {
  test("direta: média 2,1 → ⌈2,1⌉ = 3 → Alta", () => {
    const p = pergunta("P1", "direta");
    // dez respostas com média 2,1
    const r = [2, 2, 2, 2, 2, 2, 2, 2, 2, 3].map((v) => resp("A", { P1: v }));
    const g = calcularPerguntaGravidade(p, r, 0, 4);
    assert.equal(g.n, 10);
    assert.equal(g.corrigida, 3);
    assert.equal(g.gravidade.texto, "Alta");
  });

  test("invertida: a MESMA média 2,1 → 4 − ⌈2,1⌉ = 1 → Baixa (assimetria herdada do DRPS)", () => {
    const p = pergunta("P1", "invertida");
    const r = [2, 2, 2, 2, 2, 2, 2, 2, 2, 3].map((v) => resp("A", { P1: v }));
    const g = calcularPerguntaGravidade(p, r, 0, 4);
    assert.equal(g.corrigida, 1);
    assert.equal(g.gravidade.texto, "Baixa");
  });

  test("invertida com todo mundo no pior extremo (0) → 4 → Alta; no melhor (4) → 0 → Baixa", () => {
    const p = pergunta("P1", "invertida");
    assert.equal(calcularPerguntaGravidade(p, [resp("A", { P1: 0 })], 0, 4).gravidade.texto, "Alta");
    assert.equal(calcularPerguntaGravidade(p, [resp("A", { P1: 4 })], 0, 4).gravidade.texto, "Baixa");
  });

  test("sem resposta: corrigida 0 e n = 0 — nunca inverte para 4", () => {
    const p = pergunta("P1", "invertida");
    const g = calcularPerguntaGravidade(p, [resp("A", { OUTRA: 3 })], 0, 4);
    assert.equal(g.n, 0);
    assert.equal(g.corrigida, 0);
  });

  test("escala 1–5 é levada a 0–4 antes da régua (3 em 1–5 = 2 em 0–4)", () => {
    assert.equal(mediaParaDominioDrps(3, 1, 5), 2);
    assert.equal(mediaParaDominioDrps(2.5, 0, 4), 2.5); // identidade em 0–4
    const p = pergunta("P1", "direta");
    const g = calcularPerguntaGravidade(p, [resp("A", { P1: 5 })], 1, 5);
    assert.equal(g.media04, 4);
    assert.equal(g.gravidade.texto, "Alta");
  });

  test("pergunta com alternativas próprias (v180) usa a faixa 1..N dela, não a do tipo", () => {
    const p = pergunta("P1", "invertida", { opcoes: ["Nunca", "Às vezes", "Sempre"] });
    // posição 3 de 3 = melhor cenário na invertida → 0 em 0–4 → Baixa
    const g = calcularPerguntaGravidade(p, [resp("A", { P1: 3 })], 0, 4);
    assert.equal(g.media04, 4);
    assert.equal(g.corrigida, 0);
    assert.equal(g.gravidade.texto, "Baixa");
  });
});

describe("probabilidadeEfetiva — a probabilidade é do psicólogo", () => {
  const probs: QpsProbabilidade[] = [
    { id_aplicacao: "A", setor: SETOR_TODA_APLICACAO, id_categoria: "C1", probabilidade: 2, atualizado_em: "" },
    { id_aplicacao: "A", setor: "Produção", id_categoria: "C1", probabilidade: 3, atualizado_em: "" },
  ];

  test("sem nada informado → Baixa (1), origem 'padrao', como o DRPS", () => {
    assert.deepEqual(probabilidadeEfetiva([], "Produção", "C1"), { probabilidade: 1, origem: "padrao" });
  });

  test("geral da aplicação vale para qualquer setor e para o consolidado", () => {
    assert.deepEqual(probabilidadeEfetiva(probs, "Escritório", "C1"), { probabilidade: 2, origem: "aplicacao" });
    assert.deepEqual(probabilidadeEfetiva(probs, TODOS_OS_SETORES, "C1"), { probabilidade: 2, origem: "aplicacao" });
    assert.deepEqual(probabilidadeEfetiva(probs, null, "C1"), { probabilidade: 2, origem: "aplicacao" });
  });

  test("ajuste do setor passa por cima da geral", () => {
    assert.deepEqual(probabilidadeEfetiva(probs, "Produção", "C1"), { probabilidade: 3, origem: "setor" });
  });
});

describe("calcularAnaliseSetor — categoria, probabilidade e matriz", () => {
  const cats = [categoria("C1", "Assédio", { ordem: 2 }), categoria("C2", "Suporte", { ordem: 1 })];
  const pergs = [
    pergunta("P1", "direta", { id_categoria: "C1", ordem: 1 }),
    pergunta("P2", "invertida", { id_categoria: "C1", ordem: 2 }),
    pergunta("P3", "direta", { id_categoria: "C2", ordem: 1 }),
  ];
  // Produção: P1 média 4 (Alta), P2 média 0 invertida → 4 (Alta) → categoria Alta (3,0)
  // Escritório: P1 média 1 (Baixa), P2 média 4 invertida → 0 (Baixa) → Baixa
  const rs = [
    resp("Produção", { P1: 4, P2: 0, P3: 2 }),
    resp("Produção", { P1: 4, P2: 0, P3: 2 }),
    resp("Escritório", { P1: 1, P2: 4 }),
  ];

  test("categorias saem na ordem cadastrada e a gravidade é a média das perguntas com resposta", () => {
    const a = calcularAnaliseSetor("Produção", cats, pergs, rs, [], 0, 4);
    assert.deepEqual(a.map((c) => c.nome), ["Suporte", "Assédio"]);
    const assedio = a[1];
    assert.equal(assedio.mediaGravidade, 3);
    assert.equal(assedio.gravidade?.texto, "Alta");
    assert.equal(assedio.probabilidadeOrigem, "padrao");
    // gravidade Alta × probabilidade Baixa (padrão) = Médio na matriz do DRPS
    assert.equal(assedio.matriz, "Médio");
  });

  test("Alta × Alta = Crítico — a classe que a régua antiga não tinha", () => {
    const probs: QpsProbabilidade[] = [
      { id_aplicacao: "A", setor: SETOR_TODA_APLICACAO, id_categoria: "C1", probabilidade: 3, atualizado_em: "" },
    ];
    const a = calcularAnaliseSetor("Produção", cats, pergs, rs, probs, 0, 4);
    assert.equal(a[1].matriz, "Crítico");
    assert.equal(a[1].corMatriz, "#1a1a2e");
  });

  test("probabilidadeGeral é a da aplicação mesmo quando o setor tem ajuste (é o que o '= geral' mostra)", () => {
    const soAjuste: QpsProbabilidade[] = [
      { id_aplicacao: "A", setor: "Produção", id_categoria: "C1", probabilidade: 3, atualizado_em: "" },
    ];
    const a = calcularAnaliseSetor("Produção", cats, pergs, rs, soAjuste, 0, 4);
    assert.equal(a[1].probabilidadeOrigem, "setor");
    assert.equal(a[1].probabilidade, 3);
    assert.equal(a[1].probabilidadeGeral, null); // geral não informada — não é "Alta"

    const comGeral: QpsProbabilidade[] = [
      ...soAjuste,
      { id_aplicacao: "A", setor: SETOR_TODA_APLICACAO, id_categoria: "C1", probabilidade: 2, atualizado_em: "" },
    ];
    const b = calcularAnaliseSetor("Produção", cats, pergs, rs, comGeral, 0, 4);
    assert.equal(b[1].probabilidade, 3);
    assert.equal(b[1].probabilidadeGeral, 2);
  });

  test("categoria sem nenhuma resposta no recorte fica semBase, sem gravidade nem matriz", () => {
    const a = calcularAnaliseSetor("Escritório", cats, pergs, rs, [], 0, 4);
    const suporte = a[0];
    assert.equal(suporte.semBase, true);
    assert.equal(suporte.gravidade, null);
    assert.equal(suporte.matriz, null);
    assert.equal(a[1].gravidade?.texto, "Baixa");
  });

  test("consolidado (null ou 'Todos os setores') usa todos os respondentes", () => {
    const a = calcularAnaliseSetor(null, cats, pergs, rs, [], 0, 4);
    const b = calcularAnaliseSetor(TODOS_OS_SETORES, cats, pergs, rs, [], 0, 4);
    assert.deepEqual(a, b);
    // P1: (4+4+1)/3 = 3 → Alta; P2: (0+0+4)/3 = 1,33 → ⌈⌉=2 → 4−2=2 → Média → média 2,5 → Alta
    assert.equal(a[1].gravidade?.texto, "Alta");
    assert.equal(a[1].perguntas[0].n, 3);
  });

  test("setor com espaço sobrando no respondente ainda entra no recorte", () => {
    const a = calcularAnaliseSetor("Produção", cats, pergs, [resp("Produção ", { P3: 3 })], [], 0, 4);
    assert.equal(a[0].perguntas[0].n, 1);
  });
});

describe("oráculo — FLOC TEXTIL, medido na prévia de 14/09 com as funções compiladas do painel", () => {
  // Recorte real de uma pergunta invertida da QAP: 113 respostas em 0–4 com
  // média 3,04. Na régua antiga: (4−3,04)/4 = 24% → Baixa. Na do DRPS:
  // ⌈3,04⌉ = 4 → 4−4 = 0 → Baixa. Concordam aqui — e discordam no caso 2,1
  // acima. Fixa o comportamento nas duas pontas.
  test("média 3,04 invertida → corrigida 0 → Baixa", () => {
    const p = pergunta("P1", "invertida");
    const vals = [...Array(65).fill(4), ...Array(20).fill(3), ...Array(12).fill(2), ...Array(16).fill(0)];
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    assert.ok(Math.abs(media - 3.04) < 0.01, `média ${media}`);
    const g = calcularPerguntaGravidade(p, vals.map((v) => resp("X", { P1: v })), 0, 4);
    assert.equal(g.corrigida, 0);
    assert.equal(g.gravidade.texto, "Baixa");
  });
});

describe("listarSetoresQps", () => {
  test("único, sem espaço e em ordem pt-BR", () => {
    assert.deepEqual(
      listarSetoresQps([{ setor: "Tecelagem " }, { setor: "Acabamento" }, { setor: "Tecelagem" }, { setor: "" }]),
      ["Acabamento", "Tecelagem"],
    );
  });
});
