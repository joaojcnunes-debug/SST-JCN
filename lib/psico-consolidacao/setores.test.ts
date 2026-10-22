import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveSetor, sugerirSetorCanonico } from "./setores";

test("regras do caso de origem (seção 4.2)", () => {
  const casos: Array<[string, string]> = [
    ["CANTEIRO DE OBRAS - ELETRICA", "Elétrica"],
    ["CANTEIRO DE OBRA - CARPINTARIA", "Carpintaria"],
    ["OBRA - ELETRICA", "Elétrica"],
    ["OBRA - ELÉTRICA", "Elétrica"],
    ["ELÉTRICA - ALTURA", "Elétrica"],
    ["CARPINTARIA C/ALTURA", "Carpintaria"],
    ["ENGENHARIA S/ALTURA", "Engenharia"],
    ["MÁQUINA", "Máquinas"],
    ["MAQUINAS", "Máquinas"],
    ["Administrativo", "Administrativo (canteiro)"],
    ["Canteiro – Administrativo", "Administrativo (canteiro)"],
    ["OBRA - ADMINISTRATIVO", "Administrativo (canteiro)"],
    ["CANTEIRO DE OBRA - ADMINISTRATIVO", "Administrativo (canteiro)"],
    ["ADMINISTRATIVO / ESCRITÓRIO", "Escritório"],
    ["ESCRITÓRIO - HIGIENIZAÇÃO", "Escritório"],
    ["ENGENHARIA / SEGURANÇA DO TRABALHO", "Engenharia/Seg. Trabalho"],
    ["ELÉTRICA/HIDRÁULICA", "Elétrica/Hidráulica"],
    ["ALVENARIA / ESCAVAÇÃO", "Alvenaria/Escavação"],
    ["OBRA", "Obra (geral)"],
    ["SEGURANÇA DO TRABALHO", "Segurança do Trabalho"],
    ["ALMOXARIFADO", "Almoxarifado"],
  ];
  for (const [original, esperado] of casos) {
    assert.equal(sugerirSetorCanonico(original), esperado, original);
  }
});

test("vazio não inventa setor", () => {
  assert.equal(sugerirSetorCanonico(""), "");
  assert.equal(sugerirSetorCanonico(null), "");
  assert.equal(sugerirSetorCanonico("   "), "");
});

test("chave ignora acento, caixa, travessão e espaço em volta da barra", () => {
  assert.equal(chaveSetor(" Elétrica / Hidráulica "), chaveSetor("ELETRICA/HIDRAULICA"));
  assert.equal(chaveSetor("Canteiro – Administrativo"), "CANTEIRO - ADMINISTRATIVO");
});
