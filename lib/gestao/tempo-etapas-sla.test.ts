import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { entrouNaColunaEm, formatarTempoLongo, tempoPorEtapa } from "./tempo-etapas";
import { fmtMeta, resumoSla, situacaoResolucao, situacaoResposta, type SlaTarefa } from "./sla";

const H = 3_600_000;

describe("Tempo em cada etapa", () => {
  const criada = "2026-11-10T10:00:00Z";
  const agora = new Date("2026-11-10T20:00:00Z").getTime();
  test("soma as passagens e a coluna atual vai até agora", () => {
    const r = tempoPorEtapa(criada, "A", [
      { de: "A", para: "B", em: "2026-11-10T12:00:00Z" },
      { de: "B", para: "A", em: "2026-11-10T15:00:00Z" },
    ], agora);
    assert.deepEqual(r, [
      { slug: "A", ms: 2 * H + 5 * H, atual: true },
      { slug: "B", ms: 3 * H, atual: false },
    ]);
  });
  test("sem mudança: tudo na coluna atual", () => {
    assert.deepEqual(tempoPorEtapa(criada, "A", [], agora), [{ slug: "A", ms: 10 * H, atual: true }]);
  });
  test("entrou na coluna = última mudança (ou a criação)", () => {
    assert.equal(entrouNaColunaEm(criada, []), criada);
    assert.equal(entrouNaColunaEm(criada, [{ de: "A", para: "B", em: "2026-11-10T12:00:00Z" }]), "2026-11-10T12:00:00Z");
  });
  test("formatação", () => {
    assert.equal(formatarTempoLongo(30_000), "menos de 1min");
    assert.equal(formatarTempoLongo(12 * 60_000), "12min");
    assert.equal(formatarTempoLongo(5 * H + 20 * 60_000), "5h 20min");
    assert.equal(formatarTempoLongo(76 * H), "3d 4h");
  });
});

describe("Situação do prazo de atendimento", () => {
  const base: SlaTarefa = {
    id_tarefa: "T", meta_resposta: 120, meta_resolucao: 480,
    prazo_resposta: "2026-11-10T12:00:00Z", respondido_em: null,
    prazo_resolucao: "2026-11-11T12:00:00Z", resolvido_em: null, alerta_resolucao: "2026-11-11T10:00:00Z",
  };
  const t = (iso: string) => new Date(iso).getTime();
  test("1ª resposta: no prazo, estourada, cumprida e cumprida com atraso", () => {
    assert.equal(situacaoResposta(base, t("2026-11-10T11:00:00Z")).estado, "no_prazo");
    assert.equal(situacaoResposta(base, t("2026-11-10T13:00:00Z")).estado, "estourado");
    assert.equal(situacaoResposta({ ...base, respondido_em: "2026-11-10T11:30:00Z" }).estado, "cumprido");
    assert.equal(situacaoResposta({ ...base, respondido_em: "2026-11-10T12:30:00Z" }).estado, "cumprido_atrasado");
  });
  test("resolução: perto depois de 75%, estourada depois do prazo", () => {
    assert.equal(situacaoResolucao(base, t("2026-11-11T09:00:00Z")).estado, "no_prazo");
    assert.equal(situacaoResolucao(base, t("2026-11-11T10:30:00Z")).estado, "perto");
    assert.equal(situacaoResolucao(base, t("2026-11-11T12:30:00Z")).estado, "estourado");
  });
  test("cartão: vale a 1ª resposta até ela acontecer; resolvida não mostra nada", () => {
    assert.equal(resumoSla(base, t("2026-11-10T13:00:00Z"))?.estado, "estourado");
    assert.match(resumoSla(base, t("2026-11-10T13:00:00Z"))!.rotulo, /^1ª resposta atrasada/);
    const respondida = { ...base, respondido_em: "2026-11-10T11:00:00Z" };
    assert.match(resumoSla(respondida, t("2026-11-11T10:30:00Z"))!.rotulo, /^Resolver até/);
    assert.equal(resumoSla(respondida, t("2026-11-11T10:30:00Z"))!.estado, "perto");
    assert.equal(resumoSla({ ...respondida, resolvido_em: "2026-11-11T09:00:00Z" }), null);
  });
  test("metas", () => {
    assert.equal(fmtMeta(120), "2h");
    assert.equal(fmtMeta(90), "1h30");
    assert.equal(fmtMeta(null), "—");
  });
});
