import { test } from "node:test";
import assert from "node:assert/strict";

import { COLUNAS_INVENTARIO, csvInventario, detalhesDoSetor, idsSelecionados, linhasInventario, normalizarInventario } from "./inventario";
import { confiancaDoFator, normalizarMapaLista, origensEfetivas } from "./evidencia";
import { ITENS_GESTAO, lacunasDoFator, medidasExistentesDoFator, normalizarChecklistGestao } from "./checklist-gestao";
import { ITENS_ORGANIZACIONAL } from "./checklist-itens";
import { existeNaBiblioteca, idsPadrao, itensDe, montarBiblioteca } from "./biblioteca";

const item = (id: string, fator: string | null, topico: string, texto: string, extra: Record<string, unknown> = {}) => ({
  id_item: id,
  fator,
  topico,
  texto,
  ordem: 0,
  padrao: false,
  status: "ativo",
  ...extra,
});

const BIB = montarBiblioteca(
  [{ fator: "assedio", ordem: 1, meio_propagacao: "Relações interpessoais", situacao_padrao: "Normal", tempo_exposicao_padrao: "Habitual e permanente" }],
  [
    item("P1", "assedio", "perigo", "Assédio de qualquer natureza no trabalho", { padrao: true }),
    item("F1", "assedio", "fonte", "Gestão autoritária", { codigo: "1.4" }),
    item("F2", "assedio", "fonte", "Lideranças sem capacitação", { codigo: "1.5" }),
    item("E1", "assedio", "evidencia", "Relato do cipeiro"),
    item("D1", "assedio", "descricao", "Condutas abusivas", { padrao: true }),
    item("DN1", "assedio", "danos", "Estresse", { padrao: true }),
    item("M1", "assedio", "medida", "Canal de denúncia sigiloso"),
    item("MR1", "assedio", "medida_recomendada", "Canal de denúncia sigiloso"),
    item("S1", "assedio", "sugestao", "Política de prevenção", { padrao: true }),
    item("S2", "assedio", "sugestao", "Pendente", { padrao: true, status: "pendente" }),
    item("A1", "assedio", "acao", "Código de conduta", { padrao: true }),
    item("A2", "assedio", "acao", "Capacitar lideranças", { padrao: true }),
    item("ME1", null, "meio", "Relações interpessoais"),
    item("ME2", null, "meio", "Não Aplicável"),
    item("SI1", null, "situacao", "Normal"),
    item("T1", null, "tempo", "Habitual e permanente"),
    item("X1", "sobrecarga", "acao", "Outro fator", { padrao: true }),
    { id_item: "ruim", topico: "inexistente", texto: "x" },
  ],
);

const GESTAO = normalizarChecklistGestao({
  itens: {
    G01: { resposta: "nao_existe" },
    G02: { resposta: "existe_evidenciado", origem: "documento", evidencia: "Canal X" },
    G03: { resposta: "existe_sem_evidencia" },
    G99: { resposta: "nao_existe" },
  },
});

test("biblioteca: opções por fator, comuns sem fator, só ativas; padrão comum pelo texto do fator", () => {
  assert.deepEqual(itensDe(BIB, "assedio", "sugestao").map((i) => i.id_item), ["S1"]);
  assert.deepEqual(itensDe(BIB, "assedio", "meio").map((i) => i.id_item).sort(), ["ME1", "ME2"]);
  assert.deepEqual(idsPadrao(BIB, "assedio", "meio"), ["ME1"]);
  assert.deepEqual(idsPadrao(BIB, "assedio", "acao"), ["A2", "A1"]); // ordem, depois alfabética
  assert.equal(BIB.itens.some((i) => i.id_item === "ruim"), false);
  assert.equal(existeNaBiblioteca(BIB, "assedio", "sugestao", "  pendente ")?.id_item, "S2");
});

test("confiança: 1 tipo baixa, 2 média, 3+ alta; lacuna de gestão conta como documental", () => {
  assert.equal(confiancaDoFator([], false), null);
  assert.equal(confiancaDoFator(["observacao_direta"], false), "Baixa");
  assert.equal(confiancaDoFator(["observacao_direta"], true), "Média");
  assert.equal(confiancaDoFator(["observacao_direta", "relato_grupo", "documental"], true), "Alta");
  assert.deepEqual(origensEfetivas(["documental", "xx"], true), ["documental"]);
});

test("checklist de gestão: lacunas e medidas por fator; código desconhecido descartado", () => {
  assert.equal(GESTAO.itens?.G99, undefined);
  assert.deepEqual(lacunasDoFator(GESTAO, "assedio").map((i) => i.codigo), ["G01", "G03"]);
  assert.deepEqual(medidasExistentesDoFator(GESTAO, "assedio").map((i) => i.codigo), ["G02"]);
  assert.deepEqual(lacunasDoFator(GESTAO, "sobrecarga"), []);
});

