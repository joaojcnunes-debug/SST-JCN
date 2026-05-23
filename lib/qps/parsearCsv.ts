// Parser de CSV do Google Forms para QPS.
// Estrutura esperada: Carimbo | Setor | Cargo (opcional) | R1 | R2 | ... | RN
// As colunas de resposta são mapeadas por posição às perguntas ordenadas do tipo.

export interface QpsLinhaParsed {
  setor: string;
  cargo: string | null;
  respostas: Record<string, number>; // id_pergunta → valor numérico
}

export interface QpsDiagnostico {
  separador: string;
  totalLinhas: number;
  pulouHeader: boolean;
  colunasPorLinha: number[];
  amostraLinha: string | null;
  setorIdx: number;
  cargoIdx: number;
  nColsResposta: number;
  nPerguntasEsperadas: number;
}

export interface QpsParseResult {
  linhas: QpsLinhaParsed[];
  erros: string[];
  diagnostico: QpsDiagnostico;
}

export interface PerguntaOrdenadaInput {
  id_pergunta: string;
}

// ─── RFC 4180 — divide o texto completo em linhas lógicas ────────────────────
// Lida com campos entre aspas que contêm quebras de linha (comum no Forms).
function splitLinhasRFC4180(texto: string, sep: string): string[][] {
  const resultado: string[][] = [];
  let campos: string[] = [];
  let campo = "";
  let aspas = false;
  let i = 0;

  while (i < texto.length) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i += 2; }
        else { aspas = false; i++; }
      } else { campo += c; i++; }
    } else {
      if (c === '"') { aspas = true; i++; }
      else if (texto.startsWith(sep, i)) {
        campos.push(campo.trim());
        campo = "";
        i += sep.length;
      } else if (c === "\r" && texto[i + 1] === "\n") {
        campos.push(campo.trim());
        if (campos.some((f) => f.length > 0)) resultado.push(campos);
        campos = []; campo = ""; i += 2;
      } else if (c === "\n") {
        campos.push(campo.trim());
        if (campos.some((f) => f.length > 0)) resultado.push(campos);
        campos = []; campo = ""; i++;
      } else { campo += c; i++; }
    }
  }
  if (campo || campos.length > 0) {
    campos.push(campo.trim());
    if (campos.some((f) => f.length > 0)) resultado.push(campos);
  }
  return resultado;
}

// ─── Detecta separador mais provável ─────────────────────────────────────────
function detectarSep(texto: string): string {
  const amostra = texto.slice(0, 2000);
  const tab = (amostra.match(/\t/g) ?? []).length;
  const semi = (amostra.match(/;/g) ?? []).length;
  const comma = (amostra.match(/,/g) ?? []).length;
  if (tab > semi && tab > comma) return "\t";
  if (semi > comma) return ";";
  return ",";
}

// ─── Normaliza string para comparação sem acentos e minúsculas ───────────────
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function contemAlgum(s: string, palavras: string[]) {
  const n = norm(s);
  return palavras.some((p) => n.includes(p));
}

// ─── Detecta se a primeira linha é cabeçalho ─────────────────────────────────
function ehCabecalho(campos: string[]): boolean {
  return campos.some((c) =>
    contemAlgum(c, ["carimbo", "timestamp", "hora", "date", "setor", "sector"])
  );
}

