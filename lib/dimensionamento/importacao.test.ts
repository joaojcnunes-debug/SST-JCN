/* eslint-disable @typescript-eslint/no-explicit-any --
   Testes PORTADOS da origem: os fixtures sao parciais de proposito e quem valida a
   forma sao os 84 asserts, nao o compilador. */
/* Testes do importador de planilha (funções puras): `node tests/importacao.test.mjs`
   Gera uma planilha no formato "SGG" (uma linha por documento) e confere a contagem por unidade × mês. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import * as ImpMod from "./importacao";
/** Porta frouxa: o app consome estes modulos TIPADOS; aqui os fixtures sao
    parciais de proposito e quem valida a forma sao os asserts do teste. */
const Imp = ImpMod as unknown as Record<string, any>;

/* Tipagem dos fixtures deste porte: os testes vieram da origem e constroem
   objetos PARCIAIS de proposito. `Frouxo` nomeia isso -- objeto de teste cuja
   forma quem valida e o motor, nao o compilador (os 84 asserts sao a validacao).
   Melhor que @ts-nocheck, proibido pelo eslint do painel, que desligaria a
   checagem do arquivo inteiro. */
type Frouxo = Record<string, any>;



/* planilha de exemplo (o mesmo arquivo usado no teste de tela) */
const cabecalho = ['Cliente', 'CNPJ', 'Unidade', 'Documento', 'Data de Vencimento', 'Tipo de Contrato', 'Nº Funcionários'];
const linhas = [
  ['Padaria Central', '11.111.111/0001-11', 'Teresópolis', 'PGR', new Date(2026, 8, 10), 'Mensal', 12],
  ['Padaria Central', '11.111.111/0001-11', 'Teresópolis', 'PCMSO', new Date(2026, 8, 25), 'Mensal', 12],   // mesmo cliente, mesmo mês → conta 1
  ['Padaria Central', '11.111.111/0001-11', 'Teresópolis', 'LTCAT', new Date(2026, 9, 5), 'Mensal', 12],    // outro mês → conta
  ['Metalúrgica Serra', '22.222.222/0001-22', 'Teresópolis', 'PGR', '15/09/2026', 'Exclusiva TST', 150],
  ['Hotel Vista', '33.333.333/0001-33', 'TERESOPOLIS', 'PGR', '2026-09-30', 'Mensal', 45],                 // unidade sem acento/maiúscula
  ['Oficina Norte', '44.444.444/0001-44', 'Campos dos Goytacazes', 'PGR', new Date(2026, 0, 20), 'Mensal', 8],
  ['Oficina Norte', '44.444.444/0001-44', 'Campos dos Goytacazes', 'PCMSO', new Date(2025, 11, 20), 'Mensal', 8], // outro ano → fora
  ['Sem Data Ltda', '55.555.555/0001-55', 'Guapimirim', 'PGR', '', 'Mensal', 3],                            // sem data → ignorada
  ['Cliente Filial X', '66.666.666/0001-66', 'Filial Nova', 'PGR', new Date(2026, 2, 1), 'Mensal', 30],     // unidade que não existe
];
const ws = XLSX.utils.aoa_to_sheet([['Relatório de vencimentos — SGG'], [], cabecalho, ...linhas], { cellDates: true });
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Vencimentos');
const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true });
const saida = new URL('../../.playwright-mcp/sgg-exemplo.xlsx', import.meta.url);
try { writeFileSync(saida, Buffer.from(buffer)); } catch (_) { /* opcional */ }

const unidades = [{ id: 'u-ter', nome: 'Teresópolis' }, { id: 'u-cam', nome: 'Campos dos Goytacazes' }, { id: 'u-gua', nome: 'Guapimirim' }];


test('lê a planilha pulando o título e acha o cabeçalho', () => {
  const { abas } = Imp.lerPlanilha(buffer);
  assert.strictEqual(abas.length, 1);
  assert.deepStrictEqual(abas[0].cabecalhos, cabecalho);
  assert.strictEqual(abas[0].linhas.length, linhas.length);
});

test('detecta as colunas pelos títulos', () => {
  const m = Imp.detectarColunas(cabecalho);
  assert.deepStrictEqual({ unidade: m.unidade, vencimento: m.vencimento, cliente: m.cliente, condicao: m.condicao, porte: m.porte }, { unidade: 2, vencimento: 4, cliente: 0, condicao: 5, porte: 6 });
});

