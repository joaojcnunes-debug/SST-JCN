/* eslint-disable @typescript-eslint/no-explicit-any --
   Testes PORTADOS da origem: os fixtures sao parciais de proposito e quem valida a
   forma sao os 84 asserts, nao o compilador. */
/* ==========================================================================
   Testes do dimensionamento — núcleo `Motor.fluxo`: UEP, capacidade, cadeia,
   backlog por coorte, idade, QLP (operacional / recuperação / estrutural), custo,
   invariantes e casos extremos.

   node tests/dimensionamento.test.js
   ========================================================================== */

import { test } from "node:test";
import assert from "node:assert/strict";
import CalculoTipado from "./calculo";

/* Tipagem dos fixtures deste porte: os testes vieram da origem e constroem
   objetos PARCIAIS de proposito. `Frouxo` nomeia isso -- objeto de teste cuja
   forma quem valida e o motor, nao o compilador (os 84 asserts sao a validacao).
   Melhor que @ts-nocheck, proibido pelo eslint do painel, que desligaria a
   checagem do arquivo inteiro. */
type Frouxo = Record<string, any>;

/** Porta frouxa para os fixtures PARCIAIS deste porte. O app usa o motor TIPADO
    (calculo.d.ts); aqui quem valida a forma e o proprio motor, nao o compilador --
    e os 84 asserts sao a validacao. Um cast, no topo, visivel, em vez de afrouxar
    os tipos que protegem o codigo de producao. */
const Motor = CalculoTipado as unknown as Frouxo;
const perto = (a: any, b: any, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `esperava ${b}, veio ${a}`);
const TEC = Motor.TEC, ADM = Motor.ADM;

/* ---------- apoio ---------- */
const DIAS = Array(12).fill(20);
const PARAM = { diasUteis: DIAS, ocupacaoAlvo: 85, rampup: [50, 80], pesosPorte: { P: 1, M: 1.5, G: 2 } };
let seq = 0;
const tecnico = (extra = {}) => ({ id: 't' + (++seq), nome: 'Téc ' + seq, tipoProducao: TEC, inspecoesDia: 2, relatoriosDia: 1, empresasDia: 0, alocacoes: [{ unidadeId: 'u', percentual: 100 }], ...extra });
const administrativo = (extra = {}) => ({ id: 'a' + (++seq), nome: 'Adm ' + seq, tipoProducao: ADM, inspecoesDia: 0, relatoriosDia: 0, empresasDia: 1, alocacoes: [{ unidadeId: 'u', percentual: 100 }], ...extra });
const equipe = (nTec: any, nAdm: any, extraTec = {}, extraAdm = {}) => [
  ...Array.from({ length: nTec }, () => tecnico(extraTec)),
  ...Array.from({ length: nAdm }, () => administrativo(extraAdm)),
];
/** Meses com a mesma demanda: `porte` aceita número (P) ou objeto { P, M, G }. */
const mesesConst = (q: any) => {
  const porPorte = typeof q === 'object' ? q : { P: q };
  const m: any = {};
  for (let i = 1; i <= 12; i++) m[i] = { demanda: { mensal: { ...porPorte } } };
  return m;
};
const unidade = (meses: any, id = 'u', nome = 'U') => ({ id, nome, meses });
const calc = (unidades: any, colaboradores: any, p = PARAM, ano = 2026) =>
  Motor.calcular({ unidades, colaboradores, parametros: p, janela: { de: 0, ate: 11 }, ano });
const fluxo = (unidades: any, colaboradores: any, opcoes = {}, p = PARAM, ano = 2026) =>
  Motor.fluxo(calc(unidades, colaboradores, p, ano), { prazoMeses: 2, parametros: p, ano, ...opcoes });


test('UEP: 10 P + 10 M + 10 G com pesos 1 / 1,5 / 2 = 45 UEP, e 30 clientes', () => {
  const f = fluxo([unidade(mesesConst({ P: 10, M: 10, G: 10 }))], equipe(1, 1));
  const m = f.total.meses[0];
  perto(m.demanda, 45);
  perto(m.clientes, 30);
  perto(m.pesoMedio, 1.5);
});

test('UEP: os pesos são parâmetro — mudar o peso de G muda a demanda, não a contagem', () => {
  const p = { ...PARAM, pesosPorte: { P: 1, M: 2, G: 5 } };
  const f = fluxo([unidade(mesesConst({ P: 10, G: 10 }))], equipe(1, 1), {}, p);
  perto(f.total.meses[0].demanda, 10 * 1 + 10 * 5);
  perto(f.total.meses[0].clientes, 20);
});

test('UEP: porte desconhecido vale 1 e quantidade negativa não entra', () => {
  const meses: any = { 1: { demanda: { mensal: { ZZZ: 4, P: -9 } } } };
  for (let i = 2; i <= 12; i++) meses[i] = { demanda: { mensal: { P: 0 } } };
  const f = fluxo([unidade(meses)], equipe(1, 1));
  perto(f.total.meses[0].demanda, 4);
});

