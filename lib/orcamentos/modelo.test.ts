import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoriaDoExame,
  cipaVazia,
  condicoesCipa,
  dataPorExtenso,
  descontoGrupo,
  distribuicaoGrupo,
  examesPorCategoria,
  faturamentoMinimo,
  mensalPorVida,
  novaMensalidadeCipa,
  paginarExames,
  somaIndividual,
  valorPorColaborador,
  vidasCobradas,
  vidasInformadas,
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


// ── Fase 2 (0.3.340) ──

const emp = (id: string, valorIndividual: number, funcionarios: number | null = null) => ({ id, nome: `Empresa ${id}`, cnpj: null, funcionarios, valorIndividual });

test("Grupo: desconto mensal e anual, distribuição proporcional que fecha nos centavos e pendências", () => {
  const g = { empresas: [emp("A", 160, 1), emp("B", 160, 1), emp("C", 160, 1)], valorGrupo: 390, anexoDistribuicao: true };
  assert.equal(somaIndividual(g), 480);
  assert.deepEqual(descontoGrupo(g), { mensal: 90, anual: 1080 });
  assert.equal(totalOrcamento("grupo", { data: "2026-11-27", grupo: g }), 390);
  const d = distribuicaoGrupo({ ...g, valorGrupo: 100 })!;
  assert.deepEqual(d.map((x) => x.valor), [33.33, 33.33, 33.34]);
  assert.equal(distribuicaoGrupo({ ...g, empresas: [emp("A", 1, 3), emp("B", 1, null)] }), null);
  assert.deepEqual(pendencias("grupo", "Grupo X", { data: "2026-11-27", grupo: g }), []);
  assert.ok(pendencias("grupo", "Grupo X", { data: "2026-11-27", grupo: { ...g, valorGrupo: 480 } }).some((x) => x.includes("menor que a soma")));
  assert.ok(pendencias("grupo", "", { data: "2026-11-27", grupo: { ...g, empresas: [g.empresas[0]] } }).includes("Inclua ao menos duas empresas no grupo."));
});

test("Valor por vida: vidas das funções ou dos funcionários, nunca abaixo do mínimo", () => {
  const v = { valorPorVida: 25, minimoVidas: 10, funcoes: [{ id: "1", funcao: "Motorista", colaboradores: 4 }, { id: "2", funcao: "Auxiliar", colaboradores: 3 }] };
  assert.equal(vidasInformadas(v), 7);
  assert.equal(vidasCobradas(v), 10);
  assert.equal(faturamentoMinimo(v), 250);
  assert.equal(totalOrcamento("vida", { data: "2026-11-27", vida: v }), 250);
  assert.equal(mensalPorVida({ ...v, funcoes: [] }, 14), 350);
  assert.ok(pendencias("vida", "Cliente", { data: "2026-11-27", vida: { valorPorVida: 25, minimoVidas: 0, funcoes: [] } }).some((x) => x.includes("mínimo de vidas")));
});

test("Inclusão do Designado CIPA: atual + R$ 15,00 e as 4 condições", () => {
  const c = cipaVazia();
  assert.equal(c.acrescimo, 15);
  const d = { mensalidadeAtual: 250, acrescimo: 15 };
  assert.equal(novaMensalidadeCipa(d), 265);
  assert.equal(totalOrcamento("cipa", { data: "2026-11-27", cipa: d }), 265);
  const cond = condicoesCipa(d);
  assert.equal(cond.length, 4);
  assert.ok(cond[1].includes("R$ 250,00") && cond[1].includes("R$ 265,00"));
  assert.ok(pendencias("cipa", "Cliente", { data: "2026-11-27", cipa: c }).includes("Informe a mensalidade atual."));
});

test("Tabela de exames: categoria pelo nome, valor por colaborador sem os isentos, pendências e anexo", () => {
  assert.equal(categoriaDoExame("Exame Clínico"), "Clínicos");
  assert.equal(categoriaDoExame("Raio X Tórax (OIT)"), "Imagem");
  assert.equal(categoriaDoExame("Audiometria"), "Complementares");
  assert.equal(categoriaDoExame("ECG"), "Complementares");
  assert.equal(categoriaDoExame("Hemograma Completo"), "Laboratoriais");
  const exames = [
    { id: "c", nome: "Exame Clínico", categoria: "Clínicos", valor: 0, isento: true },
    { id: "a", nome: "Audiometria", categoria: "Complementares", valor: 30, isento: false },
    { id: "h", nome: "Hemograma", categoria: "Laboratoriais", valor: 13, isento: false },
  ];
  assert.equal(valorPorColaborador({ id: "s", setor: "Motoristas", exames: ["c", "a", "h"] }, exames), 43);
  assert.equal(valorPorColaborador({ id: "s", setor: "Administrativo", exames: ["c"] }, exames), 0);
  assert.deepEqual(examesPorCategoria([exames[2], exames[0], exames[1]]).map((g) => g.categoria), ["Clínicos", "Complementares", "Laboratoriais"]);
  const t = { exames, setores: [] };
  assert.deepEqual(pendencias("exames", "Cliente", { data: "2026-11-27", tabelaExames: t }), []);
  assert.equal(totalOrcamento("exames", { data: "2026-11-27", tabelaExames: t }), 0);
  const sem = { exames: [{ ...exames[1], valor: 0 }], setores: [] };
  assert.ok(pendencias("exames", "Cliente", { data: "2026-11-27", tabelaExames: sem })[0].includes("sem valor"));
  // Anexo: só conta quando marcado.
  const ess = { data: "2026-11-27", essencial: { ...essencialVazio(), valorMensal: 300 }, tabelaExames: sem };
  assert.deepEqual(pendencias("essencial", "Cliente", ess), []);
  assert.ok(pendencias("essencial", "Cliente", { ...ess, anexarExames: true }).some((x) => x.includes("sem valor")));
});

test("Paginar exames: 2 colunas por página, categoria longa continua na coluna seguinte", () => {
  const muitos = Array.from({ length: 30 }, (_, i) => ({ id: String(i), nome: `Exame ${i}`, categoria: "Laboratoriais", valor: 10, isento: false }));
  const p = paginarExames([{ categoria: "Laboratoriais", exames: muitos }], 12, 20);
  // 1ª página: 2 colunas de 10 (12 − 1,5 de título); 2ª: os 10 restantes equilibrados em 5 + 5.
  const porColuna = (pg: typeof p[number]) => pg.map((c) => c.reduce((s, g) => s + g.exames.length, 0));
  assert.equal(p.length, 2);
  assert.deepEqual(porColuna(p[0]), [10, 10]);
  assert.deepEqual(porColuna(p[1]), [5, 5]);
  // Lista curta: uma categoria em cada coluna.
  const dois = paginarExames([{ categoria: "Complementares", exames: muitos.slice(0, 1) }, { categoria: "Laboratoriais", exames: muitos.slice(1, 2) }], 30, 36);
  assert.deepEqual(dois[0].map((c) => c.map((g) => g.categoria)), [["Complementares"], ["Laboratoriais"]]);
  assert.equal(p.flat(2).reduce((s, g) => s + g.exames.length, 0), 30);
  assert.equal(paginarExames([], 12, 20).length, 1);
});
