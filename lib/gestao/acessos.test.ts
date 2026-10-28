import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chaveRecurso,
  descreverOrigem,
  ehGrupoSemEspaco,
  filtrarArvore,
  indiceRecursos,
  lerChave,
  montarArvore,
  origensComEfeito,
  planoCopia,
  type GrantPessoa,
} from "./acessos";

const espacos = [
  { id: "E2", nome: "Setores", ordem: 2 },
  { id: "E1", nome: "Unidades", ordem: 1 },
];
const pastas = [{ id: "P1", id_espaco: "E1", nome: "Serra", ordem: 0 }];
const listas = [
  { id_quadro: "Q1", nome: "Teresópolis", id_espaco: "E1", id_pasta: "P1" },
  { id_quadro: "Q2", nome: "Campos", id_espaco: "E1", id_pasta: null },
  { id_quadro: "Q3", nome: "Comercial", id_espaco: "E2", id_pasta: null },
  { id_quadro: "Q4", nome: "Solta", id_espaco: null, id_pasta: null },
  { id_quadro: "Q5", nome: "Meu Quadro — Ana", id_espaco: null, id_pasta: null, dono_email: "ana@x.com" },
];

test("árvore: espaços na ordem, pasta com as listas dela, lista sem espaço à parte e sem quadro pessoal", () => {
  const arv = montarArvore(espacos, pastas, listas);
  assert.deepEqual(arv.map((e) => e.nome), ["Unidades", "Setores", "Sem espaço"]);
  assert.deepEqual(arv[0].pastas[0].listas.map((l) => l.id), ["Q1"]);
  assert.deepEqual(arv[0].listas.map((l) => l.id), ["Q2"]);
  assert.equal(ehGrupoSemEspaco(arv[2]), true);
  assert.deepEqual(arv[2].listas.map((l) => l.id), ["Q4"], "o Meu Quadro não entra");
});

test("busca: casa no espaço mantém tudo; casa na lista mantém só o caminho até ela (sem acento)", () => {
  const arv = montarArvore(espacos, pastas, listas);
  assert.equal(filtrarArvore(arv, "unidades")[0].pastas[0].listas.length, 1);
  const r = filtrarArvore(arv, "teresopolis");
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].pastas[0].listas.map((l) => l.id), ["Q1"]);
  assert.equal(r[0].listas.length, 0);
  assert.equal(filtrarArvore(arv, "nada disso").length, 0);
});

test("índice dá nome e caminho; chave vai e volta", () => {
  const ix = indiceRecursos(montarArvore(espacos, pastas, listas));
  assert.equal(ix.get(chaveRecurso("list", "Q1"))?.caminho, "Unidades › Serra › Teresópolis");
  assert.equal(ix.get(chaveRecurso("folder", "P1"))?.caminho, "Unidades › Serra");
  assert.equal(ix.get(chaveRecurso("list", "Q4"))?.caminho, "Solta");
  assert.deepEqual(lerChave("folder:abc:1"), { tipo: "folder", id: "abc:1" });
});

test("origem que manda: a lista vale mais que o espaço; restritivo é teto; gestor vale", () => {
  const r = origensComEfeito([
    { tipo: "equipe", equipe: "Serra", recurso: "list", nome_recurso: "Teresópolis", nivel: "comment" },
    { tipo: "direto", recurso: "space", nome_recurso: "Unidades", nivel: "view_all" },
    { tipo: "direto", recurso: "space", nome_recurso: "Unidades", nivel: "view", restritivo: true },
  ]);
  assert.deepEqual(r.map((o) => o.efeito), ["vale", "sem_efeito", "teto"]);
  assert.equal(origensComEfeito([{ tipo: "gestor" }])[0].efeito, "vale");
  assert.equal(descreverOrigem(r[0]), "Equipe Serra · na lista Teresópolis");
  assert.equal(descreverOrigem(r[1]), "Direto no espaço Unidades");
});

test("copiar acessos: só os diretos da origem, sem restritivo/tarefa/equipe, pulando o que o alvo já tem", () => {
  const grants: GrantPessoa[] = [
    { usuario_email: "Ana@x.com", recurso_tipo: "space", recurso_id: "E1", nivel: "view_all" },
    { usuario_email: "ana@x.com", recurso_tipo: "list", recurso_id: "Q3", nivel: "edit" },
    { usuario_email: "ana@x.com", recurso_tipo: "list", recurso_id: "Q2", nivel: "view", restritivo: true },
    { usuario_email: "ana@x.com", recurso_tipo: "task", recurso_id: "T1", nivel: "edit" },
    { usuario_email: null, id_equipe: "EQ", recurso_tipo: "list", recurso_id: "Q1", nivel: "full" },
    { usuario_email: "bia@x.com", recurso_tipo: "list", recurso_id: "Q3", nivel: "edit" },
  ];
  const p = planoCopia("ana@x.com", ["bia@x.com", "ana@x.com", "caio@x.com"], grants);
  assert.deepEqual(
    p.map((x) => `${x.alvo} ${x.tipo}:${x.id} ${x.nivel}`),
    ["bia@x.com space:E1 view_all", "caio@x.com space:E1 view_all", "caio@x.com list:Q3 edit"],
  );
});
