import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { avaliarRegras, diasUteisDoMes, vereditoGeral } from "./regras";
import type {
  EscalaDia,
  EscalaFeriado,
  EscalaRegra,
  EscalaSupervisor,
  UnidadeDaEscala,
} from "./tipos";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function sup(id: string, nome = id): EscalaSupervisor {
  return {
    id_supervisor: id,
    nome,
    nome_resumido: nome,
    funcao: null,
    usuario_email: null,
    ordem: 0,
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
  };
}

function uni(id: string, nome: string): UnidadeDaEscala {
  return {
    id_unidade: id,
    nome,
    cor_hex: "#0ea5e9",
    ordem: 0,
    municipio: nome,
    ativo: true,
    configurada: true,
  };
}

function dia(id_supervisor: string, data: string, campos: Partial<EscalaDia> = {}): EscalaDia {
  return {
    id_dia: `EDIA-${id_supervisor}-${data}`,
    id_supervisor,
    data,
    unidade_ids: ["UNI-TERE"],
    situacao: null,
    origem: "padrao",
    observacao: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    ...campos,
  };
}

function regra(codigo: string, parametros: Record<string, unknown> = {}): EscalaRegra {
  return {
    id_regra: `EREG-${codigo}`,
    codigo,
    descricao: codigo,
    parametros,
    ativa: true,
    ordem: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
  };
}

const UNIDADES = [uni("UNI-TERE", "Teresópolis"), uni("UNI-PETRO", "Petrópolis")];
const NATAL = (): EscalaFeriado => ({
  id_feriado: "EFER-natal",
  data: "2026-01-01",
  descricao: "Confraternização Universal",
  abrangencia: "nacional",
  municipio: null,
  tipo: "feriado",
  created_at: "2026-01-01T00:00:00Z",
});

// ─── A definição de dia útil ─────────────────────────────────────────────────

describe("dia util = dia de semana SEM feriado geral", () => {
  test("janeiro/2026: 22 dias de semana, 21 com expediente", () => {
    assert.equal(diasUteisDoMes(2026, 1, []).length, 22);
    assert.equal(diasUteisDoMes(2026, 1, [NATAL()]).length, 21);
  });

  test("feriado MUNICIPAL nao tira o dia da conta", () => {
    const municipal: EscalaFeriado = {
      ...NATAL(),
      id_feriado: "EFER-mun",
      data: "2026-01-05",
      abrangencia: "municipal",
      municipio: "Teresópolis",
    };
    // Alcanca so parte da equipe; quem nao e alcancado continua devendo dia.
    assert.equal(diasUteisDoMes(2026, 1, [municipal]).length, 22);
  });

  test("ponto facultativo tambem sai da conta", () => {
    const carnaval: EscalaFeriado = { ...NATAL(), data: "2026-02-16", tipo: "facultativo" };
    assert.equal(diasUteisDoMes(2026, 2, []).length, 20);
    assert.equal(diasUteisDoMes(2026, 2, [carnaval]).length, 19);
  });
});

// ─── Mínimo de supervisores ──────────────────────────────────────────────────

describe("minimo de supervisores por dia", () => {
  const uteis = diasUteisDoMes(2026, 1, [NATAL()]);

  test("passa quando todos os dias tem o minimo", () => {
    const dias = uteis.flatMap((d) => [dia("A", d), dia("B", d)]);
    const [r] = avaliarRegras({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A"), sup("B")],
      dias,
      feriados: [NATAL()],
      unidades: UNIDADES,
      regras: [regra("min_supervisores_dia", { minimo: 2 })],
    });
    assert.equal(r.situacao, "ok");
  });

  test("o dia de feriado NAO conta como falta", () => {
    // Ninguem escalado em 01/01. Se o feriado entrasse na conta de dia util, a
    // regra acusaria falta num dia em que ninguem trabalhou.
    const dias = uteis.flatMap((d) => [dia("A", d), dia("B", d)]);
    const [r] = avaliarRegras({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A"), sup("B")],
      dias,
      feriados: [NATAL()],
      unidades: UNIDADES,
      regras: [regra("min_supervisores_dia", { minimo: 2 })],
    });
    assert.equal(r.situacao, "ok");
    assert.ok(r.resumo.includes("21"));
  });

  test("home office conta em 'qualquer' e nao conta em 'em_unidade'", () => {
    const dias = uteis.flatMap((d) => [
      dia("A", d),
      dia("B", d, { unidade_ids: [], situacao: "Home office" }),
    ]);
    const entrada = {
      ano: 2026,
      mes: 1,
      supervisores: [sup("A"), sup("B")],
      dias,
      feriados: [NATAL()],
      unidades: UNIDADES,
    };

    const [comQualquer] = avaliarRegras({
      ...entrada,
      regras: [regra("min_supervisores_dia", { minimo: 2 })],
    });
    assert.equal(comQualquer.situacao, "ok");

    const [comUnidade] = avaliarRegras({
      ...entrada,
      regras: [regra("min_supervisores_dia", { minimo: 2, considerar: "em_unidade" })],
    });
    assert.equal(comUnidade.situacao, "revisar");
  });
});

// ─── Sede ────────────────────────────────────────────────────────────────────

