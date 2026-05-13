// DRPS — funções de cálculo da gravidade, probabilidade e matriz de risco.
//
// As regras vêm do spec PROMPT_DRPS_PSICOSSOCIAL.md (extraído da planilha
// Excel original com 111+ respondentes reais).

import { TOPICOS, TOTAL_PERGUNTAS } from "./topicos";
import type {
  ClassificacaoGravidade,
  DrpsRespondente,
  NivelMatriz,
  NivelProbabilidade,
  PerguntaCalculada,
  TopicoCalculado,
  TopicoComMatriz,
} from "./types";

const COR_BAIXA = "#27ae60";
const COR_MEDIA = "#f39c12";
const COR_ALTA = "#e74c3c";
const COR_CRITICO = "#1a1a2e";

export const CORES_MATRIZ: Record<NivelMatriz, string> = {
  Baixo: COR_BAIXA,
  Médio: COR_MEDIA,
  Alto: COR_ALTA,
  Crítico: COR_CRITICO,
};

/**
 * Converte pontuação bruta em corrigida segundo a lógica da pergunta.
 * Aplica ROUNDUP (Math.ceil) ANTES da inversão, conforme fórmula do Excel:
 *   =IF(UPPER(D)="INVERTIDA", 4 - ROUNDUP(media,0), ROUNDUP(media,0))
 */
export function pontuacaoCorrigida(
  valor: number,
  logica: "direta" | "invertida"
): number {
  const arredondado = Math.ceil(valor);
  return logica === "invertida" ? 4 - arredondado : arredondado;
}

/**
 * Classifica gravidade individual de uma pergunta a partir da pontuação
 * corrigida (inteira após ROUNDUP).
 *   >= 3 → Alta (3)
 *   == 2 → Média (2)
 *   <= 1 → Baixa (1)
 */
export function classificarGravidade(
  pontuacao: number
): ClassificacaoGravidade {
  if (pontuacao >= 3) return { texto: "Alta", num: 3, cor: COR_ALTA };
  if (pontuacao === 2) return { texto: "Média", num: 2, cor: COR_MEDIA };
  return { texto: "Baixa", num: 1, cor: COR_BAIXA };
}

/**
 * Classifica gravidade do TÓPICO a partir da média dos gravidade.num das
 * suas perguntas (limiares exatos extraídos da planilha modelo):
 *   ≤ 1.66 → Baixa
 *   ≤ 2.32 → Média
 *   >  2.32 → Alta
 */
export function classificarGravidadeTopico(
  mediaGravNum: number
): ClassificacaoGravidade {
  if (mediaGravNum <= 1.66) return { texto: "Baixa", num: 1, cor: COR_BAIXA };
  if (mediaGravNum <= 2.32) return { texto: "Média", num: 2, cor: COR_MEDIA };
  return { texto: "Alta", num: 3, cor: COR_ALTA };
}

export function rotuloProbabilidade(num: 1 | 2 | 3): NivelProbabilidade {
  return num === 1 ? "Baixa" : num === 2 ? "Média" : "Alta";
}

/** Cruza gravidade × probabilidade na matriz 3×3 padrão. */
export function calcularMatriz(
  gravNum: 1 | 2 | 3,
  probNum: 1 | 2 | 3
): NivelMatriz {
  const tabela: Record<string, NivelMatriz> = {
    "1-1": "Baixo",
    "1-2": "Baixo",
    "1-3": "Médio",
    "2-1": "Baixo",
    "2-2": "Médio",
    "2-3": "Alto",
    "3-1": "Médio",
    "3-2": "Alto",
    "3-3": "Crítico",
  };
  return tabela[`${gravNum}-${probNum}`] ?? "Baixo";
}

/** Filtra respondentes por setor (ou "Todos"). */
export function filtrarPorSetor(
  respondentes: DrpsRespondente[],
  setor: string
): DrpsRespondente[] {
  if (!setor || setor === "Todos") return respondentes;
  return respondentes.filter((r) => r.setor === setor);
}

/** Lista os setores distintos dos respondentes, ordenados alfabeticamente. */
export function listarSetores(respondentes: DrpsRespondente[]): string[] {
  const set = new Set<string>();
  for (const r of respondentes) {
    if (r.setor && r.setor.trim()) set.add(r.setor.trim());
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );
}

