import { test } from "node:test";
import assert from "node:assert/strict";
import { casarSetoresDoLaudo, semelhancaSetor, chaveSetor, previaDoLaudo, riscosDoLaudo, tipoDaInspecao, type RiscoGravado, type SetorDoLaudo } from "./riscos-do-laudo";

const setorAep: SetorDoLaudo = {
  id: "s1",
  nome_setor: "Administração",
  riscos: [
    { id: "r1", tipo: "Ergonômico", risco: "Postura inadequada", classificacao_risco: "De Atenção", medida_preventiva: "Pausas" },
    { id: "r2", tipo: "Acidentes", risco: "  ", classificacao_risco: "Alto" },
  ],
  checklist_organizacional: { assedio: "sim", sobrecarga: "nao" },
  aiha_organizacional: {
    assedio: { probabilidade: "Exposição elevada", severidade: "Irreversíveis", nivel: "Alto" },
    sobrecarga: { probabilidade: "Exposição moderada", severidade: "Severos", nivel: "Moderado" },
  },
};

test("tipoDaInspecao e chaveSetor", () => {
  assert.equal(tipoDaInspecao("Acidentes"), "Acidente");
  assert.equal(tipoDaInspecao("Químico"), "Químico");
  assert.equal(tipoDaInspecao(""), "Ergonômico");
  assert.equal(chaveSetor("  ADMINISTRAÇÃO  Geral "), "administracao geral");
});

test("riscosDoLaudo: riscos com nome e fatores organizacionais 'Sim' com AIHA", () => {
  const r = riscosDoLaudo("AEP", [setorAep]);
  assert.deepEqual(r.map((x) => x.chave), ["aep:s1:r1", "aep:s1:org:assedio"]);
  assert.equal(r[0].dados.nivel_risco, "Baixo");
  assert.equal(r[0].dados.medidas_recomendadas, "Pausas");
  assert.equal(r[1].dados.tipo_risco, "Psicossocial");
  assert.equal(r[1].dados.agente, "Assédio de qualquer natureza no trabalho");
  assert.equal(r[1].dados.probabilidade, "Exposição elevada");
  assert.equal(r[1].dados.nivel_risco, "Alto");
});

test("previaDoLaudo: casa o setor pelo nome; novo, igual, atualizar e fora do laudo", () => {
  const setores = [{ id_setor: "SET-1", setor_ghe: "ADMINISTRACAO" }];
  const vazia = previaDoLaudo("AEP", [setorAep], setores, []);
  assert.deepEqual(vazia.itens.map((i) => [i.situacao, i.idSetor]), [["novo", "SET-1"], ["novo", "SET-1"]]);

  const gravados: RiscoGravado[] = [
    {
      id_risco: "RSC-1", id_setor: "SET-9", origem_chave: "aep:s1:r1", tipo_risco: "Ergonômico", agente: "Postura inadequada",
      nivel_risco: "Baixo", probabilidade: null, severidade: null, medidas_recomendadas: "Pausas",
    },
    {
      id_risco: "RSC-2", id_setor: "SET-1", origem_chave: "aep:s1:org:assedio", tipo_risco: "Psicossocial",
      agente: "Assédio de qualquer natureza no trabalho", nivel_risco: "Moderado", probabilidade: "Exposição elevada",
      severidade: "Irreversíveis", medidas_recomendadas: null,
    },
    {
      id_risco: "RSC-3", id_setor: "SET-1", origem_chave: "aep:s1:velho", tipo_risco: "Físico", agente: "Ruído",
      nivel_risco: "Baixo", probabilidade: null, severidade: null, medidas_recomendadas: null,
    },
    { id_risco: "RSC-4", id_setor: "SET-1", origem_chave: null, tipo_risco: "Físico", agente: "Calor", nivel_risco: null, probabilidade: null, severidade: null, medidas_recomendadas: null },
  ];
  const p = previaDoLaudo("AEP", [setorAep], setores, gravados);
  assert.equal(p.itens[0].situacao, "igual");
  assert.equal(p.itens[0].idSetor, "SET-9", "fica no setor onde o técnico deixou");
  assert.equal(p.itens[1].situacao, "atualizar");
  assert.deepEqual(p.itens[1].mudou, ["nivel_risco"]);
  assert.deepEqual(p.foraDoLaudo.map((r) => r.id_risco), ["RSC-3"]);
});

test("previaDoLaudo: setor sem par fica para escolher", () => {
  const p = previaDoLaudo("AET", [{ id: "x", nome_setor: "Forno", riscos: [{ id: "a", tipo: "Físico", risco: "Calor", classificacao_risco: "Crítico" }] }], [{ id_setor: "SET-1", setor_ghe: "Administração" }], []);
  assert.equal(p.itens[0].idSetor, null);
  assert.equal(p.itens[0].dados.nivel_risco, "Muito Alto");
  assert.equal(p.itens[0].chave, "aet:x:a");
});

test("setor do laudo: igual vai direto, parecido vem para conferir, sem nenhum sugere criar (com o pré-cadastro)", () => {
  const insp = [{ id_setor: "S1", setor_ghe: "Administrativo" }, { id_setor: "S2", setor_ghe: "Produção" }] as never;
  const cad = [{ nome: "Expedição", descricao: "Carga e descarga" }];
  const itens = [{ setorLaudo: "PRODUCAO" }, { setorLaudo: "producao" }, { setorLaudo: "Administrativ" }, { setorLaudo: "Expedicao" }, { setorLaudo: "teste" }];
  const r = casarSetoresDoLaudo(itens, insp, cad);
  const por = Object.fromEntries(r.map((c) => [c.setorLaudo, c]));
  assert.equal(por["PRODUCAO"].como, "igual");
  assert.equal(por["PRODUCAO"].riscos, 2);
  assert.deepEqual(por["PRODUCAO"].sugestao, { tipo: "existente", idSetor: "S2" });
  assert.equal(por["Administrativ"].como, "parecido");
  assert.deepEqual(por["Administrativ"].sugestao, { tipo: "existente", idSetor: "S1" });
  assert.deepEqual(por["Expedicao"].sugestao, { tipo: "criar", nome: "Expedição", descricao: "Carga e descarga" });
  assert.deepEqual(por["teste"].sugestao, { tipo: "criar", nome: "teste", descricao: null });
  assert.equal(semelhancaSetor("Adm", "Administrativo"), 0.9);
  assert.ok(semelhancaSetor("Teste", "Loja") < 0.8);
});
