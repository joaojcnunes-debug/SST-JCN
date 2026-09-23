/**
 * Prova o XLSX da Fase 8 sem banco: monta a planilha com fixture, grava, e LÊ
 * DE VOLTA o arquivo para conferir abas, linhas e a regra da coluna vazia.
 *
 * Vale a mesma armadilha do banco de provas do PDF: não basta gerar sem erro —
 * o detector precisa ser validado com um positivo conhecido. Por isso a
 * fixture tem, de propósito, uma coluna vazia em TODAS as linhas (Motivo) e
 * uma preenchida em UMA só (Responsável): a primeira tem de sumir, a segunda
 * tem de ficar.
 */
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { montarPlanilhaEquipamentos } from "@/lib/equipamentos/exportar-xlsx";

const saldo = [
  { nomeBase: "Teresópolis", item: "Fone headset", tipo: "Áudio", unidadeMedida: "un", quantidade: 8, estoqueMinimo: 10 },
  { nomeBase: "Teresópolis", item: "Mouse sem fio", tipo: null, unidadeMedida: "un", quantidade: 14, estoqueMinimo: 5 },
  { nomeBase: "Nova Friburgo", item: "Cabo HDMI", tipo: null, unidadeMedida: null, quantidade: 3, estoqueMinimo: 0 },
];

const movimentacoes = [
  { criadoEm: "2026-09-01T13:00:00Z", nomeBase: "Teresópolis", item: "Fone headset", tipo: "entrada", quantidade: 10, origem: "nota fiscal", motivo: null, responsavel: "Leandro", criadoPor: "ti@chabra" },
  { criadoEm: "2026-09-02T14:30:00Z", nomeBase: "Teresópolis", item: "Fone headset", tipo: "saida", quantidade: 2, origem: "entrega", motivo: null, responsavel: null, criadoPor: "ti@chabra" },
  { criadoEm: "2026-09-03T09:10:00Z", nomeBase: "Nova Friburgo", item: "Cabo HDMI", tipo: "entrada", quantidade: 3, origem: "transferência", motivo: null, responsavel: null, criadoPor: null },
];

const comColaborador = [
  { colaborador: "Fulana de Tal", matricula: "0042", cargo: "Técnica", nomeBase: "Teresópolis", equipamento: "Notebook Dell", numeroSerie: "SN-9931", numeroPatrimonio: "0114", status: "em_uso", entregueEm: "2026-08-20T12:00:00Z" },
  { colaborador: "Beltrano", matricula: null, cargo: null, nomeBase: "Nova Friburgo", equipamento: "Fone headset", numeroSerie: null, numeroPatrimonio: null, status: "em_uso", entregueEm: null },
];

const buf = montarPlanilhaEquipamentos({
  saldo,
  movimentacoes,
  comColaborador,
  filtroDescrito: "Todas as bases",
  movimentacoesNaTela: 2,
});

// Sai no temp do sistema, nunca dentro do repo: o arquivo é descartável.
const destino = process.argv[2] ?? path.join(tmpdir(), "equipamentos-prova.xlsx");
writeFileSync(destino, Buffer.from(buf));

// ── Leitura de volta: é isto que prova, não o "gerou sem erro" ──────────────
const wb = XLSX.read(Buffer.from(buf), { type: "buffer" });
console.log("abas:", wb.SheetNames.join(" | "));

for (const nome of wb.SheetNames) {
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1 });
  console.log(`\n[${nome}] ${linhas.length - 1} linha(s) de dado`);
  console.log("  colunas:", JSON.stringify(linhas[0]));
}

const movsAba = XLSX.utils.sheet_to_json(wb.Sheets["Movimentações"], { header: 1 });
const cabec = movsAba[0];
const temMotivo = cabec.includes("Motivo");
const temResp = cabec.includes("Responsável");

const sobre = XLSX.utils.sheet_to_json(wb.Sheets["Sobre"], { header: 1 });
const avisoExtrato = sobre.some((l) => String(l[0] ?? "") === "Extrato completo");
const avisoTransf = sobre.some((l) => String(l[0] ?? "") === "Transferência");

console.log("\n── veredito ──");
console.log("Motivo (vazio em todas) foi OMITIDO:", temMotivo ? "NÃO ❌" : "sim ✅");
console.log("Responsável (1 de 3 preenchido) FICOU:", temResp ? "sim ✅" : "NÃO ❌");
console.log("aviso 'tela x arquivo' na aba Sobre:", avisoExtrato ? "sim ✅" : "NÃO ❌");
console.log("aviso da transferência (2 linhas):", avisoTransf ? "sim ✅" : "NÃO ❌");
console.log("arquivo:", destino, Buffer.from(buf).length, "bytes");