function mediaColuna(
  respondentes: DrpsRespondente[],
  idx: number
): { media: number; n: number } {
  let soma = 0;
  let n = 0;
  for (const r of respondentes) {
    const v = r.respostas[idx];
    if (typeof v === "number" && !Number.isNaN(v)) {
      soma += v;
      n++;
    }
  }
  return { media: n === 0 ? 0 : soma / n, n };
}

/**
 * Calcula tudo de UM tópico: 1 entrada por pergunta + média de
 * gravidade.num das perguntas + classificação do tópico (limiares próprios
 * 1.66 / 2.32).
 */
export function calcularTopico(
  topicoIdx: number,
  respondentesFiltrados: DrpsRespondente[]
): TopicoCalculado {
  const t = TOPICOS[topicoIdx];
  const perguntas: PerguntaCalculada[] = t.perguntas.map((p, i) => {
    const colIdx = t.colunaInicio + i;
    const { media, n } = mediaColuna(respondentesFiltrados, colIdx);
    const corrigida = pontuacaoCorrigida(media, p.logica);
    return {
      texto: p.texto,
      logica: p.logica,
      mediaBruta: media,
      pontuacaoCorrigida: corrigida,
      gravidade: classificarGravidade(corrigida),
      n,
    };
  });

  const somaGrav = perguntas.reduce((s, p) => s + p.gravidade.num, 0);
  const mediaGravidade = perguntas.length > 0 ? somaGrav / perguntas.length : 0;

  return {
    idx: topicoIdx,
    nome: t.nome,
    fonteGeradora: t.fonteGeradora,
    perguntas,
    mediaGravidade,
    classificacaoGravidade: classificarGravidadeTopico(mediaGravidade),
  };
}

/** Calcula os 13 tópicos para um conjunto filtrado de respondentes. */
export function calcularResumoCompleto(
  respondentesFiltrados: DrpsRespondente[]
): TopicoCalculado[] {
  return TOPICOS.map((_, i) => calcularTopico(i, respondentesFiltrados));
}

/**
 * Junta os tópicos calculados com a probabilidade definida por
 * `mapaProbabilidades` (chave = topico_idx). Sem probabilidade configurada,
 * usa default 1 (Baixa).
 */
export function aplicarMatriz(
  topicos: TopicoCalculado[],
  mapaProbabilidades: Record<number, 1 | 2 | 3>
): TopicoComMatriz[] {
  return topicos.map((t) => {
    const prob = mapaProbabilidades[t.idx] ?? 1;
    const matriz = calcularMatriz(t.classificacaoGravidade.num, prob);
    return {
      ...t,
      probabilidade: prob,
      classificacaoProbabilidade: rotuloProbabilidade(prob),
      matriz,
      corMatriz: CORES_MATRIZ[matriz],
    };
  });
}

/**
 * Parser tolerante de TSV/CSV colado do Google Sheets/Excel/Forms.
 *
 * Funcionalidades:
 * - Detecta separador automaticamente (tab / vírgula / ponto-e-vírgula)
 * - Detecta se a primeira linha é header (texto) ou já é dado (data)
 * - Suporta CSV com campos entre aspas duplas ("valor, com vírgula")
 * - Interpreta data BR (dd/mm/aaaa hh:mm:ss) e serial Excel
 * - Respostas fora do range 0..4 são clipadas
 * - Retorna diagnóstico detalhado pra o usuário entender o que rolou
 */

export interface LinhaParsed {
  setor: string;
  cargo: string | null;
  respostas: number[];
  data_carimbo: string | null;
}

export interface ParseDiagnostico {
  separador: "tab" | "vírgula" | "ponto-e-vírgula" | "pipe";
  totalLinhas: number;
  pulouHeader: boolean;
  colunasPorLinha: number[]; // colunas detectadas nas primeiras 5 linhas de dados
  amostraLinha: string; // primeiros 200 chars da 1ª linha de dados (debug)
  codigosNaoAscii: { char: string; code: string }[]; // chars suspeitos da amostra
}

export interface ParseResult {
  linhas: LinhaParsed[];
  erros: string[];
  diagnostico: ParseDiagnostico;
}

const META_COLS = 3; // data + cargo + setor (ordem do Forms NR-01 50P)

/**
 * Parser CSV completo que respeita aspas duplas através de QUEBRAS DE LINHA.
 * Isso é fundamental porque o Google Forms/Sheets exporta perguntas longas
 * dentro de "..." e essas aspas podem conter \n no meio. Quebrar por \n
 * antes de respeitar aspas faz o parser ver 90 linhas em vez de 1 (header).
 *
 * Convenção CSV padrão (RFC 4180):
 * - Campos entre aspas duplas podem conter sep, \n, \r
 * - Aspa dupla dentro de campo entre aspas é escapada como ""
 */