test('UEP: atendimento informado por porte é exato (sem peso médio)', () => {
  const f = fluxo([unidade(mesesConst({ P: 10, G: 10 }))], equipe(1, 1), { mesAtual: 12, atendidas: { u: { 1: { G: 5 } } } });
  const m = f.total.meses[0];
  perto(m.demanda, 30);
  perto(m.informadasUep, 10);       // 5 grandes = 10 UEP
  assert.strictEqual(m.informadasExatas, true);
  perto(m.concluido, 10);
  perto(m.backlog, 20);
});

test('UEP: atendimento informado como número único usa o peso médio e se declara aproximado', () => {
  const f = fluxo([unidade(mesesConst({ P: 10, G: 10 }))], equipe(1, 1), { mesAtual: 12, atendidas: { u: { 1: 10 } } });
  const m = f.total.meses[0];
  perto(m.informadasUep, 15);       // 10 × peso médio 1,5
  assert.strictEqual(m.informadasExatas, false);
});


test('capacidade: produção diária × dias úteis × margem', () => {
  const f = fluxo([unidade(mesesConst(0))], [tecnico()]);
  const e = f.total.meses[0].etapas;
  perto(e.inspecoes.capacidadeNominal, 2 * 20);
  perto(e.inspecoes.capacidade, 2 * 20 * 0.85);
  perto(e.relatorios.capacidade, 1 * 20 * 0.85);
});

test('capacidade: margem 0% entrega o nominal; margem 100% zera', () => {
  const semMargem = fluxo([unidade(mesesConst(0))], [tecnico()], {}, { ...PARAM, ocupacaoAlvo: 100 });
  perto(semMargem.total.meses[0].etapas.relatorios.capacidade, 20);
  const tudoMargem = fluxo([unidade(mesesConst(0))], [tecnico()], {}, { ...PARAM, ocupacaoAlvo: 0 });
  perto(tudoMargem.total.meses[0].etapas.relatorios.capacidade, 0);
});

test('capacidade: alocação 50/50 divide a pessoa entre as unidades e conserva o total', () => {
  const c = tecnico({ alocacoes: [{ unidadeId: 'a', percentual: 50 }, { unidadeId: 'b', percentual: 50 }] });
  const f = fluxo([unidade(mesesConst(10), 'a', 'A'), unidade(mesesConst(10), 'b', 'B')], [c]);
  const ca = f.unidades[0].meses[0].etapas.relatorios.capacidade;
  const cb = f.unidades[1].meses[0].etapas.relatorios.capacidade;
  perto(ca, cb);
  perto(ca + cb, f.total.meses[0].etapas.relatorios.capacidade);
});

test('capacidade: adaptação reduz os primeiros meses (50% → 80% → 100%)', () => {
  const f = fluxo([unidade(mesesConst(0))], [tecnico({ dataAdmissao: '2026-03-01' })]);
  const cap = (i: any) => f.total.meses[i].etapas.relatorios.capacidade;
  perto(cap(1), 0);
  perto(cap(2), 1 * 20 * 0.85 * 0.5);
  perto(cap(3), 1 * 20 * 0.85 * 0.8);
  perto(cap(4), 1 * 20 * 0.85);
});

test('capacidade: adaptação 0% zera a produção do período de adaptação', () => {
  const f = fluxo([unidade(mesesConst(0))], [tecnico({ dataAdmissao: '2026-03-01' })], {}, { ...PARAM, rampup: [0, 0] });
  perto(f.total.meses[2].etapas.relatorios.capacidade, 0);
  perto(f.total.meses[4].etapas.relatorios.capacidade, 1 * 20 * 0.85);
});

test('capacidade: admissão e desligamento no meio do mês contam os dias úteis do período', () => {
  perto(Motor.presencaNoMes({ dataAdmissao: '2026-01-16' }, 2026, 0), 11 / 22, 1e-9);   // 11 dias de semana de 16 a 31/01
  perto(Motor.presencaNoMes({ dataAdmissao: '2026-01-31' }, 2026, 0), 0, 1e-9);          // sábado: nenhum dia útil
  perto(Motor.presencaNoMes({ dataDesligamento: '2026-06-01' }, 2026, 5), 1 / 22, 1e-9); // 1/06 é segunda
  const cedo = Motor.presencaNoMes({ dataAdmissao: '2026-04-01' }, 2026, 3);
  const tarde = Motor.presencaNoMes({ dataAdmissao: '2026-04-20' }, 2026, 3);
  assert.ok(cedo > tarde, 'quem entra antes tem mais presença');
});


test('cadeia: a etapa seguinte só recebe o que a anterior concluiu', () => {
  // técnicos limitados (1 relatório/dia = 17 UEP), administrativo folgado (10/dia = 170 UEP)
  const f = fluxo([unidade(mesesConst(100))], [tecnico(), administrativo({ empresasDia: 10 })], { mesAtual: 0 });
  const e = f.total.meses[0].etapas;
  perto(e.inspecoes.concluido, Math.min(100, 2 * 20 * 0.85));
  perto(e.relatorios.entrada, e.inspecoes.concluido);
  perto(e.relatorios.concluido, Math.min(e.relatorios.entrada, 1 * 20 * 0.85));
  perto(e.empresas.entrada, e.relatorios.concluido);
  perto(f.total.meses[0].concluido, e.empresas.concluido);
  assert.ok(e.empresas.concluido <= e.relatorios.concluido + 1e-9, 'a finalização não pode superar os relatórios');
});

