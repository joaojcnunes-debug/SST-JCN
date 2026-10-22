// Montagem PURA do laudo da QAP (v226) — a mesma função alimenta o PDF
// (`/api/pdf/qps/[id]`, no servidor) e a prévia da tela Laudo (no navegador),
// para que os dois nunca divirjam: um bloco por setor com a conta da régua do
// DRPS (`calcularAnaliseSetor`), mais o consolidado ("*"), a caracterização
// dos trabalhadores e os textos que o psicólogo gravou na tela Análise.

import type {
  QpsAplicacao,
  QpsCategoria,
  QpsPergunta,
  QpsProbabilidade,
  QpsRespondente,
  QpsTipo,
} from "@/lib/supabase/types";
import {
  SETOR_TODA_APLICACAO,
  TODOS_OS_SETORES,
  calcularAnaliseSetor,
  listarSetoresQps,
  type CategoriaGravidade,
} from "./gravidade";
import { fontesEscolhidas, guardadasDe, textoFontes, type FontesPorSetor } from "@/lib/psicossocial/fontes";

/** Chave em `pdfs_assinados` / `pdfs_gerados` do laudo da aplicação (rota e tela Laudo usam a mesma). */
export const QPS_LAUDO_TABELA = "qps_aplicacoes_laudo";
/** `modulo` em pdfs_gerados / congelamento / anexos / textos_padrao. */
export const QPS_MODULO_PDF = "qps";

export interface BlocoSetorLaudo {
  /** Nome do setor; no consolidado, `TODOS_OS_SETORES`. */
  setor: string;
  ehConsolidado: boolean;
  totalRespondentes: number;
  /** Cargos declarados pelos respondentes do setor, separados por vírgula. */
  cargos: string;
  categorias: CategoriaGravidade[];
  agravos: string | null;
  medidas: string | null;
  /** HTML do RichTextEditor. */
  conclusao: string | null;
}

export interface DadosLaudoQps {
  aplicacao: QpsAplicacao;
  tipo: QpsTipo | null;
  /** Um bloco por setor com respondente, em ordem alfabética (pt-BR). */
  blocos: BlocoSetorLaudo[];
  /** O bloco "Todos os setores" (chave "*" nos textos) — a Conclusão Consolidada do laudo. */
  consolidado: BlocoSetorLaudo | null;
  totalRespondentes: number;
}