// ─── Função principal ─────────────────────────────────────────────────────────
export function parsearQpsCsv(
  texto: string,
  perguntasOrdenadas: PerguntaOrdenadaInput[],
  escalaMin: number,
  escalaMax: number
): QpsParseResult {
  const linhas: QpsLinhaParsed[] = [];
  const erros: string[] = [];
  const nPerg = perguntasOrdenadas.length;

  const sep = detectarSep(texto);
  const todasLinhas = splitLinhasRFC4180(texto, sep).filter((l) => l.length > 0);

  let offset = 0;
  let pulouHeader = false;
  let setorIdx = 1;
  let cargoIdx = 2;
  let questionStartIdx = 3;

  // Detecta e processa cabeçalho
  if (todasLinhas.length > 0 && ehCabecalho(todasLinhas[0])) {
    pulouHeader = true;
    offset = 1;
    const header = todasLinhas[0];

    // Localiza colunas por keyword
    const sIdx = header.findIndex((c) =>
      contemAlgum(c, ["setor", "sector", "departamento"])
    );
    const cIdx = header.findIndex((c) =>
      contemAlgum(c, ["cargo", "funcao", "funcão", "ocupacao", "ocupação", "funcional"])
    );
    const tsIdx = header.findIndex((c) =>
      contemAlgum(c, ["carimbo", "timestamp", "data", "hora"])
    );

    if (sIdx !== -1) setorIdx = sIdx;
    if (cIdx !== -1) cargoIdx = cIdx;

    // Colunas de resposta = todos os índices exceto timestamp, setor, cargo
    const metaIdxs = new Set([tsIdx, setorIdx, cargoIdx].filter((i) => i !== -1));
    const questionCols = header
      .map((_, i) => i)
      .filter((i) => !metaIdxs.has(i));
    if (questionCols.length > 0) questionStartIdx = -1; // usamos questionColsArr
    const questionColsArr = questionCols;

    const colunasPorLinha = todasLinhas.slice(1, 6).map((l) => l.length);
    const amostraLinha = todasLinhas[1]?.join(sep).slice(0, 200) ?? null;

    let nColsResposta = 0;

    for (let li = offset; li < todasLinhas.length; li++) {
      const campos = todasLinhas[li];
      const numLinha = li + 1;

      const setor = campos[setorIdx]?.trim() ?? "";
      if (!setor) {
        erros.push(`Linha ${numLinha}: setor vazio — ignorada`);
        continue;
      }

      const cargo = cIdx !== -1 ? (campos[cargoIdx]?.trim() || null) : null;

      // Extrai respostas pelas colunas de questão identificadas
      const respostas: Record<string, number> = {};
      const answCols = questionColsArr.length > 0 ? questionColsArr : [];

      if (answCols.length === 0) {
        erros.push(`Linha ${numLinha}: nenhuma coluna de resposta detectada`);
        continue;
      }

      nColsResposta = answCols.length;

      for (let qi = 0; qi < Math.min(answCols.length, nPerg); qi++) {
        const raw = campos[answCols[qi]]?.trim() ?? "";
        if (raw === "") continue;
        const val = parseInt(raw, 10);
        if (isNaN(val)) {
          erros.push(`Linha ${numLinha}, P${qi + 1}: "${raw}" não é número — ignorada`);
          continue;
        }
        if (val < escalaMin || val > escalaMax) {
          erros.push(
            `Linha ${numLinha}, P${qi + 1}: valor ${val} fora da escala [${escalaMin}-${escalaMax}]`
          );
          continue;
        }
        respostas[perguntasOrdenadas[qi].id_pergunta] = val;
      }

      if (Object.keys(respostas).length === 0) {
        erros.push(`Linha ${numLinha}: nenhuma resposta válida — ignorada`);
        continue;
      }

      linhas.push({ setor, cargo, respostas });
    }

    return {
      linhas,
      erros,
      diagnostico: {
        separador: sep === "\t" ? "tab" : sep,
        totalLinhas: todasLinhas.length - 1,
        pulouHeader,
        colunasPorLinha,
        amostraLinha,
        setorIdx,
        cargoIdx,
        nColsResposta,
        nPerguntasEsperadas: nPerg,
      },
    };
  }

  // Sem cabeçalho: posição fixa — col0=timestamp(skip), col1=setor, col2=cargo, col3+=respostas
  const colunasPorLinha = todasLinhas.slice(0, 6).map((l) => l.length);
  const amostraLinha = todasLinhas[0]?.join(sep).slice(0, 200) ?? null;
  let nColsResposta = 0;

  for (let li = 0; li < todasLinhas.length; li++) {
    const campos = todasLinhas[li];
    const numLinha = li + 1;

    const setor = campos[setorIdx]?.trim() ?? "";
    if (!setor) {
      erros.push(`Linha ${numLinha}: setor vazio (col ${setorIdx + 1}) — ignorada`);
      continue;
    }

    const cargo = campos[cargoIdx]?.trim() || null;
    const respostas: Record<string, number> = {};
    nColsResposta = campos.length - questionStartIdx;

    for (let qi = 0; qi < nPerg; qi++) {
      const raw = campos[questionStartIdx + qi]?.trim() ?? "";
      if (raw === "") continue;
      const val = parseInt(raw, 10);
      if (isNaN(val)) {
        erros.push(`Linha ${numLinha}, P${qi + 1}: "${raw}" não é número`);
        continue;
      }
      if (val < escalaMin || val > escalaMax) {
        erros.push(
          `Linha ${numLinha}, P${qi + 1}: valor ${val} fora da escala [${escalaMin}-${escalaMax}]`
        );
        continue;
      }
      respostas[perguntasOrdenadas[qi].id_pergunta] = val;
    }

    if (Object.keys(respostas).length === 0) {
      erros.push(`Linha ${numLinha}: nenhuma resposta válida — ignorada`);
      continue;
    }

    linhas.push({ setor, cargo, respostas });
  }

  return {
    linhas,
    erros,
    diagnostico: {
      separador: sep === "\t" ? "tab" : sep,
      totalLinhas: todasLinhas.length,
      pulouHeader: false,
      colunasPorLinha,
      amostraLinha,
      setorIdx,
      cargoIdx,
      nColsResposta,
      nPerguntasEsperadas: nPerg,
    },
  };
}
