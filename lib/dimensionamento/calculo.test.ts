/* eslint-disable @typescript-eslint/no-explicit-any --
   Testes PORTADOS da origem: os fixtures sao parciais de proposito e quem valida a
   forma sao os 84 asserts, nao o compilador. */
/* ==========================================================================
   Testes do motor (Calculo) — sem dependências: `node tests/calculo.test.js`
   Cobrem: demanda por porte, ramp-up e presença (admissão/desligamento),
   custo por função, quadro ideal, pendente acumulado (fila) e simulação.
   ========================================================================== */


import { test } from "node:test";
import assert from "node:assert/strict";
import CalculoTipado from "./calculo";
/** Porta frouxa para os fixtures PARCIAIS deste porte. O app usa o motor TIPADO
    (calculo.d.ts); aqui quem valida a forma e o proprio motor, nao o compilador --
    e os 84 asserts sao a validacao. Um cast, no topo, visivel, em vez de afrouxar
    os tipos que protegem o codigo de producao. */
const Motor = CalculoTipado as unknown as Frouxo;

/* Tipagem dos fixtures deste porte.

   Os testes vieram da origem e constroem fixtures PARCIAIS de proposito
   (`tecnico({ dataAdmissao })` nao e um Colaborador inteiro, e nao deve ser).
   `Frouxo` nomeia exatamente isso: objeto de teste cuja forma quem valida e o
   motor, nao o compilador. E melhor que @ts-nocheck (proibido pelo eslint do
   painel, e que desligaria a checagem do arquivo INTEIRO) e melhor que fingir
   tipos completos em dados que sao parciais por desenho. */
type Frouxo = Record<string, any>;


const perto = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `esperava ${b}, veio ${a}`);

const DIAS = [21, 18, 22, 20, 20, 21, 23, 21, 21, 21, 19, 22];
const PARAM = { diasUteis: DIAS, ocupacaoAlvo: 85, rampup: [50, 80], pesosPorte: { P: 1, M: 1.5, G: 2 } };
const tecnico = (extra: Frouxo = {}): any => ({ id: extra.id || 'c1', nome: 'T', tipoProducao: 'tecnico', inspecoesDia: 2, relatoriosDia: 1, empresasDia: 0,
  alocacoes: [{ unidadeId: 'u', percentual: 100 }], ...extra });
const unidade = (meses: any): any => ({ id: 'u', nome: 'U', empresasVencidas: 0, empresasExclusivaTst: 0, meses });
const mesesConst = (mensal: number, demanda?: any): any => { const m: Frouxo = {}; for (let i = 1; i <= 12; i++) m[i] = { empresasVencidas: mensal, empresasExclusivaTst: 0, ...(demanda ? { demanda } : {}) }; return m; };
const rodar = (unidades: Frouxo[], colaboradores: Frouxo[], extra: Frouxo = {}): any => Motor.calcular({ unidades, colaboradores, parametros: PARAM, janela: { de: 0, ate: 11 }, ano: 2026, ...extra });


test('porte: 10 P + 4 M + 3 G = 10 + 6 + 6 = 22 empresas equivalentes', () => {
  const u = unidade(mesesConst(17, { mensal: { P: 10, M: 4, G: 3 } }));
  perto(Motor.empresasPonderadas(u, Motor.normalizarParametros(PARAM), 0), 22);
  // sem detalhe por porte, vale a contagem
  perto(Motor.empresasPonderadas(unidade(mesesConst(17)), Motor.normalizarParametros(PARAM), 0), 17);
  // porte desconhecido pesa 1
  perto(Motor.empresasPonderadas(unidade(mesesConst(0, { mensal: { X: 5 } })), Motor.normalizarParametros(PARAM), 0), 5);
});

test('produção sem ramp-up: 1 técnico veterano faz 1 × 21 × 0,85 = 17,85 relatórios em janeiro', () => {
  const r = rodar([unidade(mesesConst(10))], [tecnico()]);
  perto(r.total.meses[0].entregas.relatorios.consegue, 17.85, 1e-9);
  perto(r.total.meses[0].pessoas.tecnico, 1);
});

