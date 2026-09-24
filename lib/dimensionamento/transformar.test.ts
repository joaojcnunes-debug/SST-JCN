/* eslint-disable @typescript-eslint/no-explicit-any --
   Testes PORTADOS da origem: os fixtures sao parciais de proposito e quem valida a
   forma sao os 84 asserts, nao o compilador. */
/* Testes da transformação da API de documentos SST → demanda e atendidas.
   node tests/sincronizacao.test.mjs */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as TrMod from "./transformar";
/** Porta frouxa: o app consome estes modulos TIPADOS; aqui os fixtures sao
    parciais de proposito e quem valida a forma sao os asserts do teste. */
const Tr = TrMod as unknown as Record<string, any>;

/* Tipagem dos fixtures deste porte: os testes vieram da origem e constroem
   objetos PARCIAIS de proposito. `Frouxo` nomeia isso -- objeto de teste cuja
   forma quem valida e o motor, nao o compilador (os 84 asserts sao a validacao).
   Melhor que @ts-nocheck, proibido pelo eslint do painel, que desligaria a
   checagem do arquivo inteiro. */
type Frouxo = Record<string, any>;



/* ---------- apoio ---------- */
const doc = (extra = {}) => ({
  id: 'teresopolis:PGR:1', unidade: 'teresopolis', tipo: 'PGR', numero: '1',
  emitido_em: '2026-01-10', vence_em: '2026-03-15', situacao: 'LIBERADO',
  vigente: true, estado: 'vigente', dias_para_vencer: 30,
  empresa_id: 'E1', empresa_cnpj: '12345678000199', empresa_razao_social: 'Empresa 1',
  atualizado_em: '2026-09-18T06:30:00Z', ...extra,
});
const cobertura = (extra = {}) => ({ unidade: 'teresopolis', cobertura: 'ok', ultima_varredura_em: '2026-09-18T06:30:00Z', status_varredura: 'ok', documentos_sst: 10, ...extra });
const UNIDADES = [
  { id: 'u-teresopolis', nome: 'Teresópolis', codigo_api: 'teresopolis' },
  { id: 'u-campos', nome: 'Campos dos Goytacazes', codigo_api: 'campos' },
  { id: 'u-gestao', nome: 'Gestão de Conformidade', codigo_api: null },
];
const lote = (docs: any, cobs: any, classificacao = {}) => Tr.montarLote({ ano: 2026, cobertura: cobs, documentos: docs, unidades: UNIDADES, classificacao });


test('mês do ano: aceita só o ano pedido', () => {
  assert.strictEqual(Tr.mesDoAno('2026-03-15', 2026), 3);
  assert.strictEqual(Tr.mesDoAno('2025-03-15', 2026), null);
  assert.strictEqual(Tr.mesDoAno(null, 2026), null);
  assert.strictEqual(Tr.mesDoAno('', 2026), null);
});

test('demanda: cada empresa conta uma vez por mês, mesmo com vários documentos vencendo', () => {
  const docs = [
    doc({ id: 'a', tipo: 'PGR', vence_em: '2026-03-10' }),
    doc({ id: 'b', tipo: 'LTCAT', vence_em: '2026-03-20' }),   // mesma empresa, mesmo mês
    doc({ id: 'c', tipo: 'LI', vence_em: '2026-04-05' }),      // mesma empresa, outro mês
  ];
  const r = lote(docs, [cobertura()]);
  const u = r.unidades[0];
  assert.deepStrictEqual(u.demanda, [
    { mes: 3, condicao: 'mensal', porte: 'P', quantidade: 1 },
    { mes: 4, condicao: 'mensal', porte: 'P', quantidade: 1 },
  ]);
});

test('demanda: só o documento corrente entra (substituído não gera vencimento)', () => {
  const docs = [
    doc({ id: 'velho', vigente: false, estado: 'substituido', vence_em: '2026-02-10', emitido_em: '2025-02-01' }),
    doc({ id: 'novo', vigente: true, estado: 'vigente', vence_em: '2026-08-10', emitido_em: '2026-02-05' }),
  ];
  const r = lote(docs, [cobertura()]);
  const meses = r.unidades[0].demanda.map((d: any) => d.mes);
  assert.deepStrictEqual(meses, [8], 'apenas o vencimento do documento corrente');
});

test('atendidas: emissão é conclusão — inclui documento já substituído', () => {
  const docs = [
    doc({ id: 'velho', vigente: false, estado: 'substituido', emitido_em: '2026-02-05', vence_em: '2026-02-28' }),
    doc({ id: 'novo', vigente: true, emitido_em: '2026-02-20', vence_em: '2027-02-20' }),   // mesma empresa e mês: conta 1
    doc({ id: 'outra', empresa_cnpj: '98765432000188', empresa_id: 'E2', emitido_em: '2026-02-11', vence_em: '2027-01-01' }),
  ];
  const r = lote(docs, [cobertura()]);
  assert.deepStrictEqual(r.unidades[0].atendidas, { 2: { P: 2 } }, 'duas empresas concluídas em fevereiro');
});

