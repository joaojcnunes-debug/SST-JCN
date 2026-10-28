import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NIVEIS_ORDENADOS,
  eixosDoNivel,
  nivelDosEixos,
  nivelPodeComentar,
  nivelPodeEditar,
  nivelPodeVer,
  nivelVeTodas,
  rotuloNivel,
  type AcaoNivel,
  type AlcanceNivel,
} from "./niveis";

test("níveis antigos mantêm o significado do banco (full edita e vê todas; edit vê só as dele)", () => {
  assert.deepEqual(eixosDoNivel("full"), { alcance: "todas", acao: "editar" });
  assert.deepEqual(eixosDoNivel("edit"), { alcance: "proprias", acao: "editar" });
  assert.deepEqual(eixosDoNivel("view"), { alcance: "proprias", acao: "ver" });
  assert.deepEqual(eixosDoNivel("comment"), { alcance: "proprias", acao: "comentar" });
});

test("os dois eixos cobrem as 6 combinações, cada uma num nível só", () => {
  const vistos = new Set<string>();
  for (const alcance of ["todas", "proprias"] as AlcanceNivel[]) {
    for (const acao of ["ver", "comentar", "editar"] as AcaoNivel[]) {
      const n = nivelDosEixos(alcance, acao);
      assert.deepEqual(eixosDoNivel(n), { alcance, acao });
      vistos.add(n);
    }
  }
  assert.equal(vistos.size, 6);
  assert.deepEqual([...vistos].sort(), [...NIVEIS_ORDENADOS].sort());
});

test("capacidades: view_all vê tudo mas não comenta nem edita; comment_all comenta", () => {
  assert.equal(nivelVeTodas("view_all"), true);
  assert.equal(nivelPodeEditar("view_all"), false);
  assert.equal(nivelPodeComentar("view_all"), false);
  assert.equal(nivelPodeComentar("comment_all"), true);
  assert.equal(nivelPodeEditar("comment_all"), false);
  assert.equal(nivelVeTodas("edit"), false);
  assert.equal(nivelPodeEditar("edit"), true);
  assert.equal(nivelPodeVer(null), false);
  assert.equal(nivelPodeEditar(undefined), false);
});

test("rótulo curto diz o alcance e a ação", () => {
  assert.equal(rotuloNivel("full"), "Todas as tarefas · ver e editar");
  assert.equal(rotuloNivel("view"), "Só as próprias · só ver");
});
