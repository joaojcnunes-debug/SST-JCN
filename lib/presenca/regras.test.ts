import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparPorDia,
  classificar,
  contarPorStatus,
  formatarMinutos,
  haQuantoTempo,
  statusDe,
  type PresencaBloco,
  type PresencaResumoRow,
} from "./regras";

// 16/09/2026 10:31 no RJ (UTC-3) = 13:31Z.
const AGORA = Date.parse("2026-09-16T13:31:00Z");
const min = (n: number) => new Date(AGORA - n * 60_000).toISOString();

function pessoa(p: Partial<PresencaResumoRow> & { nome: string }): PresencaResumoRow {
  return {
    usuario_email: `${p.nome.toLowerCase()}@x`,
    perfil: "Tecnico",
    cargo: null,
    entrou_em: null,
    ultima_atividade: null,
    blocos: 0,
    minutos_ativos: 0,
    ultima_atividade_geral: null,
    ...p,
  };
}

describe("statusDe — os limiares", () => {
  test("mexeu ha 1 min = ativo; 5 min ainda e ativo", () => {
    assert.equal(statusDe(min(1), AGORA), "ativo");
    assert.equal(statusDe(min(5), AGORA), "ativo");
  });
  test("6 a 30 min = ausente", () => {
    assert.equal(statusDe(min(6), AGORA), "ausente");
    assert.equal(statusDe(min(30), AGORA), "ausente");
  });
  test("31 min ou sem atividade = fora", () => {
    assert.equal(statusDe(min(31), AGORA), "fora");
    assert.equal(statusDe(null, AGORA), "fora");
  });
});

describe("classificar — a ordem que o Admin quer ver", () => {
  test("ausentes primeiro, depois ativos, depois quem saiu, depois quem nao entrou", () => {
    const rows = [
      pessoa({ nome: "Zeca", entrou_em: min(120), ultima_atividade: min(2) }), // ativo
      pessoa({ nome: "Bia" }), // nao entrou
      pessoa({ nome: "Ana", entrou_em: min(150), ultima_atividade: min(29) }), // ausente
      pessoa({ nome: "Caio", entrou_em: min(300), ultima_atividade: min(90) }), // fora, mas entrou
    ];
    const ordem = classificar(rows, AGORA).map((p) => `${p.nome}:${p.status}`);
    assert.deepEqual(ordem, ["Ana:ausente", "Zeca:ativo", "Caio:fora", "Bia:fora"]);
  });
  test("inativoHaMs e null para quem nao entrou", () => {
    const [p] = classificar([pessoa({ nome: "Bia" })], AGORA);
    assert.equal(p.inativoHaMs, null);
  });
  test("contarPorStatus separa 'sem entrar' de 'fora'", () => {
    const c = contarPorStatus(
      classificar(
        [
          pessoa({ nome: "A", entrou_em: min(60), ultima_atividade: min(1) }),
          pessoa({ nome: "B", entrou_em: min(60), ultima_atividade: min(45) }),
          pessoa({ nome: "C" }),
        ],
        AGORA,
      ),
    );
    assert.deepEqual(c, { ativo: 1, ausente: 0, fora: 2, semEntrar: 1 });
  });
});

describe("textos", () => {
  test("haQuantoTempo", () => {
    assert.equal(haQuantoTempo(null, AGORA), "—");
    assert.equal(haQuantoTempo(min(0.5), AGORA), "agora");
    assert.equal(haQuantoTempo(min(29), AGORA), "há 29 min");
    assert.equal(haQuantoTempo(min(60 * 2 + 10), AGORA), "há 2 h");
    assert.equal(haQuantoTempo(min(60 * 26), AGORA), "ontem");
    assert.equal(haQuantoTempo(min(60 * 24 * 6), AGORA), "há 6 dias");
  });
  test("formatarMinutos", () => {
    assert.equal(formatarMinutos(0), "—");
    assert.equal(formatarMinutos(45), "45 min");
    assert.equal(formatarMinutos(120), "2h");
    assert.equal(formatarMinutos(140), "2h20");
    assert.equal(formatarMinutos(65), "1h05");
  });
});

describe("agruparPorDia — blocos viram dias e sessoes", () => {
  const bloco = (iso: string, pings = 5): PresencaBloco => ({
    bloco: iso,
    primeiro_em: iso,
    ultimo_em: new Date(Date.parse(iso) + 4 * 60_000).toISOString(),
    pings,
    origem: "web",
  });

  test("manha e tarde do mesmo dia = 1 dia, 2 sessoes; almoco de 2h separa", () => {
    // 08:00–08:10 RJ (11:00Z) e 13:00–13:05 RJ (16:00Z), dia 16/09.
    const dias = agruparPorDia([
      bloco("2026-09-16T11:00:00Z"),
      bloco("2026-09-16T11:05:00Z"),
      bloco("2026-09-16T11:10:00Z", 2),
      bloco("2026-09-16T16:00:00Z"),
    ]);
    assert.equal(dias.length, 1);
    assert.equal(dias[0].dia, "2026-09-16");
    assert.equal(dias[0].sessoes.length, 2);
    assert.equal(dias[0].blocos, 4);
    assert.equal(dias[0].minutos, 5 + 5 + 2 + 5);
    assert.equal(dias[0].entrou, "2026-09-16T11:00:00Z");
  });

  test("bloco as 23:50 RJ e 00:05 RJ caem em dias diferentes (fuso, nao UTC)", () => {
    // 23:50 RJ = 02:50Z do dia seguinte; 00:05 RJ = 03:05Z.
    const dias = agruparPorDia([
      bloco("2026-09-17T02:50:00Z"),
      bloco("2026-09-17T03:05:00Z"),
    ]);
    assert.deepEqual(dias.map((d) => d.dia), ["2026-09-17", "2026-09-16"]);
  });

  test("pings acima de 5 no bloco contam no maximo 5 minutos", () => {
    const [d] = agruparPorDia([bloco("2026-09-16T11:00:00Z", 9)]);
    assert.equal(d.minutos, 5);
  });

  test("mais recente primeiro", () => {
    const dias = agruparPorDia([
      bloco("2026-09-10T11:00:00Z"),
      bloco("2026-09-15T11:00:00Z"),
    ]);
    assert.deepEqual(dias.map((d) => d.dia), ["2026-09-15", "2026-09-10"]);
  });
});