test('ramp-up: admitido em 1/mar produz 50% em março, 80% em abril, 100% de maio em diante', () => {
  const r = rodar([unidade(mesesConst(10))], [tecnico({ dataAdmissao: '2026-03-01' })]);
  const rel = (i: any) => r.total.meses[i].entregas.relatorios.consegue;
  perto(rel(0), 0);                      // ainda não entrou
  perto(rel(2), 22 * 0.85 * 0.5, 1e-9);  // março: 50%
  perto(rel(3), 20 * 0.85 * 0.8, 1e-9);  // abril: 80%
  perto(rel(4), 20 * 0.85, 1e-9);        // maio: 100%
  perto(r.total.meses[0].pessoas.tecnico, 0);
  perto(r.total.meses[2].pessoas.tecnico, 1); // conta como pessoa desde o 1º dia; só a produção é menor
  assert.strictEqual(r.total.meses[2].funcoes.tecnico.emRampup, 1);
  assert.strictEqual(r.total.meses[4].funcoes.tecnico.emRampup, 0);
});

test('presença: conta os DIAS ÚTEIS do período, não os dias corridos', () => {
  // jan/2026: 22 dias de semana; de 16 a 31/01 há 11 dias de semana → 11/22 = 0,5
  const r = rodar([unidade(mesesConst(10))], [tecnico({ dataAdmissao: '2026-01-16', dataDesligamento: '2026-06-10' })]);
  perto(Motor.presencaNoMes({ dataAdmissao: '2026-01-16' }, 2026, 0), 11 / 22, 1e-9);
  perto(r.total.meses[0].pessoas.tecnico, 11 / 22, 1e-9);
  // jun/2026: 22 dias de semana; de 1 a 10/06 há 8 dias de semana
  perto(Motor.presencaNoMes({ dataDesligamento: '2026-06-10' }, 2026, 5), 8 / 22, 1e-9);
  perto(r.total.meses[6].pessoas.tecnico, 0);
  perto(r.total.meses[6].entregas.relatorios.consegue, 0);
  // quem entra no último dia útil produz menos que quem entra na véspera
  const ultimo = Motor.presencaNoMes({ dataAdmissao: '2026-01-30' }, 2026, 0);
  const vespera = Motor.presencaNoMes({ dataAdmissao: '2026-01-29' }, 2026, 0);
  assert.ok(ultimo < vespera && ultimo > 0, 'admissão mais tarde produz menos');
  // sábado e domingo não acrescentam presença
  perto(Motor.presencaNoMes({ dataAdmissao: '2026-01-31' }, 2026, 0), 0, 1e-9);
});

test('quadro ideal e faltam/sobram continuam iguais (2 técnicos, 71 empresas em fevereiro → ideal 5, faltam 3)', () => {
  const r = rodar([unidade(mesesConst(71))], [tecnico({ id: 'a' }), tecnico({ id: 'b' })]);
  const f = r.total.meses[1].funcoes.tecnico;
  assert.strictEqual(f.ideal, 5);   // 71 ÷ (18 × 0,85 = 15,3) = 4,64 → 5
  assert.strictEqual(f.faltam, 3);  // (71 − 30,6) ÷ 15,3 = 2,64 → 3
});

test('custo: faltam 3 técnicos × R$ 4.000 = R$ 12.000 no mês; o custo do colaborador sobrepõe o da função', () => {
  const r = rodar([unidade(mesesConst(71))], [tecnico({ id: 'a', funcaoCustoMensal: 4000 }), tecnico({ id: 'b', funcaoCustoMensal: 4000, custoMensal: 6000 })]);
  const f = r.total.meses[1].funcoes.tecnico;
  perto(f.custo.pessoa, 5000);          // média ponderada: (4000 + 6000) / 2
  perto(f.custo.contratar, 3 * 5000);
  perto(f.custo.sobra, 0);
  // no ano: soma dos meses
  const ano = r.total.janela.funcoes.tecnico.custo;
  perto(ano.contratar, r.total.meses.reduce((s: any, m: any) => s + m.funcoes.tecnico.custo.contratar, 0));
  // sem custo cadastrado, tudo zero (não inventa número)
  const r0 = rodar([unidade(mesesConst(71))], [tecnico()]);
  perto(r0.total.meses[1].funcoes.tecnico.custo.contratar, 0);
});

test('custo da sobra: 3 técnicos para 10 empresas → sobram 2 × R$ 4.000', () => {
  const r = rodar([unidade(mesesConst(10))], ['a', 'b', 'c'].map(id => tecnico({ id, funcaoCustoMensal: 4000 })));
  const f = r.total.meses[0].funcoes.tecnico;
  assert.strictEqual(f.sobram, 2);
  perto(f.custo.sobra, 8000);
});

