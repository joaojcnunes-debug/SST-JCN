import test from "node:test";
import assert from "node:assert/strict";
import { decidirVoltar, HUB_MODULOS } from "@/lib/navegacao/voltar";

const base = { pathname: "/aep/123/dados", logoHref: "/aep" };

test("backHref explícito ganha até de histórico interno", () => {
  assert.deepEqual(
    decidirVoltar({ ...base, backHref: "/psicossocial", temHistoricoInterno: true }),
    { acao: "push", destino: "/psicossocial" },
  );
});

test("com histórico interno, volta de verdade", () => {
  assert.deepEqual(decidirVoltar({ ...base, temHistoricoInterno: true }), { acao: "back" });
});

test("aba nova numa tela interna cai na home do módulo", () => {
  assert.deepEqual(decidirVoltar({ ...base, temHistoricoInterno: false }), {
    acao: "push",
    destino: "/aep",
  });
});

test("aba nova JÁ na home do módulo cai no hub — senão o botão seguiria morto", () => {
  assert.deepEqual(
    decidirVoltar({ pathname: "/aep", logoHref: "/aep", temHistoricoInterno: false }),
    { acao: "push", destino: HUB_MODULOS },
  );
});

test("o piso NUNCA é a própria rota — nenhum layout pode devolver o pathname atual", () => {
  const layouts = [
    { pathname: "/aep", logoHref: "/aep" },
    { pathname: "/aet/9/laudo", logoHref: "/aet" },
    { pathname: "/inspecoes", logoHref: "/inspecoes" },
    { pathname: "/escala/calendario", logoHref: "/escala" },
    // Os dois pisos coincidindo com a rota: a cascata tem que descer mais.
    { pathname: "/modulos", logoHref: "/modulos" },
    { pathname: "/inicio", logoHref: "/inicio" },
  ];
  for (const l of layouts) {
    const d = decidirVoltar({ ...l, temHistoricoInterno: false });
    assert.equal(d.acao, "push");
    assert.notEqual(d.acao === "push" && d.destino, l.pathname);
  }
});