describe("sede coberta", () => {
  test("sem id_unidade a regra nao roda, e NAO passa como ok", () => {
    const [r] = avaliarRegras({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A")],
      dias: [],
      feriados: [],
      unidades: UNIDADES,
      regras: [regra("sede_coberta", { id_unidade: null })],
    });
    assert.equal(r.situacao, "nao_configurada");
  });

  test("acusa os dias em que a sede fica sem ninguem", () => {
    const uteis = diasUteisDoMes(2026, 1, []);
    // Todos os dias em Teresopolis, menos o primeiro dia util.
    const dias = uteis.slice(1).map((d) => dia("A", d));
    const [r] = avaliarRegras({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A")],
      dias,
      feriados: [],
      unidades: UNIDADES,
      regras: [regra("sede_coberta", { id_unidade: "UNI-TERE" })],
    });
    assert.equal(r.situacao, "revisar");
    assert.equal(r.ocorrencias.length, 1);
  });
});

// ─── Âncora e par ────────────────────────────────────────────────────────────

describe("ancora com dias fixos", () => {
  const uteis = diasUteisDoMes(2026, 1, []);

  test("passa quando a pessoa esta em unidade nas quartas e sextas", () => {
    const dias = uteis.map((d) => dia("A", d));
    const [r] = avaliarRegras({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A", "Julianna")],
      dias,
      feriados: [],
      unidades: UNIDADES,
      regras: [regra("ancora_dias_fixos", { id_supervisor: "A", dias: [3, 5] })],
    });
    assert.equal(r.situacao, "ok");
  });

  test("home office numa quarta fura a ancora", () => {
    const dias = uteis.map((d) =>
      d === "2026-01-07" ? dia("A", d, { unidade_ids: [], situacao: "Home office" }) : dia("A", d)
    );
    const [r] = avaliarRegras({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A", "Julianna")],
      dias,
      feriados: [],
      unidades: UNIDADES,
      regras: [regra("ancora_dias_fixos", { id_supervisor: "A", dias: [3, 5] })],
    });
    assert.equal(r.situacao, "revisar");
    assert.deepEqual(r.ocorrencias, ["07/01"]);
  });

  test("sem parametro, nao roda", () => {
    const [r] = avaliarRegras({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A")],
      dias: [],
      feriados: [],
      unidades: UNIDADES,
      regras: [regra("ancora_dias_fixos", {})],
    });
    assert.equal(r.situacao, "nao_configurada");
  });
});

describe("par na mesma unidade", () => {
  test("coincidir em uma unidade comum basta", () => {
    const dias = [dia("A", "2026-01-05"), dia("B", "2026-01-05")];
    const [r] = avaliarRegras({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A"), sup("B")],
      dias,
      feriados: [],
      unidades: UNIDADES,
      regras: [regra("par_mesma_unidade", { id_supervisor_a: "A", id_supervisor_b: "B" })],
    });
    assert.equal(r.situacao, "ok");
    assert.equal(r.ocorrencias.length, 1);
  });

  test("mesmo dia em unidades diferentes NAO conta", () => {
    const dias = [
      dia("A", "2026-01-05"),
      dia("B", "2026-01-05", { unidade_ids: ["UNI-PETRO"] }),
    ];
    const [r] = avaliarRegras({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A"), sup("B")],
      dias,
      feriados: [],
      unidades: UNIDADES,
      regras: [regra("par_mesma_unidade", { id_supervisor_a: "A", id_supervisor_b: "B" })],
    });
    assert.equal(r.situacao, "revisar");
  });

  test("os dois em home office no mesmo dia NAO contam como juntos", () => {
    const fora = { unidade_ids: [], situacao: "Home office" as const };
    const dias = [
      dia("A", "2026-01-05", fora),
      dia("B", "2026-01-05", fora),
    ];
    const [r] = avaliarRegras({
      ano: 2026,
      mes: 1,
      supervisores: [sup("A"), sup("B")],
      dias,
      feriados: [],
      unidades: UNIDADES,
      regras: [regra("par_mesma_unidade", { id_supervisor_a: "A", id_supervisor_b: "B" })],
    });
    assert.equal(r.situacao, "revisar");
  });
});

// ─── Higiene do motor ────────────────────────────────────────────────────────

describe("higiene", () => {
  const vazio = {
    ano: 2026,
    mes: 1,
    supervisores: [],
    dias: [],
    feriados: [],
    unidades: UNIDADES,
  };

  test("codigo desconhecido NUNCA vira ok", () => {
    const [r] = avaliarRegras({ ...vazio, regras: [regra("regra_do_futuro")] });
    assert.equal(r.situacao, "desconhecida");
  });

  test("regra inativa nem e avaliada", () => {
    const r = avaliarRegras({
      ...vazio,
      regras: [{ ...regra("min_supervisores_dia"), ativa: false }],
    });
    assert.equal(r.length, 0);
  });

  test("veredito geral: revisar ganha de tudo", () => {
    assert.equal(
      vereditoGeral([
        { id_regra: "1", codigo: "a", descricao: "", situacao: "ok", resumo: "", ocorrencias: [] },
        { id_regra: "2", codigo: "b", descricao: "", situacao: "revisar", resumo: "", ocorrencias: [] },
        { id_regra: "3", codigo: "c", descricao: "", situacao: "desconhecida", resumo: "", ocorrencias: [] },
      ]).situacao,
      "revisar"
    );
  });

  test("veredito geral: sem regra nenhuma nao e 'ok'", () => {
    assert.equal(vereditoGeral([]).situacao, "vazio");
  });
});
