import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { porMes, porSituacao, porUnidadeESupervisor } from "./relatorios";
import type { EscalaDia, EscalaSupervisor, UnidadeDaEscala } from "./tipos";

function sup(id: string): EscalaSupervisor {
  return {
    id_supervisor: id,
    nome: id,
    nome_resumido: id,
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
    unidade_ids: ["UNI-A"],
    situacao: null,
    origem: "padrao",
    observacao: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    ...campos,
  };
}

const SUPS = [sup("S1"), sup("S2")];
const UNIS = [uni("UNI-A", "Teresópolis"), uni("UNI-B", "Petrópolis")];

describe("dias por unidade x supervisor", () => {
  test("um dia em DUAS unidades conta em cada uma", () => {
    // A regra que a propria planilha declara: "celulas com mais de uma unidade
    // sao contadas em cada unidade envolvida".
    const m = porUnidadeESupervisor({
      supervisores: SUPS,
      unidades: UNIS,
      dias: [dia("S1", "2026-01-05", { unidade_ids: ["UNI-A", "UNI-B"] })],
    });
    assert.equal(m.linhas[0].porSupervisor.S1, 1);
    assert.equal(m.linhas[1].porSupervisor.S1, 1);
    // Um dia so, mas dois dias-unidade -- e por isso o total pode passar do
    // numero de dias do periodo.
    assert.equal(m.totalGeral, 2);
  });

  test("home office nao entra em unidade nenhuma", () => {
    const m = porUnidadeESupervisor({
      supervisores: SUPS,
      unidades: UNIS,
      dias: [dia("S1", "2026-01-05", { unidade_ids: [], situacao: "Home office" })],
    });
    assert.equal(m.totalGeral, 0);
  });

  test("unidade fora do cadastro nao vira linha inventada", () => {
    const m = porUnidadeESupervisor({
      supervisores: SUPS,
      unidades: UNIS,
      dias: [dia("S1", "2026-01-05", { unidade_ids: ["UNI-SUMIU"] })],
    });
    assert.equal(m.linhas.length, 2);
    assert.equal(m.totalGeral, 0);
  });

  test("dia de supervisor que nao esta na lista e ignorado", () => {
    const m = porUnidadeESupervisor({
      supervisores: SUPS,
      unidades: UNIS,
      dias: [dia("S9", "2026-01-05")],
    });
    assert.equal(m.totalGeral, 0);
  });

  test("os totais fecham por linha e por coluna", () => {
    const dias = [
      dia("S1", "2026-01-05"),
      dia("S1", "2026-01-06"),
      dia("S2", "2026-01-05", { unidade_ids: ["UNI-B"] }),
    ];
    const m = porUnidadeESupervisor({ supervisores: SUPS, unidades: UNIS, dias });
    assert.equal(m.linhas[0].total, 2);
    assert.equal(m.linhas[1].total, 1);
    assert.equal(m.totalPorSupervisor.S1, 2);
    assert.equal(m.totalPorSupervisor.S2, 1);
    assert.equal(m.totalGeral, 3);
  });
});

describe("dias com escala por mes", () => {
  test("conta o dia UMA vez, com unidade ou com situacao", () => {
    const m = porMes({
      ano: 2026,
      supervisores: SUPS,
      unidades: UNIS,
      dias: [
        dia("S1", "2026-01-05", { unidade_ids: ["UNI-A", "UNI-B"] }),
        dia("S1", "2026-01-06", { unidade_ids: [], situacao: "Home office" }),
      ],
    });
    // Duas linhas de dia => 2, mesmo com uma delas em duas unidades.
    assert.equal(m.linhas[0].porSupervisor.S1, 2);
    assert.equal(m.totalGeral, 2);
  });

  test("cada mes cai na sua linha, e as doze existem sempre", () => {
    const m = porMes({
      ano: 2026,
      supervisores: SUPS,
      unidades: UNIS,
      dias: [dia("S1", "2026-01-05"), dia("S1", "2026-03-02")],
    });
    assert.equal(m.linhas.length, 12);
    assert.equal(m.linhas[0].porSupervisor.S1, 1);
    assert.equal(m.linhas[2].porSupervisor.S1, 1);
    assert.equal(m.linhas[1].total, 0);
  });

  test("FERIADO nao conta como dia com escala definida", () => {
    // A planilha preenche o dia de feriado com a palavra "Feriado", mas conta
    // 21 dias em janeiro, nao 22. Para ela, dia com escala e dia de trabalho.
    const m = porMes({
      ano: 2026,
      supervisores: SUPS,
      unidades: UNIS,
      dias: [
        dia("S1", "2026-01-01", { unidade_ids: [], situacao: "Feriado" }),
        dia("S1", "2026-01-02"),
      ],
    });
    assert.equal(m.linhas[0].porSupervisor.S1, 1);
    assert.equal(m.totalGeral, 1);
  });

  test("as outras situacoes CONTAM -- so o feriado sai", () => {
    const m = porMes({
      ano: 2026,
      supervisores: SUPS,
      unidades: UNIS,
      dias: [
        dia("S1", "2026-01-05", { unidade_ids: [], situacao: "Home office" }),
        dia("S1", "2026-01-06", { unidade_ids: [], situacao: "Folga" }),
        dia("S1", "2026-01-07", { unidade_ids: [], situacao: "Férias" }),
      ],
    });
    assert.equal(m.linhas[0].porSupervisor.S1, 3);
  });

  test("dia de outro ano nao entra", () => {
    const m = porMes({
      ano: 2026,
      supervisores: SUPS,
      unidades: UNIS,
      dias: [dia("S1", "2025-12-31")],
    });
    assert.equal(m.totalGeral, 0);
  });

  test("virada de ano nao desliza por fuso", () => {
    // 01/01 as 00h UTC seria 31/12 em UTC-3. O parse ancorado ao meio-dia evita
    // que o dia caia no ano anterior -- e no mes 12 em vez do 1.
    const m = porMes({
      ano: 2026,
      supervisores: SUPS,
      unidades: UNIS,
      dias: [dia("S1", "2026-01-01")],
    });
    assert.equal(m.linhas[0].porSupervisor.S1, 1);
    assert.equal(m.linhas[11].porSupervisor.S1, 0);
  });
});

describe("dias por situacao", () => {
  test("agrupa e ordena do maior para o menor", () => {
    const fora = (s: "Home office" | "Folga") => ({ unidade_ids: [], situacao: s });
    const r = porSituacao({
      supervisores: SUPS,
      unidades: UNIS,
      dias: [
        dia("S1", "2026-01-05", fora("Home office")),
        dia("S1", "2026-01-06", fora("Home office")),
        dia("S1", "2026-01-07", fora("Folga")),
        dia("S1", "2026-01-08"),
      ],
    });
    assert.deepEqual(r, [
      { situacao: "Home office", dias: 2 },
      { situacao: "Folga", dias: 1 },
    ]);
  });
});
