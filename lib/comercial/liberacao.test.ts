import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aplicarVendas,
  chaveRisco,
  faltaParaConcluir,
  intervencoesDoRisco,
  resumirEmpresas,
  riscosComIntervencoes,
  riscosDoFechamento,
  textoIntervencao,
  visaoDoVendedor,
  type AtendimentoComercial,
  type ConciliacaoFechada,
  type IntervencaoIndicada,
  type ItemConciliado,
} from "./liberacao";
import type { EmpresaComercial, Oportunidade } from "./oportunidades";

const item = (setor: string, fator: string, decisao: ItemConciliado["decisao"], questionario: ItemConciliado["questionario"] = "DRPS"): ItemConciliado => ({
  setor,
  setor_chave: setor.toUpperCase(),
  id_fator: fator.toLowerCase(),
  fator,
  questionario,
  decisao,
});

const fechada = (id: string, itens: ItemConciliado[], fechado_em = "2026-11-01T12:00:00Z"): ConciliacaoFechada => ({
  id_fechamento: `F-${id}`,
  id_empresa: id,
  fechado_em,
  fechado_por: "ana@x",
  itens,
  empresas: { nome_empresa: `Empresa ${id}`, cnpj: "1", municipio: "Teresópolis", uf: "RJ", telefone: " 21 ", email: null },
});

const atendimento = (id: string, status: AtendimentoComercial["status"], extra: Partial<AtendimentoComercial> = {}): AtendimentoComercial => ({
  id_empresa: id,
  status,
  parecer: null,
  concluido_em: status === "CONCLUIDO" ? "2026-11-03T12:00:00Z" : null,
  concluido_por: null,
  empresas: { nome_empresa: `Empresa ${id}`, telefone: " 21 " },
  ...extra,
});

const indicada = (id: string, setor: string, fator: string, extra: Partial<IntervencaoIndicada> = {}): IntervencaoIndicada => ({
  id_item: `${setor}${fator}`,
  id_empresa: id,
  setor_chave: setor.toUpperCase(),
  setor_nome: setor,
  id_fator: fator.toLowerCase(),
  fator_nome: fator,
  id_intervencao: "INT-1",
  nome: "Treinamento Saúde Mental",
  modalidade: "EAD",
  responsavel: "Equipe EAD",
  prazo_dias: 30,
  ...extra,
});

const empresa = (id: string, oportunidades: Oportunidade[]) =>
  ({ empresa: { idEmpresa: id, nome: id }, oportunidades }) as unknown as EmpresaComercial;
const op = (produto: Oportunidade["produto"]): Oportunidade => ({ produto, situacao: "aberta", origens: ["Inspeção"], detalhes: ["x"], setores: [] });

test("só Confirmar e AET viram risco; descartado e sem parecer ficam de fora", () => {
  const r = riscosDoFechamento([
    item("Padaria", "Sobrecarga", "CONFIRMAR"),
    item("Açougue", "Assédio", "AET"),
    item("RH", "Baixo controle", "DESCARTAR"),
    item("TI", "Eventos violentos", null),
  ]);
  assert.deepEqual(r.map((x) => `${x.setor} ${x.fator} ${x.aet}`), ["Açougue Assédio true", "Padaria Sobrecarga false"]);
});

test("o mesmo setor × fator do DRPS e do QPS vira um risco só", () => {
  const r = riscosDoFechamento([item("Padaria", "Sobrecarga", "CONFIRMAR"), item("Padaria", "Sobrecarga", "AET", "QPS")]);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].questionarios, ["DRPS", "QPS"]);
  assert.equal(r[0].aet, true);
});

test("setores diferentes no mesmo fator são riscos diferentes", () => {
  assert.equal(riscosDoFechamento([item("Padaria", "Sobrecarga", "CONFIRMAR"), item("Açougue", "Sobrecarga", "CONFIRMAR")]).length, 2);
});

test("intervenção de risco que saiu da conciliação aparece marcada", () => {
  const riscos = riscosDoFechamento([item("Padaria", "Sobrecarga", "CONFIRMAR")]);
  const r = riscosComIntervencoes(riscos, [indicada("E1", "Padaria", "Sobrecarga"), indicada("E1", "RH", "Assédio")]);
  assert.deepEqual(r.map((x) => [x.setor, x.foraDaConciliacao]), [["Padaria", false], ["RH", true]]);
});

