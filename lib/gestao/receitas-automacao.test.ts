import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { receitasDoQuadro } from "./receitas-automacao";
import { regraCompleta } from "./automacao-completa";

const STATUS = [
  { slug: "A_FAZER", nome: "A fazer", tipo: "nao_iniciado", ordem: 0 },
  { slug: "EM_ANDAMENTO", nome: "Em andamento", tipo: "ativo", ordem: 1 },
  { slug: "EM_REVISAO", nome: "Em revisão", tipo: "ativo", ordem: 2 },
  { slug: "CONCLUIDO", nome: "Concluído", tipo: "concluido", ordem: 3 },
];

describe("receitas de automação (v300)", () => {
  test("usam os status do quadro", () => {
    const r = receitasDoQuadro(STATUS);
    const conc = r.find((x) => x.id === "concluida-avisar")!;
    assert.deepEqual(conc.condicao.all, [{ campo: "status_para", op: "=", valor: "CONCLUIDO" }]);
    assert.equal(r.find((x) => x.id === "revisao-aprovacao")?.condicao.all?.[0].valor, "EM_REVISAO");
    assert.equal(r.find((x) => x.id === "dependencia-liberada")?.acoes[0].valor, "A_FAZER");
  });
  test("todas nascem completas, menos a que precisa de pessoas", () => {
    for (const x of receitasDoQuadro(STATUS)) {
      assert.equal(regraCompleta(x.gatilho, x.condicao, x.acoes), x.id !== "rodizio-novas", x.id);
    }
  });
  test("quadro sem status de revisão ou concluído não oferece as receitas que dependem deles", () => {
    const ids = receitasDoQuadro([{ slug: "X", nome: "Aberta", tipo: "ativo", ordem: 0 }]).map((x) => x.id);
    assert.equal(ids.includes("concluida-avisar"), false);
    assert.equal(ids.includes("revisao-aprovacao"), false);
    assert.equal(ids.includes("dependencia-liberada"), true);
  });
});
