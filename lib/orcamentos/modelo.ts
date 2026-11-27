/**
 * Comercial › Orçamentos (0.3.339, banco v375): os 3 modelos da Fase 1 — Plano Essencial, Treinamentos e Avulso —, os
 * textos padrão (os 20 serviços e as 3 exclusões das bases de conhecimento), as contas e a sugestão de itens a partir das
 * oportunidades do Comercial. Fase 2 (0.3.340, banco v376): grupo de empresas com desconto, valor por vida, inclusão do
 * Designado CIPA e tabela de exames (documento próprio ou anexo).
 *
 * Módulo puro, testado em `modelo.test.ts`. Nada aqui inventa valor: item sem preço no catálogo entra com R$ 0,00 e a
 * tela avisa.
 */

import type { MarcaOrcamento } from "@/lib/orcamentos/marcas";

export type ModeloOrcamento = "essencial" | "grupo" | "vida" | "cipa" | "treinamentos" | "avulso" | "exames";
export type SituacaoOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado";
export type TipoPreco = "servico" | "treinamento" | "exame";

export const ROTULO_MODELO: Record<ModeloOrcamento, string> = {
  essencial: "Plano Essencial",
  grupo: "Grupo de empresas",
  vida: "Valor por vida",
  cipa: "Inclusão do Designado CIPA",
  treinamentos: "Treinamentos",
  avulso: "Avulso",
  exames: "Tabela de exames",
};

/** Modelos que levam a lista de serviços do Plano Essencial (0.3.340: grupo e valor por vida também). */
export const usaServicosEssencial = (m: ModeloOrcamento) => m === "essencial" || m === "grupo" || m === "vida";
/** Modelos de valor mensal (o total sai "/mês"). */
export const ehMensal = (m: ModeloOrcamento) => m === "essencial" || m === "grupo" || m === "vida" || m === "cipa";
/** Modelos que podem levar a tabela de exames como anexo. */
export const aceitaAnexoExames = (m: ModeloOrcamento) => m !== "exames" && m !== "cipa";

export const ROTULO_SITUACAO: Record<SituacaoOrcamento, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export const ROTULO_TIPO_PRECO: Record<TipoPreco, string> = { servico: "Serviço", treinamento: "Treinamento", exame: "Exame" };

/** Preço do catálogo (comercial_catalogo_precos). */
export interface PrecoCatalogo {
  id_preco: string;
  tipo: TipoPreco;
  nome: string;
  descricao: string | null;
  unidade: string;
  valor: number;
  ativo: boolean;
  ordem: number;
}

/** Uma linha do orçamento (Treinamentos e Avulso). */
export interface ItemOrcamento {
  id: string;
  descricao: string;
  detalhe?: string | null;
  quantidade: number;
  /** "por participante", "por exame", "unidade"… */
  unidade: string;
  valor: number;
  /** O serviço do Comercial a que o item se refere (para registrar a venda ao aprovar). */
  produto?: string | null;
  /** Intervenção psicossocial vendida sozinha (comercial_atendimento_intervencoes.id_item). */
  idItem?: string | null;
}

export type OpcaoCipa = "quando" | "incluido" | "sem";

export interface DadosEssencial {
  valorMensal: number;
  /** Limite de funcionários do valor; null = sem limite (sem cláusula de excedente). */
  limiteFuncionarios: number | null;
  /** Valor por colaborador acima do limite (padrão R$ 20,00). */
  valorExcedente: number;
  cipa: OpcaoCipa;
  /** Títulos dos serviços padrão que ficam de fora. */
  servicosRemovidos: string[];
  /** Serviços a mais (ex.: visita técnica mensal). */
  servicosExtras: { titulo: string; descricao: string }[];
}

/** Uma empresa do orçamento de grupo. */
export interface EmpresaDoGrupo {
  id: string;
  idEmpresa?: string | null;
  nome: string;
  cnpj: string | null;
  funcionarios: number | null;
  /** O valor mensal que a empresa pagaria sozinha. */
  valorIndividual: number;
}

export interface DadosGrupo {
  empresas: EmpresaDoGrupo[];
  /** O valor mensal do grupo, com o desconto. */
  valorGrupo: number;
  /** Anexo com a distribuição do valor por empresa (proporcional aos funcionários). */
  anexoDistribuicao: boolean;
}

export interface FuncaoVida {
  id: string;
  funcao: string;
  colaboradores: number;
}

