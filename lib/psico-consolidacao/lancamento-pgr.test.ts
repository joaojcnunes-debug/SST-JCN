// Lista para lançar no PGR (fase 8) com o caso de origem: só empresa validada entra, os
// agentes existem no catálogo do SGG e a ação bate com a harmonização.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Excel from "exceljs";
import { consolidar, type ItemMotor } from "./motor";
import { sugerirSetorCanonico } from "./setores";
import { linhasLancamento, planilhaLancamento } from "./lancamento-pgr";

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
const itensRegistro = itens.map((i) => ({ id_empresa: i.idEmpresa, setor_canonico: i.setor, setor_original: i.setorOriginal }));

test("só entra empresa validada; Incluir/Alterar batem com a harmonização", SEM_FIXTURE, () => {
  const ls = linhasLancamento({ r, itens: itensRegistro, validacao: new Map([["EMP1", "VALIDADO"], ["SPE1", "COM_RESSALVA"]]), nomeEmpresa: (id) => id });
  assert.deepEqual([...new Set(ls.map((l) => l.idEmpresa))].sort(), ["EMP1", "SPE1"]);
  const emp1 = ls.filter((l) => l.idEmpresa === "EMP1");
  const lac = r.lacunas.filter((l) => l.idEmpresa === "EMP1");
  assert.equal(emp1.filter((l) => l.acao === "Incluir").length, lac.filter((l) => l.acao === "Incluir").length);
  assert.equal(emp1.filter((l) => l.acao === "Alterar nível").length, lac.filter((l) => l.acao === "Revisar nível").length);
  const simEmp1 = r.simNaoEmpresa.filter((l) => l.idEmpresa === "EMP1").reduce((n, l) => n + Object.values(l.fatores).filter(Boolean).length, 0);
  assert.equal(emp1.length, simEmp1, "uma linha por Sim da empresa");
  assert.ok(emp1.every((l) => l.agenteSgg && l.setoresNoDocumento.length > 0));
});

test("planilha: Resumo + uma aba por empresa validada", SEM_FIXTURE, async () => {
  const ls = linhasLancamento({ r, itens: itensRegistro, validacao: new Map([["EMP1", "VALIDADO"], ["SPE1", "COM_RESSALVA"]]), nomeEmpresa: (id) => id });
  const buf = await planilhaLancamento({ grupo: "G", idExecucao: "PCX-1", linhas: ls, nomeEmpresa: (id) => id, nomeFator: (id) => id, pendentes: ["EMP2"] });
  const wb = new Excel.Workbook();
  await wb.xlsx.load(buf);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Resumo", "EMP1", "SPE1"]);
  assert.equal(wb.getWorksheet("EMP1")!.rowCount, ls.filter((l) => l.idEmpresa === "EMP1").length + 1);
});
