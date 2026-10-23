import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { escolherCanalEmail, linkTarefa, montarEmailAviso, type AvisoReservado } from "./avisos-email";

describe("canal do e-mail dos avisos", () => {
  test("Gmail vence o Resend e a senha de app perde os espaços", () => {
    const c = escolherCanalEmail({ GMAIL_USER: "sst@gmail.com", GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop", RESEND_API_KEY: "re_x" });
    assert.deepEqual(c, { tipo: "gmail", usuario: "sst@gmail.com", senha: "abcdefghijklmnop", nome: "SST JCN Consultoria" });
  });
  test("nome do remetente configurável", () => {
    const c = escolherCanalEmail({ GMAIL_USER: "sst@gmail.com", GMAIL_APP_PASSWORD: "x", EMAIL_REMETENTE_NOME: "Gestão JCN" });
    assert.equal(c?.tipo === "gmail" && c.nome, "Gestão JCN");
  });
  test("sem Gmail completo cai no Resend; sem nada, null", () => {
    assert.equal(escolherCanalEmail({ GMAIL_USER: "sst@gmail.com", RESEND_API_KEY: "re_x" })?.tipo, "resend");
    assert.equal(escolherCanalEmail({}), null);
  });
});

const BASE: AvisoReservado = {
  id: "1", destinatario: "ana@jcnconsultoria.com.br", nome: "Ana Souza", tipo: "atribuicao",
  titulo: "Você foi atribuído à tarefa: Trocar impressora", id_tarefa: "TRF-1", id_quadro: "QDR-1",
  tarefa_titulo: "Trocar impressora", quadro_nome: "Recepção", prazo: "2026-10-25",
};

describe("e-mail dos avisos da Gestão", () => {
  test("link abre quadro e tarefa", () => {
    assert.equal(linkTarefa("https://sst-jcn.vercel.app/", BASE), "https://sst-jcn.vercel.app/gestao?quadro=QDR-1&tarefa=TRF-1");
    assert.equal(linkTarefa("https://x.com", { id_quadro: null, id_tarefa: null }), "https://x.com/gestao");
  });

  test("assunto, saudação, tarefa, quadro e prazo em dd/mm/aaaa", () => {
    const { assunto, html } = montarEmailAviso(BASE, "https://sst-jcn.vercel.app");
    assert.equal(assunto, "[Gestão JCN Consultoria] Você foi atribuído à tarefa: Trocar impressora");
    assert.match(html, /Ana, Você foi atribuído/);
    assert.match(html, /Recepção/);
    assert.match(html, /25\/10\/2026/);
    assert.match(html, /gestao\?quadro=QDR-1&amp;tarefa=TRF-1/);
  });

  test("escapa HTML vindo do título da tarefa", () => {
    const { html } = montarEmailAviso({ ...BASE, titulo: "<script>x</script>", tarefa_titulo: "a & b" }, "https://x.com");
    assert.ok(!html.includes("<script>x</script>"));
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /a &amp; b/);
  });

  test("sem nome, sem prazo e sem quadro não quebra", () => {
    const { html } = montarEmailAviso({ ...BASE, nome: null, prazo: null, quadro_nome: null }, "https://x.com");
    assert.match(html, /<h2[^>]*>Você foi atribuído/);
    assert.ok(!html.includes("Prazo"));
  });
});
