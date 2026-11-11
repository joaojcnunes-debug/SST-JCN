import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contaProtegida,
  motivoRecusaSupervisor,
  podeEditarConta,
  podeGerirUsuarios,
  semCamposSoAdmin,
} from "./gestao-supervisor";

const admin = { perfil: "Admin", nivel: null };
const supervisor = { perfil: "Tecnico", nivel: "Aprovacao" };
const tecnico = { perfil: "Tecnico", nivel: "Operacao" };
const visualizador = { perfil: "Visualizador", nivel: null };

test("quem abre Usuários: Admin e nível Aprovação/Admin", () => {
  assert.equal(podeGerirUsuarios(admin), true);
  assert.equal(podeGerirUsuarios(supervisor), true);
  assert.equal(podeGerirUsuarios({ perfil: "Visualizador", nivel: "Admin" }), true);
  assert.equal(podeGerirUsuarios(tecnico), false);
  assert.equal(podeGerirUsuarios(visualizador), false);
  assert.equal(podeGerirUsuarios({ perfil: "Cliente", nivel: null }), false);
  assert.equal(podeGerirUsuarios(null), false);
});

test("conta protegida: Admin e supervisores", () => {
  assert.equal(contaProtegida(admin), true);
  assert.equal(contaProtegida(supervisor), true);
  assert.equal(contaProtegida(tecnico), false);
  assert.equal(contaProtegida(visualizador), false);
});

test("supervisor edita só conta comum; Admin edita todas", () => {
  assert.equal(podeEditarConta(supervisor, tecnico), true);
  assert.equal(podeEditarConta(supervisor, visualizador), true);
  assert.equal(podeEditarConta(supervisor, admin), false);
  assert.equal(podeEditarConta(supervisor, supervisor), false);
  assert.equal(podeEditarConta(admin, admin), true);
  assert.equal(podeEditarConta(admin, supervisor), true);
  assert.equal(podeEditarConta(tecnico, visualizador), false);
});

test("supervisor não dá perfil Admin nem nível de supervisão", () => {
  assert.equal(motivoRecusaSupervisor(supervisor, tecnico), null);
  assert.equal(motivoRecusaSupervisor(supervisor, visualizador), null);
  assert.match(motivoRecusaSupervisor(supervisor, { perfil: "Admin" }) ?? "", /Admin/);
  assert.match(motivoRecusaSupervisor(supervisor, { perfil: "Tecnico", nivel: "Aprovacao" }) ?? "", /supervisão/);
  assert.match(motivoRecusaSupervisor(supervisor, { perfil: "Tecnico", nivel: "Admin" }) ?? "", /supervisão/);
  assert.equal(motivoRecusaSupervisor(admin, { perfil: "Admin", nivel: "Admin" }), null);
  assert.notEqual(motivoRecusaSupervisor(tecnico, visualizador), null);
});

test("conta criada por supervisor nasce sem os campos do Admin", () => {
  const c = semCamposSoAdmin({
    nome: "X",
    pode_enviar_sgg: true,
    pode_enviar_sgg_concedido_por: "a@b",
    certificado_pfx_path: "p",
    assinatura_url: "u",
    mostrar_assinatura_imagem: true,
    tipo_certificado: "A1",
    oculto: true,
  });
  assert.deepEqual(c, { nome: "X" });
});
