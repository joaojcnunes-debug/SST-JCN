/**
 * Comercial › Orçamentos (0.3.339, banco v375): os 3 modelos da Fase 1 — Plano Essencial, Treinamentos e Avulso —, os
 * textos padrão (os 20 serviços e as 3 exclusões das bases de conhecimento), as contas e a sugestão de itens a partir das
 * oportunidades do Comercial.
 *
 * Módulo puro, testado em `modelo.test.ts`. Nada aqui inventa valor: item sem preço no catálogo entra com R$ 0,00 e a
 * tela avisa.
 */

import type { MarcaOrcamento } from "@/lib/orcamentos/marcas";

export type ModeloOrcamento = "essencial" | "treinamentos" | "avulso";
export type SituacaoOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado";
export type TipoPreco = "servico" | "treinamento" | "exame";

export const ROTULO_MODELO: Record<ModeloOrcamento, string> = {
  essencial: "Plano Essencial",
  treinamentos: "Treinamentos",
  avulso: "Avulso",
};

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

/** O conteúdo do orçamento (comercial_orcamentos.dados). */
export interface DadosOrcamento {
  /** Data do documento (AAAA-MM-DD). */
  data: string;
  essencial?: DadosEssencial;
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

export const PAGAMENTO_PADRAO: Record<Exclude<ModeloOrcamento, "essencial">, string> = {
  treinamentos: "Os valores são por participante e serão faturados junto à mensalidade, no mês subsequente à realização.",
  avulso: "O valor será faturado junto à cobrança mensal contratual.",
};

export function essencialVazio(): DadosEssencial {
  return { valorMensal: 0, limiteFuncionarios: null, valorExcedente: 20, cipa: "quando", servicosRemovidos: [], servicosExtras: [] };
}

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

/** O total do orçamento: no Plano Essencial, o valor mensal; nos outros, a soma dos itens. */
export function totalOrcamento(modelo: ModeloOrcamento, d: DadosOrcamento): number {
  if (modelo === "essencial") return centavos(d.essencial?.valorMensal ?? 0);
  return centavos((d.itens ?? []).reduce((s, i) => s + subtotalItem(i), 0));
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
  if (!cliente.trim()) p.push("Informe o cliente.");
  if (modelo === "essencial") {
    if (!(d.essencial?.valorMensal && d.essencial.valorMensal > 0)) p.push("Informe o valor mensal.");
  } else {
    const itens = d.itens ?? [];
    if (itens.length === 0) p.push("Inclua ao menos um item.");
    if (itens.some((i) => !i.descricao.trim())) p.push("Há item sem descrição.");
    const semValor = itens.filter((i) => !(i.valor > 0)).length;
    if (semValor) p.push(`${semValor === 1 ? "1 item está" : `${semValor} itens estão`} sem valor.`);
    if (modelo === "treinamentos" && itens.some((i) => !(i.quantidade > 0))) p.push("Há treinamento sem número de participantes.");
  }
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
export function modeloSugerido(oportunidades: readonly Pick<OportunidadeSugestao, "produto">[]): Exclude<ModeloOrcamento, "essencial"> {
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
