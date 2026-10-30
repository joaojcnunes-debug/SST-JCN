import { test } from "node:test";
import assert from "node:assert/strict";
import { mesAbsSP } from "./mes";
import {
  agruparPorDoc,
  documentosParados,
  horasPorMes,
  horasPorPessoa,
  mediasPorComplexidade,
  trabalhandoAgora,
  type DocTempo,
} from "./tempo-documentos";
import type { SessaoDocumento } from "@/lib/inspecoes/sessoes";

const H = 3_600_000;
const D = 24 * H;
const agora = Date.UTC(2026, 9, 30, 15, 0, 0); // 30/10/2026 12h em SP
const t = (off: number) => new Date(agora + off).toISOString();
const s = (x: Partial<SessaoDocumento>): SessaoDocumento => ({
  id_sessao: "S", id_inspecao: "I1", id_usuario: "U1", nome: "Sarah", inicio: t(-2 * H), ultima_atividade: t(-H),
  fim: t(-H), motivo_fim: "PAUSA", fechada_auto: false, ...x,
});
const doc = (x: Partial<DocTempo>): DocTempo => ({
  id_inspecao: "I1", id_empresa: "E1", empresa: "Empresa", complexidade: "ALTA", elaboracao_status: "EM_ELABORACAO",
  elaboracao_concluida_em: null, ...x,
});

const sessoes = [
  s({ id_sessao: "A" }), // 1h, out/26, Sarah, I1
  s({ id_sessao: "B", id_usuario: "U2", nome: "Ana", id_inspecao: "I2", inicio: t(-40 * D), ultima_atividade: t(-40 * D + 3 * H), fim: t(-40 * D + 3 * H) }), // 3h, set/26
  s({ id_sessao: "C", id_inspecao: "I2", inicio: t(-10 * 60_000), ultima_atividade: t(-60_000), fim: null, motivo_fim: null }), // correndo: 10min
];

test("horas por mês (no mês do início) e por pessoa", () => {
  const mes = mesAbsSP(new Date(agora));
  const meses = horasPorMes(sessoes, mes, 3, agora);
  assert.deepEqual(meses.map((m) => m.ms / 60_000), [0, 180, 70]);
  assert.deepEqual(horasPorPessoa(sessoes, mes, agora).map((p) => [p.pessoa, p.ms / 60_000, p.documentos]), [["Sarah", 70, 2]]);
  assert.deepEqual(horasPorPessoa(sessoes, null, agora).map((p) => p.pessoa), ["Ana", "Sarah"]);
  assert.deepEqual(trabalhandoAgora(sessoes, agora).map((x) => x.id_sessao), ["C"]);
});

test("média por complexidade só de entregues; parados há 3 dias, com aguardando cliente marcado", () => {
  const docs = [
    doc({ id_inspecao: "I1", elaboracao_status: "CONCLUIDO", elaboracao_concluida_em: t(0) }), // 1h trabalhada, 2h de calendário
    doc({ id_inspecao: "I3", complexidade: "BAIXA" }),
    doc({ id_inspecao: "I4", complexidade: "BAIXA" }),
  ];
  const porDoc = agruparPorDoc([
    ...sessoes,
    s({ id_sessao: "D", id_inspecao: "I3", inicio: t(-6 * D), ultima_atividade: t(-5 * D), fim: t(-5 * D), motivo_fim: "AGUARDANDO_CLIENTE" }),
    s({ id_sessao: "E", id_inspecao: "I4", inicio: t(-2 * D), ultima_atividade: t(-2 * D + H), fim: t(-2 * D + H) }),
  ]);
  const medias = mediasPorComplexidade(docs, porDoc, agora);
  assert.equal(medias.length, 1);
  assert.equal(medias[0].complexidade, "ALTA");
  assert.equal(medias[0].trabalhadoMs, H);
  assert.equal(medias[0].calendarioMs, 2 * H);
  const parados = documentosParados(docs, porDoc, agora);
  assert.deepEqual(parados.map((p) => [p.doc.id_inspecao, p.diasParado, p.aguardandoCliente]), [["I3", 5, true]]);
});