function cargosDe(respondentes: { cargo?: string | null }[]): string {
  const set = new Set<string>();
  for (const r of respondentes) {
    const c = (r.cargo ?? "").trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ");
}

/**
 * v262: troca a fonte geradora padrão da categoria pelas fontes escolhidas na
 * Análise para o setor ("*" = consolidado). Sem escolha guardada, fica o texto
 * da categoria intacto.
 */
export function aplicarFontesQps(
  analise: CategoriaGravidade[],
  fontes: FontesPorSetor | null | undefined,
  chaveSetor: string,
): CategoriaGravidade[] {
  if (!fontes) return analise;
  return analise.map((c) => {
    const guardadas = guardadasDe(fontes, chaveSetor, c.id_categoria);
    if (!guardadas) return c;
    return { ...c, fonteGeradora: textoFontes(fontesEscolhidas(guardadas, c.fonteGeradora)) || null };
  });
}

export function montarLaudoQps(args: {
  aplicacao: QpsAplicacao;
  tipo: QpsTipo | null | undefined;
  categorias: QpsCategoria[];
  perguntas: QpsPergunta[];
  respondentes: QpsRespondente[];
  probabilidades: QpsProbabilidade[];
}): DadosLaudoQps {
  const { aplicacao, categorias, perguntas, respondentes, probabilidades } = args;
  const tipo = args.tipo ?? null;
  const podeCalcular = !!tipo && categorias.length > 0;

  const textos = (mapa: Record<string, string> | null | undefined, chave: string) =>
    (mapa?.[chave] ?? "").trim() || null;

  const montarBloco = (setor: string): BlocoSetorLaudo => {
    const ehConsolidado = setor === TODOS_OS_SETORES;
    const chave = ehConsolidado ? SETOR_TODA_APLICACAO : setor;
    const recorte = ehConsolidado
      ? respondentes
      : respondentes.filter((r) => (r.setor ?? "").trim() === setor);
    return {
      setor,
      ehConsolidado,
      totalRespondentes: recorte.length,
      cargos: cargosDe(recorte),
      categorias: podeCalcular
        ? aplicarFontesQps(
            calcularAnaliseSetor(
              setor,
              categorias,
              perguntas,
              respondentes,
              probabilidades,
              tipo!.escala_min,
              tipo!.escala_max,
            ),
            aplicacao.fontes_por_setor,
            chave,
          )
        : [],
      agravos: textos(aplicacao.agravos_por_setor, chave),
      medidas: textos(aplicacao.medidas_por_setor, chave),
      conclusao: textos(aplicacao.conclusoes_por_setor, chave),
    };
  };

  const setores = listarSetoresQps(respondentes);
  const blocos = setores.map(montarBloco);
  const consolidado = respondentes.length > 0 ? montarBloco(TODOS_OS_SETORES) : null;

  return {
    aplicacao,
    tipo,
    blocos,
    consolidado,
    totalRespondentes: respondentes.length,
  };
}

/**
 * Agravos e medidas em parágrafos (v263). A tela Análise grava o que foi
 * selecionado como "• item\n• item" — e os itens do catálogo são trechos que
 * começam em minúscula ("estresse ocupacional, ansiedade…"). No PDF cada item
 * vira um parágrafo: sem o marcador, com inicial maiúscula e ponto final.
 */
export function paragrafosDoTexto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[•·\-–*]\s*/, "").trim())
    .filter((l) => l.length > 0)
    .map((l) => {
      const comMaiuscula = l.charAt(0).toLocaleUpperCase("pt-BR") + l.slice(1);
      return /[.!?…:;]$/.test(comMaiuscula) ? comMaiuscula : `${comMaiuscula}.`;
    });
}

/**
 * A partir de quantas colunas uma tabela colada na conclusão vai para a folha deitada.
 * Era 6: o plano de ação de 5 colunas (Prioridade / Fator / Onde / Fontes /
 * Medidas) saía em pé com o texto empilhado em colunas de 3 cm.
 */
export const COLUNAS_PARA_PAISAGEM = 5;

