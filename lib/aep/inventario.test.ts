import { test } from "node:test";
import assert from "node:assert/strict";

import { COLUNAS_INVENTARIO, csvInventario, detalhesDoSetor, linhasInventario, normalizarInventario } from "./inventario";
import { confiancaDoFator, normalizarMapaLista, origensEfetivas } from "./evidencia";
import { ITENS_GESTAO, lacunasDoFator, medidasExistentesDoFator, normalizarChecklistGestao } from "./checklist-gestao";
import { ITENS_ORGANIZACIONAL } from "./checklist-itens";
import { montarBiblioteca } from "./biblioteca";

const BIB = montarBiblioteca([
  {
    fator: "assedio",
    ordem: 1,
    descricao_risco: "Condutas abusivas",
    danos_saude: "Estresse",
    meio_propagacao: "Relações interpessoais",
    situacao_padrao: "Normal",
    tempo_exposicao_padrao: "Habitual e permanente",
    fontes_geradoras: [{ codigo: "1.4", texto: "Gestão autoritária" }, { codigo: "1.5", texto: "Lideranças sem capacitação" }],
    sugestoes_iniciais: ["Política de prevenção"],
    acoes: ["Código de conduta"],
  },
]);

const GESTAO = normalizarChecklistGestao({
  itens: {
    G01: { resposta: "nao_existe" },
    G02: { resposta: "existe_evidenciado", origem: "documento", evidencia: "Canal X" },
    G03: { resposta: "existe_sem_evidencia" },
    G99: { resposta: "nao_existe" },
  },
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

test("detalhe do fator junta biblioteca, gestão, sinais, origem e AIHA", () => {
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
  assert.equal(d.key, "assedio");
  assert.deepEqual(d.fontes, [
    "G01 — Política de prevenção e enfrentamento ao assédio e demais formas de violência (não existe)",
    "G03 — Procedimento de apuração de denúncias e aplicação de medidas (existe, sem evidência)",
    "1.5 — Lideranças sem capacitação",
  ]);
  assert.deepEqual(d.origens, ["Observação direta", "Documental"]);
  assert.equal(d.confianca, "Média");
  assert.equal(d.nivel, "Moderado");

  const linhas = linhasInventario([setor], GESTAO, BIB);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].length, COLUNAS_INVENTARIO.length);
  assert.equal(linhas[0][8], "G02 — Canal de denúncia com sigilo e garantia de não retaliação");
  // Sem medidas evidenciadas: frase padrão.
  const semMedidas = linhasInventario([setor], normalizarChecklistGestao({}), BIB);
  assert.equal(semMedidas[0][8], "Não evidenciadas medidas de controle específicas");
});

test("CSV com ponto e vírgula, BOM e aspas quando preciso", () => {
  const csv = csvInventario([["A;B", 'diz "oi"', "ok", ...Array(14).fill("")]]);
  assert.ok(csv.startsWith("﻿Setor;GHE;Perigo"));
  assert.ok(csv.includes('"A;B";"diz ""oi""";ok'));
});

test("normalizarMapaLista tira duplicados e lixo", () => {
  assert.deepEqual(normalizarMapaLista({ a: ["x", "x", 3], b: "y" }), { a: ["x"] });
});

test("ajustes do técnico no inventário: textos, seleção e itens manuais", () => {
  const setor = {
    checklist_organizacional: { assedio: "sim" },
    sinais_organizacional: { assedio: ["tom_agressivo"] },
    inventario: normalizarInventario({
      assedio: {
        perigo: "  Assédio moral pela supervisão  ",
        meio: "",
        descricao: "Texto próprio",
        fontes_extra: ["Fonte manual"],
        sinais_extra: ["Relato do cipeiro"],
        medidas_extra: ["Medida manual"],
        sugestoes: [],
        acoes: ["Código de conduta", "inexistente"],
        acoes_extra: ["Ação manual"],
        lixo: 3,
      },
    }),
  };
  const [d] = detalhesDoSetor(setor, GESTAO, BIB);
  assert.equal(d.label, "Assédio moral pela supervisão");
  assert.equal(d.meio, "Relações interpessoais"); // vazio = padrão
  assert.equal(d.descricao, "Texto próprio");
  assert.equal(d.danos, "Estresse");
  assert.deepEqual(d.sinais, ["Tom agressivo, irônico, humilhante e/ou brincadeiras constrangedoras", "Relato do cipeiro"]);
  assert.ok(d.fontes.includes("Fonte manual"));
  assert.deepEqual(d.medidasExistentes, ["G02 — Canal de denúncia com sigilo e garantia de não retaliação", "Medida manual"]);
  assert.deepEqual(d.sugestoes, []); // seleção vazia = nenhuma da biblioteca
  assert.deepEqual(d.acoes, ["Código de conduta", "Ação manual"]);
  // Sem ajuste: tudo da biblioteca.
  const [p] = detalhesDoSetor({ checklist_organizacional: { assedio: "sim" } }, GESTAO, BIB);
  assert.deepEqual(p.sugestoes, ["Política de prevenção"]);
});
