import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoRoteamento, faltasParaRoteamento, type AutomacaoRoteamento } from "./aviso-roteamento";

const P = "eb5d9daf-9b81-4903-bfd5-4fea654225e7";
const nome = (id: string) => (id === P ? "Produtos" : id);
const rot: AutomacaoRoteamento = {
  nome: "[Roteamento] Empresa nova → unidade",
  ativo: true,
  gatilho: "status_muda",
  condicao: { all: [{ op: "=", campo: "status_para", valor: "CONCLUIDO" }, { op: "in", campo: `campo:${P}`, valor: "PGR, PCMSO, LTCAT, LI, LP" }] },
  acoes: [{ tipo: "criar_tarefa_quadro", id_quadro_destino: "@unidade" }],
};

test("sem Produtos que combine: avisa o campo e os valores", () => {
  const f = faltasParaRoteamento({ etiquetas: ["nova friburgo"], campos: { [P]: ["PPP"] } }, "CONCLUIDO", [rot], nome);
  assert.equal(f.length, 1);
  assert.deepEqual(f[0].falta, ["Produtos (um destes: PGR, PCMSO, LTCAT, LI, LP)"]);
});

test("com Produtos e Região: nada a avisar; sem Região: avisa a Região", () => {
  assert.equal(faltasParaRoteamento({ etiquetas: ["nova friburgo"], campos: { [P]: ["PGR", "AEP"] } }, "CONCLUIDO", [rot], nome).length, 0);
  assert.deepEqual(faltasParaRoteamento({ etiquetas: [], campos: { [P]: ["PGR"] } }, "CONCLUIDO", [rot], nome)[0].falta, ["Região"]);
});

test("outra coluna, desligada, com OU ou sem criar tarefa: não avisa", () => {
  const c = { etiquetas: [], campos: {} };
  assert.equal(faltasParaRoteamento(c, "A_FAZER", [rot], nome).length, 0);
  assert.equal(faltasParaRoteamento(c, "CONCLUIDO", [{ ...rot, ativo: false }], nome).length, 0);
  assert.equal(faltasParaRoteamento(c, "CONCLUIDO", [{ ...rot, condicao: { ...rot.condicao, any: [{ campo: "x", op: "=", valor: "1" }] } }], nome).length, 0);
  assert.equal(faltasParaRoteamento(c, "CONCLUIDO", [{ ...rot, acoes: [{ tipo: "mover_status" }] }], nome).length, 0);
});

test("campo texto e valor em array (como o banco)", () => {
  const r = { ...rot, condicao: { all: [{ op: "=", campo: "status_para", valor: "CONCLUIDO" }, { op: "in", campo: `campo:${P}`, valor: ["PGR", "LP"] }] } };
  assert.equal(faltasParaRoteamento({ etiquetas: ["teresopolis"], campos: { [P]: "LP" } }, "CONCLUIDO", [r], nome).length, 0);
});

test("avisoRoteamento: uma frase só quando NENHUMA roda", () => {
  const treino: AutomacaoRoteamento = { ...rot, nome: "[Roteamento] Treinamento", acoes: [{ tipo: "criar_tarefa_quadro", id_quadro_destino: "QDR-T" }],
    condicao: { all: [{ op: "=", campo: "status_para", valor: "CONCLUIDO" }, { op: "in", campo: `campo:${P}`, valor: "Treinamento" }] } };
  const todas = [rot, treino];
  assert.equal(avisoRoteamento({ etiquetas: ["teresopolis"], campos: { [P]: ["Treinamento"] } }, "CONCLUIDO", todas, nome), null, "uma roda: sem aviso");
  assert.equal(avisoRoteamento({ etiquetas: ["teresopolis"], campos: {} }, "CONCLUIDO", todas, nome), "Nenhum encaminhamento vai rodar ao entrar nesta coluna: Produtos está vazio.");
  assert.match(avisoRoteamento({ etiquetas: ["teresopolis"], campos: { [P]: ["PPP"] } }, "CONCLUIDO", todas, nome) ?? "", /nenhum Produtos marcado tem encaminhamento/);
  assert.match(avisoRoteamento({ etiquetas: [], campos: { [P]: ["PGR"] } }, "CONCLUIDO", [rot], nome) ?? "", /falta a Região/);
  assert.equal(avisoRoteamento({ etiquetas: [], campos: {} }, "A_FAZER", todas, nome), null);
});