export interface DadosVida {
  valorPorVida: number;
  /** Mínimo de vidas cobradas (0 = sem mínimo). */
  minimoVidas: number;
  /** Distribuição por função (opcional; sem funções, vale o número de funcionários). */
  funcoes: FuncaoVida[];
}

export interface DadosCipa {
  mensalidadeAtual: number;
  /** Acréscimo do Designado CIPA (padrão R$ 15,00). */
  acrescimo: number;
}

export interface ExameTabela {
  id: string;
  nome: string;
  categoria: string;
  valor: number;
  /** Incluso no plano: sai como "Isento". */
  isento: boolean;
}

export interface SetorExames {
  id: string;
  setor: string;
  /** Os ids dos exames (ExameTabela.id) do setor. */
  exames: string[];
}

export interface DadosExames {
  exames: ExameTabela[];
  setores: SetorExames[];
  /** O terceiro campo do quadro do cliente (ex.: "Plano Essencial"). */
  plano?: string;
}

/** O conteúdo do orçamento (comercial_orcamentos.dados). */
export interface DadosOrcamento {
  /** Data do documento (AAAA-MM-DD). */
  data: string;
  essencial?: DadosEssencial;
  grupo?: DadosGrupo;
  vida?: DadosVida;
  cipa?: DadosCipa;
  /** A tabela de exames: o corpo do modelo "exames", ou o anexo dos outros (com `anexarExames`). */
  tabelaExames?: DadosExames;
  anexarExames?: boolean;
  itens?: ItemOrcamento[];
  /** Forma de pagamento / faturamento (Treinamentos e Avulso). */
  pagamento?: string;
  /** Observações livres no fim do documento. */
  observacoes?: string;
  /** Funcionários (só informativo no quadro do cliente). */
  funcionarios?: number | null;
}

export interface Orcamento {
  id_orcamento: string;
  numero: number;
  versao: number;
  id_orcamento_origem: string | null;
  id_empresa: string | null;
  cliente_nome: string;
  cliente_cnpj: string | null;
  cidade: string | null;
  marca: MarcaOrcamento;
  modelo: ModeloOrcamento;
  situacao: SituacaoOrcamento;
  dados: DadosOrcamento;
  total: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  enviado_em: string | null;
  decidido_em: string | null;
}

// ── Textos padrão (bases de conhecimento) ─────────────────────────────────────────────────────────────────────────────

export interface ServicoPadrao {
  titulo: string;
  descricao: string;
}

/** Os 20 serviços do Plano Essencial. O "Designado CIPA" muda conforme a opção (ver `servicosDoEssencial`). */
export const SERVICOS_ESSENCIAL: ServicoPadrao[] = [
  { titulo: "PGR", descricao: "Elaboração e implantação do Programa de Gerenciamento de Riscos" },
  { titulo: "Riscos Psicossociais – NR-1", descricao: "Diagnóstico e avaliação (exceto medidas de controle e execução das ações do Plano de Ação)" },
  { titulo: "PCMSO", descricao: "Elaboração, implantação e coordenação" },
  { titulo: "Relatório Analítico do PCMSO", descricao: "Elaboração do Relatório Analítico" },
  { titulo: "LTCAT", descricao: "Laudo Técnico das Condições Ambientais do Trabalho" },
  { titulo: "PPP", descricao: "Perfil Profissiográfico Previdenciário" },
  { titulo: "Laudo de Insalubridade", descricao: "Elaboração do laudo" },
  { titulo: "Laudo de Periculosidade", descricao: "Elaboração do laudo" },
  { titulo: "AEP", descricao: "Avaliação Ergonômica Preliminar" },
  { titulo: "PAE", descricao: "Plano de Atendimento a Emergências" },
  { titulo: "Avaliações de Ruído e Calor", descricao: "Avaliações ocupacionais" },
  { titulo: "Exames Clínicos Ocupacionais", descricao: "Admissional, periódico, mudança de risco, demissional e retorno ao trabalho" },
  { titulo: "Gestão de Exames", descricao: "Gestão e convocação de exames ocupacionais" },
  { titulo: "Exames Toxicológicos", descricao: "Exclusivamente o sorteio randômico, quando aplicável. O exame é faturado à parte" },
  { titulo: "Designado CIPA – NR-5", descricao: "Designado da CIPA, quando aplicável" },
  { titulo: "CAT", descricao: "Emissão da Comunicação de Acidente de Trabalho" },
  { titulo: "eSocial", descricao: "Suporte e envio dos eventos S-2210, S-2220, S-2221 e S-2240" },
  { titulo: "Portal do Cliente", descricao: "Disponibilização do Portal do Cliente" },
  { titulo: "Credenciamento", descricao: "Gestão de credenciamento para atendimentos ocupacionais" },
  { titulo: "Suporte Multidisciplinar", descricao: "Engenharia, Psicologia e Medicina do Trabalho" },
];