test("as intervenções do risco ficam em ordem fixa, seja qual for a do banco", () => {
  const b = indicada("A", "RH", "Assédio", { id_item: "2", nome: "Burnout" });
  const a = indicada("A", "RH", "Assédio", { id_item: "1", nome: "Assédio" });
  const outra = indicada("A", "Padaria", "Assédio", { id_item: "3", nome: "Aaa" });
  assert.deepEqual(intervencoesDoRisco([b, outra, a], chaveRisco("RH".toUpperCase(), "assédio")).map((i) => i.nome), ["Assédio", "Burnout"]);
  assert.deepEqual(intervencoesDoRisco([a, b], chaveRisco("RH".toUpperCase(), "assédio")).map((i) => i.nome), ["Assédio", "Burnout"]);
});

test("resumo: empresa sem risco não entra; situação e riscos sem intervenção", () => {
  const r = resumirEmpresas(
    [
      fechada("A", [item("Padaria", "Sobrecarga", "CONFIRMAR"), item("RH", "Assédio", "AET")]),
      fechada("B", [item("RH", "Assédio", "DESCARTAR")]),
      fechada("C", [item("RH", "Assédio", "AET")]),
      fechada("D", [item("RH", "Assédio", "AET")]),
    ],
    [atendimento("C", "EM_ANDAMENTO"), atendimento("D", "CONCLUIDO")],
    [indicada("A", "Padaria", "Sobrecarga")],
  );
  const de = (id: string) => r.find((x) => x.idEmpresa === id);
  assert.equal(de("B"), undefined);
  assert.equal(de("A")?.situacao, "fila");
  assert.equal(de("A")?.riscos, 2);
  assert.equal(de("A")?.semIntervencao, 1);
  assert.equal(de("C")?.situacao, "andamento");
  assert.equal(de("D")?.situacao, "concluida");
});

test("conciliação fechada de novo depois de concluir volta a pedir atendimento", () => {
  const [r] = resumirEmpresas([fechada("A", [item("RH", "Assédio", "AET")], "2026-11-04T12:00:00Z")], [atendimento("A", "CONCLUIDO")], []);
  assert.equal(r.situacao, "fila");
  assert.equal(r.conciliacaoNova, true);
});

test("concluir só pede o parecer", () => {
  assert.equal(faltaParaConcluir("  "), "Escreva o parecer.");
  assert.equal(faltaParaConcluir(null), "Escreva o parecer.");
  assert.equal(faltaParaConcluir("ok"), null);
});

test("texto da intervenção leva risco, modalidade, responsável e prazo", () => {
  assert.equal(textoIntervencao(indicada("A", "Padaria", "Sobrecarga")), "Padaria · Sobrecarga: Treinamento Saúde Mental · EAD · Equipe EAD · 30 dias");
  assert.equal(
    textoIntervencao(indicada("A", "Padaria", "Sobrecarga", { modalidade: null, responsavel: null, prazo_dias: 1 })),
    "Padaria · Sobrecarga: Treinamento Saúde Mental · 1 dia",
  );
});

test("o vendedor continua vendo o que veio da inspeção e da AEP, sem atendimento", () => {
  const [v] = visaoDoVendedor([empresa("A", [op("Apreciação NR-12")])], [], [], []);
  assert.deepEqual(v.oportunidades.map((o) => o.produto), ["Apreciação NR-12"]);
});

test("com atendimento em andamento, nada da Conciliação vai ao vendedor", () => {
  const c = fechada("A", [item("RH", "Assédio", "AET")]);
  const [v] = visaoDoVendedor([empresa("A", [op("Apreciação NR-12")])], [atendimento("A", "EM_ANDAMENTO", { parecer: "x" })], [indicada("A", "RH", "Assédio")], [c]);
  assert.deepEqual(v.oportunidades.map((o) => o.produto), ["Apreciação NR-12"]);
  assert.equal(v.parecerEquipe, undefined);
});

