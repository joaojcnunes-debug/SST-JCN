// DRPS — funções de cálculo da gravidade, probabilidade e matriz de risco.
//
// As regras vêm do spec PROMPT_DRPS_PSICOSSOCIAL.md (extraído da planilha
// Excel original com 111+ respondentes reais).

import { TOPICOS } from "./topicos";
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

/** Converte pontuação bruta em corrigida segundo a lógica da pergunta. */
export function pontuacaoCorrigida(
  valor: number,
  logica: "direta" | "invertida"
): number {
  return logica === "invertida" ? 4 - valor : valor;
}

/** Classifica gravidade a partir de uma pontuação corrigida 0..4. */
export function classificarGravidade(pontuacao: number): ClassificacaoGravidade {
  if (pontuacao < 1.5) return { texto: "Baixa", num: 1, cor: COR_BAIXA };
  if (pontuacao < 2.5) return { texto: "Média", num: 2, cor: COR_MEDIA };
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

/** Calcula tudo de UM tópico (10 perguntas + média + classificação). */
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
    classificacaoGravidade: classificarGravidade(mediaGravidade),
  };
}

/** Calcula os 9 tópicos para um conjunto filtrado de respondentes. */
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

const COLUNAS_ESPERADAS = 93; // data + setor + cargo + 90 respostas

/**
 * Detecta o separador testando candidatos em uma amostra das primeiras linhas
 * e escolhendo o que produz MAIS colunas em média. Inclui variantes Unicode
 * (vírgula fullwidth, pipe) que às vezes aparecem em pastes de fontes
 * estranhas (PDFs, OCR, teclados asiáticos).
 */
const SEPARADORES_CANDIDATOS = [
  "\t", // tab
  ",", // vírgula ASCII
  ";", // ponto-e-vírgula
  "|", // pipe
  "，", // vírgula fullwidth (Chinês/Japonês)
  "،", // vírgula árabe
];

function detectarSeparador(linhas: string[]): string {
  const amostra = linhas.slice(0, Math.min(10, linhas.length));
  if (amostra.length === 0) return ",";
  let melhor = ",";
  let maxMedia = 0;
  for (const sep of SEPARADORES_CANDIDATOS) {
    let total = 0;
    for (const l of amostra) {
      total += parseLine(l, sep).length;
    }
    const media = total / amostra.length;
    if (media > maxMedia) {
      maxMedia = media;
      melhor = sep;
    }
  }
  return melhor;
}

function nomeSeparador(
  sep: string
): "tab" | "vírgula" | "ponto-e-vírgula" | "pipe" {
  if (sep === "\t") return "tab";
  if (sep === ";") return "ponto-e-vírgula";
  if (sep === "|") return "pipe";
  return "vírgula";
}

function pareceHeader(linha: string, sep: string): boolean {
  const cols = parseLine(linha, sep);
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

/** Parser de uma linha que respeita aspas duplas (CSV padrão). */
function parseLine(linha: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (inQuotes && linha[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
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

  const linhasRaw = limpo.split("\n").filter((l) => l.trim().length > 0);
  diagBase.totalLinhas = linhasRaw.length;

  if (linhasRaw.length === 0) {
    return {
      linhas: [],
      erros: ["Nenhuma linha com conteúdo"],
      diagnostico: diagBase,
    };
  }

  const primeiraLinha = linhasRaw[0];
  const sep = detectarSeparador(linhasRaw);
  diagBase.separador = nomeSeparador(sep);
  diagBase.pulouHeader = pareceHeader(primeiraLinha, sep);

  const dataLinhas = diagBase.pulouHeader ? linhasRaw.slice(1) : linhasRaw;

  // Diagnóstico: quantas colunas tem cada uma das primeiras 5 linhas de dados
  diagBase.colunasPorLinha = dataLinhas
    .slice(0, 5)
    .map((l) => parseLine(l, sep).length);

  // Diagnóstico extra: amostra raw + chars não-ASCII suspeitos
  const amostra = dataLinhas[0] ?? primeiraLinha;
  diagBase.amostraLinha = amostra.slice(0, 200);
  const codigos = new Map<string, string>();
  for (const ch of amostra.slice(0, 500)) {
    const code = ch.charCodeAt(0);
    // Chars não-ASCII (>127) ou de controle exóticos (<32 mas não \t)
    if (code > 127 || (code < 32 && code !== 9)) {
      const key = `U+${code.toString(16).padStart(4, "0").toUpperCase()}`;
      if (!codigos.has(key)) codigos.set(key, ch);
    }
  }
  diagBase.codigosNaoAscii = Array.from(codigos.entries())
    .slice(0, 10)
    .map(([code, char]) => ({ char, code }));

  const resultado: LinhaParsed[] = [];

  for (let i = 0; i < dataLinhas.length; i++) {
    const numLinhaOriginal = diagBase.pulouHeader ? i + 2 : i + 1;
    const cols = parseLine(dataLinhas[i], sep);

    if (cols.length < COLUNAS_ESPERADAS) {
      erros.push(
        `Linha ${numLinhaOriginal}: ${cols.length} coluna(s) — esperado ${COLUNAS_ESPERADAS} (data + setor + cargo + 90 respostas)`
      );
      continue;
    }

    const setor = (cols[1] ?? "").trim();
    if (!setor) {
      erros.push(`Linha ${numLinhaOriginal}: setor vazio`);
      continue;
    }
    const cargo = (cols[2] ?? "").trim() || null;

    const respostas: number[] = [];
    let parseOk = true;
    for (let c = 3; c < 3 + 90; c++) {
      const raw = (cols[c] ?? "").trim().replace(",", ".");
      if (raw === "") {
        // Resposta em branco — assume 0 (não respondida)
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
