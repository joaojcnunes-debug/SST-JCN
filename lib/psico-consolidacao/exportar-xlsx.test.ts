// As três planilhas com o caso real de um grupo do painel (anonimizado): abas certas, fórmulas com o
// resultado já calculado e os números do pedido onde eles aparecem.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Excel from "exceljs";
import { consolidar, type ItemMotor } from "./motor";
import { sugerirSetorCanonico } from "./setores";
import { planilhaAnalise, planilhaConfronto, planilhaHarmonizacao, type DadosPlanilha } from "./exportar-xlsx";

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
const d: DadosPlanilha = {
  grupo: "GRUPO TESTE",
  r,
  itens,
  nomeEmpresa: (id) => id,
  nomeFator: (id) => id,
  documentos: empresas
    .filter((e) => e.idEmpresa.startsWith("SPE"))
    .map((e) => ({ id: e.idEmpresa, origem: "AEP", idEmpresa: e.idEmpresa, titulo: "AEP", status: "CONCLUIDO", data: "2026-09-17", responsavel: null, necessitaAet: true, setores: 5 })),
  empresasInfo: [],
};

async function abrir(buf: ArrayBuffer) {
  const wb = new Excel.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}
const resultado = (v: unknown) => (v && typeof v === "object" && "result" in v ? (v as { result: number }).result : v);

test("análise: abas do pedido e Matriz resumo calculada da Base", SEM_FIXTURE, async () => {
  const wb = await abrir(await planilhaAnalise(d));
  assert.deepEqual(wb.worksheets.map((w) => w.name), [
    "Visão geral", "Matriz resumo", "Unânimes", "Intermediários", "Exclusivos", "Pontos de atenção", "Base",
  ]);
  const m = wb.getWorksheet("Matriz resumo")!;
  const nCol = m.getRow(1).cellCount;
  const recompensas = m.getRow(2);
  assert.equal(recompensas.getCell(1).value, "recompensas");
  assert.match(String((recompensas.getCell(2).value as { formula: string }).formula), /^COUNTIFS\(Base!/);
  assert.equal(resultado(recompensas.getCell(nCol - 1).value), 6);
  assert.equal(recompensas.getCell(nCol).value, "Unânime");
  assert.equal(wb.getWorksheet("Base")!.rowCount, 73, "72 linhas da AEP + cabeçalho");
});

test("confronto: Resumo conta da Lista 18/14/5/77/90", SEM_FIXTURE, async () => {
  const wb = await abrir(await planilhaConfronto(d));
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Resumo", "Matriz", "Lista", "Base AEP", "Base DRPS"]);
  const res = wb.getWorksheet("Resumo")!;
  assert.deepEqual([2, 3, 4, 5, 6].map((l) => resultado(res.getCell(l, 2).value)), [18, 14, 5, 77, 90]);
  assert.equal(wb.getWorksheet("Lista")!.rowCount, 205);
  assert.equal(wb.getWorksheet("Base DRPS")!.rowCount, 493);
});

test("harmonização: lacunas 301 + 25 e Sim/Não por empresa com 65 linhas", SEM_FIXTURE, async () => {
  const wb = await abrir(await planilhaHarmonizacao(d));
  assert.deepEqual(wb.worksheets.map((w) => w.name), [
    "Parecer", "Perfil do setor", "Matriz por empresa", "Lacunas", "Sim-Não setor", "Sim-Não empresa",
  ]);
  const lac = wb.getWorksheet("Lacunas")!;
  const acoes: Record<string, number> = {};
  for (let i = 2; i <= lac.rowCount; i++) acoes[String(lac.getCell(i, 4).value)] = (acoes[String(lac.getCell(i, 4).value)] ?? 0) + 1;
  assert.deepEqual(acoes, { Incluir: 301, "Revisar nível": 25 });
  assert.equal(wb.getWorksheet("Sim-Não empresa")!.rowCount, 66);
  // a célula colorida leva o preenchimento
  const perfil = wb.getWorksheet("Perfil do setor")!;
  let pintadas = 0;
  perfil.eachRow((row, n) => n > 1 && row.eachCell((c) => { if (c.fill && (c.fill as { fgColor?: unknown }).fgColor) pintadas++; }));
  assert.equal(pintadas, r.perfil.length + r.avaliacaoPropria.length);
});
