import { test } from "node:test";
import assert from "node:assert/strict";
import { ehTecnicoDeCampo, resumirCampo, rotuloMotivoCampo } from "./campo";
import type { SessaoDocumento } from "./sessoes";

const H = 3_600_000;
const t0 = Date.parse("2026-11-19T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const sessao = (p: Partial<SessaoDocumento> & { de: number; ate: number | null }): SessaoDocumento => ({
  id_sessao: Math.random().toString(36),
  id_inspecao: "INS-1",
  id_usuario: "U1",
  nome: "Ana",
  inicio: iso(p.de),
  ultima_atividade: iso(p.ate ?? p.de),
  fim: p.ate === null ? null : iso(p.ate),
  motivo_fim: p.ate === null ? null : "PAUSA",
  fechada_auto: false,
  ...p,
});

test("resumirCampo: trabalhado, deslocamento à parte e por pessoa", () => {
  const sessoes = [
    sessao({ de: t0, ate: t0 + 1 * H, motivo_fim: "DESLOCAMENTO" }),
    sessao({ de: t0 + 1.5 * H, ate: t0 + 2.5 * H, motivo_fim: "PAUSA" }),
    sessao({ de: t0, ate: t0 + 0.5 * H, id_usuario: "U2", nome: "Beto" }),
  ];
  const r = resumirCampo(sessoes, t0 + 5 * H);
  assert.equal(r.trabalhadoMs, 2.5 * H);
  assert.equal(r.deslocamentoMs, 0.5 * H, "do fim da pausa (1h) até o próximo início (1h30)");
  assert.deepEqual(r.porPessoa.map((p) => p.nome), ["Ana", "Beto"]);
  assert.equal(r.deslocandoAgora, false);

  const so = resumirCampo(sessoes, t0 + 5 * H, "U2");
  assert.equal(so.trabalhadoMs, 0.5 * H, "o técnico vê só o próprio");
});

test("resumirCampo: em deslocamento agora conta até agora", () => {
  const r = resumirCampo([sessao({ de: t0, ate: t0 + H, motivo_fim: "DESLOCAMENTO" })], t0 + 1.25 * H);
  assert.equal(r.deslocandoAgora, true);
  assert.equal(r.deslocamentoMs, 0.25 * H);
});

test("ehTecnicoDeCampo: responsável, quem lançou ou aba Responsáveis", () => {
  const u = { id_usuario: "U1", nome: "João Silva", email: "joao@x.com" };
  assert.equal(ehTecnicoDeCampo({ responsavel: "JOAO SILVA" }, [], u), true);
  assert.equal(ehTecnicoDeCampo({ responsavel: "Outro", usuario: "JOAO@X.COM" }, [], u), true);
  assert.equal(ehTecnicoDeCampo({ responsavel: "Outro" }, [{ id_usuario: "U1" }], u), true);
  assert.equal(ehTecnicoDeCampo({ responsavel: "Outro" }, [{ tecnico_responsavel: "joão  silva" }], u), true);
  assert.equal(ehTecnicoDeCampo({ responsavel: "Outro" }, [{ tecnico_responsavel: "Maria" }], u), false);
  assert.equal(ehTecnicoDeCampo({ responsavel: "João Silva" }, [], null), false);
});

test("rótulos do campo", () => {
  assert.equal(rotuloMotivoCampo("CONCLUIDO"), "Inspeção concluída");
  assert.equal(rotuloMotivoCampo("DESLOCAMENTO"), "Deslocamento");
});

test("travaEdicaoCampo: técnico sem o play trava; supervisor, concluída, play ligado ou carregando não", async () => {
  const { travaEdicaoCampo } = await import("./campo");
  const base = { carregando: false, tecnico: true, supervisor: false, podeEditar: true, concluida: false, sessaoAberta: false };
  assert.equal(travaEdicaoCampo(base), true);
  assert.equal(travaEdicaoCampo({ ...base, sessaoAberta: true }), false);
  assert.equal(travaEdicaoCampo({ ...base, supervisor: true }), false);
  assert.equal(travaEdicaoCampo({ ...base, concluida: true }), false);
  assert.equal(travaEdicaoCampo({ ...base, tecnico: false }), false);
  assert.equal(travaEdicaoCampo({ ...base, podeEditar: false }), false);
  assert.equal(travaEdicaoCampo({ ...base, carregando: true }), false);
});

test("campoPorPessoa: mês corrente, total, deslocamento por inspeção e quantas inspeções", async () => {
  const { campoPorPessoa } = await import("./campo");
  const inicioMes = t0 - 2 * H; // o mês começou 2h antes de t0
  const r = campoPorPessoa(
    [
      sessao({ de: t0 - 3 * H, ate: t0 - 1 * H, motivo_fim: "DESLOCAMENTO" }), // 2h, 1h dentro do mês
      sessao({ de: t0, ate: t0 + H, id_inspecao: "INS-1" }), // volta 1h depois: 1h de deslocamento
      sessao({ de: t0, ate: t0 + 0.5 * H, id_inspecao: "INS-2", id_usuario: "U2", nome: "Beto" }),
    ],
    t0 + 5 * H,
    inicioMes,
  );
  assert.equal(r[0].nome, "Ana");
  assert.equal(r[0].trabalhadoMs, 3 * H);
  assert.equal(r[0].mesMs, 2 * H);
  assert.equal(r[0].deslocamentoMs, 1 * H);
  assert.equal(r[0].inspecoes, 1);
  assert.equal(r[1].nome, "Beto");
});