function maxColunas(tabelaHtml: string): number {
  let max = 0;
  for (const tr of tabelaHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []) {
    let n = 0;
    for (const cel of tr.match(/<t[dh]\b[^>]*>/gi) ?? []) {
      const span = cel.match(/\bcolspan\s*=\s*["']?(\d+)/i);
      n += span ? Number(span[1]) : 1;
    }
    max = Math.max(max, n);
  }
  return max;
}

/** Parágrafo sem texto: `<p></p>`, `<p style="…"></p>`, `<p><br></p>`, `<p>&nbsp;</p>`. */
const PARAGRAFO_VAZIO = /<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi;

/**
 * Tabela larga colada na conclusão (ex.: o plano 5W2H de 8 colunas) não cabe em
 * pé: as colunas ficam com 2 cm e as palavras partem no meio. Como no DRPS, ela
 * vai para a folha deitada — só a tabela; o texto em volta segue em pé (v263).
 *
 * Tira também os parágrafos VAZIOS do fim do texto: o editor sempre deixa um
 * `<p></p>` depois de uma tabela, e depois da folha deitada ele abria uma
 * folha em pé só para si — era a página em branco antes da assinatura.
 */
export function marcarTabelasLargas(
  html: string | null | undefined,
  minColunas = COLUNAS_PARA_PAISAGEM,
): string {
  if (!html) return "";
  let fim = html;
  for (;;) {
    const aparado = fim.replace(/\s+$/, "").replace(new RegExp(`(?:${PARAGRAFO_VAZIO.source})$`, "i"), "");
    if (aparado === fim) break;
    fim = aparado;
  }
  return fim.replace(/<table\b[\s\S]*?<\/table>/gi, (tabela) =>
    maxColunas(tabela) >= minColunas ? `<div class="qps-tabela-paisagem">${tabela}</div>` : tabela,
  );
}

/** Âncora do capítulo no PDF — o Sumário aponta para ela e lê dela a página. */
export function ancoraCapitulo(idCapitulo: string): string {
  return `cap-${idCapitulo}`;
}

/** Um campo do laudo que a equipe ainda não preencheu (v263). */
export interface PendenciaLaudo {
  /** O que sai errado/em branco no PDF. */
  campo: string;
  /** Onde a equipe preenche. */
  onde: "Aplicação" | "Análise" | "Respondentes" | "Texto Padrão" | "Tipos e Perguntas";
  detalhe?: string;
}

/**
 * O que falta preencher para o PDF sair completo — a mesma lista que a tela
 * Laudo mostra antes de gerar. Só aponta o que é da EQUIPE; o que o sistema
 * calcula (gravidade, matriz, caracterização, numeração) não entra.
 */
export function pendenciasDoLaudo(args: {
  laudo: DadosLaudoQps;
  periodo: { inicio: string | null; fim: string | null };
  temCargo: boolean;
}): PendenciaLaudo[] {
  const { laudo, periodo } = args;
  const ap = laudo.aplicacao;
  const out: PendenciaLaudo[] = [];
  if (!(ap.responsavel ?? "").trim()) {
    out.push({ campo: "Responsável técnico (psicólogo)", onde: "Aplicação" });
  }
  if (!periodo.inicio || !periodo.fim) {
    out.push({
      campo: "Período da coleta",
      onde: "Aplicação",
      detalhe: "A Metodologia imprime \"no período de … à …\". Preencha Período Início e Fim.",
    });
  }
  if (!ap.data_conclusao) {
    out.push({
      campo: "Data da conclusão (capa)",
      onde: "Aplicação",
      detalhe: "É carimbada sozinha quando a aplicação vira Concluída.",
    });
  }
  if (!args.temCargo) {
    out.push({
      campo: "Funções dos trabalhadores",
      onde: "Respondentes",
      detalhe: "A planilha importada não tinha a coluna de cargo/função: a coluna Funções sai \"—\".",
    });
  }
  const semFonte = (laudo.consolidado?.categorias ?? []).filter((c) => !(c.fonteGeradora ?? "").trim());
  if (semFonte.length > 0) {
    out.push({
      campo: "Fontes geradoras do risco",
      onde: "Tipos e Perguntas",
      detalhe: `${semFonte.length} categoria(s) sem fonte geradora: ${semFonte.map((c) => c.nome).join(", ")}.`,
    });
  }
  const falta = (sel: (b: BlocoSetorLaudo) => string | null) =>
    laudo.blocos.filter((b) => !sel(b)).map((b) => b.setor);
  for (const [campo, sel] of [
    ["Possíveis agravos à saúde mental", (b: BlocoSetorLaudo) => b.agravos],
    ["Medidas de controle recomendadas", (b: BlocoSetorLaudo) => b.medidas],
    ["Conclusão do setor", (b: BlocoSetorLaudo) => b.conclusao],
  ] as const) {
    const setores = falta(sel);
    if (setores.length > 0) {
      out.push({ campo, onde: "Análise", detalhe: `Sem texto em: ${setores.join(", ")}.` });
    }
  }
  if (!laudo.consolidado?.conclusao) {
    out.push({
      campo: "Conclusão Técnica Consolidada",
      onde: "Análise",
      detalhe: "Escrita em \"Todos os setores\". Sem ela a seção não sai no PDF nem no Sumário.",
    });
  }
  return out;
}

/** Linha do Plano de Ação 5W2H como o template imprime (mesmo formato do DRPS). */
export interface PlanoAcaoLinhaLaudo {
  ordem: number;
  acao: string | null;
  justificativa: string | null;
  onde: string | null;
  prazo: string | null;
  responsavel: string | null;
  como: string | null;
  quanto_custa: string | null;
  status: string;
}

/** Uma linha do 5W2H só imprime se algum campo foi preenchido (igual ao DRPS). */
export function linhasPlanoComConteudo(linhas: PlanoAcaoLinhaLaudo[]): PlanoAcaoLinhaLaudo[] {
  return linhas.filter((l) =>
    [l.acao, l.justificativa, l.onde, l.prazo, l.responsavel, l.como, l.quanto_custa].some(
      (v) => (v ?? "").trim().length > 0,
    ),
  );
}
