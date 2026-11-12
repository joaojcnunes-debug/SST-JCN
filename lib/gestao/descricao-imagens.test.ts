import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  completarComImagens, docParaTexto, idsDasImagens, imagensForaDoTexto, textoParaDoc, textoSemImagens, tokenImagem, type NoDoc,
} from "./descricao-imagens";

const ID = "0f8e2a3c-1b2d-4e5f-8a9b-0c1d2e3f4a5b";
const ID2 = "11111111-2222-4333-8444-555555555555";

describe("ida e volta texto ↔ editor", () => {
  test("descrições de hoje (só texto) voltam idênticas", () => {
    for (const t of ["", "uma linha", "a\nb", "a\n\nb", "a\n", "\n", "  recuo e espaço no fim  ", "Razão Social\n\nVALE DO MARMELO\nCNPJ: 06.995.999/0002-13"]) {
      assert.equal(docParaTexto(textoParaDoc(t)), t, JSON.stringify(t));
    }
  });
  test("linha de imagem vira imagem e volta igual", () => {
    const t = `Foto da máquina:\n${tokenImagem(ID, "imagem-colada-1.png")}\nLaudo anterior\n${tokenImagem(ID2, "placa.jpg")}`;
    const doc = textoParaDoc(t);
    assert.deepEqual(doc.content?.map((n) => n.type), ["paragraph", "image", "paragraph", "image"]);
    assert.deepEqual(doc.content?.[1].attrs, { anexo: ID, alt: "imagem-colada-1.png" });
    assert.equal(docParaTexto(doc), t);
  });
  test("marcação no meio da frase continua texto", () => {
    const t = `veja ${tokenImagem(ID, "a.png")} aqui`;
    assert.deepEqual(textoParaDoc(t).content?.map((n) => n.type), ["paragraph"]);
    assert.equal(docParaTexto(textoParaDoc(t)), t);
  });
  test("\\r\\n do Runrun vira \\n", () => {
    assert.equal(docParaTexto(textoParaDoc("a\r\nb")), "a\nb");
  });
});

describe("docParaTexto (o que o editor manda)", () => {
  test("quebra de linha dentro do parágrafo, imagem sem anexo some, marcas de texto não importam", () => {
    const doc: NoDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "linha 1" }, { type: "hardBreak" }, { type: "text", text: "linha 2" }] },
        { type: "image", attrs: { src: "https://site.com/x.png", anexo: null } },
        { type: "image", attrs: { anexo: ID, alt: "foto [1] (nova)" } },
        { type: "paragraph" },
      ],
    };
    assert.equal(docParaTexto(doc), `linha 1\nlinha 2\n${tokenImagem(ID, "foto [1] (nova)")}\n`);
    assert.equal(tokenImagem(ID, "foto [1] (nova)"), `![foto 1 nova](anexo:${ID})`);
  });
});

describe("para quem lê texto", () => {
  test("ids das imagens e texto sem a marcação", () => {
    const t = `A\n${tokenImagem(ID, "a.png")}\nB\n${tokenImagem(ID2.toUpperCase(), "b.png")}`;
    assert.deepEqual(idsDasImagens(t), [ID, ID2]);
    assert.equal(textoSemImagens(t), "A\n[imagem]\nB\n[imagem]");
    assert.equal(textoSemImagens(null), "");
  });
});

describe("toda imagem do cartão fica dentro da descrição", () => {
  const A = { id: ID, nome: "a.png" };
  const B = { id: ID2.toUpperCase(), nome: "b (1).png" };
  const tA = tokenImagem(ID, "a.png");
  const tB = tokenImagem(ID2, "b 1 .png");
  test("a que falta entra no fim, uma por linha; a que já está fica no lugar", () => {
    const t = ["Texto", tA, "mais texto", "", ""].join("\n");
    assert.equal(completarComImagens(t, [A, B]), ["Texto", tA, "mais texto", tB].join("\n"));
  });
  test("descrição vazia vira só as imagens; nada faltando devolve o mesmo texto", () => {
    assert.equal(completarComImagens("", [A, B]), [tA, tB].join("\n"));
    const t = ["x", tA].join("\n");
    assert.equal(completarComImagens(t, [A]), t);
    assert.equal(completarComImagens(t, []), t);
  });
  test("a mesma imagem duas vezes na lista entra uma vez só", () => {
    assert.equal(completarComImagens("x", [A, A]), ["x", tA].join("\n"));
  });
  test("ida e volta pelo editor mantém as imagens acrescentadas", () => {
    const t = completarComImagens(["Linha 1", "Linha 2"].join("\n"), [A, B]);
    assert.equal(docParaTexto(textoParaDoc(t)), t);
    assert.deepEqual(idsDasImagens(t), [ID, ID2]);
  });
  test("fora do texto = as que a pessoa tirou", () => {
    const t = ["x", tokenImagem(ID2, "b.png")].join("\n");
    assert.deepEqual(imagensForaDoTexto(t, [A, B]), [A]);
    assert.deepEqual(imagensForaDoTexto(completarComImagens(t, [A, B]), [A, B]), []);
  });
});