test('simulação: contratação simulada em setembro entra com ramp-up (50% em set, 80% em out, 100% em nov)', () => {
  const r = rodar([unidade(mesesConst(10))], [], { simulacoes: [{ unidadeId: 'u', grupo: 'tecnico', quantidade: 1, de: 8, ate: 11, inspecoesDia: 2, relatoriosDia: 1 }] });
  const rel = (i: any) => r.total.meses[i].entregas.relatorios.consegue;
  perto(rel(7), 0);
  perto(rel(8), 21 * 0.85 * 0.5, 1e-9);
  perto(rel(9), 21 * 0.85 * 0.8, 1e-9);
  perto(rel(10), 19 * 0.85, 1e-9);
  // desligamento simulado não tem ramp-up: −1 de 2 veteranos a partir de setembro tira uma pessoa inteira
  const r2 = rodar([unidade(mesesConst(10))], [tecnico({ id: 'a' }), tecnico({ id: 'b' })], { simulacoes: [{ unidadeId: 'u', grupo: 'tecnico', quantidade: -1, de: 8, ate: 11 }] });
  perto(r2.total.meses[8].pessoas.tecnico, 1);
});

test('pendente acumulado (fila): passado soma sem descontar; do mês atual em diante a equipe atende', () => {
  const vencem = [25, 30, 20, 22, 10, 5, 0, 0, 0, 0, 0, 0];
  const meses: Frouxo = {}; vencem.forEach((v, i) => { meses[i + 1] = { empresasVencidas: v, empresasExclusivaTst: 0 }; });
  const r = Motor.calcular({ unidades: [unidade(meses)], colaboradores: [tecnico()], parametros: { diasUteis: Array(12).fill(20), ocupacaoAlvo: 85 }, janela: { de: 0, ate: 11 }, ano: 2026 });
  const g = Motor.fila(r, { mesAtual: 4, prazoMeses: 2 }).total.grupos.tecnico;
  assert.deepStrictEqual(g.meses.slice(0, 4).map((m: any) => m.filaFim), [25, 55, 75, 97]);
  assert.deepStrictEqual(g.meses.slice(4, 8).map((m: any) => m.filaFim), [90, 78, 61, 44]);
  assert.strictEqual(g.resumo.filaHoje, 107);
  assert.strictEqual(g.resumo.deMesesAnteriores, 97);
});

test('porte muda o pendente: 10 empresas G pesam como 20 na fila', () => {
  const meses: Frouxo = {}; for (let i = 1; i <= 12; i++) meses[i] = { empresasVencidas: 10, empresasExclusivaTst: 0, demanda: { mensal: { G: 10 } } };
  const r = rodar([unidade(meses)], [tecnico()]);
  perto(r.total.meses[0].precisa, 20);
  const g = Motor.fila(r, { mesAtual: 0, prazoMeses: 2 }).total.grupos.tecnico;
  perto(g.meses[0].pendentes, 20);
});

test('ano anterior: mesAtual = 12 deixa tudo em aberto; filaInicial entra em janeiro do ano seguinte', () => {
  const meses: Frouxo = {}; [25, 30, 20, 22, 10, 5, 0, 0, 0, 0, 0, 0].forEach((v, i) => { meses[i + 1] = { empresasVencidas: v, empresasExclusivaTst: 0 }; });
  const r = Motor.calcular({ unidades: [unidade(meses)], colaboradores: [tecnico()], parametros: { diasUteis: Array(12).fill(20), ocupacaoAlvo: 85 }, janela: { de: 0, ate: 11 }, ano: 2025 });
  const passado = Motor.fila(r, { mesAtual: 12 }).total.grupos.tecnico;
  assert.strictEqual(passado.meses[11].filaFim, 112);             // nada é atendido: soma de tudo
  assert.strictEqual(passado.meses.every((m: any) => m.atendidas === 0), true);
  const seguinte = Motor.fila(r, { mesAtual: 4, filaInicial: { u: { tecnico: 112, administrativo: 0 } } });
  assert.strictEqual(seguinte.total.grupos.tecnico.meses[0].filaInicio, 112);
  assert.strictEqual(seguinte.total.grupos.tecnico.meses[0].pendentes, 112 + 25);
  assert.deepStrictEqual(seguinte.filaInicial, { tecnico: 112, administrativo: 0 });
  assert.strictEqual(seguinte.total.grupos.tecnico.resumo.deMesesAnteriores, 112 + 25 + 30 + 20 + 22);
});

