import { test } from "node:test";
import assert from "node:assert/strict";

import { avaliarServico, enviosDoServico, montarFila, visaoDoVendedor, type DecisaoServico } from "./liberacao";
import type { EmpresaComercial, Oportunidade, Produto, SituacaoOportunidade } from "./oportunidades";

const CORTE = "2026-11-05T12:00:00.000Z";
const ANTES = "2026-10-01T12:00:00.000Z";
const DEPOIS = "2026-11-10T12:00:00.000Z";

const op = (produto: Produto, situacao: SituacaoOportunidade = "aberta", origens: Oportunidade["origens"] = ["Inspeção"]): Oportunidade => ({
  produto,
  situacao,
  origens,
  detalhes: [],
  setores: [],
});

const empresa = (oportunidades: Oportunidade[], envio: { insp?: string | null; aep?: string | null } = { insp: DEPOIS }, id = "E1") =>
  ({
    empresa: { idEmpresa: id, nome: id },
    oportunidades,
    aepLiberadaEm: envio.aep ?? null,
    aepLiberadaPor: null,
    inspecao: envio.insp ? { idInspecao: "I1", concluidaEm: null, responsavel: null, liberadoEm: envio.insp, liberadoPor: null } : null,
  }) as unknown as EmpresaComercial;

const decisao = (produto: Produto, status: DecisaoServico["status"], em: string, extra: Partial<DecisaoServico> = {}): DecisaoServico => ({
  id_empresa: "E1",
  produto,
  status,
  modalidades: [],
  orientacao: null,
  motivo: null,
  decidido_por: "Ana",
  decidido_em: em,
  ...extra,
});

const NOVA = "2026-11-20T12:00:00.000Z";

test("envio depois do corte e sem decisão fica pendente", () => {
  const o = op("AET");
  assert.equal(avaliarServico(empresa([o]), o, null, CORTE).estado, "pendente");
});

test("o que já estava liberado antes da fila continua valendo", () => {
  const o = op("AET");
  assert.equal(avaliarServico(empresa([o], { insp: ANTES }), o, null, CORTE).estado, "legado");
});

test("banco sem a v321 (sem corte): nada muda para o vendedor", () => {
  const o = op("AET");
  const c = empresa([o]);
  assert.equal(avaliarServico(c, o, null, null).estado, "legado");
  assert.deepEqual(visaoDoVendedor([c], [], null)[0].oportunidades.map((x) => x.produto), ["AET"]);
});

test("a decisão vale enquanto o documento não for reenviado", () => {
  const o = op("AET");
  const c = empresa([o]);
  assert.equal(avaliarServico(c, o, decisao("AET", "LIBERADO", NOVA), CORTE).estado, "liberado");
  assert.equal(avaliarServico(c, o, decisao("AET", "SEGURADO", NOVA), CORTE).estado, "segurado");
});

test("documento reenviado depois da decisão volta para a fila, mesmo tendo envio antigo", () => {
  const o = op("AET", "aberta", ["AEP", "Inspeção"]);
  const c = empresa([o], { aep: ANTES, insp: NOVA });
  const r = avaliarServico(c, o, decisao("AET", "SEGURADO", DEPOIS), CORTE);
  assert.equal(r.estado, "pendente");
  assert.equal(r.reenviado, true);
  assert.equal(r.enviadoEm, NOVA);
});

test("os envios vêm só das origens do serviço", () => {
  const c = empresa([], { aep: ANTES, insp: DEPOIS });
  assert.deepEqual(enviosDoServico(c, op("AET", "aberta", ["AEP"])), [ANTES]);
  assert.deepEqual(enviosDoServico(c, op("Treinamentos NR")), [DEPOIS]);
  assert.deepEqual(enviosDoServico(c, op("DRPS/Questionário", "aberta", ["AEP", "Inspeção"])), [ANTES, DEPOIS]);
});

test("a fila só traz o que ainda tem o que vender", () => {
  const c = empresa([op("AET"), op("Apreciação NR-12", "revisao"), op("Análise de Químicos", "andamento"), op("Treinamentos NR", "realizada")]);
  const fila = montarFila([c], [], CORTE);
  assert.deepEqual(fila.map((f) => f.oportunidade.produto), ["AET", "Apreciação NR-12"]);
  assert.ok(fila.every((f) => f.estado === "pendente"));
});

test("a fila guarda a decisão vencida para preencher a próxima", () => {
  const c = empresa([op("Treinamentos NR")], { insp: NOVA });
  const d = decisao("Treinamentos NR", "LIBERADO", DEPOIS, { modalidades: ["EAD"], orientacao: "Oferecer pacote" });
  const [f] = montarFila([c], [d], CORTE);
  assert.equal(f.estado, "pendente");
  assert.equal(f.reenviado, true);
  assert.deepEqual(f.decisao?.modalidades, ["EAD"]);
});

test("decisão de outra empresa não vale aqui", () => {
  const c = empresa([op("AET")], { insp: DEPOIS }, "E2");
  assert.equal(montarFila([c], [decisao("AET", "SEGURADO", NOVA)], CORTE)[0].estado, "pendente");
});

test("o vendedor vê liberado e legado, com modalidades e orientação", () => {
  const liberada = empresa([op("Treinamentos NR")]);
  const antiga = empresa([op("AET")], { insp: ANTES }, "E2");
  const d = decisao("Treinamentos NR", "LIBERADO", NOVA, { modalidades: ["EAD", "Ao vivo"], orientacao: "Falar com o RH" });
  const [a, b] = visaoDoVendedor([liberada, antiga], [d], CORTE);
  assert.deepEqual(a.oportunidades[0].liberacao, { modalidades: ["EAD", "Ao vivo"], orientacao: "Falar com o RH", por: "Ana", em: NOVA });
  assert.equal(b.oportunidades[0].liberacao, undefined);
});

test("o vendedor não vê pendente nem segurado, e a empresa vazia sai da lista", () => {
  const c = empresa([op("AET"), op("Apreciação NR-12")]);
  assert.deepEqual(visaoDoVendedor([c], [], CORTE), []);
  const uma = visaoDoVendedor([c], [decisao("AET", "LIBERADO", NOVA), decisao("Apreciação NR-12", "SEGURADO", NOVA)], CORTE);
  assert.deepEqual(uma[0].oportunidades.map((x) => x.produto), ["AET"]);
});

test("em andamento e realizado seguem visíveis sem decisão, mas segurado não", () => {
  const c = empresa([op("AET", "andamento"), op("Análise de Químicos", "realizada")]);
  assert.deepEqual(visaoDoVendedor([c], [], CORTE)[0].oportunidades.map((x) => x.produto), ["AET", "Análise de Químicos"]);
  const segurada = visaoDoVendedor([c], [decisao("AET", "SEGURADO", NOVA)], CORTE);
  assert.deepEqual(segurada[0].oportunidades.map((x) => x.produto), ["Análise de Químicos"]);
});

test("visaoDoVendedor não altera a lista recebida", () => {
  const c = empresa([op("AET")]);
  visaoDoVendedor([c], [decisao("AET", "LIBERADO", NOVA)], CORTE);
  assert.equal(c.oportunidades[0].liberacao, undefined);
});