test('cadeia: o gargalo é identificado e a etapa a jusante aparece como ociosa', () => {
  const f = fluxo([unidade(mesesConst(100))], [tecnico(), administrativo({ empresasDia: 10 })], { mesAtual: 0 });
  const m = f.total.meses[0];
  assert.strictEqual(m.gargalo, 'inspecoes');           // a fila maior fica na primeira etapa
  assert.ok(m.etapas.empresas.ocioso > 0, 'sobra capacidade administrativa sem trabalho disponível');
  assert.ok(m.etapas.inspecoes.saturada, 'a inspeção está saturada');
});

test('cadeia: o backlog é a soma das filas das etapas (cada UEP está em uma delas)', () => {
  const f = fluxo([unidade(mesesConst(100))], [tecnico(), administrativo()], { mesAtual: 0 });
  const m = f.total.meses[0];
  const soma = m.etapas.inspecoes.filaFim + m.etapas.relatorios.filaFim + m.etapas.empresas.filaFim;
  perto(m.backlog, soma);
  perto(m.backlog, m.demanda - m.concluido);            // o que entrou e não saiu
});


test('backlog: fila final = fila inicial + demanda − atendidas, na mesma unidade (UEP)', () => {
  const f = fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 12, atendidas: { u: { 1: { P: 10 } } } });
  const m = f.total.meses[0];
  perto(m.backlogInicio, 0);
  perto(m.demanda, 40);
  perto(m.concluido, 10);
  perto(m.backlog, 30);
  perto(f.total.meses[1].backlogInicio, 30);
});

test('backlog: meses passados sem informação acumulam tudo; do mês atual em diante a equipe atende', () => {
  const f = fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 6 });
  for (let i = 0; i < 6; i++) perto(f.total.meses[i].concluido, 0);
  assert.ok(f.total.meses[6].concluido > 0, 'o mês atual desconta a produção da equipe');
});

test('coortes: o consumo é FIFO (o mais antigo primeiro) e a idade sai em faixas de 30 dias', () => {
  const f = fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 12 });
  const dez = f.total.meses[11];
  perto(dez.backlog, 40 * 12);
  perto(dez.idade.faixas.ate30, 40);                    // o que venceu em dezembro
  perto(dez.idade.faixas.ate60, 40);                    // novembro
  perto(dez.idade.faixas.mais120, 40 * 8);              // janeiro a agosto
  assert.strictEqual(dez.idade.maisAntigaMeses, 11);
  // com atendimento, o mais antigo sai primeiro
  const g = fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 12, atendidas: { u: { 3: { P: 40 } } } });
  const abril = g.total.meses[3];
  assert.ok(abril.coortes.every((c: any) => c.mes >= 1), 'janeiro foi consumido primeiro');
});

test('coortes: a virada de ano preserva a idade do backlog', () => {
  const f25 = fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 12 }, PARAM, 2025);
  const inicial = { u: f25.unidades[0].resumo.filaFinal };
  const f26 = fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 0, filaInicial: inicial }, PARAM, 2026);
  const jan = f26.total.meses[0];
  perto(jan.backlogInicio, 40 * 12);
  assert.ok(jan.idade.faixas.mais120 > 0, 'o backlog de 2025 aparece como mais antigo em 2026');
  const coortes2025 = jan.coortes.filter((c: any) => c.ano === 2025);
  assert.ok(coortes2025.length > 0, 'as coortes de 2025 continuam identificadas');
});

test('backlog: nunca fica negativo, mesmo com capacidade muito acima da demanda', () => {
  const f = fluxo([unidade(mesesConst(1))], equipe(20, 20), { mesAtual: 0 });
  f.total.meses.forEach((m: any) => {
    assert.ok(m.backlog >= 0, 'backlog não negativo');
    Object.values(m.etapas).forEach(e => assert.ok((e as any).filaFim >= 0 && (e as any).concluido >= 0, 'etapas não negativas'));
  });
});


test('QLP operacional: cada etapa é dimensionada contra a demanda do mês (o gargalo não esconde a jusante)', () => {
  const f = fluxo([unidade(mesesConst(40))], [tecnico(), administrativo()], { mesAtual: 0 });
  const e = f.total.meses[0].etapas;
  assert.strictEqual(e.inspecoes.qlpOperacional, Math.ceil(40 / (2 * 20 * 0.85)));    // 2
  assert.strictEqual(e.relatorios.qlpOperacional, Math.ceil(40 / (1 * 20 * 0.85)));   // 3
  assert.strictEqual(e.empresas.qlpOperacional, Math.ceil(40 / (1 * 20 * 0.85)));     // 3
  assert.strictEqual(f.total.meses[0].areas[TEC].qlpOperacional, 3);                  // a pessoa cobre as duas etapas
});