test("concluído leva intervenções, AET e parecer ao vendedor", () => {
  const c = fechada("A", [item("RH", "Assédio", "AET"), item("Padaria", "Sobrecarga", "CONFIRMAR")]);
  const [v] = visaoDoVendedor(
    [empresa("A", [op("Apreciação NR-12")])],
    [atendimento("A", "CONCLUIDO", { parecer: "Empresa pronta" })],
    [indicada("A", "Padaria", "Sobrecarga")],
    [c],
  );
  assert.deepEqual(v.oportunidades.map((o) => o.produto), ["Apreciação NR-12", "AET", "Intervenção psicossocial"]);
  assert.deepEqual(v.oportunidades[1].detalhes, ["RH · Assédio (Conciliação: aprofundar com AET)"]);
  assert.equal(v.parecerEquipe, "Empresa pronta");
});

test("AET que já veio da AEP junta na mesma oportunidade", () => {
  const c = fechada("A", [item("RH", "Assédio", "AET")]);
  const [v] = visaoDoVendedor([empresa("A", [op("AET")])], [atendimento("A", "CONCLUIDO")], [], [c]);
  assert.equal(v.oportunidades.length, 1);
  assert.deepEqual(v.oportunidades[0].origens, ["Inspeção", "Conciliação"]);
  assert.deepEqual(v.oportunidades[0].detalhes, ["x", "RH · Assédio (Conciliação: aprofundar com AET)"]);
});

test("empresa só da Conciliação aparece com o cadastro do atendimento", () => {
  const [v] = visaoDoVendedor([], [atendimento("A", "CONCLUIDO")], [indicada("A", "RH", "Assédio")], [fechada("A", [item("RH", "Assédio", "CONFIRMAR")])]);
  assert.equal(v.empresa.nome, "Empresa A");
  assert.equal(v.telefone, "21");
});

test("concluído sem nada a vender não cria empresa", () => {
  assert.deepEqual(visaoDoVendedor([], [atendimento("A", "CONCLUIDO", { parecer: "Nada" })], [], [fechada("A", [item("RH", "Assédio", "CONFIRMAR")])]), []);
});

test("venda marca a oportunidade como vendida e tira do a vender", () => {
  const c = empresa("A", [op("AET"), op("Treinamentos NR")]);
  const v = { id_empresa: "A", produto: "AET" as const, observacao: "Fechado", vendido_por: "Ana", vendido_por_email: "ana@x", vendido_em: "2026-11-05T12:00:00Z" };
  const [r] = aplicarVendas([c], [v]);
  assert.equal(r.oportunidades[0].situacao, "vendida");
  assert.deepEqual(r.oportunidades[0].venda, { por: "Ana", porEmail: "ana@x", em: "2026-11-05T12:00:00Z", observacao: "Fechado" });
  assert.equal(r.oportunidades[1].situacao, "aberta");
  assert.equal(c.oportunidades[0].situacao, "aberta");
});

test("documento em andamento ou feito continua valendo depois da venda", () => {
  const c = empresa("A", [{ ...op("AET"), situacao: "andamento" }, { ...op("Treinamentos NR"), situacao: "realizada" }]);
  const venda = (produto: Oportunidade["produto"]) => ({ id_empresa: "A", produto, observacao: null, vendido_por: "Ana", vendido_por_email: "ana@x", vendido_em: "2026-11-05T12:00:00Z" });
  const [r] = aplicarVendas([c], [venda("AET"), venda("Treinamentos NR")]);
  assert.deepEqual(r.oportunidades.map((o) => o.situacao), ["andamento", "realizada"]);
  assert.equal(r.oportunidades[0].venda?.por, "Ana");
});

test("venda de outra empresa não vale aqui", () => {
  const [r] = aplicarVendas([empresa("B", [op("AET")])], [{ id_empresa: "A", produto: "AET", observacao: null, vendido_por: "Ana", vendido_por_email: "ana@x", vendido_em: "2026-11-05T12:00:00Z" }]);
  assert.equal(r.oportunidades[0].situacao, "aberta");
});

test("não altera a lista recebida", () => {
  const c = empresa("A", [op("AET")]);
  visaoDoVendedor([c], [atendimento("A", "CONCLUIDO", { parecer: "x" })], [indicada("A", "RH", "Assédio")], [fechada("A", [item("RH", "Assédio", "AET")])]);
  assert.equal(c.oportunidades.length, 1);
  assert.deepEqual(c.oportunidades[0].origens, ["Inspeção"]);
  assert.equal(c.parecerEquipe, undefined);
});