/* ---------- evolução (controle histórico mês a mês) ---------- */

test('evolução: sem atendidas informadas, a fila acumula e o quadro necessário aparece nas duas leituras', () => {
  // 40 clientes/mês, um técnico (2 inspeções e 1 relatório por dia → o relatório é o gargalo)
  const r = rodar([unidade(mesesConst(40))], [tecnico()]);
  const e = Motor.evolucao(r, { mesAtual: 12, prazoMeses: 2, parametros: PARAM }).total.areas.tecnico;
  const jan = e.meses[0];
  perto(jan.entram, 40);
  perto(jan.capacidade, 1 * 1 * 21 * 0.85);                 // 1 relatório/dia × 21 dias × 85%
  assert.strictEqual(jan.atendidas, 0);                      // mês passado sem informação: nada é descontado
  perto(jan.filaFim, 40);
  assert.strictEqual(jan.necessarioVazao, 3);                // 40 ÷ 17,85 por pessoa
  assert.strictEqual(jan.faltamVazao, 2);                    // já existe 1 pessoa
  assert.strictEqual(jan.status, 'deficit');
  const fev = e.meses[1];
  perto(fev.filaInicio, 40);                                 // a fila de janeiro entra em fevereiro
  assert.ok(fev.necessarioRecuperacao > fev.necessarioVazao); // recuperação inclui a fila
  perto(e.meses[11].filaFim, 40 * 12);
  assert.ok(e.resumo.admissoesTotal > 0);
  assert.ok(e.resumo.filaDezembroCenario < e.resumo.filaDezembro); // contratando, a fila termina menor
});

test('evolução: atendidas informadas mandam na fila (e valem para meses passados e futuros)', () => {
  const r = rodar([unidade(mesesConst(40))], [tecnico()]);
  const informadas = { u: { 1: 40, 2: 10 } };                 // janeiro zerado, fevereiro parcial
  const e = Motor.evolucao(r, { mesAtual: 12, prazoMeses: 2, atendidas: informadas, parametros: PARAM }).unidades[0].areas.tecnico;
  perto(e.meses[0].atendidas, 40);
  perto(e.meses[0].filaFim, 0);
  assert.strictEqual(e.meses[0].informado, true);
  perto(e.meses[1].filaInicio, 0);
  perto(e.meses[1].atendidas, 10);
  perto(e.meses[1].filaFim, 30);
  assert.strictEqual(e.meses[2].informado, false);            // sem informação: mês passado não desconta
  perto(e.meses[2].filaFim, 30 + 40);
  assert.strictEqual(e.resumo.mesesInformados, 2);
});

test('evolução: alterar um mês só afeta dali para a frente', () => {
  const base = mesesConst(40);
  const antes = Motor.evolucao(rodar([unidade(base)], [tecnico()]), { mesAtual: 12, parametros: PARAM }).total.areas.tecnico;
  const mudado = { ...base, 6: { empresasVencidas: 10, empresasExclusivaTst: 0 } }; // junho: 40 → 10
  const depois = Motor.evolucao(rodar([unidade(mudado)], [tecnico()]), { mesAtual: 12, parametros: PARAM }).total.areas.tecnico;
  for (let i = 0; i < 5; i++) perto(depois.meses[i].filaFim, antes.meses[i].filaFim);   // janeiro a maio: idênticos
  perto(depois.meses[5].filaFim, antes.meses[5].filaFim - 30);                          // junho e os seguintes: -30
  perto(depois.meses[11].filaFim, antes.meses[11].filaFim - 30);
});

test('evolução: o peso do porte converte as atendidas informadas em demanda equivalente', () => {
  const meses: Frouxo = {}; for (let i = 1; i <= 12; i++) meses[i] = { demanda: { mensal: { G: 10 } } }; // 10 grandes = 20 equivalentes
  const r = rodar([unidade(meses)], [tecnico()]);
  const e = Motor.evolucao(r, { mesAtual: 12, atendidas: { u: { 1: 5 } }, parametros: PARAM }).unidades[0].areas.tecnico;
  perto(e.meses[0].clientes, 10);
  perto(e.meses[0].entram, 20);
  perto(e.meses[0].pesoMedio, 2);
  perto(e.meses[0].atendidas, 10);   // 5 clientes grandes = 10 de demanda equivalente
  perto(e.meses[0].filaFim, 10);
});