function parseCSV(texto: string, sep: string): string[][] {
  const linhas: string[][] = [];
  let linhaAtual: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];

    if (ch === '"') {
      if (inQuotes && texto[i + 1] === '"') {
        // Escape: "" dentro de campo entre aspas vira "
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      linhaAtual.push(cur);
      cur = "";
    } else if (ch === "\n" && !inQuotes) {
      linhaAtual.push(cur);
      cur = "";
      // Só adiciona linha se tem algum conteúdo
      if (linhaAtual.some((c) => c.trim().length > 0)) {
        linhas.push(linhaAtual);
      }
      linhaAtual = [];
    } else {
      cur += ch;
    }
  }

  // Última célula/linha
  if (cur.length > 0 || linhaAtual.length > 0) {
    linhaAtual.push(cur);
    if (linhaAtual.some((c) => c.trim().length > 0)) {
      linhas.push(linhaAtual);
    }
  }

  return linhas;
}

/**
 * Detecta o separador rodando parseCSV completo com cada candidato e
 * escolhendo o que produz mais colunas em média (e mais linhas).
 */
const SEPARADORES_CANDIDATOS = [
  "\t", // tab
  ",", // vírgula ASCII
  ";", // ponto-e-vírgula
  "|", // pipe
  "，", // vírgula fullwidth (Chinês/Japonês)
  "،", // vírgula árabe
];

function detectarSeparadorComLinhas(texto: string): {
  sep: string;
  linhas: string[][];
} {
  let melhorSep = ",";
  let melhorLinhas: string[][] = [];
  let melhorScore = 0;
  for (const sep of SEPARADORES_CANDIDATOS) {
    const linhas = parseCSV(texto, sep);
    if (linhas.length === 0) continue;
    const totalCols = linhas.reduce((s, r) => s + r.length, 0);
    const mediaCols = totalCols / linhas.length;
    // Score = média de colunas (preferimos sep que dá muitas colunas por linha).
    // Empate é desempatado por nº de linhas.
    const score = mediaCols * 1000 + linhas.length;
    if (score > melhorScore) {
      melhorScore = score;
      melhorSep = sep;
      melhorLinhas = linhas;
    }
  }
  return { sep: melhorSep, linhas: melhorLinhas };
}

function nomeSeparador(
  sep: string
): "tab" | "vírgula" | "ponto-e-vírgula" | "pipe" {
  if (sep === "\t") return "tab";
  if (sep === ";") return "ponto-e-vírgula";
  if (sep === "|") return "pipe";
  return "vírgula";
}

function pareceHeader(cols: string[]): boolean {
  const primeira = (cols[0] ?? "").trim().toLowerCase();
  if (!primeira) return false;
  // Palavras-chave típicas do header
  const headerKeywords = ["carimbo", "timestamp", "data/hora", "qual o seu setor"];
  for (const kw of headerKeywords) {
    if (primeira.includes(kw)) return true;
    if (cols.slice(0, 5).some((c) => c.toLowerCase().includes(kw))) return true;
  }
  // Data BR (dd/mm/aaaa) → não é header
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(primeira)) return false;
  // Serial Excel (>20000) → não é header
  if (/^\d{5,}(\.\d+)?$/.test(primeira)) return false;
  // ISO date → não é header
  if (/^\d{4}-\d{2}-\d{2}/.test(primeira)) return false;
  // Default: se primeira coluna não parece data nem número, trata como header
  return true;
}