test('QLP de recuperação: inclui a fila que ainda vai passar por cada etapa', () => {
  const f = fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 1, prazoMeses: 2 });
  const fev = f.total.meses[1];
  assert.ok(fev.etapas.inspecoes.filaAcumulada > 0, 'há fila vinda de janeiro');
  assert.ok(fev.areas[TEC].qlpRecuperacao > fev.areas[TEC].qlpOperacional, 'recuperação exige mais que a vazão');
  // a etapa administrativa também precisa dar conta do que está parado antes dela
  assert.ok(fev.etapas.empresas.filaAcumulada >= fev.etapas.inspecoes.filaInicio, 'a fila a montante passa pela finalização');
});

test('QLP estrutural: dimensiona a demanda média do ano, separado do pico e da recuperação', () => {
  const meses: any = {};
  for (let i = 1; i <= 12; i++) meses[i] = { demanda: { mensal: { P: i === 7 ? 200 : 20 } } }; // um pico em julho
  const f = fluxo([unidade(meses)], equipe(1, 1), { mesAtual: 0 });
  const e = f.total.resumo.estrutural[TEC];
  const media = f.total.resumo.mediaDemanda;
  perto(media, (20 * 11 + 200) / 12);
  assert.strictEqual(e.qlp, Math.ceil(media / (1 * 20 * 0.85)));
  assert.ok(e.pico >= e.qlp, 'o pico exige pelo menos o estrutural');
  assert.ok(e.recuperacao >= e.qlp, 'recuperação nunca é menor que o estrutural');
  assert.ok(e.temporarios === Math.max(0, e.recuperacao - e.qlp), 'temporários = recuperação − estrutural');
});

test('QLP: arredondamento sempre para cima e sempre suficiente', () => {
  [1, 7, 13, 41, 97, 333].forEach(q => {
    const f = fluxo([unidade(mesesConst(q))], equipe(1, 1), { mesAtual: 0 });
    const e = f.total.meses[0].etapas.relatorios;
    assert.ok(e.qlpOperacional * e.producaoPessoa + 1e-9 >= f.total.meses[0].demanda, `QLP cobre a demanda (${q})`);
    assert.strictEqual(e.qlpOperacional, Math.ceil(f.total.meses[0].demanda / e.producaoPessoa - 1e-9));
  });
});


test('custo: atual, estrutural, recuperação e incremental são separados', () => {
  const custo = { custoMensal: 5000 };
  const f = fluxo([unidade(mesesConst(100))], equipe(2, 2, custo, custo), { mesAtual: 0 });
  const e = f.total.resumo.estrutural[TEC];
  perto(e.custoPessoa, 5000);
  perto(e.custoAtual, 2 * 5000);
  perto(e.custoEstrutural, e.qlp * 5000);
  perto(e.custoRecuperacao, Math.max(0, e.recuperacao - e.qlp) * 5000);
  perto(e.custoIncremental, Math.max(0, e.recuperacao - e.quadroAtual) * 5000);
  assert.ok(e.custoEstrutural >= e.custoAtual, 'falta quadro estrutural neste cenário');
});

test('custo: sem custo cadastrado, tudo zero (sem inventar valores)', () => {
  const f = fluxo([unidade(mesesConst(100))], equipe(1, 1), { mesAtual: 0 });
  const e = f.total.resumo.estrutural[ADM];
  perto(e.custoPessoa, 0);
  perto(e.custoEstrutural, 0);
  perto(e.custoIncremental, 0);
});


test('700 clientes vencidos, 4 técnicos (2 visitas e 1 relatório/dia) e 4 administrativos (1/dia)', () => {
  // toda a carteira venceu em janeiro; o ano segue sem novas entradas
  const meses: any = { 1: { demanda: { mensal: { P: 700 } } } };
  for (let i = 2; i <= 12; i++) meses[i] = { demanda: { mensal: { P: 0 } } };
  const f = fluxo([unidade(meses)], equipe(4, 4), { mesAtual: 0, prazoMeses: 2 });
  const jan = f.total.meses[0];
  perto(jan.demanda, 700);
  perto(jan.etapas.inspecoes.capacidade, 4 * 2 * 20 * 0.85);   // 136 UEP
  perto(jan.etapas.relatorios.capacidade, 4 * 1 * 20 * 0.85);  // 68 UEP
  perto(jan.etapas.empresas.capacidade, 4 * 1 * 20 * 0.85);    // 68 UEP
  perto(jan.concluido, 68);                                    // a cadeia entrega o gargalo
  perto(jan.backlog, 700 - 68);
  assert.strictEqual(jan.gargalo, 'inspecoes');                // a fila fica na entrada da cadeia
  // sem novas entradas, a fila é consumida mês a mês e o mês em que zera é informado
  assert.ok(f.total.resumo.zeraEm !== null, 'o sistema informa quando a fila zera');
  assert.ok(f.total.resumo.zeraEm >= 9, `com 68 UEP/mês, 700 UEP levam ~10 meses (veio ${f.total.resumo.zeraEm + 1})`);
  // QLP: a recuperação em 2 meses exige muito mais gente do que a operação recorrente
  const rec = f.total.meses[0].areas[TEC].qlpRecuperacao;
  const op = f.total.meses[0].areas[TEC].qlpOperacional;
  assert.ok(rec >= op, 'recuperação ≥ operacional');
});


