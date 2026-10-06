import { test } from "node:test";
import assert from "node:assert/strict";

import { FATOR_POR_CATEGORIA, gerarToken, percentuaisPorFator, situacaoColeta, tokenValido, validarEnvio } from "./triagem-anonima";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { gerarQr } from "@/lib/qr/qrcode";

test("token: 256 bits em hex, sempre diferente", () => {
  const a = gerarToken();
  const b = gerarToken();
  assert.ok(tokenValido(a));
  assert.notEqual(a, b);
  assert.equal(tokenValido("abc"), false);
  assert.equal(tokenValido(a.toUpperCase()), false);
});

test("categorias fixas cobrem os 13 fatores", () => {
  const f = Object.values(FATOR_POR_CATEGORIA).sort();
  assert.deepEqual(f, ITENS_ORGANIZACIONAL.map((i) => i.key as string).sort());
});

test("situação da coleta", () => {
  const c = { ativo: true, expira_em: "2026-10-20", max_respostas: 3 };
  assert.equal(situacaoColeta(c, "2026-10-06"), "aberta");
  assert.equal(situacaoColeta(c, "2026-10-20T23:00:00Z"), "aberta");
  assert.equal(situacaoColeta(c, "2026-10-21"), "expirada");
  assert.equal(situacaoColeta({ ...c, ativo: false }, "2026-10-06"), "encerrada");
  assert.equal(situacaoColeta(c, "2026-10-06", 3), "cheia");
});

test("envio: todas as perguntas, valores 1–5, nada além das permitidas", () => {
  const ids = ["p1", "p2"];
  assert.deepEqual(validarEnvio({ respostas: { p1: 1, p2: 5, intruso: 9 }, comentario: "  oi  " }, ids), {
    ok: true,
    respostas: { p1: 1, p2: 5 },
    comentario: "oi",
  });
  assert.equal(validarEnvio({ respostas: { p1: 1 } }, ids).ok, false);
  assert.equal(validarEnvio({ respostas: { p1: 0, p2: 3 } }, ids).ok, false);
  assert.equal(validarEnvio({ respostas: { p1: 2.5, p2: 3 } }, ids).ok, false);
  assert.equal(validarEnvio(null, ids).ok, false);
  const longo = validarEnvio({ respostas: { p1: 1, p2: 1 }, comentario: "x".repeat(5000) }, ids);
  assert.ok(longo.ok && longo.comentario!.length === 1000);
});

test("percentuais por fator só com k ≥ 5 e limiar de 30%", () => {
  const mapa = { p1: "assedio", p2: "sobrecarga" };
  assert.deepEqual(percentuaisPorFator({ total: 4, suficiente: false }, mapa), []);
  const r = percentuaisPorFator(
    {
      total: 10,
      suficiente: true,
      perguntas: [
        { id_pergunta: "p1", n: 10, freq: 3 },
        { id_pergunta: "p2", n: 10, freq: 2 },
        { id_pergunta: "desconhecida", n: 10, freq: 10 },
      ],
    },
    mapa,
  );
  assert.deepEqual(r, [
    { fator: "assedio", pct: 0.3, sugerido: true, n: 10 },
    { fator: "sobrecarga", pct: 0.2, sugerido: false, n: 10 },
  ]);
});

test("QR: tamanho cresce com o texto e respeita 4·versão + 17", () => {
  const curto = gerarQr("A");
  const link = gerarQr(`https://sst-jcn.vercel.app/q/${"a".repeat(64)}`);
  assert.equal(curto.length, 21);
  assert.ok(link.length > curto.length && (link.length - 17) % 4 === 0);
});