export const TITULO_CIPA = "Designado CIPA – NR-5";

/** As 3 exclusões da página de investimento do Plano Essencial. */
export const EXCLUSOES_ESSENCIAL: ServicoPadrao[] = [
  {
    titulo: "Exames complementares",
    descricao:
      "São exames ocupacionais solicitados pelo Médico do Trabalho conforme o PCMSO, de acordo com os riscos específicos de cada função. " +
      "Por dependerem da necessidade individual, serão cobrados separadamente, assim como o exame toxicológico.",
  },
  {
    titulo: "Avaliações ambientais",
    descricao:
      "Exceto as avaliações de ruído e calor, já inclusas no plano, as demais medições técnicas (agentes químicos, vibração, entre outros " +
      "riscos ocupacionais) são identificadas durante a inspeção do ambiente pelo Técnico de Segurança do Trabalho e faturadas à parte.",
  },
  {
    titulo: "Intervenções psicossociais",
    descricao:
      "O plano contempla apenas o diagnóstico e a avaliação dos riscos psicossociais, integrados ao PGR. Intervenções psicossociais, medidas " +
      "de controle e a execução das ações previstas no Plano de Ação não estão inclusas no valor mensal.",
  },
];

export const PAGAMENTO_PADRAO: Record<"treinamentos" | "avulso", string> = {
  treinamentos: "Os valores são por participante e serão faturados junto à mensalidade, no mês subsequente à realização.",
  avulso: "O valor será faturado junto à cobrança mensal contratual.",
};

export function essencialVazio(): DadosEssencial {
  return { valorMensal: 0, limiteFuncionarios: null, valorExcedente: 20, cipa: "quando", servicosRemovidos: [], servicosExtras: [] };
}

export const ACRESCIMO_CIPA_PADRAO = 15;

export const grupoVazio = (): DadosGrupo => ({ empresas: [], valorGrupo: 0, anexoDistribuicao: false });
export const vidaVazia = (): DadosVida => ({ valorPorVida: 0, minimoVidas: 0, funcoes: [] });
export const cipaVazia = (): DadosCipa => ({ mensalidadeAtual: 0, acrescimo: ACRESCIMO_CIPA_PADRAO });
export const examesVazios = (): DadosExames => ({ exames: [], setores: [], plano: "" });

/** Os serviços que saem no Plano Essencial: os padrão (menos os removidos; o CIPA conforme a opção) e os extras. */
export function servicosDoEssencial(e: DadosEssencial): ServicoPadrao[] {
  const out: ServicoPadrao[] = [];
  for (const s of SERVICOS_ESSENCIAL) {
    if (e.servicosRemovidos.includes(s.titulo)) continue;
    if (s.titulo === TITULO_CIPA) {
      if (e.cipa === "sem") continue;
      out.push({ titulo: s.titulo, descricao: e.cipa === "incluido" ? "Incluído no plano" : s.descricao });
      continue;
    }
    out.push(s);
  }
  for (const x of e.servicosExtras) if (x.titulo.trim()) out.push({ titulo: x.titulo.trim(), descricao: x.descricao.trim() });
  return out;
}

// ── Contas e formatos ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Arredonda para centavos. */
export const centavos = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;

export const subtotalItem = (i: Pick<ItemOrcamento, "quantidade" | "valor">) => centavos((i.quantidade || 0) * (i.valor || 0));

// ── Grupo de empresas ──

/** A soma dos valores individuais (o "de" do desconto). */
export const somaIndividual = (g: DadosGrupo) => centavos(g.empresas.reduce((s, e) => s + (e.valorIndividual || 0), 0));

/** O desconto do grupo: por mês e no ano (×12). Sem percentual (as bases pedem para não mostrar). */
export function descontoGrupo(g: DadosGrupo): { mensal: number; anual: number } {
  const mensal = centavos(Math.max(0, somaIndividual(g) - (g.valorGrupo || 0)));
  return { mensal, anual: centavos(mensal * 12) };
}