test('invariante: aumentar a demanda nunca reduz o QLP necessário', () => {
  let anterior = -1;
  [0, 10, 25, 50, 100, 400].forEach(q => {
    const f = fluxo([unidade(mesesConst(q))], equipe(2, 2), { mesAtual: 0 });
    const qlp = f.total.meses[0].areas[TEC].qlpOperacional;
    assert.ok(qlp >= anterior, `QLP não pode cair (${q})`);
    anterior = qlp;
  });
});

test('invariante: contratar nunca reduz capacidade nem aumenta o backlog', () => {
  let capAnterior = -1, backlogAnterior = Infinity;
  [1, 2, 4, 8].forEach(n => {
    const f = fluxo([unidade(mesesConst(40))], equipe(n, n), { mesAtual: 0 });
    const cap = f.total.meses[0].etapas.relatorios.capacidade;
    const backlog = f.total.meses[11].backlog;
    assert.ok(cap >= capAnterior, 'capacidade não cai ao contratar');
    assert.ok(backlog <= backlogAnterior + 1e-9, 'backlog não cresce ao contratar');
    capAnterior = cap; backlogAnterior = backlog;
  });
});

test('invariante: reduzir capacidade não reduz o backlog', () => {
  const muitos = fluxo([unidade(mesesConst(40))], equipe(4, 4), { mesAtual: 0 }).total.meses[11].backlog;
  const poucos = fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 0 }).total.meses[11].backlog;
  assert.ok(poucos >= muitos, 'menos gente, mais (ou igual) backlog');
});

test('invariante: nenhum indicador fica negativo em nenhum mês', () => {
  const f = fluxo([unidade(mesesConst({ P: 30, M: 10, G: 5 }))], equipe(2, 3), { mesAtual: 5 });
  f.total.meses.forEach((m: any) => {
    assert.ok(m.demanda >= 0 && m.backlog >= 0 && m.concluido >= 0, 'mês sem negativos');
    Object.values(m.etapas).forEach(e => {
      assert.ok((e as any).capacidade >= 0 && (e as any).filaFim >= 0 && (e as any).ocioso >= 0, 'etapa sem negativos');
      assert.ok((e as any).qlpOperacional >= 0 && (e as any).qlpRecuperacao >= 0, 'QLP sem negativos');
    });
    Motor.FUNCOES.forEach((f2: any) => assert.ok(m.areas[f2].quadro >= 0, 'quadro sem negativos'));
  });
});

test('invariante: alterar um mês não muda os meses anteriores', () => {
  const base = mesesConst(40);
  const antes = fluxo([unidade(base)], equipe(1, 1), { mesAtual: 12 }).total.meses.map((m: any) => m.backlog);
  const mudado = { ...base, 7: { demanda: { mensal: { P: 5 } } } };
  const depois = fluxo([unidade(mudado)], equipe(1, 1), { mesAtual: 12 }).total.meses.map((m: any) => m.backlog);
  for (let i = 0; i < 6; i++) perto(depois[i], antes[i]);
  assert.ok(depois[6] < antes[6] && depois[11] < antes[11], 'muda do mês alterado em diante');
});

test('invariante: a fila de uma unidade não é atendida pela equipe de outra', () => {
  const comEquipe = unidade(mesesConst(0), 'a', 'A');
  const semEquipe = unidade(mesesConst(40), 'b', 'B');
  const c = tecnico({ alocacoes: [{ unidadeId: 'a', percentual: 100 }] });
  const adm = administrativo({ alocacoes: [{ unidadeId: 'a', percentual: 100 }] });
  const f = fluxo([comEquipe, semEquipe], [c, adm], { mesAtual: 0 });
  perto(f.unidades[0].meses[0].backlog, 0);
  perto(f.unidades[1].meses[0].backlog, 40);   // sem equipe, nada é atendido
});


