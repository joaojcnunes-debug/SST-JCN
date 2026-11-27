import { test } from "node:test";
import assert from "node:assert/strict";
import {
  etapaDoAlvo,
  fatoresConfirmados,
  fmtHoras,
  montarAlvo,
  porMes,
  resumirTempo,
  situacaoConsolidacao,
  tempoMedioAteLiberar,
  topo,
  type FechamentoResumo,
  type SessaoComAlvo,
} from "./dashboard";

const item = (setor: string, fator: string, decisao: string | null, classe: string | null = null) =>
  ({ setor, setor_chave: setor, id_fator: fator, fator, questionario: "DRPS", decisao, classe }) as never;

const fechado = (itens: never[], reaberta = false): FechamentoResumo => ({ id: "F1", fechado_em: "2026-11-20T12:00:00Z", reaberta, itens });

test("situação da consolidação: sem, pendente (começou ou reaberta) e concluída", () => {
  assert.equal(situacaoConsolidacao(null, false), "sem");
  assert.equal(situacaoConsolidacao(null, true), "pendente");
  assert.equal(situacaoConsolidacao(fechado([], true), false), "pendente");
  assert.equal(situacaoConsolidacao(fechado([]), false), "concluida");
});

test("andamento: cada alvo cai numa etapa, e a venda só conta depois de liberado", () => {
  const itens = [item("Adm", "assedio", "CONFIRMAR"), item("Adm", "sobrecarga", "DESCARTAR"), item("Prod", "assedio", null, "Convergente")];
  const base = { tipo: "empresa" as const, id: "E1", nome: "E1", href: "/x", ultimo: fechado(itens), comecou: true, vendido: false };
  const a = montarAlvo({ ...base, atendimento: null, comIntervencao: new Set(["Adm|assedio"]) });
  assert.equal(a.riscos, 2);
  assert.equal(a.riscosSemIntervencao, 1);
  assert.equal(etapaDoAlvo(a), "para-liberar");
  const lib = montarAlvo({ ...base, atendimento: { status: "CONCLUIDO", parecer: "ok", concluido_em: "2026-11-21T12:00:00Z" }, comIntervencao: new Set() });
  assert.equal(etapaDoAlvo(lib), "liberado");
  assert.equal(etapaDoAlvo({ ...lib, vendido: true }), "vendido");
  assert.equal(etapaDoAlvo(montarAlvo({ ...base, ultimo: fechado([]), atendimento: null, comIntervencao: new Set() })), "sem-risco");
  assert.equal(etapaDoAlvo(montarAlvo({ ...base, ultimo: null, comecou: false, atendimento: null, comIntervencao: new Set() })), "sem");
});

test("fatores confirmados ignoram a conciliação reaberta e contam os de AET", () => {
  const r = fatoresConfirmados([fechado([item("A", "assedio", "AET"), item("B", "assedio", "CONFIRMAR")]), fechado([item("C", "x", "CONFIRMAR")], true)]);
  assert.equal(r.total, 2);
  assert.equal(r.aet, 1);
  assert.equal(r.fatores.get("assedio"), 2);
});

test("topo junta o resto em Outros", () => {
  const m = new Map([["a", 5], ["b", 4], ["c", 3], ["d", 1]]);
  assert.deepEqual(topo(m, 3), [{ nome: "a", valor: 5 }, { nome: "b", valor: 4 }, { nome: "Outros", valor: 4 }]);
});

test("porMes: os últimos meses, com zero onde não houve venda (fuso de São Paulo)", () => {
  const r = porMes(["2026-11-01T02:00:00Z", "2026-11-10T12:00:00Z", "2026-09-05T12:00:00Z"], "2026-11-27", 3);
  assert.deepEqual(r.map((x) => [x.mes, x.valor]), [["set/26", 1], ["out/26", 1], ["nov/26", 1]]); // 01/11 02:00 UTC ainda é 31/10 em SP
});

test("tempo: por pessoa no período, abertas agora e média até liberar", () => {
  const agora = new Date("2026-11-27T15:00:00Z").getTime();
  const s = (id: string, nome: string, alvo: string, ini: string, fim: string | null): SessaoComAlvo => ({
    id_sessao: id, id_inspecao: alvo, id_usuario: nome, nome, inicio: ini, ultima_atividade: fim ?? "2026-11-27T14:59:00Z", fim,
    motivo_fim: null, fechada_auto: false, alvoTipo: "empresa",
  });
  const sessoes = [
    s("1", "Ana", "E1", "2026-11-27T10:00:00Z", "2026-11-27T12:00:00Z"),
    s("2", "Bia", "E2", "2026-10-01T10:00:00Z", "2026-10-01T11:00:00Z"),
    s("3", "Ana", "E2", "2026-11-27T14:00:00Z", null),
  ];
  const desde = new Date("2026-11-01T00:00:00Z").getTime();
  const r = resumirTempo(sessoes, agora, desde);
  assert.equal(r.porPessoa.get("Bia"), undefined);
  assert.ok((r.porPessoa.get("Ana") ?? 0) >= 2 * 3_600_000);
  assert.deepEqual(r.abertas.map((x) => x.id_sessao), ["3"]);
  assert.equal(tempoMedioAteLiberar(sessoes, new Set(["empresa:E1"]), agora), 2 * 3_600_000);
  assert.equal(tempoMedioAteLiberar(sessoes, new Set(), agora), null);
  assert.equal(fmtHoras(30 * 60_000), "30 min");
  assert.equal(fmtHoras(5_400_000), "1,5 h");
});
