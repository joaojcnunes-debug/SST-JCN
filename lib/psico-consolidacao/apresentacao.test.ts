// A apresentação com o caso de origem: abre como .pptx e tem os slides do roteiro, com
// as tabelas Sim/Não paginadas em até 12 linhas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { consolidar, type ItemMotor } from "./motor";
import { sugerirSetorCanonico } from "./setores";
import { montarApresentacao } from "./apresentacao";

// O fixture é um grupo real anonimizado do painel e não vem para o JCN sem
// autorização: sem ele, os testes que dependem dos números do caso são pulados.
const FIXTURE = path.join(process.cwd(), "lib/psico-consolidacao/__fixtures__/genesis-2026-10.json");
const TEM_FIXTURE = existsSync(FIXTURE);
const SEM_FIXTURE = { skip: !TEM_FIXTURE && "fixture do grupo real ausente (lib/psico-consolidacao/__fixtures__)" };
const fx = (TEM_FIXTURE ? JSON.parse(readFileSync(FIXTURE, "utf-8")) : { itens: [] }) as { itens: Array<Omit<ItemMotor, "idEmpresa" | "setor"> & { empresa: string }> };
const FATORES = [
  "assedio", "eventos_traumaticos", "sobrecarga", "recompensas", "falta_suporte", "subcarga", "gestao_mudancas",
  "maus_relacionamentos", "baixo_controle", "clareza_papel", "comunicacao_dificil", "justica_organizacional", "trabalho_remoto",
].map((id_fator, i) => ({ id_fator, nome: id_fator, ordem: i + 1 }));
const itens: ItemMotor[] = fx.itens.map(({ empresa, ...i }) => ({ ...i, idEmpresa: empresa, setor: sugerirSetorCanonico(i.setorOriginal) }));
const empresas = [...new Set(itens.map((i) => i.idEmpresa))].map((e) => ({ idEmpresa: e, nome: e, papel: null }));
const r = consolidar({ itens, empresas, fatores: FATORES });
const png = "data:image/jpeg;base64," + readFileSync(path.join(process.cwd(), "public/apresentacao/fundo-tabela.jpg")).toString("base64");

test("apresentação: .pptx válido com o roteiro e tabelas de até 12 linhas", SEM_FIXTURE, async () => {
  const pptx = await montarApresentacao({
    grupo: "GRUPO TESTE", r, nomeEmpresa: (id) => id, nomeFator: (id) => id, nomeCurto: (id) => id,
    glossario: [{ sigla: "PGR", significado: "Programa de Gerenciamento de Riscos", explicacao: null, ordem: 1 }],
    fundos: { capa: png, tabela: png }, geradoEm: "19/10/2026",
  });
  const buf = (await pptx.stream({ compression: true })) as Uint8Array;
  assert.ok(buf.byteLength < 1_000_000, `arquivo grande demais: ${buf.byteLength}`);
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  // capa, 2 seções+3 conteúdos, 2 setores (17 → 12+5), seção empresa, 11 empresas × (Sim/Não + ajustes), glossário, fim
  assert.ok(slides.length >= 30, `poucos slides: ${slides.length}`);
  const xml = await Promise.all(slides.map((f) => zip.file(f)!.async("string")));
  const todos = xml.join("\n");
  assert.match(todos, /Consolidação dos Riscos Psicossociais/);
  assert.match(todos, /Obrigado/);
  for (const x of xml) {
    const linhas = (x.match(/<a:tr /g) ?? []).length;
    assert.ok(linhas <= 13, `tabela com ${linhas - 1} linhas num slide`);
  }
});