const extremos = [
  ['sem colaboradores', () => fluxo([unidade(mesesConst(40))], [], { mesAtual: 0 })],
  ['sem demanda', () => fluxo([unidade(mesesConst(0))], equipe(2, 2), { mesAtual: 0 })],
  ['demanda muito acima da capacidade', () => fluxo([unidade(mesesConst(10000))], equipe(1, 1), { mesAtual: 0 })],
  ['capacidade muito acima da demanda', () => fluxo([unidade(mesesConst(1))], equipe(30, 30), { mesAtual: 0 })],
  ['unidade sem equipe', () => fluxo([unidade(mesesConst(40), 'z', 'Z')], equipe(1, 1), { mesAtual: 0 })],
  ['equipe sem unidade', () => fluxo([unidade(mesesConst(40))], [tecnico({ alocacoes: [] })], { mesAtual: 0 })],
  ['só clientes grandes', () => fluxo([unidade(mesesConst({ G: 50 }))], equipe(2, 2), { mesAtual: 0 })],
  ['dias úteis zero', () => fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 0 }, { ...PARAM, diasUteis: Array(12).fill(0) })],
  ['margem 100%', () => fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 0 }, { ...PARAM, ocupacaoAlvo: 0 })],
  ['contratação em massa', () => fluxo([unidade(mesesConst(40))], equipe(50, 50), { mesAtual: 0 })],
  ['admitido no último dia do mês', () => fluxo([unidade(mesesConst(40))], [tecnico({ dataAdmissao: '2026-01-30' }), administrativo()], { mesAtual: 0 })],
  ['desligado no primeiro dia', () => fluxo([unidade(mesesConst(40))], [tecnico({ dataDesligamento: '2026-01-01' }), administrativo()], { mesAtual: 0 })],
  ['atendimento maior que a fila', () => fluxo([unidade(mesesConst(10))], equipe(1, 1), { mesAtual: 12, atendidas: { u: { 1: { P: 999 } } } })],
  ['três unidades, alocação parcial', () => {
    const c = tecnico({ alocacoes: [{ unidadeId: 'a', percentual: 40 }, { unidadeId: 'b', percentual: 30 }, { unidadeId: 'c', percentual: 30 }] });
    return fluxo([unidade(mesesConst(10), 'a', 'A'), unidade(mesesConst(10), 'b', 'B'), unidade(mesesConst(10), 'c', 'C')], [c, administrativo()], { mesAtual: 0 });
  }],
];

test('casos extremos: nenhum quebra e nenhum produz valor inválido', () => {
  extremos.forEach(([nome, fn]: any[]) => {
    const f = fn();
    [...f.unidades, f.total].forEach(item => {
      item.meses.forEach((m: any) => {
        const numeros = [m.demanda, m.backlog, m.concluido, m.clientes];
        numeros.forEach(v => assert.ok(Number.isFinite(v) && v >= 0, `${nome}: valor inválido (${v})`));
        Object.values(m.etapas).forEach(e => {
          [(e as any).capacidade, (e as any).filaFim, (e as any).concluido, (e as any).qlpOperacional, (e as any).qlpRecuperacao].forEach(v => {
            assert.ok(Number.isFinite(v) && v >= 0, `${nome}: etapa com valor inválido (${v})`);
          });
        });
      });
    });
  });
});

test('caso extremo: atendimento informado nunca deixa a fila negativa', () => {
  const f = fluxo([unidade(mesesConst(10))], equipe(1, 1), { mesAtual: 12, atendidas: { u: { 1: { P: 999 } } } });
  perto(f.total.meses[0].backlog, 0);
  perto(f.total.meses[0].concluido, 10);   // não conclui mais do que existe
});

test('caso extremo: sem equipe, o QLP é estimado por produção de referência e o déficit aparece', () => {
  const f = fluxo([unidade(mesesConst(40))], [], { mesAtual: 0 });
  const m = f.total.meses[0];
  perto(m.etapas.relatorios.capacidade, 0);
  assert.ok(m.etapas.relatorios.qlpOperacional > 0, 'o sistema estima quantas pessoas seriam necessárias');
  assert.ok(m.areas[TEC].faltamOperacional > 0, 'e mostra o déficit');
  perto(m.concluido, 0);
});


/** 700 UEP vencidos em janeiro, nada mais vence no ano; 4 técnicos e 4 administrativos. */
const cenario700 = () => {
  const meses: any = { 1: { demanda: { mensal: { P: 700 } } } };
  for (let i = 2; i <= 12; i++) meses[i] = { demanda: { mensal: { P: 0 } } };
  const f = fluxo([unidade(meses)], equipe(4, 4), { mesAtual: 1 });
  return Motor.headcount(f.total, { mes: 1, prazos: [1, 2, 3, 6, 12] });
};

test('headcount: pessoas = ⌈(vencido ÷ prazo) ÷ produção de uma pessoa⌉', () => {
  const h = cenario700();
  perto(h.backlog.total, 700);
  const porPessoa = 1 * 20 * 0.85;                       // 17 UEP por relatório/mês
  const c1 = h.cenarios.find((c: any) => c.prazoMeses === 1);
  const c2 = h.cenarios.find((c: any) => c.prazoMeses === 2);
  assert.strictEqual(c1.areas[TEC].pessoas, Math.ceil(700 / porPessoa));        // 42
  assert.strictEqual(c2.areas[TEC].pessoas, Math.ceil(700 / 2 / porPessoa));    // 21
  assert.strictEqual(c2.areas[ADM].pessoas, Math.ceil(700 / 2 / porPessoa));
  assert.strictEqual(c2.deficit, c2.pessoas - h.quadroAtual);
});

