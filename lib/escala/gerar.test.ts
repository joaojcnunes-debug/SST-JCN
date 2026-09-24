import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { gerarMes, mesmaAlocacao, padraoVigenteEm } from "./gerar";
import type {
  EscalaDia,
  EscalaFeriado,
  EscalaPadraoSemanal,
  EscalaSupervisor,
  UnidadeDaEscala,
} from "./tipos";

// ─── Fixtures mínimas ────────────────────────────────────────────────────────

function supervisor(id: string, nome = id): EscalaSupervisor {
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

function unidade(id: string, nome: string, municipio: string | null): UnidadeDaEscala {
  return {
    id_unidade: id,
    nome,
    cor_hex: "#0ea5e9",
    ordem: 0,
    municipio,
    ativo: true,
    configurada: true,
  };
}

function padrao(
  id_supervisor: string,
  dia_semana: 1 | 2 | 3 | 4 | 5,
  campos: Partial<EscalaPadraoSemanal> = {}
): EscalaPadraoSemanal {
  return {
    id_padrao: `EPAD-${id_supervisor}-${dia_semana}-${campos.vigencia_inicio ?? "base"}`,
    id_supervisor,
    dia_semana,
    unidade_ids: ["UNI-TERE"],
    situacao: null,
    vigencia_inicio: "2020-01-01",
    vigencia_fim: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    ...campos,
  };
}

function dia(
  id_supervisor: string,
  data: string,
  campos: Partial<EscalaDia> = {}
): EscalaDia {
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

function feriado(data: string, campos: Partial<EscalaFeriado> = {}): EscalaFeriado {
  return {
    id_feriado: `EFER-${data}`,
    data,
    descricao: "Feriado",
    abrangencia: "nacional",
    municipio: null,
    tipo: "feriado",
    created_at: "2026-01-01T00:00:00Z",
    ...campos,
  };
}

const UNIDADES = [
  unidade("UNI-TERE", "Teresópolis", "Teresópolis"),
  unidade("UNI-PETRO", "Petrópolis", "Petrópolis"),
  unidade("UNI-SEM", "Sem município", null),
];

/** Um supervisor em Teresópolis todos os dias úteis. */
const SEMPRE_TERE = [1, 2, 3, 4, 5].map((d) => padrao("SUP-A", d as 1));

// ─── Vigência ────────────────────────────────────────────────────────────────

describe("padrao vigente em uma data", () => {
  test("ignora vigencia que ainda nao comecou e a que ja terminou", () => {
    const linhas = [
      padrao("SUP-A", 1, { vigencia_inicio: "2026-01-01", vigencia_fim: "2026-05-31" }),
      padrao("SUP-A", 1, { vigencia_inicio: "2026-06-01" }),
    ];
    // 05/01 e uma segunda; 06/07 tambem.
    assert.equal(padraoVigenteEm(linhas, "SUP-A", "2026-01-05")?.vigencia_inicio, "2026-01-01");
    assert.equal(padraoVigenteEm(linhas, "SUP-A", "2026-07-06")?.vigencia_inicio, "2026-06-01");
  });

  test("fim de semana nunca tem padrao vigente", () => {
    assert.equal(padraoVigenteEm(SEMPRE_TERE, "SUP-A", "2026-01-10"), null); // sabado
    assert.equal(padraoVigenteEm(SEMPRE_TERE, "SUP-A", "2026-01-11"), null); // domingo
  });

  test("com duas vigencias abertas, a mais nova ganha", () => {
    const linhas = [
      padrao("SUP-A", 1, { vigencia_inicio: "2026-01-01" }),
      padrao("SUP-A", 1, { vigencia_inicio: "2026-03-01", unidade_ids: ["UNI-PETRO"] }),
    ];
    const achado = padraoVigenteEm(linhas, "SUP-A", "2026-06-01"); // segunda
    assert.deepEqual(achado?.unidade_ids, ["UNI-PETRO"]);
  });
});

// ─── Geração ─────────────────────────────────────────────────────────────────

describe("geracao da grade mensal", () => {
  const base = {
    supervisores: [supervisor("SUP-A")],
    padroes: SEMPRE_TERE,
    unidades: UNIDADES,
    existentes: [] as EscalaDia[],
  };

  test("janeiro/2026 gera 22 dias de semana, e o feriado vira situacao", () => {
    const r = gerarMes({ ...base, ano: 2026, mes: 1, feriados: [feriado("2026-01-01")] });

    // Janeiro/2026 tem 22 dias de segunda a sexta. Os 21 da planilha ja
    // descontam o 1o de janeiro -- "dia de semana" e "dia com expediente" sao
    // perguntas diferentes, e a Fase 6 depende dessa distincao.
    assert.equal(r.diasDeSemana, 22);
    assert.equal(r.diasComFeriadoGeral, 1);
    assert.equal(r.aCriar.length, 22);

    const primeiro = r.aCriar.find((l) => l.data === "2026-01-01");
    assert.deepEqual(primeiro?.alocacao, { tipo: "situacao", situacao: "Feriado" });

    const segundo = r.aCriar.find((l) => l.data === "2026-01-02");
    assert.deepEqual(segundo?.alocacao, { tipo: "unidades", unidade_ids: ["UNI-TERE"] });
  });

  test("ponto facultativo bloqueia igual a feriado", () => {
    // Carnaval de 2026: 16 e 17/02, segunda e terca, marcados "facultativo" na
    // planilha -- e la os 5 supervisores aparecem como "Feriado".
    const r = gerarMes({
      ...base,
      ano: 2026,
      mes: 2,
      feriados: [
        feriado("2026-02-16", { tipo: "facultativo", descricao: "Carnaval" }),
        feriado("2026-02-17", { tipo: "facultativo", descricao: "Carnaval" }),
      ],
    });
    assert.equal(r.diasComFeriadoGeral, 2);
    for (const data of ["2026-02-16", "2026-02-17"]) {
      const l = r.aCriar.find((x) => x.data === data);
      assert.deepEqual(l?.alocacao, { tipo: "situacao", situacao: "Feriado" });
    }
    // 20 dias de semana em fevereiro/2026; menos os 2 do Carnaval = os 18 da planilha.
    assert.equal(r.diasDeSemana, 20);
    assert.equal(r.diasDeSemana - r.diasComFeriadoGeral, 18);
  });

  test("dia MANUAL nunca e tocado por regeracao", () => {
    const manual = dia("SUP-A", "2026-01-05", {
      origem: "manual",
      unidade_ids: ["UNI-PETRO"],
    });
    const r = gerarMes({
      ...base,
      ano: 2026,
      mes: 1,
      feriados: [],
      existentes: [manual],
    });
    assert.equal(r.preservados, 1);
    assert.ok(!r.aCriar.some((l) => l.data === "2026-01-05"));
    assert.ok(!r.aAtualizar.some((l) => l.data === "2026-01-05"));
  });

  test("regerar duas vezes nao faz nada na segunda", () => {
    const primeira = gerarMes({ ...base, ano: 2026, mes: 3, feriados: [] });
    const gravados = primeira.aCriar.map((l) => dia("SUP-A", l.data));
    const segunda = gerarMes({
      ...base,
      ano: 2026,
      mes: 3,
      feriados: [],
      existentes: gravados,
    });
    assert.equal(segunda.aCriar.length, 0);
    assert.equal(segunda.aAtualizar.length, 0);
    assert.equal(segunda.jaCorretos, primeira.aCriar.length);
  });

  test("linha de padrao mudou: atualiza o que era padrao", () => {
    const gravado = dia("SUP-A", "2026-03-02", { unidade_ids: ["UNI-PETRO"] });
    const r = gerarMes({
      ...base,
      ano: 2026,
      mes: 3,
      feriados: [],
      existentes: [gravado],
    });
    const alvo = r.aAtualizar.find((l) => l.data === "2026-03-02");
    assert.deepEqual(alvo?.alocacao, { tipo: "unidades", unidade_ids: ["UNI-TERE"] });
    assert.equal(alvo?.id_dia, gravado.id_dia);
  });

  test("sem padrao vigente nao gera linha", () => {
    const r = gerarMes({
      ...base,
      ano: 2026,
      mes: 1,
      feriados: [],
      padroes: [padrao("SUP-A", 3)], // so quarta
    });
    // 4 quartas em janeiro/2026 (07, 14, 21, 28).
    assert.equal(r.aCriar.length, 4);
    assert.equal(r.semPadrao, 22 - 4);
  });

  test("fevereiro de ano bissexto vai ate o dia 29", () => {
    const r = gerarMes({ ...base, ano: 2028, mes: 2, feriados: [] });
    // 29/02/2028 e uma terca.
    assert.ok(r.aCriar.some((l) => l.data === "2028-02-29"));
  });
});

// ─── Feriado municipal ───────────────────────────────────────────────────────

describe("feriado municipal alcanca so quem esta no municipio", () => {
  const municipal = feriado("2026-03-02", {
    abrangencia: "municipal",
    municipio: "Teresópolis",
    descricao: "Aniversário da cidade",
  });

  test("bloqueia quem esta na unidade daquele municipio", () => {
    const r = gerarMes({
      ano: 2026,
      mes: 3,
      supervisores: [supervisor("SUP-A")],
      padroes: [padrao("SUP-A", 1)], // segunda em Teresopolis
      unidades: UNIDADES,
      feriados: [municipal],
      existentes: [],
    });
    const l = r.aCriar.find((x) => x.data === "2026-03-02");
    assert.deepEqual(l?.alocacao, { tipo: "situacao", situacao: "Feriado" });
    // Nao entra na conta de feriado GERAL -- alcance municipal e outra coisa.
    assert.equal(r.diasComFeriadoGeral, 0);
  });

  test("NAO bloqueia quem esta em outro municipio", () => {
    const r = gerarMes({
      ano: 2026,
      mes: 3,
      supervisores: [supervisor("SUP-B")],
      padroes: [padrao("SUP-B", 1, { unidade_ids: ["UNI-PETRO"] })],
      unidades: UNIDADES,
      feriados: [municipal],
      existentes: [],
    });
    const l = r.aCriar.find((x) => x.data === "2026-03-02");
    assert.deepEqual(l?.alocacao, { tipo: "unidades", unidade_ids: ["UNI-PETRO"] });
  });

  test("NAO bloqueia quem esta em home office", () => {
    const r = gerarMes({
      ano: 2026,
      mes: 3,
      supervisores: [supervisor("SUP-C")],
      padroes: [padrao("SUP-C", 1, { unidade_ids: [], situacao: "Home office" })],
      unidades: UNIDADES,
      feriados: [municipal],
      existentes: [],
    });
    const l = r.aCriar.find((x) => x.data === "2026-03-02");
    assert.deepEqual(l?.alocacao, { tipo: "situacao", situacao: "Home office" });
  });

  test("unidade SEM municipio nunca casa com feriado municipal", () => {
    const r = gerarMes({
      ano: 2026,
      mes: 3,
      supervisores: [supervisor("SUP-D")],
      padroes: [padrao("SUP-D", 1, { unidade_ids: ["UNI-SEM"] })],
      unidades: UNIDADES,
      feriados: [municipal],
      existentes: [],
    });
    const l = r.aCriar.find((x) => x.data === "2026-03-02");
    assert.deepEqual(l?.alocacao, { tipo: "unidades", unidade_ids: ["UNI-SEM"] });
  });

  test("municipio casa sem depender de caixa nem espaco", () => {
    const r = gerarMes({
      ano: 2026,
      mes: 3,
      supervisores: [supervisor("SUP-A")],
      padroes: [padrao("SUP-A", 1)],
      unidades: [unidade("UNI-TERE", "Teresópolis", "  teresópolis ")],
      feriados: [municipal],
      existentes: [],
    });
    const l = r.aCriar.find((x) => x.data === "2026-03-02");
    assert.deepEqual(l?.alocacao, { tipo: "situacao", situacao: "Feriado" });
  });
});

describe("comparacao de alocacoes", () => {
  test("ordem das unidades nao importa", () => {
    assert.equal(
      mesmaAlocacao(
        { tipo: "unidades", unidade_ids: ["A", "B"] },
        { tipo: "unidades", unidade_ids: ["B", "A"] }
      ),
      true
    );
  });

  test("tipos diferentes nunca sao iguais", () => {
    assert.equal(
      mesmaAlocacao(
        { tipo: "unidades", unidade_ids: ["A"] },
        { tipo: "situacao", situacao: "Folga" }
      ),
      false
    );
  });
});
