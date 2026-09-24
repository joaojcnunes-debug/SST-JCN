/* eslint-disable @typescript-eslint/no-explicit-any --
   Mesmo motivo do dimensionamento.test.ts: fixtures PARCIAIS de propósito; quem valida
   a forma é o motor, e os asserts são a validação. */
/* ==========================================================================
   v257 — colaborador FORA DO CÁLCULO (`sem_producao_diaria` / `gestao`).

   O que este arquivo existe para impedir:

   1. Que a marcação vire enfeite. O teste central não checa uma flag — checa o
      NÚMERO: marcar um administrativo tira o FTE dele do `quadro` e o déficit SOBE.
      Foi exatamente isso que eu afirmei ao operador antes de escrever o código, e
      afirmação sobre número que não tem teste é palpite com sorte.

   2. Que alguém "conserte" o efeito achando que é regressão. O quadro NECESSÁRIO
      não pode mudar — ele nunca usou quem não produz (a régua sai de `comProducao`).
      Se um dia o necessário começar a mexer junto, o assert abaixo quebra e diz por quê.
   ========================================================================== */

import { test } from "node:test";
import assert from "node:assert/strict";
import CalculoTipado from "./calculo";
import {
  colaboradoresCompletos,
  colaboradorDeLinha,
  colaboradorParaLinha,
  motivoForaDoCalculo,
} from "./mapear";
import { equipeDoMes, derivarHeadcount } from "./derivar";

type Frouxo = Record<string, any>;
const Motor = CalculoTipado as unknown as Frouxo;

/* Porta frouxa, igual à do dimensionamento.test.ts e pelo mesmo motivo: os fixtures
   daqui são PARCIAIS de propósito (um cadastro completo teria dezenas de campos
   irrelevantes para o que se testa). O app usa as funções TIPADAS; aqui quem valida a
   forma são os asserts. Um cast nomeado, no topo, visível — em vez de afrouxar os tipos
   que protegem o código de produção. */
const Completos = colaboradoresCompletos as unknown as (c: Frouxo[], f: Frouxo[], u: Frouxo[]) => Frouxo[];
const Equipe = equipeDoMes as unknown as (cadastro: Frouxo, opcoes: Frouxo) => Frouxo[];
const Derivar = derivarHeadcount as unknown as (cadastro: Frouxo, opcoes: Frouxo) => Frouxo;
const ParaLinha = colaboradorParaLinha as unknown as (c: Frouxo) => Frouxo;
const DeLinha = colaboradorDeLinha as unknown as (r: Frouxo) => Frouxo;

const PARAM = { diasUteis: Array(12).fill(20), ocupacaoAlvo: 85, rampup: [100, 100], pesosPorte: { P: 1, M: 1.5, G: 2 } };

const FUNCOES = [
  { id: "f-adm", nome: "Administrativo", tipoProducao: "administrativo", chefia: false, coordena: "todos", respondeParaId: null, ordem: 1, custoMensal: 0 },
  { id: "f-tec", nome: "Técnico", tipoProducao: "tecnico", chefia: false, coordena: "todos", respondeParaId: null, ordem: 0, custoMensal: 0 },
];
const UNIDADES = [{ id: "u1", nome: "Unidade 1" }, { id: "u2", nome: "Unidade 2" }];

const colab = (id: string, extra: Frouxo = {}) => ({
  id, nome: id, funcaoId: "f-adm",
  inspecoesDia: 0, relatoriosDia: 0, empresasDia: 1,
  dataAdmissao: null, dataDesligamento: null, custoMensal: null,
  semProducaoDiaria: false, gestao: false,
  alocacoes: [{ unidadeId: "u1", percentual: 100 }],
  ...extra,
});

const mesesConst = (q: number) => {
  const m: Frouxo = {};
  for (let i = 1; i <= 12; i++) m[i] = { demanda: { mensal: { P: q } } };
  return m;
};

/* ---------- 1. o join decide quem entra na conta ---------- */

test("colaboradoresCompletos: sem_producao_diaria rebaixa a pessoa a tipoProducao 'nenhuma'", () => {
  const [dentro, fora] = Completos(
    [colab("dentro"), colab("fora", { semProducaoDiaria: true })],
    FUNCOES, UNIDADES,
  );

  assert.equal(dentro.tipoProducao, "administrativo");
  assert.equal(dentro.foraDoCalculo, false);
  assert.equal(dentro.motivoFora, "");

  assert.equal(fora.tipoProducao, "nenhuma", "marcado tem de virar 'nenhuma' — é o valor que o motor já ignora");
  assert.equal(fora.foraDoCalculo, true);
  assert.equal(fora.motivoFora, "sem_producao_diaria");
  assert.equal(fora.funcao, "Administrativo", "a função REAL da pessoa não se perde");
});