test('headcount: prazo maior exige menos gente, e nunca menos que o necessário', () => {
  const h = cenario700();
  let anterior = Infinity;
  h.cenarios.forEach((c: any) => {
    assert.ok(c.pessoas <= anterior, `prazo ${c.prazoMeses}: não pode exigir mais que um prazo menor`);
    anterior = c.pessoas;
    const porPessoa = c.etapas.relatorios.producaoPessoa;
    assert.ok(c.areas[TEC].pessoas * porPessoa + 1e-9 >= c.etapas.relatorios.porMes, 'o quadro cobre o trabalho mensal');
  });
});

test('headcount: o que vence durante o período também entra na conta', () => {
  const f = fluxo([unidade(mesesConst(100))], equipe(1, 1), { mesAtual: 0 });
  const h = Motor.headcount(f.total, { mes: 0, prazos: [3] });
  const c = h.cenarios[0];
  perto(c.entradaReal, 300);                              // três meses de 100 UEP
  perto(c.trabalhoTotal, h.backlog.total + 300);
  assert.strictEqual(c.mesesEstimados, 0);
});

test('headcount: prazo que passa de dezembro usa a média do ano e se declara estimado', () => {
  const f = fluxo([unidade(mesesConst(60))], equipe(2, 2), { mesAtual: 10 });   // novembro
  const h = Motor.headcount(f.total, { mes: 10, prazos: [6] });
  const c = h.cenarios[0];
  assert.strictEqual(c.mesesEstimados, 4, 'novembro e dezembro são reais; faltam quatro');
  perto(c.entradaReal, 120);
  perto(c.entradaPeriodo, 120 + 4 * h.mediaEntrada);
});

test('headcount: sem equipe, o déficit é o quadro inteiro; sem produção possível, avisa', () => {
  const semGente = fluxo([unidade(mesesConst(50))], [], { mesAtual: 0 });
  const h1 = Motor.headcount(semGente.total, { mes: 0, prazos: [2] }).cenarios[0];
  assert.strictEqual(h1.areas[TEC].quadro, 0);
  assert.strictEqual(h1.areas[TEC].deficit, h1.areas[TEC].pessoas);
  assert.ok(h1.areas[TEC].pessoas > 0);

  const semDias = fluxo([unidade(mesesConst(50))], equipe(1, 1), { mesAtual: 0 }, { ...PARAM, diasUteis: Array(12).fill(0) });
  const h2 = Motor.headcount(semDias.total, { mes: 0, prazos: [2] }).cenarios[0];
  assert.strictEqual(h2.impossivel, true, 'sem dias úteis não há quadro possível — o sistema diz isso');
});

test('headcount: o vencido acumulado atravessa o ano (2025 → 2026)', () => {
  const f25 = fluxo([unidade(mesesConst(40))], equipe(1, 1), { mesAtual: 12 }, PARAM, 2025);
  const inicial = { u: f25.unidades[0].resumo.filaFinal };
  const f26 = fluxo([unidade(mesesConst(0))], equipe(1, 1), { mesAtual: 0, filaInicial: inicial }, PARAM, 2026);
  const h = Motor.headcount(f26.total, { mes: 0, prazos: [2] });
  perto(h.backlog.total, 40 * 12, 1);                     // todo o vencido de 2025 chega em janeiro/2026
  assert.ok(h.cenarios[0].areas[TEC].pessoas > 0, 'e exige gente para ser eliminado');
});

test('headcount: custo só aparece com custo cadastrado', () => {
  const comCusto = fluxo([unidade(mesesConst(100))], equipe(2, 2, { custoMensal: 5000 }, { custoMensal: 4000 }), { mesAtual: 0 });
  const c = Motor.headcount(comCusto.total, { mes: 0, prazos: [2] }).cenarios[0];
  perto(c.areas[TEC].custoTotal, c.areas[TEC].pessoas * 5000);
  perto(c.areas[ADM].custoDeficit, c.areas[ADM].deficit * 4000);
  const semCusto = fluxo([unidade(mesesConst(100))], equipe(2, 2), { mesAtual: 0 });
  perto(Motor.headcount(semCusto.total, { mes: 0, prazos: [2] }).cenarios[0].custoTotal, 0);
});

test('referência: quem está alocado sem produção declarada não puxa a régua para baixo', () => {
  const semProducao = administrativo({ empresasDia: 0 });
  const f = fluxo([unidade(mesesConst(50))], [administrativo(), administrativo(), administrativo(), semProducao, tecnico()], { mesAtual: 0 });
  const e = f.total.meses[0].etapas.empresas;
  perto(e.producaoPessoa, 1 * 20 * 0.85);              // a régua é de quem produz 1/dia
  perto(e.capacidade, 3 * 1 * 20 * 0.85);              // a capacidade soma só quem produz
  assert.ok(e.quadro > 3, 'o quadro continua contando a pessoa alocada');
  const r = calc([unidade(mesesConst(50))], [administrativo(), administrativo({ empresasDia: 0 }), tecnico()]);
  assert.strictEqual(r.avisos.colabProducaoZerada.length, 1, 'e o cadastro incompleto é denunciado');
});

