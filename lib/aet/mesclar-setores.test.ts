import { test } from "node:test";
import assert from "node:assert/strict";
import { mesclarSetores, reordenarComo } from "./mesclar-setores";

type S = { id: string; nome?: string; parecer?: string; owas?: number[] };

test("cada tela grava só o que mudou: Setores muda o nome, Análise o parecer", () => {
  const base: S[] = [{ id: "a", nome: "Corte", parecer: "", owas: [] }];
  // A Análise salvou antes: o banco já tem o parecer e o OWAS.
  const servidor: S[] = [{ id: "a", nome: "Corte", parecer: "Ok", owas: [2] }];
  // A tela Setores (base antiga) só trocou o nome.
  const local: S[] = [{ id: "a", nome: "Corte e dobra", parecer: "", owas: [] }];
  assert.deepEqual(mesclarSetores(base, local, servidor), [{ id: "a", nome: "Corte e dobra", parecer: "Ok", owas: [2] }]);
});

test("setor criado na tela entra; apagado na tela sai; criado por outra tela continua", () => {
  const base: S[] = [{ id: "a" }, { id: "b" }];
  const servidor: S[] = [{ id: "a" }, { id: "b" }, { id: "c", nome: "Novo da outra tela" }];
  const local: S[] = [{ id: "b" }, { id: "d", nome: "Novo desta tela" }];
  assert.deepEqual(mesclarSetores(base, local, servidor), [
    { id: "b" },
    { id: "d", nome: "Novo desta tela" },
    { id: "c", nome: "Novo da outra tela" },
  ]);
});

test("a ordem é a da tela", () => {
  const base: S[] = [{ id: "a" }, { id: "b" }];
  const servidor: S[] = [{ id: "a", parecer: "x" }, { id: "b" }];
  const local: S[] = [{ id: "b" }, { id: "a" }];
  assert.deepEqual(mesclarSetores(base, local, servidor), [{ id: "b" }, { id: "a", parecer: "x" }]);
});

test("setor apagado por outra tela só volta se esta tela mexeu nele", () => {
  const base: S[] = [{ id: "a", nome: "A" }, { id: "b", nome: "B" }];
  const servidor: S[] = [];
  const local: S[] = [{ id: "a", nome: "A" }, { id: "b", nome: "B editado" }];
  assert.deepEqual(mesclarSetores(base, local, servidor), [{ id: "b", nome: "B editado" }]);
});

test("arrasto: grava a versão salva na ordem nova, sem edições nem setores não salvos", () => {
  const salvos: S[] = [{ id: "a", nome: "A" }, { id: "b", nome: "B" }, { id: "c", nome: "C" }];
  // Na tela: B foi editado sem salvar, D é novo e ainda não foi salvo; ordem C, D, B, A.
  const ordem = ["c", "d", "b", "a"];
  assert.deepEqual(reordenarComo(salvos, ordem), [{ id: "c", nome: "C" }, { id: "b", nome: "B" }, { id: "a", nome: "A" }]);
});

test("arrasto: setor salvo que sumiu da tela vai para o fim", () => {
  const salvos: S[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(reordenarComo(salvos, ["c", "a"]).map((s) => s.id), ["c", "a", "b"]);
});

test("os dois mudaram o mesmo campo: vale quem salva agora", () => {
  const base: S[] = [{ id: "a", parecer: "" }];
  const servidor: S[] = [{ id: "a", parecer: "da Análise" }];
  const local: S[] = [{ id: "a", parecer: "dos Setores" }];
  assert.deepEqual(mesclarSetores(base, local, servidor), [{ id: "a", parecer: "dos Setores" }]);
});
