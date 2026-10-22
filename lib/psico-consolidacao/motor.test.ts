// Motor da Consolidação de Grupo contra o caso real de um grupo do painel (anonimizado).
//
// A fixture saiu da cópia do banco de 19/10/2026 (AEPs das 6 SPEs + QAP das 5
// empregadoras), pelo mesmo leitor da tela, ANONIMIZADA: SPE1..SPE6 = SPEs com AEP,
// EMP1..EMP5 = empresas com questionário, na ordem do nome. Os números esperados são
// os critérios de aceite do pedido (seção 9) e do complemento (4.3.1).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { consolidar, nivelAihaPelaRegra, type ItemMotor } from "./motor";
import { sugerirSetorCanonico } from "./setores";

// O fixture é um grupo real anonimizado do painel e não vem para o JCN sem
// autorização: sem ele, os testes que dependem dos números do caso são pulados.
const FIXTURE = path.join(process.cwd(), "lib/psico-consolidacao/__fixtures__/genesis-2026-10.json");
const TEM_FIXTURE = existsSync(FIXTURE);
const SEM_FIXTURE = { skip: !TEM_FIXTURE && "fixture do grupo real ausente (lib/psico-consolidacao/__fixtures__)" };
const fx = (TEM_FIXTURE ? JSON.parse(readFileSync(FIXTURE, "utf-8")) : { itens: [] }) as { itens: Array<Omit<ItemMotor, "idEmpresa" | "setor"> & { empresa: string }> };

const FATORES = [
  "assedio", "eventos_traumaticos", "sobrecarga", "recompensas", "falta_suporte", "subcarga", "gestao_mudancas",
  "maus_relacionamentos", "baixo_controle", "clareza_papel", "comunicacao_dificil", "justica_organizacional",
  "trabalho_remoto",
].map((id_fator, i) => ({ id_fator, nome: id_fator, ordem: i + 1 }));

const itens: ItemMotor[] = fx.itens.map(({ empresa, ...i }) => ({
  ...i,
  idEmpresa: empresa,
  setor: sugerirSetorCanonico(i.setorOriginal),
}));
const empresas = [...new Set(itens.map((i) => i.idEmpresa))].map((e) => ({
  idEmpresa: e,
  nome: e,
  papel: e.startsWith("SPE") ? "SPE" : "EXECUTORA",
}));
const r = consolidar({ itens, empresas, fatores: FATORES });
const comuns = r.setores.filter((s) => s.comum).map((s) => s.setor);
const contar = (l: unknown[]) => l.length;

test("fontes: 72 linhas da AEP (6 SPEs) e 492 do questionário (41 setores × 12 fatores)", SEM_FIXTURE, () => {
  assert.equal(itens.filter((i) => i.origem === "AEP").length, 72);
  assert.equal(new Set(itens.filter((i) => i.origem === "AEP").map((i) => i.idEmpresa)).size, 6);
  assert.equal(itens.filter((i) => i.origem === "QPS").length, 492);
  assert.equal(r.fatores.length, 12, "o 13º (trabalho remoto) não foi marcado: fica fora");
});

test("comparativo AEP: nº de SPEs por fator e classe", SEM_FIXTURE, () => {
  const n = Object.fromEntries(r.comparativoAep.fatores.map((f) => [f.idFator, [f.empresas.length, f.classe]]));
  assert.deepEqual(n, {
    recompensas: [6, "Unânime"],
    sobrecarga: [5, "Parcial"],
    baixo_controle: [5, "Parcial"],
    falta_suporte: [5, "Parcial"],
    gestao_mudancas: [4, "Parcial"],
    clareza_papel: [3, "Parcial"],
    subcarga: [3, "Parcial"],
    eventos_traumaticos: [2, "Parcial"],
    comunicacao_dificil: [1, "Exclusivo"],
  });
  assert.deepEqual(r.comparativoAep.fatores.find((f) => f.idFator === "comunicacao_dificil")!.empresas, ["SPE6"]);
});

test("fator sem sinal: Falta de suporte em HUB (Obra, Hidráulica) e NOF (Alvenaria/Escavação)", SEM_FIXTURE, () => {
  const semSinal = r.alertas
    .filter((a) => a.tipo === "fator_sem_sinal")
    .map((a) => `${a.idEmpresa}|${sugerirSetorCanonico(a.setor)}|${a.idFator}`)
    .sort();
  assert.deepEqual(semSinal, [
    "SPE3|Hidráulica|falta_suporte",
    "SPE3|Obra (geral)|falta_suporte",
    "SPE5|Alvenaria/Escavação|falta_suporte",
  ]);
});

test("AIHA pela regra (4.3.1): Trivial 3 · Baixo 43 · Moderado 26", SEM_FIXTURE, () => {
  const dist: Record<string, number> = {};
  for (const i of itens.filter((x) => x.origem === "AEP")) {
    const n = nivelAihaPelaRegra(i.idFator, i.sinais.length);
    dist[n] = (dist[n] ?? 0) + 1;
  }
  assert.deepEqual(dist, { Trivial: 3, Baixo: 43, Moderado: 26 });
  assert.equal(nivelAihaPelaRegra("assedio", 5), "Muito Alto");
  assert.equal(nivelAihaPelaRegra("sobrecarga", 4), "Alto");
});

test("questionário: Crítico 45 · Médio 151 · Baixo 296 (nenhum Alto); Sobrecarga 18/22/1", SEM_FIXTURE, () => {
  assert.deepEqual(r.drps.total, { Crítico: 45, Alto: 0, Médio: 151, Baixo: 296 });
  assert.deepEqual(r.drps.porFator.sobrecarga, { Crítico: 18, Alto: 0, Médio: 22, Baixo: 1 });
});

