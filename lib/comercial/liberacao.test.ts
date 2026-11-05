import { test } from "node:test";
import assert from "node:assert/strict";

import {
  avaliarServico,
  enviosDoServico,
  faltaParaConcluir,
  montarFila,
  resumirEmpresas,
  visaoDoVendedor,
  type AtendimentoComercial,
  type DecisaoServico,
  type IntervencaoIndicada,
} from "./liberacao";
import type { EmpresaComercial, Oportunidade, Produto, SituacaoOportunidade } from "./oportunidades";

const CORTE = "2026-11-05T12:00:00.000Z";
const ANTES = "2026-10-01T12:00:00.000Z";
const DEPOIS = "2026-11-10T12:00:00.000Z";
const NOVA = "2026-11-20T12:00:00.000Z";

const op = (produto: Produto, situacao: SituacaoOportunidade = "aberta", origens: Oportunidade["origens"] = ["Inspeção"]): Oportunidade => ({
  produto,
  situacao,
  origens,
  detalhes: [],
  setores: [],
});

const empresa = (oportunidades: Oportunidade[], envio: { insp?: string | null; aep?: string | null } = { insp: DEPOIS }, id = "E1") =>
  ({
    empresa: { idEmpresa: id, nome: id, cnpj: null, municipio: null, uf: null },
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

const atendimento = (status: AtendimentoComercial["status"], extra: Partial<AtendimentoComercial> = {}, id = "E1"): AtendimentoComercial => ({
  id_empresa: id,
  status,
  parecer: null,
  concluido_em: null,
  concluido_por: null,
  empresas: { nome_empresa: "Empresa nova", cnpj: "1", municipio: "Teresópolis", uf: "RJ", telefone: " 21 ", email: null },
  ...extra,
});

const indicada = (nome: string, extra: Partial<IntervencaoIndicada> = {}): IntervencaoIndicada => ({
  id_empresa: "E1",
  id_intervencao: nome,
  nome,
  responsavel: null,
  modalidades: ["EAD"],
  orientacao: null,
  decidido_por: "Ana",
  decidido_em: NOVA,
  ...extra,
});

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

test("o vendedor vê o liberado de atendimento concluído, com modalidades e orientação", () => {
  const liberada = empresa([op("Treinamentos NR")]);
  const antiga = empresa([op("AET")], { insp: ANTES }, "E2");
  const d = decisao("Treinamentos NR", "LIBERADO", NOVA, { modalidades: ["EAD", "Ao vivo"], orientacao: "Falar com o RH" });
  const [a, b] = visaoDoVendedor([liberada, antiga], [d], CORTE, [atendimento("CONCLUIDO", { parecer: "Empresa pronta" })]);
  assert.deepEqual(a.oportunidades[0].liberacao, { modalidades: ["EAD", "Ao vivo"], orientacao: "Falar com o RH", por: "Ana", em: NOVA });
  assert.equal(a.parecerEquipe, "Empresa pronta");
  assert.equal(b.oportunidades[0].liberacao, undefined);
});

test("reabrir tira o liberado do vendedor até concluir de novo", () => {
  const c = empresa([op("AET")]);
  const d = decisao("AET", "LIBERADO", NOVA);
  assert.deepEqual(visaoDoVendedor([c], [d], CORTE, [atendimento("EM_ANDAMENTO")]), []);
  assert.equal(visaoDoVendedor([c], [d], CORTE, [atendimento("CONCLUIDO")]).length, 1);
});

test("reabrir não tira o que já estava liberado antes da fila", () => {
  const c = empresa([op("AET")], { insp: ANTES });
  assert.equal(visaoDoVendedor([c], [], CORTE, [atendimento("EM_ANDAMENTO")]).length, 1);
});

test("o vendedor não vê pendente nem segurado, e a empresa vazia sai da lista", () => {
  const c = empresa([op("AET"), op("Apreciação NR-12")]);
  assert.deepEqual(visaoDoVendedor([c], [], CORTE), []);
  const uma = visaoDoVendedor([c], [decisao("AET", "LIBERADO", NOVA), decisao("Apreciação NR-12", "SEGURADO", NOVA)], CORTE, [atendimento("CONCLUIDO")]);
  assert.deepEqual(uma[0].oportunidades.map((x) => x.produto), ["AET"]);
});

test("em andamento e realizado seguem visíveis sem decisão, mas segurado não", () => {
  const c = empresa([op("AET", "andamento"), op("Análise de Químicos", "realizada")]);
  assert.deepEqual(visaoDoVendedor([c], [], CORTE)[0].oportunidades.map((x) => x.produto), ["AET", "Análise de Químicos"]);
  const segurada = visaoDoVendedor([c], [decisao("AET", "SEGURADO", NOVA)], CORTE);
  assert.deepEqual(segurada[0].oportunidades.map((x) => x.produto), ["Análise de Químicos"]);
});

test("as intervenções viram uma oportunidade só, depois de concluído", () => {
  const c = empresa([op("AET")]);
  const d = decisao("AET", "LIBERADO", NOVA);
  const lista = [indicada("Saúde Mental"), indicada("Burnout", { modalidades: [], orientacao: "Começar pela liderança" })];
  assert.deepEqual(visaoDoVendedor([c], [d], CORTE, [atendimento("EM_ANDAMENTO")], lista), []);
  const [v] = visaoDoVendedor([c], [d], CORTE, [atendimento("CONCLUIDO")], lista);
  const o = v.oportunidades[1];
  assert.equal(o.produto, "Intervenção psicossocial");
  assert.deepEqual(o.origens, ["Psicossocial"]);
  assert.deepEqual(o.detalhes, ["Saúde Mental · EAD", "Burnout · Começar pela liderança"]);
});

test("empresa só com intervenção aparece para o vendedor, com o cadastro do atendimento", () => {
  const [v] = visaoDoVendedor([], [], CORTE, [atendimento("CONCLUIDO")], [indicada("Saúde Mental")]);
  assert.equal(v.empresa.nome, "Empresa nova");
  assert.equal(v.empresa.municipio, "Teresópolis");
  assert.equal(v.telefone, "21");
  assert.equal(v.oportunidades.length, 1);
});

test("atendimento concluído sem nada para vender não cria empresa", () => {
  assert.deepEqual(visaoDoVendedor([], [], CORTE, [atendimento("CONCLUIDO", { parecer: "Nada a oferecer" })]), []);
});

test("visaoDoVendedor não altera a lista recebida", () => {
  const c = empresa([op("AET")]);
  visaoDoVendedor([c], [decisao("AET", "LIBERADO", NOVA)], CORTE, [atendimento("CONCLUIDO", { parecer: "x" })]);
  assert.equal(c.oportunidades[0].liberacao, undefined);
  assert.equal(c.parecerEquipe, undefined);
});

test("resumo: fila, andamento, concluída e serviço novo depois de concluir", () => {
  const fila = montarFila(
    [empresa([op("AET")], { insp: DEPOIS }, "E1"), empresa([op("AET")], { insp: DEPOIS }, "E2"), empresa([op("AET")], { insp: ANTES }, "E3")],
    [],
    CORTE,
  );
  const r = resumirEmpresas(fila, [atendimento("EM_ANDAMENTO", {}, "E2"), atendimento("CONCLUIDO", {}, "E4"), atendimento("CONCLUIDO", {}, "E1")]);
  const de = (id: string) => r.find((x) => x.idEmpresa === id)!;
  assert.equal(de("E1").situacao, "fila");
  assert.equal(de("E1").chegouServico, true);
  assert.equal(de("E2").situacao, "andamento");
  assert.equal(de("E3").situacao, "concluida");
  assert.equal(de("E3").soAntesDaFila, true);
  assert.equal(de("E4").situacao, "concluida");
  assert.equal(de("E4").nome, "Empresa nova");
  assert.equal(de("E4").soAntesDaFila, false);
});

test("concluir pede as decisões e o parecer", () => {
  assert.equal(faltaParaConcluir(1, "ok"), "Decida o serviço que está na fila.");
  assert.equal(faltaParaConcluir(3, "ok"), "Decida os 3 serviços que estão na fila.");
  assert.equal(faltaParaConcluir(0, "  "), "Escreva o parecer.");
  assert.equal(faltaParaConcluir(0, "ok"), null);
});