export const funcionariosDoGrupo = (g: DadosGrupo) => g.empresas.reduce((s, e) => s + (e.funcionarios || 0), 0);

/**
 * A distribuição do valor do grupo por empresa: valor do grupo ÷ total de funcionários × funcionários da empresa. Os
 * centavos que sobram do arredondamento ficam na última empresa, para a soma bater. Null se faltar funcionário.
 */
export function distribuicaoGrupo(g: DadosGrupo): { id: string; valor: number }[] | null {
  const total = funcionariosDoGrupo(g);
  if (!total || g.empresas.some((e) => !(e.funcionarios && e.funcionarios > 0))) return null;
  const out = g.empresas.map((e) => ({ id: e.id, valor: centavos(((g.valorGrupo || 0) * (e.funcionarios || 0)) / total) }));
  const resto = centavos((g.valorGrupo || 0) - out.reduce((s, x) => s + x.valor, 0));
  if (out.length) out[out.length - 1].valor = centavos(out[out.length - 1].valor + resto);
  return out;
}

// ── Valor por vida ──

/** As vidas informadas: a soma das funções, ou (sem funções) o número de funcionários. */
export function vidasInformadas(v: DadosVida, funcionarios?: number | null): number {
  return v.funcoes.length ? v.funcoes.reduce((s, f) => s + (f.colaboradores || 0), 0) : Math.max(0, funcionarios ?? 0);
}

/** As vidas cobradas: as informadas, nunca abaixo do mínimo. */
export const vidasCobradas = (v: DadosVida, funcionarios?: number | null) => Math.max(vidasInformadas(v, funcionarios), v.minimoVidas || 0);

export const faturamentoMinimo = (v: DadosVida) => centavos((v.minimoVidas || 0) * (v.valorPorVida || 0));

export const mensalPorVida = (v: DadosVida, funcionarios?: number | null) => centavos(vidasCobradas(v, funcionarios) * (v.valorPorVida || 0));

// ── Inclusão do Designado CIPA ──

export const novaMensalidadeCipa = (c: DadosCipa) => centavos((c.mensalidadeAtual || 0) + (c.acrescimo || 0));

/** As 4 condições comerciais da proposta de inclusão (bases de conhecimento). */
export function condicoesCipa(c: DadosCipa): string[] {
  return [
    "O Designado da CIPA (NR-5) será incorporado ao contrato mediante a aprovação desta proposta.",
    `A mensalidade passa de R$ ${fmtValor(c.mensalidadeAtual)} para R$ ${fmtValor(novaMensalidadeCipa(c))}.`,
    "A alteração será formalizada e comunicada ao financeiro para o faturamento.",
    "As demais condições do contrato permanecem inalteradas.",
  ];
}

// ── Tabela de exames ──

export const CATEGORIAS_EXAME = ["Clínicos", "Complementares", "Laboratoriais", "Imagem", "Outros"] as const;

/** A categoria provável do exame pelo nome (dá para trocar na tela). */
export function categoriaDoExame(nome: string): string {
  const n = norm(nome);
  if (/clinic|\baso\b/.test(n)) return "Clínicos";
  if (/raio|\brx\b|tomograf|ultrass|ressonanc|radiograf/.test(n)) return "Imagem";
  if (/audiom|espirom|eletro|\becg\b|\beeg\b|acuidade|snellen|ishihara|psicoss|psicolog|romberg|ergometr/.test(n)) return "Complementares";
  return "Laboratoriais";
}

/** O valor por colaborador do setor: a soma dos exames do setor que não são isentos. */
export function valorPorColaborador(s: SetorExames, exames: readonly ExameTabela[]): number {
  const porId = new Map(exames.map((e) => [e.id, e]));
  return centavos(s.exames.reduce((t, id) => { const e = porId.get(id); return t + (e && !e.isento ? e.valor || 0 : 0); }, 0));
}

/** Os exames agrupados por categoria, na ordem de CATEGORIAS_EXAME (as outras depois, por nome). */
export function examesPorCategoria(exames: readonly ExameTabela[]): { categoria: string; exames: ExameTabela[] }[] {
  const m = new Map<string, ExameTabela[]>();
  for (const e of exames) {
    const c = e.categoria?.trim() || "Outros";
    m.set(c, [...(m.get(c) ?? []), e]);
  }
  const ordem = (c: string) => { const i = (CATEGORIAS_EXAME as readonly string[]).indexOf(c); return i < 0 ? 99 : i; };
  return [...m].sort(([a], [b]) => ordem(a) - ordem(b) || a.localeCompare(b, "pt-BR")).map(([categoria, exames]) => ({ categoria, exames }));
}