test('referência: sem ninguém com produção na unidade, usa a equipe; sem equipe, o padrão do sistema', () => {
  const soZero = fluxo([unidade(mesesConst(50))], [administrativo({ empresasDia: 0 }), tecnico()], { mesAtual: 0 });
  assert.ok(soZero.total.meses[0].etapas.empresas.producaoPessoa > 0, 'não fica sem régua');
  const vazio = fluxo([unidade(mesesConst(50))], [], { mesAtual: 0 });
  assert.ok(vazio.total.meses[0].etapas.empresas.producaoPessoa > 0, 'sem equipe, produção de referência do sistema');
});

test('cabeças x tempo integral: meia alocação é uma pessoa e meio equivalente', () => {
  const meio = administrativo({ alocacoes: [{ unidadeId: 'u', percentual: 50 }] });
  const f = fluxo([unidade(mesesConst(10))], [administrativo(), meio, tecnico()], { mesAtual: 0 });
  const area = f.unidades[0].meses[0].areas[ADM];
  assert.strictEqual(area.cabecas, 2, 'são duas pessoas de verdade');
  perto(area.quadro, 1.5);                                   // mas 1,5 em tempo integral
  const h = Motor.headcount(f.unidades[0], { mes: 0 });
  assert.strictEqual(h.cabecasAtual, 3);                     // 2 administrativos + 1 técnico
  perto(h.quadroAtual, 2.5);
});

test('cabeças: quem entra no meio do mês conta como pessoa inteira e meia presença', () => {
  const novato = administrativo({ dataAdmissao: '2026-09-16' });   // entra dia 16 de setembro
  const f = fluxo([unidade(mesesConst(10))], [administrativo(), novato, tecnico()], { mesAtual: 8 });
  const setembro = f.unidades[0].meses[8].areas[ADM];
  assert.strictEqual(setembro.cabecas, 2, 'está na equipe desde o dia 16');
  assert.ok(setembro.quadro > 1 && setembro.quadro < 2, `esperava entre 1 e 2, veio ${setembro.quadro}`);
  const agosto = f.unidades[0].meses[7].areas[ADM];
  assert.strictEqual(agosto.cabecas, 1, 'em agosto ainda não tinha entrado');
});

test('cabeças no total: quem atende duas unidades é uma pessoa, não duas', () => {
  const dividido = administrativo({ alocacoes: [{ unidadeId: 'u', percentual: 50 }, { unidadeId: 'v', percentual: 50 }] });
  const f = fluxo([unidade(mesesConst(10)), unidade(mesesConst(10), 'v', 'V')], [dividido, tecnico()], { mesAtual: 0 });
  assert.strictEqual(f.unidades[0].meses[0].areas[ADM].cabecas, 1);
  assert.strictEqual(f.unidades[1].meses[0].areas[ADM].cabecas, 1);
  assert.strictEqual(f.total.meses[0].areas[ADM].cabecas, 1, 'no total conta uma vez só');
  perto(f.total.meses[0].areas[ADM].quadro, 1);
});

test('área: ociosa é a menor das atividades — o técnico parado no relatório está inspecionando', () => {
  // muita demanda: a inspeção satura e o relatório fica sem o que fazer
  const f = fluxo([unidade(mesesConst(500))], [tecnico({ relatoriosDia: 10 }), administrativo()], { mesAtual: 0 });
  const m = f.unidades[0].meses[0];
  assert.ok(m.etapas.inspecoes.saturada, 'a inspeção satura');
  assert.ok(m.etapas.relatorios.ocioso > 0, 'e o relatório sobra capacidade');
  perto(m.areas[TEC].ocioso, 0);                        // mas a área não está ociosa
  assert.ok(m.areas[TEC].saturada, 'a área está saturada');
  assert.strictEqual(m.areas[TEC].etapaSaturada, 'inspeção');   // nome curto, para as frases das telas
  assert.deepStrictEqual(m.areas[TEC].atividades, ['Inspeções', 'Relatórios']);
});

test('cabeças chegam aos adaptadores das telas (fila e evolução)', () => {
  const meio = administrativo({ alocacoes: [{ unidadeId: 'u', percentual: 50 }] });
  const r = calc([unidade(mesesConst(10))], [administrativo(), meio, tecnico()]);
  const fl = Motor.fila(r, { prazoMeses: 2, parametros: PARAM, ano: 2026, mesAtual: 0 });
  perto(fl.unidades[0].grupos[ADM].meses[0].cabecas, 2);
  perto(fl.unidades[0].grupos[ADM].resumo.cabecas, 2);
  perto(fl.unidades[0].grupos[ADM].meses[0].pessoas, 1.5);
  const ev = Motor.evolucao(r, { prazoMeses: 2, parametros: PARAM, ano: 2026, mesAtual: 0 });
  perto(ev.unidades[0].areas[ADM].meses[0].cabecas, 2);
  perto(ev.unidades[0].areas[ADM].meses[0].quadro, 1.5);
});
