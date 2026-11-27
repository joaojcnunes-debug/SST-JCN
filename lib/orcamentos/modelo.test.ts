import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataPorExtenso,
  essencialVazio,
  fmtBRL,
  modeloSugerido,
  pendencias,
  precoDoCatalogo,
  produtosDosItens,
  rotuloNumero,
  servicosDoEssencial,
  sugerirItens,
  totalOrcamento,
  type PrecoCatalogo,
} from "./modelo";

const preco = (tipo: PrecoCatalogo["tipo"], nome: string, valor: number, unidade = "unidade"): PrecoCatalogo =>
  ({ id_preco: nome, tipo, nome, descricao: null, unidade, valor, ativo: true, ordem: 0 });

test("Plano Essencial: 20 serviços; CIPA quando aplicável, incluído ou fora; removidos e extras", () => {
  const e = essencialVazio();
  assert.equal(servicosDoEssencial(e).length, 20);
  assert.equal(servicosDoEssencial({ ...e, cipa: "incluido" }).find((s) => s.titulo.startsWith("Designado"))!.descricao, "Incluído no plano");
  assert.equal(servicosDoEssencial({ ...e, cipa: "sem" }).some((s) => s.titulo.includes("CIPA")), false);
  const r = servicosDoEssencial({ ...e, servicosRemovidos: ["AEP", "PAE"], servicosExtras: [{ titulo: "Visita técnica", descricao: "1 vez ao mês" }, { titulo: " ", descricao: "" }] });
  assert.equal(r.length, 19);
  assert.equal(r.at(-1)!.titulo, "Visita técnica");
});

test("contas e formatos", () => {
  assert.equal(totalOrcamento("essencial", { data: "2026-11-27", essencial: { ...essencialVazio(), valorMensal: 250 } }), 250);
  assert.equal(totalOrcamento("treinamentos", { data: "2026-11-27", itens: [
    { id: "1", descricao: "NR-01", quantidade: 12, unidade: "por participante", valor: 30 },
    { id: "2", descricao: "NR-06", quantidade: 6, unidade: "por participante", valor: 60 },
  ] }), 720);
  assert.equal(fmtBRL(1234.5), "R$ 1.234,50");
  assert.equal(dataPorExtenso("Teresópolis", "2026-11-27"), "Teresópolis, 27 de novembro de 2026.");
  assert.equal(dataPorExtenso("", "2026-03-05"), "5 de março de 2026.");
  assert.equal(rotuloNumero({ numero: 12, versao: 1 }), "Nº 0012");
  assert.equal(rotuloNumero({ numero: 12, versao: 3 }), "Nº 0012 · v3");
});

test("pendências: nada é gerado sem valor", () => {
  assert.deepEqual(pendencias("essencial", "Cliente", { data: "x", essencial: essencialVazio() }), ["Informe o valor mensal."]);
  assert.deepEqual(pendencias("treinamentos", "", { data: "x", itens: [{ id: "1", descricao: "NR-01", quantidade: 0, unidade: "", valor: 0 }] }),
    ["Informe o cliente.", "1 item está sem valor.", "Há treinamento sem número de participantes."]);
  assert.deepEqual(pendencias("avulso", "C", { data: "x", itens: [{ id: "1", descricao: "AET", quantidade: 1, unidade: "", valor: 1250 }] }), []);
});

test("sugestão a partir das oportunidades, com o preço do catálogo quando o nome casa", () => {
  const cat = [preco("treinamento", "NR-35 Trabalho em Altura", 150, "por participante"), preco("servico", "AET", 1250), preco("treinamento", "Inativo", 9)];
  cat[2].ativo = false;
  const itens = sugerirItens([
    { produto: "Treinamentos NR", nomeProduto: "Treinamentos NR", detalhes: ["NR-35 trabalho em altura", "NR-10 Eletricidade"], setores: [] },
    { produto: "AET", nomeProduto: "AET – Análise Ergonômica do Trabalho", detalhes: [], setores: [{ nome: "Açougue", expostos: 15 }] },
    { produto: "Intervenção psicossocial", nomeProduto: "Intervenção psicossocial", detalhes: [], setores: [],
      intervencoes: [{ idItem: "CAI-1", setor: "Adm", risco: "Assédio", intervencao: "Treinamento Assédio", modalidade: "EAD" }] },
  ], cat);
  assert.deepEqual(itens.map((i) => [i.descricao, i.valor, i.quantidade, i.unidade]), [
    ["NR-35 Trabalho em Altura", 150, 1, "por participante"],
    ["NR-10 Eletricidade", 0, 1, "por participante"],
    ["AET – Análise Ergonômica do Trabalho", 1250, 1, "por setor"],
    ["Treinamento Assédio", 0, 1, "unidade"],
  ]);
  assert.equal(itens[2].detalhe, "Açougue · 15 trabalhadores expostos");
  assert.equal(itens[3].idItem, "CAI-1");
  assert.equal(precoDoCatalogo(cat, "Inativo"), undefined);
  assert.equal(modeloSugerido([{ produto: "Treinamentos NR" }]), "treinamentos");
  assert.equal(modeloSugerido([{ produto: "Treinamentos NR" }, { produto: "AET" }]), "avulso");
  assert.deepEqual(produtosDosItens(itens), [
    { produto: "Treinamentos NR", idItens: [] },
    { produto: "AET", idItens: [] },
    { produto: "Intervenção psicossocial", idItens: ["CAI-1"] },
  ]);
});

test("notas internas da equipe não vão para o orçamento", () => {
  const itens = sugerirItens([{ produto: "Apreciação NR-12", nomeProduto: "Apreciação de Máquinas (NR-12)", setores: [],
    detalhes: ["Prensa Hidráulica 50T (grau alto)", "Há 4 rascunhos de Apreciação parados — não conta como em andamento"] },
  { produto: "DRPS/Questionário", nomeProduto: "DRPS", setores: [], detalhes: ["DRPS concluído em 30/06/2026, antes da indicação de 07/10/2026"] }], []);
  assert.equal(itens[0].detalhe, "Prensa Hidráulica 50T (grau alto)");
  assert.equal(itens[1].detalhe, null);
});