/**
 * Divide os valores unitários em páginas de 2 colunas. Cada categoria ocupa 1,5 linha de título + 1 por exame; a
 * primeira página tem `capPrimeira` linhas por coluna (o resto do espaço é do quadro por setor), as demais `capDemais`.
 * Categoria que não cabe continua na coluna seguinte (com o título repetido). Quando o que resta cabe na página, as
 * duas colunas ficam equilibradas (lista curta não fica toda na coluna da esquerda).
 */
export function paginarExames(
  grupos: readonly { categoria: string; exames: ExameTabela[] }[],
  capPrimeira: number,
  capDemais: number,
): { categoria: string; exames: ExameTabela[] }[][][] {
  type Col = { categoria: string; exames: ExameTabela[] }[];
  const paginas: Col[][] = [];
  let pagina: Col[] = [[]];
  let usado = 0;
  let restante = grupos.reduce((t, g) => t + (g.exames.length ? 1.5 + g.exames.length : 0), 0);
  const cap = () => (paginas.length === 0 ? capPrimeira : capDemais);
  const limiteDaColuna = () => (pagina.length === 1 && restante <= 2 * cap() - 3 ? Math.min(cap(), Math.ceil(restante / 2) + 1.5) : cap());
  let limite = limiteDaColuna();
  const proximaColuna = () => {
    if (pagina.length === 2) { paginas.push(pagina); pagina = [[]]; } else pagina.push([]);
    usado = 0;
    limite = limiteDaColuna();
  };
  for (const g of grupos) {
    // Categoria que não cabe aqui, mas cabe inteira numa coluna nova, não é partida.
    if (usado > 0 && usado + 1.5 + g.exames.length > limite && 1.5 + g.exames.length <= cap()) proximaColuna();
    let resto = [...g.exames];
    while (resto.length) {
      if (usado + 2.5 > limite && usado > 0) proximaColuna();
      const cabem = Math.max(1, Math.floor(limite - usado - 1.5));
      const parte = resto.slice(0, cabem);
      pagina[pagina.length - 1].push({ categoria: g.categoria, exames: parte });
      usado += 1.5 + parte.length;
      restante -= parte.length + (resto.length === g.exames.length ? 1.5 : 0);
      resto = resto.slice(parte.length);
      if (resto.length) proximaColuna();
    }
  }
  if (pagina.some((c) => c.length) || paginas.length === 0) paginas.push(pagina);
  return paginas;
}

/** O total do orçamento: nos mensais, o valor do mês; nos de itens, a soma; na tabela de exames, 0 (não tem total). */
export function totalOrcamento(modelo: ModeloOrcamento, d: DadosOrcamento): number {
  switch (modelo) {
    case "essencial": return centavos(d.essencial?.valorMensal ?? 0);
    case "grupo": return centavos(d.grupo?.valorGrupo ?? 0);
    case "vida": return d.vida ? mensalPorVida(d.vida, d.funcionarios) : 0;
    case "cipa": return d.cipa ? novaMensalidadeCipa(d.cipa) : 0;
    case "exames": return 0;
    default: return centavos((d.itens ?? []).reduce((s, i) => s + subtotalItem(i), 0));
  }
}

