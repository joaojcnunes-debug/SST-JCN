import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blocoDe,
  colunasDosBlocos,
  faixasDoPeriodo,
  hhmm,
  iniciais,
  intervaloDa,
  moverTarefa,
  rotuloHorario,
  situacaoDa,
} from "./calendario";

const t = (p: Partial<{ prazo: string | null; data_inicio: string | null; hora_inicio: string | null; hora_fim: string | null }>) => ({
  prazo: null, data_inicio: null, hora_inicio: null, hora_fim: null, ...p,
});

test("intervaloDa: prazo é a referência; sem prazo só na agenda pessoal", () => {
  assert.deepEqual(intervaloDa(t({ prazo: "2026-11-10" })), { inicio: "2026-11-10", fim: "2026-11-10", horaIni: null, horaFim: null });
  assert.equal(intervaloDa(t({ data_inicio: "2026-11-10" })), null);
  assert.deepEqual(intervaloDa(t({ data_inicio: "2026-11-10" }), true)?.inicio, "2026-11-10");
});

test("intervaloDa: início antes do prazo vira faixa; depois do prazo é ignorado", () => {
  assert.deepEqual(intervaloDa(t({ data_inicio: "2026-11-03", prazo: "2026-11-06" }))?.inicio, "2026-11-03");
  assert.deepEqual(intervaloDa(t({ data_inicio: "2026-11-09", prazo: "2026-11-06" }))?.inicio, "2026-11-06");
});

test("hhmm e rótulo do horário", () => {
  assert.equal(hhmm("07:30:00"), "07:30");
  assert.equal(hhmm("7:05"), "07:05");
  assert.equal(hhmm(""), null);
  const iv = intervaloDa(t({ prazo: "2026-11-10", hora_inicio: "07:00:00", hora_fim: "09:00:00" }))!;
  assert.equal(rotuloHorario(iv), "07:00 – 09:00");
  assert.equal(rotuloHorario({ ...iv, horaFim: null }), "07:00");
  assert.equal(rotuloHorario({ ...iv, horaIni: null }), "Dia inteiro");
});

test("blocoDe: sem fim ou fim antes do início = 1 hora", () => {
  assert.deepEqual(blocoDe({ inicio: "x", fim: "x", horaIni: "14:00", horaFim: "15:30" }), { ini: 840, fim: 930 });
  assert.deepEqual(blocoDe({ inicio: "x", fim: "x", horaIni: "14:00", horaFim: null }), { ini: 840, fim: 900 });
  assert.deepEqual(blocoDe({ inicio: "x", fim: "x", horaIni: "14:00", horaFim: "13:00" }), { ini: 840, fim: 900 });
  assert.deepEqual(blocoDe({ inicio: "x", fim: "x", horaIni: "23:30", horaFim: null }), { ini: 1410, fim: 1440 });
});

test("situacaoDa", () => {
  const iv = { inicio: "2026-11-09", fim: "2026-11-11", horaIni: null, horaFim: null };
  assert.equal(situacaoDa(iv, false, "2026-11-10"), "hoje");
  assert.equal(situacaoDa(iv, false, "2026-11-12"), "atrasada");
  assert.equal(situacaoDa(iv, false, "2026-11-01"), "no_prazo");
  assert.equal(situacaoDa(iv, true, "2026-11-12"), "concluida");
});

test("faixasDoPeriodo: corta na semana e empilha sem sobrepor", () => {
  const f = faixasDoPeriodo(
    [
      { id: "a", inicio: "2026-11-04", fim: "2026-11-08" }, // qua→dom
      { id: "b", inicio: "2026-11-05", fim: "2026-11-06" }, // qui→sex (encosta em a)
      { id: "c", inicio: "2026-10-30", fim: "2026-11-03" }, // começa antes, termina ter
      { id: "d", inicio: "2026-11-20", fim: "2026-11-21" }, // fora
    ],
    "2026-11-02", // segunda
    7,
  );
  const por = Object.fromEntries(f.map((x) => [x.id, x]));
  assert.equal(f.length, 3);
  assert.deepEqual([por.c.col0, por.c.col1, por.c.cortadaIni], [0, 1, true]);
  assert.deepEqual([por.a.col0, por.a.col1, por.a.cortadaFim], [2, 6, false]);
  assert.equal(por.c.linha, 0);
  assert.equal(por.a.linha, 0); // c termina na terça, a começa na quarta: mesma pista
  assert.equal(por.b.linha, 1);
});

test("colunasDosBlocos: sobrepostos dividem; separados ocupam tudo", () => {
  const m = colunasDosBlocos([
    { id: "a", ini: 480, fim: 600 },
    { id: "b", ini: 540, fim: 660 },
    { id: "c", ini: 600, fim: 630 }, // cabe na coluna de a (a terminou)
    { id: "d", ini: 700, fim: 760 }, // outro grupo
  ]);
  assert.deepEqual(m.get("a"), { col: 0, ncols: 2 });
  assert.deepEqual(m.get("b"), { col: 1, ncols: 2 });
  assert.deepEqual(m.get("c"), { col: 0, ncols: 2 });
  assert.deepEqual(m.get("d"), { col: 0, ncols: 1 });
});

test("moverTarefa: prazo e início andam juntos; nada muda = null", () => {
  const tt = t({ data_inicio: "2026-11-03", prazo: "2026-11-05" });
  const iv = intervaloDa(tt)!;
  assert.deepEqual(moverTarefa(tt, iv, "2026-11-10"), { prazo: "2026-11-12", data_inicio: "2026-11-10" });
  assert.equal(moverTarefa(tt, iv, "2026-11-03"), null);
  const so = t({ prazo: "2026-11-05" });
  assert.deepEqual(moverTarefa(so, intervaloDa(so)!, "2026-11-04"), { prazo: "2026-11-04" });
  const ag = t({ data_inicio: "2026-11-05" });
  assert.deepEqual(moverTarefa(ag, intervaloDa(ag, true)!, "2026-11-07"), { data_inicio: "2026-11-07" });
});

test("moverTarefa com horário: mantém a duração; sem hora antes ganha 1 hora", () => {
  const tt = t({ prazo: "2026-11-10", hora_inicio: "14:00:00", hora_fim: "15:30:00" });
  assert.deepEqual(moverTarefa(tt, intervaloDa(tt)!, "2026-11-11", "09:00"), { prazo: "2026-11-11", hora_inicio: "09:00", hora_fim: "10:30" });
  const sem = t({ prazo: "2026-11-10" });
  assert.deepEqual(moverTarefa(sem, intervaloDa(sem)!, "2026-11-10", "08:15"), { hora_inicio: "08:15", hora_fim: "09:15" });
  assert.deepEqual(moverTarefa(tt, intervaloDa(tt)!, "2026-11-10", "23:30"), { hora_inicio: "23:30", hora_fim: "23:59" });
});

test("iniciais", () => {
  assert.equal(iniciais("Ana Souza Lima"), "AL");
  assert.equal(iniciais("Phelipe"), "P");
  assert.equal(iniciais(""), "?");
});
