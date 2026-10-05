import { test } from "node:test";
import assert from "node:assert/strict";

import { chaveNome, montarCatalogoSetores } from "./catalogo-setores";

test("nome igual com acento/maiúscula/espaço vira um setor só, com os cargos somados", () => {
  const cat = montarCatalogoSetores(
    [
      { id_setor: "S1", setor_ghe: "Produção", descricao: null },
      { id_setor: "S2", setor_ghe: "  PRODUCAO ", descricao: "Linha de montagem" },
      { id_setor: "S3", setor_ghe: "Administrativo", descricao: "Escritório" },
      { id_setor: "S4", setor_ghe: "", descricao: null },
    ],
    [
      { id_setor: "S1", cargo: "Operador", descricao: "" },
      { id_setor: "S2", cargo: "operador", descricao: "Opera a prensa" },
      { id_setor: "S2", cargo: "Líder", descricao: null },
      { id_setor: "S3", cargo: "Auxiliar", descricao: null },
      { id_setor: "S9", cargo: "Fantasma", descricao: null },
    ],
  );
  assert.deepEqual(cat.map((s) => s.nome), ["Administrativo", "Produção"]);
  const prod = cat[1];
  assert.equal(prod.descricao, "Linha de montagem");
  assert.deepEqual(prod.cargos, [
    { cargo: "Líder", descricao: "" },
    { cargo: "Operador", descricao: "Opera a prensa" },
  ]);
});

test("chaveNome", () => {
  assert.equal(chaveNome("  Produção   Geral "), "producao geral");
  assert.equal(chaveNome(null), "");
});