function parseDataBR(raw: string): string | null {
  if (!raw) return null;
  // Serial Excel
  const asNum = parseFloat(raw);
  if (!Number.isNaN(asNum) && asNum > 20000 && asNum < 100000) {
    const ms = (asNum - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  // dd/mm/aaaa hh:mm:ss (formato BR do Google Forms)
  const m = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[\s,]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (m) {
    const [, dd, mm, yy, h, mi, s] = m;
    const year = yy.length === 2 ? 2000 + parseInt(yy) : parseInt(yy);
    const d = new Date(
      year,
      parseInt(mm) - 1,
      parseInt(dd),
      parseInt(h ?? "0"),
      parseInt(mi ?? "0"),
      parseInt(s ?? "0")
    );
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  // Fallback: parser do JS
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

export function parsearTexto(texto: string): ParseResult {
  const erros: string[] = [];
  const limpo = texto
    .replace(/^﻿/, "") // remove BOM se vier do clipboard do Excel/Sheets
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  const diagBase: ParseDiagnostico = {
    separador: "vírgula",
    totalLinhas: 0,
    pulouHeader: false,
    colunasPorLinha: [],
    amostraLinha: "",
    codigosNaoAscii: [],
  };

  if (!limpo) {
    return { linhas: [], erros: ["Texto vazio"], diagnostico: diagBase };
  }

  // Roda o parser CSV completo com detecção de separador. parseCSV respeita
  // aspas duplas através de quebras de linha — fundamental porque o Forms
  // exporta perguntas dentro de "..." e essas podem ter \n no meio.
  const { sep, linhas } = detectarSeparadorComLinhas(limpo);
  diagBase.separador = nomeSeparador(sep);
  diagBase.totalLinhas = linhas.length;

  if (linhas.length === 0) {
    return {
      linhas: [],
      erros: ["Nenhuma linha com conteúdo"],
      diagnostico: diagBase,
    };
  }

  diagBase.pulouHeader = pareceHeader(linhas[0]);
  const dataLinhas = diagBase.pulouHeader ? linhas.slice(1) : linhas;

  // Diagnóstico: quantas colunas tem cada uma das primeiras 5 linhas de dados
  diagBase.colunasPorLinha = dataLinhas.slice(0, 5).map((l) => l.length);

  // Diagnóstico extra: amostra raw + chars não-ASCII suspeitos
  const amostraTxt =
    dataLinhas[0]?.join(sep === "\t" ? "→" : sep) ??
    linhas[0]?.join(sep === "\t" ? "→" : sep) ??
    "";
  diagBase.amostraLinha = amostraTxt.slice(0, 200);
  const codigos = new Map<string, string>();
  for (const ch of amostraTxt.slice(0, 500)) {
    const code = ch.charCodeAt(0);
    if (code > 127 || (code < 32 && code !== 9)) {
      const key = `U+${code.toString(16).padStart(4, "0").toUpperCase()}`;
      if (!codigos.has(key)) codigos.set(key, ch);
    }
  }
  diagBase.codigosNaoAscii = Array.from(codigos.entries())
    .slice(0, 10)
    .map(([code, char]) => ({ char, code }));

  // O modelo NR-01 50P tem 50 perguntas fixas → 53 colunas total
  // (data + cargo + setor + 50 respostas).
  const totalCols = META_COLS + TOTAL_PERGUNTAS;
  const resultado: LinhaParsed[] = [];

  for (let i = 0; i < dataLinhas.length; i++) {
    const numLinhaOriginal = diagBase.pulouHeader ? i + 2 : i + 1;
    const cols = dataLinhas[i];

    if (cols.length < totalCols) {
      erros.push(
        `Linha ${numLinhaOriginal}: ${cols.length} coluna(s) — esperado ${totalCols} (data + cargo + setor + ${TOTAL_PERGUNTAS} respostas)`
      );
      continue;
    }

    // Ordem do Forms NR-01 50P: col0=data, col1=cargo, col2=setor
    const cargo = (cols[1] ?? "").trim() || null;
    const setor = (cols[2] ?? "").trim();
    if (!setor) {
      erros.push(`Linha ${numLinhaOriginal}: setor vazio (coluna 3)`);
      continue;
    }

    const respostas: number[] = [];
    let parseOk = true;
    for (let c = META_COLS; c < META_COLS + TOTAL_PERGUNTAS; c++) {
      const raw = (cols[c] ?? "").trim().replace(",", ".");
      if (raw === "") {
        respostas.push(0);
        continue;
      }
      const v = parseFloat(raw);
      if (Number.isNaN(v)) {
        erros.push(
          `Linha ${numLinhaOriginal}: resposta Q${c - 2} inválida ("${raw}")`
        );
        parseOk = false;
        break;
      }
      respostas.push(Math.max(0, Math.min(4, Math.round(v))));
    }
    if (!parseOk) continue;

    const dataIso = parseDataBR((cols[0] ?? "").trim());

    resultado.push({ setor, cargo, respostas, data_carimbo: dataIso });
  }

  if (resultado.length === 0 && erros.length === 0) {
    erros.push("Nenhum respondente válido encontrado");
  }

  return { linhas: resultado, erros, diagnostico: diagBase };
}