/** "R$ 1.234,56". */
export function fmtBRL(v: number): string {
  return `R$ ${centavos(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "1.234,56" (sem o R$). */
export function fmtValor(v: number): string {
  return centavos(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "Teresópolis, 27 de novembro de 2026." (data AAAA-MM-DD). */
export function dataPorExtenso(cidade: string | null | undefined, data: string): string {
  const [a, m, d] = data.slice(0, 10).split("-").map(Number);
  const corpo = a && m && d ? `${d} de ${MESES[m - 1]} de ${a}` : data;
  const c = (cidade ?? "").trim();
  return `${c ? `${c}, ` : ""}${corpo}.`;
}

/** "27/11/2026". */
export function dataCurta(data: string): string {
  const [a, m, d] = data.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : data;
}

/** Quantidade com 2 dígitos ("04 funcionários"). */
export const doisDigitos = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

/** "Nº 0012" (versão 2+: "Nº 0012 · v2"). */
export function rotuloNumero(o: Pick<Orcamento, "numero" | "versao">): string {
  return `Nº ${String(o.numero).padStart(4, "0")}${o.versao > 1 ? ` · v${o.versao}` : ""}`;
}

/** O que falta para o orçamento sair (vazio = pode gerar). */
export function pendencias(modelo: ModeloOrcamento, cliente: string, d: DadosOrcamento): string[] {
  const p: string[] = [];
  if (!cliente.trim()) p.push(modelo === "grupo" ? "Informe o nome do grupo." : "Informe o cliente.");
  const exames = (t: DadosExames | undefined) => {
    const l = t?.exames ?? [];
    if (l.length === 0) p.push("Inclua ao menos um exame na tabela.");
    if (l.some((e) => !e.nome.trim())) p.push("Há exame sem nome.");
    const semValor = l.filter((e) => !e.isento && !(e.valor > 0)).length;
    if (semValor) p.push(`${semValor === 1 ? "1 exame está" : `${semValor} exames estão`} sem valor (ou marque como isento).`);
    if ((t?.setores ?? []).some((s) => !s.setor.trim())) p.push("Há setor sem nome na tabela de exames.");
  };
  if (modelo === "essencial") {
    if (!(d.essencial?.valorMensal && d.essencial.valorMensal > 0)) p.push("Informe o valor mensal.");
  } else if (modelo === "grupo") {
    const g = d.grupo ?? grupoVazio();
    if (g.empresas.length < 2) p.push("Inclua ao menos duas empresas no grupo.");
    if (g.empresas.some((e) => !e.nome.trim())) p.push("Há empresa sem nome.");
    if (g.empresas.some((e) => !(e.valorIndividual > 0))) p.push("Informe o valor individual de cada empresa.");
    if (!(g.valorGrupo > 0)) p.push("Informe o valor do grupo.");
    else if (g.empresas.length && g.valorGrupo >= somaIndividual(g)) p.push("O valor do grupo precisa ser menor que a soma dos valores individuais (é o desconto).");
    if (g.anexoDistribuicao && !distribuicaoGrupo(g)) p.push("Para o anexo de distribuição, informe os funcionários de cada empresa.");
  } else if (modelo === "vida") {
    const v = d.vida ?? vidaVazia();
    if (!(v.valorPorVida > 0)) p.push("Informe o valor por vida.");
    if (v.funcoes.some((f) => !f.funcao.trim())) p.push("Há função sem nome.");
    if (vidasCobradas(v, d.funcionarios) === 0) p.push("Informe as funções (ou os funcionários) ou o mínimo de vidas.");
  } else if (modelo === "cipa") {
    if (!(d.cipa?.mensalidadeAtual && d.cipa.mensalidadeAtual > 0)) p.push("Informe a mensalidade atual.");
    if (!(d.cipa?.acrescimo && d.cipa.acrescimo > 0)) p.push("Informe o acréscimo do Designado CIPA.");
  } else if (modelo === "exames") {
    exames(d.tabelaExames);
  } else {
    const itens = d.itens ?? [];
    if (itens.length === 0) p.push("Inclua ao menos um item.");
    if (itens.some((i) => !i.descricao.trim())) p.push("Há item sem descrição.");
    const semValor = itens.filter((i) => !(i.valor > 0)).length;
    if (semValor) p.push(`${semValor === 1 ? "1 item está" : `${semValor} itens estão`} sem valor.`);
    if (modelo === "treinamentos" && itens.some((i) => !(i.quantidade > 0))) p.push("Há treinamento sem número de participantes.");
  }
  if (aceitaAnexoExames(modelo) && d.anexarExames) exames(d.tabelaExames);
  return p;
}

// ── Sugestão a partir das oportunidades do Comercial ──────────────────────────────────────────────────────────────────

/** O mínimo de uma oportunidade que a sugestão usa (lib/comercial/oportunidades.ts → Oportunidade). */
export interface OportunidadeSugestao {
  produto: string;
  nomeProduto: string;
  detalhes: string[];
  setores: { nome: string; expostos: number }[];
  intervencoes?: { idItem: string; setor: string; risco: string; intervencao: string; modalidade: string | null }[];
}

/** Nota interna da equipe nos detalhes da oportunidade (a mesma regra da tela do Comercial): não vai para o cliente. */
export const ehNotaInterna = (d: string) => /antes da indicação|não conta como|^Há \d/.test(d);

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** O preço do catálogo cujo nome casa com o texto (igual, ou um contido no outro), do tipo pedido. */
export function precoDoCatalogo(catalogo: readonly PrecoCatalogo[], texto: string, tipo?: TipoPreco): PrecoCatalogo | undefined {
  const t = norm(texto);
  if (!t) return undefined;
  const lista = catalogo.filter((p) => p.ativo && (!tipo || p.tipo === tipo));
  return lista.find((p) => norm(p.nome) === t) ?? lista.find((p) => norm(p.nome).length >= 4 && (t.includes(norm(p.nome)) || norm(p.nome).includes(t)));
}

let seq = 0;
export const novoIdItem = () => `IT${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Itens sugeridos a partir das oportunidades a vender: treinamentos NR (um por treinamento indicado), AET (com os
 * setores e os expostos), intervenções psicossociais (uma por intervenção) e os demais serviços (um por serviço). O
 * valor vem do catálogo quando o nome casa; senão, R$ 0,00 (a tela avisa).
 */
export function sugerirItens(oportunidades: readonly OportunidadeSugestao[], catalogo: readonly PrecoCatalogo[]): ItemOrcamento[] {
  const out: ItemOrcamento[] = [];
  for (const bruta of oportunidades) {
    const o = { ...bruta, detalhes: bruta.detalhes.filter((d) => !ehNotaInterna(d)) };
    if (o.produto === "Treinamentos NR") {
      const nomes = o.detalhes.length ? o.detalhes : [o.nomeProduto];
      for (const d of nomes) {
        const p = precoDoCatalogo(catalogo, d, "treinamento");
        out.push({ id: novoIdItem(), descricao: p?.nome ?? d, quantidade: 1, unidade: "por participante", valor: p?.valor ?? 0, produto: o.produto });
      }
    } else if (o.produto === "Intervenção psicossocial" && o.intervencoes?.length) {
      for (const i of o.intervencoes) {
        const p = precoDoCatalogo(catalogo, i.intervencao);
        out.push({
          id: novoIdItem(),
          descricao: i.intervencao,
          detalhe: [i.risco, i.setor, i.modalidade].filter(Boolean).join(" · "),
          quantidade: 1,
          unidade: p?.unidade ?? "unidade",
          valor: p?.valor ?? 0,
          produto: o.produto,
          idItem: i.idItem,
        });
      }
    } else if (o.produto === "AET" && o.setores.length) {
      const p = precoDoCatalogo(catalogo, "AET", "servico") ?? precoDoCatalogo(catalogo, o.nomeProduto, "servico");
      const expostos = o.setores.reduce((s, x) => s + (x.expostos || 0), 0);
      out.push({
        id: novoIdItem(),
        descricao: o.nomeProduto,
        detalhe: `${o.setores.map((s) => s.nome).join(", ")}${expostos ? ` · ${expostos} trabalhadores expostos` : ""}`,
        quantidade: o.setores.length,
        unidade: "por setor",
        valor: p?.valor ?? 0,
        produto: o.produto,
      });
    } else {
      const p = precoDoCatalogo(catalogo, o.nomeProduto, "servico") ?? precoDoCatalogo(catalogo, o.produto, "servico");
      out.push({
        id: novoIdItem(),
        descricao: o.nomeProduto,
        detalhe: o.detalhes.slice(0, 6).join(", ") || null,
        quantidade: 1,
        unidade: p?.unidade ?? "unidade",
        valor: p?.valor ?? 0,
        produto: o.produto,
      });
    }
  }
  return out;
}

/** O modelo que combina com as oportunidades: só treinamentos → Treinamentos; senão, Avulso. */
export function modeloSugerido(oportunidades: readonly Pick<OportunidadeSugestao, "produto">[]): "treinamentos" | "avulso" {
  return oportunidades.length > 0 && oportunidades.every((o) => o.produto === "Treinamentos NR") ? "treinamentos" : "avulso";
}

/** Os serviços do Comercial nos itens (para oferecer "registrar venda" ao aprovar), sem repetir. */
export function produtosDosItens(itens: readonly ItemOrcamento[]): { produto: string; idItens: string[] }[] {
  const m = new Map<string, string[]>();
  for (const i of itens) {
    if (!i.produto) continue;
    const l = m.get(i.produto) ?? [];
    if (i.idItem) l.push(i.idItem);
    m.set(i.produto, l);
  }
  return [...m].map(([produto, idItens]) => ({ produto, idItens }));
}
