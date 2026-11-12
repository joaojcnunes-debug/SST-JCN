import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  caminhoDaImagem, colarComoImagem, comentarioDoCaminho, ehImagem, nomearColada, pastaDoComentario, separarImagens,
} from "./imagens-cartao";

const anexo = (id: string, path: string, mime: string | null) => ({ id, nome: id, storage_path: path, mime, created_by: null });

describe("caminho e comentário", () => {
  test("a imagem do comentário fica na pasta dele e volta pelo caminho", () => {
    const p = caminhoDaImagem("TRF-1", "foto da placa.png", "u-1", pastaDoComentario("CMT-AB12"));
    assert.equal(p, "gestao/TRF-1/comentario-CMT-AB12/u-1-foto_da_placa.png");
    assert.equal(comentarioDoCaminho(p), "CMT-AB12");
  });
  test("imagem do cartão (e anexo antigo) não tem comentário", () => {
    assert.equal(caminhoDaImagem("TRF-1", "a.png", "u-2"), "gestao/TRF-1/u-2-a.png");
    assert.equal(comentarioDoCaminho("gestao/TRF-1/u-2-a.png"), null);
    assert.equal(comentarioDoCaminho("gestao/TRF-1/u-3-comentario-sobre.png"), null);
  });
});

describe("separarImagens", () => {
  test("cartão × comentário; PDF e outros arquivos ficam de fora", () => {
    const r = separarImagens([
      anexo("a", "gestao/T/u1-a.png", "image/png"),
      anexo("b", "gestao/T/comentario-C1/u2-b.jpg", "image/jpeg"),
      anexo("c", "gestao/T/comentario-C1/u3-c.png", "image/png"),
      anexo("d", "gestao/T/u4-laudo.pdf", "application/pdf"),
      anexo("e", "gestao/T/u5-sem-tipo", null),
    ]);
    assert.deepEqual(r.doCartao.map((x) => x.id), ["a"]);
    assert.deepEqual(r.porComentario.get("C1")?.map((x) => x.id), ["b", "c"]);
    assert.equal(r.porComentario.size, 1);
  });
  test("ehImagem", () => {
    assert.equal(ehImagem("image/webp"), true);
    assert.equal(ehImagem("application/pdf"), false);
    assert.equal(ehImagem(null), false);
  });
});

describe("colar", () => {
  test("texto num campo de texto continua texto; só imagem, ou fora de campo, vira imagem", () => {
    assert.equal(colarComoImagem({ emCampoDeTexto: true, texto: "trecho do Word", imagens: 1 }), false);
    assert.equal(colarComoImagem({ emCampoDeTexto: true, texto: "  ", imagens: 1 }), true);
    assert.equal(colarComoImagem({ emCampoDeTexto: false, texto: "trecho", imagens: 2 }), true);
    assert.equal(colarComoImagem({ emCampoDeTexto: false, texto: "", imagens: 0 }), false);
  });
  test("print colado ganha nome com data; arquivo com nome fica como está", () => {
    const quando = new Date(2026, 10, 12, 9, 5, 7);
    const colado = nomearColada(new File(["x"], "image.png", { type: "image/png" }), 2, quando);
    assert.equal(colado.name, "imagem-colada-20261112-090507-2.png");
    const jpg = nomearColada(new File(["x"], "image.jpeg", { type: "image/jpeg" }), 1, quando);
    assert.equal(jpg.name, "imagem-colada-20261112-090507-1.jpg");
    const meu = new File(["x"], "placa da máquina.jpg", { type: "image/jpeg" });
    assert.equal(nomearColada(meu, 1, quando), meu);
  });
});