test('datas: Date, dd/mm/aaaa, aaaa-mm-dd e serial do Excel', () => {
  assert.strictEqual(Imp.lerData('15/09/2026').getMonth(), 8);
  assert.strictEqual(Imp.lerData('2026-09-30').getDate(), 30);
  assert.strictEqual(Imp.lerData(46000).getFullYear(), 2025); // serial Excel (≈ dez/2025)
  assert.strictEqual(Imp.lerData(''), null);
  assert.strictEqual(Imp.lerData('abc'), null);
});

test('porte: P/M/G, nomes e faixa de funcionários', () => {
  assert.strictEqual(Imp.lerPorte('G'), 'G');
  assert.strictEqual(Imp.lerPorte('Médio'), 'M');
  assert.strictEqual(Imp.lerPorte(150, { pequeno: 19, medio: 99 }), 'G');
  assert.strictEqual(Imp.lerPorte(12, { pequeno: 19, medio: 99 }), 'P');
  assert.strictEqual(Imp.lerPorte(''), 'P');
});

test('conta cada cliente uma vez por unidade × mês, só no ano escolhido', () => {
  const { abas } = Imp.lerPlanilha(buffer);
  const r = Imp.resumir(abas[0].linhas, Imp.detectarColunas(cabecalho), { contarPor: 'cliente', ano: 2026, porteFaixas: { pequeno: 19, medio: 99 } });
  // Teresópolis set: Padaria (1, não 2) + Metalúrgica (exclusiva, G) + 'TERESOPOLIS' é outro nome no arquivo
  assert.deepStrictEqual(r.porUnidade['Teresópolis'][9], { mensal: { P: 1 }, exclusiva_tst: { G: 1 } });
  assert.deepStrictEqual(r.porUnidade['Teresópolis'][10], { mensal: { P: 1 } });
  assert.deepStrictEqual(r.porUnidade['TERESOPOLIS'][9], { mensal: { M: 1 } });
  assert.deepStrictEqual(r.porUnidade['Campos dos Goytacazes'], { 1: { mensal: { P: 1 } } });
  assert.strictEqual(r.porUnidade['Guapimirim'], undefined);
  assert.strictEqual(r.linhasUsadas, 6);
  assert.ok(r.avisos.some((a: any) => /sem data/.test(a)) && r.avisos.some((a: any) => /outros anos/.test(a)));
  assert.deepStrictEqual(r.anosEncontrados.map((a: any) => a.ano), [2025, 2026]);
  // por linha (documento): Padaria conta 2 em setembro
  const r2 = Imp.resumir(abas[0].linhas, Imp.detectarColunas(cabecalho), { contarPor: 'linha', ano: 2026 });
  assert.strictEqual(r2.porUnidade['Teresópolis'][9].mensal.P, 2);
});

test('casa nomes do arquivo com o cadastro (acento, maiúscula) e junta na mesma unidade', () => {
  const { abas } = Imp.lerPlanilha(buffer);
  const r = Imp.resumir(abas[0].linhas, Imp.detectarColunas(cabecalho), { ano: 2026, porteFaixas: { pequeno: 19, medio: 99 } });
  const mapa = Imp.casarUnidades(Object.keys(r.porUnidade), unidades);
  assert.strictEqual(mapa['Teresópolis'], 'u-ter');
  assert.strictEqual(mapa['TERESOPOLIS'], 'u-ter');
  assert.strictEqual(mapa['Filial Nova'], null);
  const rpc = Imp.montarLinhasRpc(r.porUnidade, mapa);
  const set = rpc.filter((l: any) => l.unidade_id === 'u-ter' && l.mes === 9);
  assert.deepStrictEqual(set.map((l: any) => `${l.condicao}/${l.porte}=${l.quantidade}`).sort(), ['exclusiva_tst/G=1', 'mensal/M=1', 'mensal/P=1']);
  assert.ok(!rpc.some((l: any) => l.unidade_id === null));
});