test('porte e condição vêm da classificação do cliente (por CNPJ, senão por código)', () => {
  const classificacao = {
    porCnpj: { 12345678000199: { porte: 'G', condicao: 'exclusiva_tst' } },
    porCodigo: { E2: { porte: 'M', condicao: 'mensal' } },
  };
  const docs = [
    doc({ vence_em: '2026-05-10' }),
    doc({ id: 'x', empresa_cnpj: '', empresa_id: 'E2', vence_em: '2026-05-12' }),
    doc({ id: 'y', empresa_cnpj: '11111111000111', empresa_id: 'E3', vence_em: '2026-05-15' }), // sem classificação
  ];
  const r = lote(docs, [cobertura()], classificacao);
  assert.deepStrictEqual(r.unidades[0].demanda.sort((a: any, b: any) => (a.porte as Frouxo).localeCompare(b.porte)), [
    { mes: 5, condicao: 'exclusiva_tst', porte: 'G', quantidade: 1 },
    { mes: 5, condicao: 'mensal', porte: 'M', quantidade: 1 },
    { mes: 5, condicao: 'mensal', porte: 'P', quantidade: 1 },
  ].sort((a, b) => a.porte.localeCompare(b.porte)));
  assert.strictEqual(r.resumo.semClassificacao, 1);
  assert.strictEqual(r.naoClassificados[0].cnpj, '11111111000111');
});

test('cobertura: indisponível e falha não são gravadas; parcial e desatualizado são, com aviso', () => {
  const docs = [
    doc({ unidade: 'teresopolis', vence_em: '2026-06-10' }),
    doc({ id: 'c1', unidade: 'campos', empresa_cnpj: '22222222000122', vence_em: '2026-06-11' }),
  ];
  const indisponivel = lote(docs, [cobertura(), cobertura({ unidade: 'campos', cobertura: 'indisponivel', documentos_sst: 0 })]);
  const campos = indisponivel.unidades.find((u: any) => u.codigo_api === 'campos');
  assert.strictEqual(campos.aplicar, false);
  assert.strictEqual(campos.demanda.length, 0, 'nada é gravado para unidade indisponível');
  assert.ok(/não utiliz/.test(campos.mensagem));
  assert.strictEqual(indisponivel.resumo.unidadesAplicadas, 1);

  const parcial = lote(docs, [cobertura({ cobertura: 'parcial' })]);
  assert.strictEqual(parcial.unidades[0].aplicar, true);
  assert.ok(/ausência de documento não prova/.test(parcial.unidades[0].mensagem));

  const velho = lote(docs, [cobertura({ cobertura: 'desatualizado' })]);
  assert.strictEqual(velho.unidades[0].aplicar, true);
  assert.deepStrictEqual(Tr.COBERTURA_UTILIZAVEL, ['ok', 'parcial', 'desatualizado']);
});

test('unidade da API sem correspondente no cadastro não é gravada', () => {
  const r = lote([doc({ unidade: 'macae' })], [cobertura({ unidade: 'macae' })]);
  assert.strictEqual(r.unidades[0].aplicar, false);
  assert.ok(/sem correspondente/.test(r.unidades[0].mensagem));
});

test('outros anos ficam de fora, tanto na demanda quanto nas atendidas', () => {
  const docs = [
    doc({ vence_em: '2027-03-10', emitido_em: '2025-03-01' }),
    doc({ id: 'z', empresa_cnpj: '33333333000133', vence_em: '2026-03-10', emitido_em: '2026-03-01' }),
  ];
  const r = lote(docs, [cobertura()]);
  assert.deepStrictEqual(r.unidades[0].demanda, [{ mes: 3, condicao: 'mensal', porte: 'P', quantidade: 1 }]);
  assert.deepStrictEqual(r.unidades[0].atendidas, { 3: { P: 1 } });
});

test('documento sem vencimento entra como atendimento, mas não como demanda', () => {
  const r = lote([doc({ vence_em: null, estado: 'sem_vencimento', emitido_em: '2026-07-07' })], [cobertura()]);
  assert.strictEqual(r.unidades[0].demanda.length, 0);
  assert.deepStrictEqual(r.unidades[0].atendidas, { 7: { P: 1 } });
});

test('lote vazio e entradas inválidas não quebram', () => {
  const vazio = Tr.montarLote({ ano: 2026, cobertura: [], documentos: [], unidades: UNIDADES });
  assert.deepStrictEqual(vazio.unidades, []);
  assert.strictEqual(vazio.resumo.demanda, 0);
  const sujo = lote([doc({ empresa_cnpj: '', empresa_id: '' }), {}], [cobertura()]);
  assert.strictEqual(sujo.unidades[0].demanda.length, 0, 'documento sem identificação de empresa é ignorado');
});

test('classificar: CNPJ com máscara casa com o cadastro sem máscara', () => {
  const c = Tr.classificar({ empresa_cnpj: '12.345.678/0001-99', empresa_id: 'E9' }, { porCnpj: { 12345678000199: { porte: 'M', condicao: 'mensal' } } });
  assert.strictEqual(c.porte, 'M');
  assert.strictEqual(c.classificado, true);
});

test('resumo: soma o que será gravado e lista o que foi ignorado', () => {
  const docs = [
    doc({ vence_em: '2026-01-10', emitido_em: '2026-01-05' }),
    doc({ id: 'b', empresa_cnpj: '44444444000144', vence_em: '2026-01-20', emitido_em: '2026-01-06' }),
    doc({ id: 'c', unidade: 'campos', empresa_cnpj: '55555555000155', vence_em: '2026-02-10' }),
  ];
  const r = lote(docs, [cobertura(), cobertura({ unidade: 'campos', cobertura: 'indisponivel' })]);
  assert.strictEqual(r.resumo.demanda, 2);
  assert.strictEqual(r.resumo.atendidas, 2);
  assert.strictEqual(r.resumo.unidadesIgnoradas.length, 1);
  assert.strictEqual(r.resumo.unidadesIgnoradas[0].codigo_api, 'campos');
});
