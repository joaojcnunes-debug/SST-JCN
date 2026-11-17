import { test } from "node:test";
import assert from "node:assert/strict";
import { arquivoDeTexto, ehTexto, LIMITE_CARACTERES, LIMITE_LINHAS, nomeTextoColado, previaDoTexto, tamanhoDoTexto, textoGrande } from "./texto-colado";

test("grande: mais de 2.000 caracteres ou mais de 30 linhas", () => {
  assert.equal(textoGrande(""), false);
  assert.equal(textoGrande("a".repeat(LIMITE_CARACTERES)), false);
  assert.equal(textoGrande("a".repeat(LIMITE_CARACTERES + 1)), true);
  assert.equal(textoGrande(Array(LIMITE_LINHAS).fill("x").join("\n")), false);
  assert.equal(textoGrande(Array(LIMITE_LINHAS + 1).fill("x").join("\r\n")), true);
});

test("nome e arquivo .txt", () => {
  const d = new Date(2026, 10, 17, 9, 5);
  assert.equal(nomeTextoColado(d), "texto-colado-20261117-0905.txt");
  assert.equal(nomeTextoColado(d, 2), "texto-colado-20261117-0905-2.txt");
  const f = arquivoDeTexto("olá", d);
  assert.equal(f.name, "texto-colado-20261117-0905.txt");
  assert.ok(f.type.startsWith("text/plain"));
  assert.equal(ehTexto(f), true);
  assert.equal(ehTexto({ mime: "image/png", nome: "a.png" }), false);
  assert.equal(ehTexto({ mime: null, nome: "notas.TXT" }), true);
});

test("tamanho e prévia", () => {
  assert.equal(tamanhoDoTexto("a\nb"), "3 caracteres · 2 linhas");
  assert.equal(previaDoTexto("\nlinha 1\n\nlinha 2\nlinha 3\nlinha 4"), "linha 1\nlinha 2\nlinha 3");
  assert.ok(previaDoTexto("x".repeat(500)).endsWith("…"));
});

test("o .txt colado aparece no comentário; o do cartão continua só na aba Anexos", async () => {
  const { separarImagens } = await import("./imagens-cartao");
  const base = { created_by: null };
  const r = separarImagens([
    { ...base, id: "1", nome: "texto-colado-20261117-0905.txt", mime: "text/plain;charset=utf-8", storage_path: "gestao/T/comentario-CMT-1/u-texto.txt" },
    { ...base, id: "2", nome: "foto.png", mime: "image/png", storage_path: "gestao/T/comentario-CMT-1/u-foto.png" },
    { ...base, id: "3", nome: "planilha.txt", mime: "text/plain", storage_path: "gestao/T/u-planilha.txt" },
    { ...base, id: "4", nome: "doc.pdf", mime: "application/pdf", storage_path: "gestao/T/comentario-CMT-1/u-doc.pdf" },
  ]);
  assert.deepEqual(r.porComentario.get("CMT-1")?.map((a) => a.id), ["1", "2"]);
  assert.deepEqual(r.doCartao.map((a) => a.id), []);
});