test("colaboradoresCompletos: gestao tem o mesmo efeito, com outro motivo", () => {
  const [g] = Completos([colab("g", { gestao: true })], FUNCOES, UNIDADES);
  assert.equal(g.tipoProducao, "nenhuma");
  assert.equal(g.foraDoCalculo, true);
  assert.equal(g.motivoFora, "gestao");
});

test("motivoForaDoCalculo: com as duas marcadas, 'gestao' ganha", () => {
  assert.equal(motivoForaDoCalculo({ gestao: true, semProducaoDiaria: true }), "gestao");
  assert.equal(motivoForaDoCalculo({ gestao: false, semProducaoDiaria: true }), "sem_producao_diaria");
  assert.equal(motivoForaDoCalculo({ gestao: false, semProducaoDiaria: false }), "");
  assert.equal(motivoForaDoCalculo(null), "");
});

/* ---------- 2. ida e volta ao banco ---------- */

test("linha ⇄ domínio: as duas marcações sobrevivem ao round-trip, e ausente é false", () => {
  const linha = ParaLinha(colab("x", { gestao: true }));
  assert.equal(linha.gestao, true);
  assert.equal(linha.sem_producao_diaria, false);

  const volta = DeLinha({ ...linha, id: "x" });
  assert.equal(volta.gestao, true);
  assert.equal(volta.semProducaoDiaria, false);

  // coluna ausente (banco antes da v257, ou select parcial) NÃO pode virar `true`
  const antiga = DeLinha({ id: "y", nome: "y", funcao_id: "f-adm" });
  assert.equal(antiga.gestao, false);
  assert.equal(antiga.semProducaoDiaria, false);
});

/* ---------- 3. O NÚMERO — o motivo de este arquivo existir ---------- */

test("marcar um administrativo TIRA o FTE do quadro, NÃO mexe no necessário, e o déficit SOBE", () => {
  // 4 administrativos, um deles não entrega nada de fato (produção 0/dia).
  const base = [
    colab("a1"), colab("a2"), colab("a3"),
    colab("zerado", { empresasDia: 0 }),
  ];
  const unidades = [{ id: "u1", nome: "Unidade 1", meses: mesesConst(60) }];

  const rodar = (colaboradores: Frouxo[]) => {
    const completos = Completos(colaboradores, FUNCOES, UNIDADES);
    const r = Motor.calcular({ unidades, colaboradores: completos, parametros: PARAM, janela: { de: 0, ate: 11 }, ano: 2026 });
    const f = Motor.fluxo(r, { mesAtual: 0, prazoMeses: 3, parametros: PARAM, ano: 2026 });
    const hc = Motor.headcount(f.total, { mes: 0, prazos: [3] });
    const c = hc.cenarios[0];
    return { quadro: c.areas.administrativo.quadro, necessario: c.areas.administrativo.pessoas, deficit: c.areas.administrativo.deficit };
  };

  const antes = rodar(base);
  const depois = rodar([...base.slice(0, 3), colab("zerado", { empresasDia: 0, semProducaoDiaria: true })]);

  // 1) o FTE da equipe perde exatamente a pessoa marcada
  assert.equal(antes.quadro, 4, "antes: os 4 contavam como capacidade");
  assert.equal(depois.quadro, 3, "depois: o marcado sai do quadro");

  // 2) o quadro NECESSÁRIO não se move — a régua nunca usou quem não produz
  assert.equal(
    depois.necessario, antes.necessario,
    "o necessário NÃO pode mudar: `producaoPessoa` sai de `comProducao`, que já excluía o zerado",
  );

  // 3) e por isso o déficit sobe em exatamente 1 — a falta que já existia, aparecendo
  assert.equal(
    depois.deficit, antes.deficit + 1,
    "déficit = necessário − quadro; tirando 1 do quadro sem mexer no necessário, sobe 1",
  );
});

