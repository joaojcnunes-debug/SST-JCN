import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizarRelatorio, normalizarRelatorioCompleto } from "./normalizar-relatorio";
import { reinserirVisiveis, semSetoresOcultos, setorVisivel } from "./setores-ocultos";

type Setor = { id: string; oculto?: unknown; nome_setor?: string };

const A: Setor = { id: "a" };
const B: Setor = { id: "b", oculto: true };
const C: Setor = { id: "c" };
const D: Setor = { id: "d" };

const ids = (lista: { id: string }[]) => lista.map((s) => s.id);

test("só oculto === true esconde o setor", () => {
  assert.equal(setorVisivel({ oculto: true }), false);
  for (const s of [{}, { oculto: false }, { oculto: null }, { oculto: "true" }, null, undefined]) {
    assert.equal(setorVisivel(s), true);
  }
});

test("semSetoresOcultos tira os ocultos, aceita setores nulo e não altera o original", () => {
  const rel: { id_relatorio: string; setores: Setor[] } = { id_relatorio: "1", setores: [A, B, C] };
  assert.deepEqual(ids(semSetoresOcultos(rel).setores), ["a", "c"]);
  assert.equal(rel.setores.length, 3);
  const semLista: { setores: Setor[] | null } = { setores: null };
  assert.deepEqual(semSetoresOcultos(semLista).setores, []);
});

test("normalizarRelatorio: leitura padrão não traz oculto; a completa traz e preserva a marca", () => {
  const cru = { id_relatorio: "1", setores: [{ id: "a" }, { id: "b", oculto: true }] };
  assert.deepEqual(ids(normalizarRelatorio(cru).setores), ["a"]);
  const completo = normalizarRelatorioCompleto(cru).setores;
  assert.deepEqual(ids(completo), ["a", "b"]);
  assert.equal(completo[1].oculto, true);
  assert.equal("oculto" in completo[0], false);
});

test("desocultado volta na leitura padrão", () => {
  const cru = { id_relatorio: "1", setores: [{ id: "b", oculto: false }] };
  assert.deepEqual(ids(normalizarRelatorio(cru).setores), ["b"]);
});

test("reinserirVisiveis mantém o oculto na posição e reordena os demais", () => {
  assert.deepEqual(ids(reinserirVisiveis([A, B, C, D], [D, A, C])), ["d", "b", "a", "c"]);
});

test("reinserirVisiveis usa a versão atual do setor, não a da ordem velha", () => {
  const atual = { id: "a", nome_setor: "novo" };
  const r = reinserirVisiveis([atual, C], [C, { id: "a", nome_setor: "velho" }]);
  assert.deepEqual(r, [C, atual]);
});

test("setor ocultado depois da ordem calculada não volta a aparecer", () => {
  const r = reinserirVisiveis([A, B, C], [C, { id: "b" }, A]);
  assert.deepEqual(ids(r), ["c", "b", "a"]);
  assert.equal(r[1].oculto, true);
});

test("setor desocultado ou criado depois da ordem calculada não some nem duplica", () => {
  assert.deepEqual(ids(reinserirVisiveis([A, { id: "x" }, C], [C, A])), ["c", "a", "x"]);
});

test("setor removido depois da ordem calculada não volta", () => {
  assert.deepEqual(ids(reinserirVisiveis([A, C], [C, D, A])), ["c", "a"]);
});