test("confronto AEP × DRPS: 204 células, 18/14/5/77/90", SEM_FIXTURE, () => {
  assert.equal(r.confronto.celulas.length, 204);
  assert.deepEqual(r.confronto.totais, {
    Convergente: 18, Divergente: 14, "Só AEP": 5, "Só DRPS": 77, "Sem indicação": 90,
  });
  assert.deepEqual(
    r.confronto.porFator.filter((f) => f.presenca === "Só no DRPS").map((f) => f.idFator).sort(),
    ["assedio", "justica_organizacional", "maus_relacionamentos"],
  );
});

test("harmonização: 12 setores comuns e 5 de uma empresa só", SEM_FIXTURE, () => {
  assert.deepEqual(comuns.sort(), [
    "Administrativo (canteiro)", "Almoxarifado", "Alvenaria/Escavação", "Carpintaria", "Elétrica",
    "Elétrica/Hidráulica", "Engenharia", "Engenharia/Seg. Trabalho", "Escritório", "Hidráulica", "Máquinas",
    "Segurança do Trabalho",
  ]);
  const unicos = Object.fromEntries(r.setores.filter((s) => !s.comum).map((s) => [s.setor, s.empresas]));
  assert.deepEqual(unicos, {
    Arquitetura: ["EMP5"],
    Concreto: ["SPE2"],
    Gessaria: ["SPE2"],
    "Incorporação": ["EMP3"],
    "Obra (geral)": ["SPE3"],
  });
});

test("harmonização: 301 Incluir · 25 Revisar nível; 65 linhas empresa × setor", SEM_FIXTURE, () => {
  assert.equal(r.resumo.incluir, 301);
  assert.equal(r.resumo.revisar, 25);
  assert.equal(contar(r.simNaoEmpresa), 65);
});

test("perfil: fatores em todos os comuns e setores com os 12 fatores", SEM_FIXTURE, () => {
  const emTodos = r.fatores
    .filter((f) => comuns.every((s) => r.perfil.some((p) => p.setor === s && p.idFator === f.id_fator)))
    .map((f) => f.id_fator);
  assert.deepEqual(emTodos.sort(), ["assedio", "eventos_traumaticos", "sobrecarga"]);
  const completos = comuns.filter((s) => r.perfil.filter((p) => p.setor === s).length === 12);
  assert.deepEqual(completos.sort(), ["Almoxarifado", "Elétrica", "Máquinas"]);
});

test("parâmetro aep_incluir_trivial_baixo: perfil cai de 101 para 91", SEM_FIXTURE, () => {
  assert.equal(r.perfil.length, 101);
  const semTrivial = consolidar({ itens, empresas, fatores: FATORES, aepIncluirTrivialBaixo: false });
  assert.equal(semTrivial.perfil.length, 91);
});

test("lacuna mostra em quais empresas o risco foi achado, do mais grave ao menos grave", SEM_FIXTURE, () => {
  const revisar = r.lacunas.find((l) => l.acao === "Revisar nível")!;
  assert.equal(revisar.situacao, "Médio");
  assert.equal(revisar.perfil, "Crítico");
  assert.equal(revisar.fontes[0].nivel, "Crítico");
});

test("setor que não transita sai da harmonização", SEM_FIXTURE, () => {
  const x = consolidar({ itens, empresas, fatores: FATORES, setoresSemTransito: ["Elétrica"] });
  assert.equal(x.setores.find((s) => s.setor === "Elétrica")!.comum, false);
  assert.ok(x.lacunas.every((l) => l.setor !== "Elétrica"));
});

test("SPE nunca é cobrada por DRPS; empregadora sem DRPS gera alerta", SEM_FIXTURE, () => {
  assert.equal(r.alertas.filter((a) => a.tipo === "empregadora_sem_drps").length, 0);
  const x = consolidar({
    itens,
    empresas: [...empresas, { idEmpresa: "EMP9", nome: "EMP9", papel: "EXECUTORA" }, { idEmpresa: "SPE9", nome: "SPE9", papel: "SPE" }],
    fatores: FATORES,
  });
  assert.deepEqual(x.alertas.filter((a) => a.tipo === "empregadora_sem_drps").map((a) => a.idEmpresa), ["EMP9"]);
});

test("regras de nível: Alto entra, Baixo não; maior nível vence; Identificado não pede revisão", SEM_FIXTURE, () => {
  const base = { setorOriginal: "x", sinais: ["s"], semSinal: false, nivelAiha: "Moderado", confianca: null, respondentes: 5, probabilidadeInformada: true };
  const x = consolidar({
    empresas: ["A", "B", "C"].map((e) => ({ idEmpresa: e, nome: e, papel: null })),
    fatores: FATORES,
    itens: [
      { ...base, idEmpresa: "A", origem: "QPS", setor: "S", idFator: "assedio", nivel: "Alto" },
      { ...base, idEmpresa: "A", origem: "QPS", setor: "S", idFator: "assedio", nivel: "Médio" },
      { ...base, idEmpresa: "B", origem: "QPS", setor: "S", idFator: "assedio", nivel: "Médio" },
      { ...base, idEmpresa: "C", origem: "AEP", setor: "S", idFator: "assedio", nivel: "Identificado" },
      { ...base, idEmpresa: "B", origem: "QPS", setor: "S", idFator: "sobrecarga", nivel: "Baixo" },
    ],
  });
  assert.deepEqual(x.perfil.map((p) => [p.idFator, p.nivel]), [["assedio", "Alto"]]);
  const acao = Object.fromEntries(x.lacunas.map((l) => [l.idEmpresa, l.acao]));
  assert.deepEqual(acao, { A: "OK", B: "Revisar nível", C: "OK" });
});