test("todo item de gestão aponta para fatores que existem", () => {
  const chaves = ITENS_ORGANIZACIONAL.map((i) => i.key as string);
  assert.equal(ITENS_GESTAO.length, 26);
  for (const i of ITENS_GESTAO) for (const f of i.fatores) assert.ok(chaves.includes(f), `${i.codigo}:${f}`);
});

test("sem seleção: padrão da biblioteca; fontes legadas (códigos) ainda valem", () => {
  const setor = {
    nome_setor: "Produção",
    ghe: "GHE-1",
    checklist_organizacional: { assedio: "sim", sobrecarga: "nao" },
    sinais_organizacional: { assedio: ["tom_agressivo"] },
    aiha_organizacional: { assedio: { probabilidade: "Exposição a níveis baixos", severidade: "Irreversíveis", nivel: "Moderado" } },
    origem_evidencia: { assedio: ["observacao_direta"] },
    fontes_geradoras: { assedio: ["1.5"] },
  };
  const [d] = detalhesDoSetor(setor, GESTAO, BIB);
  assert.equal(d.label, "Assédio de qualquer natureza no trabalho");
  assert.deepEqual(d.fontes, [
    "G01 — Política de prevenção e enfrentamento ao assédio e demais formas de violência (não existe)",
    "G03 — Procedimento de apuração de denúncias e aplicação de medidas (existe, sem evidência)",
    "1.5 — Lideranças sem capacitação",
  ]);
  assert.equal(d.meio, "Relações interpessoais");
  assert.equal(d.descricao, "Condutas abusivas");
  assert.deepEqual(d.sugestoes, ["Política de prevenção"]);
  assert.deepEqual(d.acoes, ["Capacitar lideranças", "Código de conduta"]);
  assert.deepEqual(d.origens, ["Observação direta", "Documental"]);
  assert.equal(d.confianca, "Média");

  const linhas = linhasInventario([setor], GESTAO, BIB);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].length, COLUNAS_INVENTARIO.length);
  assert.equal(linhas[0][8], "G02 — Canal de denúncia com sigilo e garantia de não retaliação");
  const semMedidas = linhasInventario([setor], normalizarChecklistGestao({}), BIB);
  assert.equal(semMedidas[0][8], "Não evidenciadas medidas de controle específicas");
});

test("com seleção do técnico: opções marcadas + manuais; item que saiu da biblioteca some", () => {
  const setor = {
    checklist_organizacional: { assedio: "sim" },
    sinais_organizacional: { assedio: ["tom_agressivo"] },
    inventario: normalizarInventario({
      assedio: {
        sel: { meio: ["ME2"], acao: ["A2", "APAGADO"], sugestao: [], evidencia: ["E1"], medida: ["M1"], fonte: ["F1"], medida_recomendada: ["MR1"] },
        extra: { acao: ["Ação manual"], perigo: ["Assédio moral pela supervisão"], fonte: ["Fonte manual"], lixo: 3 },
      },
    }),
  };
  assert.deepEqual(idsSelecionados(setor, "assedio", "acao", BIB), ["A2"]);
  const [d] = detalhesDoSetor(setor, GESTAO, BIB);
  assert.equal(d.label, "Assédio de qualquer natureza no trabalho / Assédio moral pela supervisão");
  assert.equal(d.meio, "Não Aplicável");
  assert.deepEqual(d.acoes, ["Capacitar lideranças", "Ação manual"]);
  assert.deepEqual(d.sugestoes, []);
  assert.deepEqual(d.sinais, ["Tom agressivo, irônico, humilhante e/ou brincadeiras constrangedoras", "Relato do cipeiro"]);
  assert.ok(d.fontes.includes("1.4 — Gestão autoritária") && d.fontes.includes("Fonte manual"));
  assert.deepEqual(d.medidasExistentes, ["G02 — Canal de denúncia com sigilo e garantia de não retaliação", "Canal de denúncia sigiloso"]);
  assert.deepEqual(d.medidasRecomendadas, ["Canal de denúncia sigiloso"]);
});

test("CSV com ponto e vírgula, BOM e aspas quando preciso", () => {
  const csv = csvInventario([["A;B", 'diz "oi"', "ok", ...Array(COLUNAS_INVENTARIO.length - 3).fill("")]]);
  assert.ok(csv.startsWith("﻿Setor;GHE;Perigo"));
  assert.ok(csv.includes('"A;B";"diz ""oi""";ok'));
});

test("normalizarMapaLista tira duplicados e lixo", () => {
  assert.deepEqual(normalizarMapaLista({ a: ["x", "x", 3], b: "y" }), { a: ["x"] });
});