test("quem está fora não puxa a régua de produtividade para baixo", () => {
  // um administrativo rápido (2/dia) e um marcado como gestão com produção alta declarada:
  // a produção do marcado tem de ser IGNORADA, não somada à média.
  const unidades = [{ id: "u1", nome: "Unidade 1", meses: mesesConst(60) }];
  const rodar = (colaboradores: Frouxo[]) => {
    const completos = Completos(colaboradores, FUNCOES, UNIDADES);
    const r = Motor.calcular({ unidades, colaboradores: completos, parametros: PARAM, janela: { de: 0, ate: 11 }, ano: 2026 });
    const f = Motor.fluxo(r, { mesAtual: 0, prazoMeses: 3, parametros: PARAM, ano: 2026 });
    return Motor.headcount(f.total, { mes: 0, prazos: [3] }).cenarios[0].etapas.empresas.producaoPessoa;
  };

  const so = rodar([colab("rapido", { empresasDia: 2 })]);
  const comGestor = rodar([colab("rapido", { empresasDia: 2 }), colab("chefe", { empresasDia: 8, gestao: true })]);
  assert.equal(comGestor, so, "a produção declarada de quem está fora não entra na média");
});

/* ---------- 4. a lista da tela ---------- */

test("equipeDoMes: marcado aparece na lista, equivale a 0 e NÃO dispara 'informe a produção'", () => {
  const cadastro: Frouxo = {
    funcoes: FUNCOES,
    unidades: [{ id: "u1", nome: "Unidade 1", mesesPorAno: { 2026: mesesConst(10) } }],
    colaboradores: [colab("dentro"), colab("marcado", { gestao: true }), colab("lacuna", { empresasDia: 0 })],
    portes: [{ codigo: "P", nome: "P", peso: 1, ordem: 0 }],
    parametros: { ...PARAM, prazoDias: 90 },
  };
  const lista = Equipe(cadastro, { ano: 2026, mesAtual: 0, unidadeId: "u1" });
  const porNome = Object.fromEntries(lista.map((p) => [p.nome, p]));

  assert.equal(lista.length, 3, "ninguém some da lista — a conferência tem de bater com o time real");

  assert.equal(porNome.marcado.equivalente, 0, "marcado equivale a 0");
  assert.equal(porNome.marcado.foraDoCalculo, true);
  assert.equal(porNome.marcado.motivoFora, "gestao");
  assert.equal(porNome.marcado.semProducao, false, "marcado tem RESPOSTA, não lacuna — sem alerta vermelho");

  assert.equal(porNome.lacuna.foraDoCalculo, false);
  assert.equal(porNome.lacuna.semProducao, true, "produção 0 sem marcação continua sendo cadastro incompleto");
  assert.ok(porNome.dentro.equivalente > 0);
});

/* ---------- 5. a quebra por unidade ---------- */

test("derivarHeadcount.porUnidade: uma entrada por unidade, e o quadro do total é a soma", () => {
  const cadastro: Frouxo = {
    funcoes: FUNCOES,
    unidades: [
      { id: "u1", nome: "Unidade 1", mesesPorAno: { 2026: mesesConst(30) } },
      { id: "u2", nome: "Unidade 2", mesesPorAno: { 2026: mesesConst(10) } },
    ],
    colaboradores: [
      colab("a1"),
      colab("a2", { alocacoes: [{ unidadeId: "u2", percentual: 100 }] }),
      colab("meio", { alocacoes: [{ unidadeId: "u1", percentual: 50 }, { unidadeId: "u2", percentual: 50 }] }),
    ],
    portes: [{ codigo: "P", nome: "P", peso: 1, ordem: 0 }],
    parametros: { ...PARAM, prazoDias: 90 },
  };
  const d = Derivar(cadastro, { ano: 2026, mesAtual: 0, unidadeId: "", prazos: [3] });

  assert.equal(d.porUnidade.length, 2);
  assert.deepEqual(d.porUnidade.map((u: Frouxo) => u.nome), ["Unidade 1", "Unidade 2"]);
  d.porUnidade.forEach((u: Frouxo) => assert.ok(u.headcount, `unidade ${u.nome} sem headcount`));

  // o FTE é aditivo: a soma das unidades fecha com o total (o DÉFICIT não fecha — cada
  // unidade arredonda para cima na sua conta; por isso a tela avisa em vez de somar)
  const somaQuadro = d.porUnidade.reduce((s: number, u: Frouxo) => s + u.headcount.quadroAtual, 0);
  assert.ok(Math.abs(somaQuadro - d.headcount.quadroAtual) < 1e-9,
    `soma por unidade ${somaQuadro} != total ${d.headcount.quadroAtual}`);
});