test('formato real do SGG (VENCIMENTO(s) DE PGR(s)): Região, Data Validade, Empresa, Código Empresa, Situação, Informações adicionais', () => {
  const cab = ['Código Empresa', 'Empresa', 'Região', 'Tipo Período', 'Data Emissão Anterior', 'Data Validade', 'Situação', 'Detalhes Adicionais', 'Informações adicionais da Empresa', ''];
  const rows = [
    ['1483', 'FONTE DA CONSTRUCAO', 'Teresópolis', 'PERIÓDICA', '23/05/2024', '07/02/2025', 'Vencido', '', 'Mensal desde 04/04/2022\n', ''],
    ['1499', 'FRADES IDIOMAS LTDA', 'Teresópolis', 'PERIÓDICA', '', '03/09/2025', 'Vencido', '', 'Mensal', ''],
    ['1501', 'FRADES IDIOMAS LTDA', 'Teresópolis', 'PERIÓDICA', '', '12/09/2025', 'Vencido', '', 'Mensal', ''],   // outro código = outro estabelecimento
    ['2000', 'HOTEL X', 'Teresópolis', 'PERIÓDICA', '', '20/09/2025', 'Renovado', '', 'Mensal', ''],              // renovado: fora por padrão
    ['2001', 'CLINICA Y', 'Teresópolis', 'PERIÓDICA', '', '25/09/2025', 'Vencido', '', 'Exclusiva TST', ''],
  ];
  const m = Imp.detectarColunas(cab);
  assert.deepStrictEqual({ u: cab[m.unidade], v: cab[m.vencimento], c: cab[m.cliente], id: cab[m.clienteId], cond: cab[m.condicao], sit: cab[m.situacao], porte: m.porte },
    { u: 'Região', v: 'Data Validade', c: 'Empresa', id: 'Código Empresa', cond: 'Informações adicionais da Empresa', sit: 'Situação', porte: null });
  assert.strictEqual(Imp.situacaoExcluida('Renovado'), true);
  assert.strictEqual(Imp.situacaoExcluida('Vencido'), false);
  const r = Imp.resumir(rows, m, { ano: 2025, situacoes: ['Vencido'] });
  assert.deepStrictEqual(r.porUnidade['Teresópolis'][9], { mensal: { P: 2 }, exclusiva_tst: { P: 1 } }); // Frades conta 2 (dois códigos)
  assert.deepStrictEqual(r.porUnidade['Teresópolis'][2], { mensal: { P: 1 } });
  assert.ok(r.avisos.some((a: any) => /não selecionada/.test(a)));
});

/* Relatório sem coluna de data (empresas sem avaliação de risco): mês de referência escolhido. */
test('planilha sem data: todas as linhas contam no mês de referência', () => {
  const cab = ['Código Empresa', 'Empresa', 'CNPJ/CPF', 'Região', 'Email', 'Telefone', 'Situação da Empresa'];
  const rows = [
    [585, 'A5 CONSULTORIA', '42.129.224/0001-48', 'Teresópolis', '', '', 'Ativa'],
    [588, 'ABDU NEME BUFFET', '25.080.168/0001-85', 'Teresópolis', '', '', 'Ativa'],
    [588, 'ABDU NEME BUFFET', '25.080.168/0001-85', 'Teresópolis', '', '', 'Ativa'], // repetido: conta uma vez
    [675, 'ATOS CONTABIL', '11.915.309/0001-28', 'Teresópolis', '', '', 'Inativa'],
  ];
  const m = Imp.detectarColunas(cab);
  assert.strictEqual(m.vencimento, null);
  assert.strictEqual(cab[m.unidade], 'Região');

  // sem data e sem mês de referência: nada entra e o aviso orienta
  const semMes = Imp.resumir(rows, m, { ano: 2026, condicaoFixa: 'sem_avaliacao' });
  assert.strictEqual(semMes.linhasUsadas, 0);
  assert.ok(semMes.avisos.some((a: any) => /mês de referência/.test(a)));

  // com mês de referência: tudo cai em setembro do ano escolhido, na condição escolhida
  const r = Imp.resumir(rows, m, { ano: 2026, condicaoFixa: 'sem_avaliacao', mesFixo: 9, situacoes: ['Ativa'] });
  assert.strictEqual(r.linhasUsadas, 2);
  assert.deepStrictEqual(r.porUnidade['Teresópolis'][9], { sem_avaliacao: { P: 2 } });
  assert.deepStrictEqual(r.anosEncontrados, []);
  assert.strictEqual(r.detalhes[0].ano, 2026);
  assert.strictEqual(r.detalhes[0].mes, 9);
});
