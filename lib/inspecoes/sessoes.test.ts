import { test } from "node:test";
import assert from "node:assert/strict";
import { esperasDoCliente, estaAberta, fmtCronometro, fmtDuracao, minhaSessaoAberta, resumirSessoes, type SessaoDocumento } from "./sessoes";

const H = 3_600_000;
const M = 60_000;
const base = Date.UTC(2026, 9, 30, 12, 0, 0);
const t = (off: number) => new Date(base + off).toISOString();
const s = (x: Partial<SessaoDocumento>): SessaoDocumento => ({
  id_sessao: "S", id_inspecao: "I", id_usuario: "U1", nome: "Sarah", inicio: t(0), ultima_atividade: t(0),
  fim: null, motivo_fim: null, fechada_auto: false, ...x,
});

test("trabalhado por pessoa; sessão aberta corre até agora; parada há 30 min vale até a última atividade", () => {
  const agora = base + 5 * H;
  const r = resumirSessoes([
    s({ id_sessao: "A", inicio: t(0), fim: t(H), motivo_fim: "PAUSA", ultima_atividade: t(H) }),
    s({ id_sessao: "B", inicio: t(4 * H), ultima_atividade: t(5 * H - 10 * M) }), // correndo: 1h
    s({ id_sessao: "C", id_usuario: "U2", nome: "Ana", inicio: t(2 * H), ultima_atividade: t(2 * H + 20 * M) }), // parada: 20min
  ], agora);
  assert.equal(r.trabalhadoMs, 2 * H + 20 * M);
  assert.deepEqual(r.porPessoa.map((p) => [p.nome, p.ms / M, p.aberta]), [["Sarah", 120, true], ["Ana", 20, false]]);
  assert.equal(estaAberta(s({ ultima_atividade: t(0) }), base + 31 * M), false);
});

test("aguardando cliente: do fim da pausa até o próximo início, fora do trabalhado; sobreposição conta uma vez", () => {
  const sessoes = [
    s({ id_sessao: "A", inicio: t(0), fim: t(H), motivo_fim: "AGUARDANDO_CLIENTE", ultima_atividade: t(H) }),
    s({ id_sessao: "B", id_usuario: "U2", inicio: t(30 * M), fim: t(2 * H), motivo_fim: "AGUARDANDO_CLIENTE", ultima_atividade: t(2 * H) }),
    s({ id_sessao: "C", inicio: t(26 * H), fim: t(27 * H), motivo_fim: "PAUSA", ultima_atividade: t(27 * H) }),
  ];
  const r = resumirSessoes(sessoes, base + 30 * H);
  assert.equal(r.trabalhadoMs, H + 90 * M + H);
  // A: 1h→26h (a B começou antes do fim da A); B: 2h→26h — juntas, 1h→26h = 25h.
  assert.equal(r.aguardandoClienteMs, 25 * H);
  assert.equal(r.aguardandoClienteAgora, false);

  const esperando = resumirSessoes([sessoes[0]], base + 3 * H);
  assert.equal(esperando.aguardandoClienteMs, 2 * H);
  assert.equal(esperando.aguardandoClienteAgora, true);
  // Com o documento concluído, a espera sem retorno para na conclusão.
  assert.equal(resumirSessoes([sessoes[0]], base + 10 * H, base + 2 * H).aguardandoClienteMs, H);
});

test("minha sessão aberta e formato", () => {
  const agora = base + 10 * M;
  const lista = [s({ id_sessao: "X", id_usuario: "U2", ultima_atividade: t(5 * M) }), s({ id_sessao: "Y", ultima_atividade: t(5 * M) })];
  assert.equal(minhaSessaoAberta(lista, "U1", agora)?.id_sessao, "Y");
  assert.equal(minhaSessaoAberta(lista, null, agora), undefined);
  assert.equal(fmtDuracao(45 * M), "45min");
  assert.equal(fmtDuracao(H + 5 * M), "1h05");
  assert.equal(fmtDuracao(51 * H), "2d 3h");
  assert.equal(fmtCronometro(H + 42 * M + 7_000), "01:42:07");
  assert.equal(fmtCronometro(26 * H), "26:00:00");
});

test("esperas do cliente juntam as sobrepostas (a linha do tempo do painel)", () => {
  const e = esperasDoCliente([
    s({ id_sessao: "A", inicio: t(0), fim: t(H), motivo_fim: "AGUARDANDO_CLIENTE", ultima_atividade: t(H) }),
    s({ id_sessao: "B", id_usuario: "U2", inicio: t(30 * M), fim: t(2 * H), motivo_fim: "AGUARDANDO_CLIENTE", ultima_atividade: t(2 * H) }),
    s({ id_sessao: "C", inicio: t(5 * H), fim: t(6 * H), motivo_fim: "PAUSA", ultima_atividade: t(6 * H) }),
  ], base + 10 * H);
  assert.deepEqual(e.intervalos.map(([a, b]) => [(a - base) / H, (b - base) / H]), [[1, 5]]);
  assert.equal(e.agora, false);
});
