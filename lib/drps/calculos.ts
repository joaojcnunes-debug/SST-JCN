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
 * Parser tolerante de TSV/CSV colado do Google Sheets/Excel.
 * Espera primeira linha como header (Carimbo | Setor | Cargo | Q1..Q90)
 * e a partir da segunda linha, cada respondente.
 *
 * Aceita separador TAB (colagem direta do Sheets) ou vírgula/ponto-e-vírgula.
 * Respostas devem ser inteiros 0..4 — valores fora desse range são clipados.
 *
 * Retorna { linhas: array, erros: array<string> }.
 */
export interface LinhaParsed {
  setor: string;
  cargo: string | null;
  respostas: number[];
  data_carimbo: string | null;
}

export function parsearTexto(texto: string): {
  linhas: LinhaParsed[];
  erros: string[];
} {
  const erros: string[] = [];
  const limpo = texto.replace(/\r\n/g, "\n").trim();
  if (!limpo) return { linhas: [], erros: ["Texto vazio"] };

  // Detecta separador olhando a primeira linha
  const primeiraLinha = limpo.split("\n")[0];
  const sep = primeiraLinha.includes("\t")
    ? "\t"
    : primeiraLinha.split(";").length > primeiraLinha.split(",").length
    ? ";"
    : ",";

  const linhas = limpo.split("\n");
  if (linhas.length < 2) {
    return { linhas: [], erros: ["Esperado header + pelo menos 1 respondente"] };
  }

  const resultado: LinhaParsed[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep);
    if (cols.length < 93) {
      erros.push(
        `Linha ${i + 1}: esperado 93 colunas (data + setor + cargo + 90 respostas), recebido ${cols.length}`
      );
      continue;
    }
    const setor = cols[1]?.trim();
    if (!setor) {
      erros.push(`Linha ${i + 1}: setor vazio — ignorada`);
      continue;
    }
    const cargo = cols[2]?.trim() || null;
    const respostas: number[] = [];
    let parseOk = true;
    for (let c = 3; c < 93; c++) {
      const raw = cols[c]?.trim().replace(",", ".");
      const v = parseFloat(raw);
      if (Number.isNaN(v)) {
        erros.push(`Linha ${i + 1}: resposta Q${c - 2} inválida ("${raw}")`);
        parseOk = false;
        break;
      }
      // Clipa para 0..4
      const clip = Math.max(0, Math.min(4, Math.round(v)));
      respostas.push(clip);
    }
    if (!parseOk) continue;

    // Tenta interpretar coluna 0 como timestamp ISO ou serial Excel
    const dataRaw = cols[0]?.trim();
    let dataIso: string | null = null;
    if (dataRaw) {
      const asNum = parseFloat(dataRaw);
      if (!Number.isNaN(asNum) && asNum > 20000) {
        // Excel serial: dias desde 1899-12-30
        const ms = (asNum - 25569) * 86400 * 1000;
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime())) dataIso = d.toISOString();
      } else {
        const d = new Date(dataRaw);
        if (!Number.isNaN(d.getTime())) dataIso = d.toISOString();
      }
    }

    resultado.push({ setor, cargo, respostas, data_carimbo: dataIso });
  }

  if (resultado.length === 0 && erros.length === 0) {
    erros.push("Nenhum respondente válido encontrado");
  }

  return { linhas: resultado, erros };
}
