import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { grupoDaMesmaRaiz, ordenarMembros, papelPeloCnpj, raizCnpj, sugestoesPorRaiz } from "./grupos";

describe("raizCnpj / papelPeloCnpj", () => {
  test("lê a raiz e a ordem com ou sem máscara", () => {
    assert.equal(raizCnpj("12.345.678/0001-90"), "12345678");
    assert.equal(raizCnpj("12345678000290"), "12345678");
    assert.equal(papelPeloCnpj("12.345.678/0001-90"), "MATRIZ");
    assert.equal(papelPeloCnpj("12.345.678/0002-71"), "FILIAL");
  });
  test("não adivinha sem CNPJ completo", () => {
    assert.equal(raizCnpj(null), null);
    assert.equal(raizCnpj("123.456.789-00"), null);
    assert.equal(papelPeloCnpj(""), null);
  });
});

describe("ordenarMembros", () => {
  test("matriz primeiro, depois por nome", () => {
    const r = ordenarMembros([
      { papel_grupo: "FILIAL" as const, nome_empresa: "B" },
      { papel_grupo: "FILIAL" as const, nome_empresa: "A" },
      { papel_grupo: "MATRIZ" as const, nome_empresa: "Z" },
    ]);
    assert.deepEqual(r.map((m) => m.nome_empresa), ["Z", "A", "B"]);
  });
});

describe("sugestoesPorRaiz", () => {
  const e = (id: string, cnpj: string | null, id_grupo: string | null = null) => ({
    id_empresa: id, cnpj, nome_empresa: id, id_grupo,
  });
  test("sugere só raízes com 2+ empresas sem grupo e aponta a 0001", () => {
    const s = sugestoesPorRaiz([
      e("A", "11.111.111/0002-00"),
      e("B", "11.111.111/0001-00"),
      e("C", "22.222.222/0001-00"),
      e("D", "33.333.333/0001-00", "GRP-1"),
      e("E", "33.333.333/0002-00"),
      e("F", "44.444.444/0001-00"),
      e("G", "44444444000100"),
    ]);
    assert.equal(s.length, 1);
    assert.equal(s[0].raiz, "11111111");
    assert.equal(s[0].matriz?.id_empresa, "B");
  });
});

describe("grupoDaMesmaRaiz", () => {
  const membros = [{ id_empresa: "A", id_grupo: "GRP-1", cnpj: "11.111.111/0001-00", nome_empresa: "A" }];
  test("acha o grupo pela raiz, ignorando a própria empresa", () => {
    assert.equal(grupoDaMesmaRaiz("11111111000299", membros)?.id_grupo, "GRP-1");
    assert.equal(grupoDaMesmaRaiz("11111111000100", membros, "A"), null);
    assert.equal(grupoDaMesmaRaiz("99999999000100", membros), null);
  });
});
