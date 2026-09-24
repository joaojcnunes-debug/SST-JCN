// Parser de CSV do Google Forms para QPS.
// Estrutura esperada: Carimbo | Setor | Cargo (opcional) | R1 | R2 | ... | RN
// As colunas de resposta são mapeadas por posição às perguntas ordenadas do tipo.
//
// Cada pergunta é lida do jeito dela (v180):
//   • pergunta COM alternativas próprias → a célula traz o TEXTO da alternativa
//     e o que se grava é a POSIÇÃO dela na lista (1 = primeira);
//   • pergunta sem alternativas → a célula traz um número dentro da escala do
//     tipo, como sempre foi.
// As duas convivem no mesmo arquivo, e os diagnósticos não se misturam: texto
// que não casou não conta como "fora da escala".

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
  /**
   * Escala que o arquivo realmente usa — menor e maior valor numérico visto nas
   * colunas de resposta, e os distintos em ordem. É o que diz se o Forms foi
   * montado em 0–5 enquanto o tipo está cadastrado 1–5.
   */
  valorMin: number | null;
  valorMax: number | null;
  valoresEncontrados: number[];
  totalForaEscala: number;
  totalNaoNumerico: number;
  /** Quantas das perguntas do tipo têm alternativas próprias (v180). */
  perguntasComAlternativas: number;
  /** Respostas de texto que não bateram com alternativa nenhuma. */
  totalAlternativaNaoCasou: number;
}

export interface QpsParseResult {
  linhas: QpsLinhaParsed[];
  erros: string[];
  diagnostico: QpsDiagnostico;
}

export interface PerguntaOrdenadaInput {
  id_pergunta: string;
  /** Alternativas próprias (v180). Vazio/ausente = a pergunta usa a escala do tipo. */
  opcoes?: string[] | null;
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

// ─── Coleta das células rejeitadas ───────────────────────────────────────────
// Um aviso por célula rejeitada vira centenas de linhas iguais na tela e esconde
// justamente o que interessa: qual escala o arquivo usa. Agrupamos por valor.

interface Coleta {
  distintos: Set<number>;
  foraEscala: Map<number, { total: number; linhas: Set<number>; perguntas: Set<number> }>;
  naoNumerico: Map<string, { total: number; linhas: Set<number> }>;
  /**
   * Texto que não bateu com alternativa nenhuma, agrupado por pergunta.
   * Fica separado do `naoNumerico` de propósito: numa pergunta de alternativas,
   * texto é o esperado — o problema é ele não constar da lista cadastrada, e a
   * mensagem precisa dizer QUAL pergunta e QUAIS eram as opções.
   */
  alternativaNaoCasou: Map<string, { qi: number; texto: string; total: number; linhas: Set<number> }>;
}

function novaColeta(): Coleta {
  return {
    distintos: new Set(),
    foraEscala: new Map(),
    naoNumerico: new Map(),
    alternativaNaoCasou: new Map(),
  };
}

// ─── Casamento de texto com alternativa (v180) ───────────────────────────────

/**
 * Chave de comparação: tira acento, caixa, espaço sobrando, pontuação de ponta
 * e o prefixo numerado que alguns formulários colocam ("1 - Nunca", "2) Sempre").
 *
 * O que ela NÃO faz é casamento aproximado. Alternativa parecida casando com a
 * errada inverteria o risco de um respondente sem ninguém perceber; melhor
 * recusar alto e a pessoa acertar o cadastro.
 */
export function chaveAlternativa(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^\s*\d+\s*[-–—.)\]:]\s*/, "")
    .replace(/[.,;:!?"'()\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Índice "chave normalizada → posição (1-based)" das alternativas da pergunta. */
function mapaAlternativas(opcoes: string[]): Map<string, number> {
  const m = new Map<string, number>();
  opcoes.forEach((o, i) => {
    const k = chaveAlternativa(o);
    // Duas alternativas que normalizam igual: a primeira manda. É cadastro
    // duvidoso, e `avisosDeCadastro` reclama disso na tela.
    if (k && !m.has(k)) m.set(k, i + 1);
  });
  return m;
}

/** Alternativas do tipo que colidem depois de normalizadas — vira aviso. */
export function avisosDeCadastro(
  perguntas: { opcoes?: string[] | null }[],
): string[] {
  const avisos: string[] = [];
  perguntas.forEach((p, qi) => {
    const opcoes = p.opcoes ?? [];
    if (opcoes.length < 2) return;
    const vistas = new Map<string, string>();
    for (const o of opcoes) {
      const k = chaveAlternativa(o);
      const antes = vistas.get(k);
      if (antes !== undefined) {
        avisos.push(
          `pergunta ${qi + 1}: as alternativas "${antes}" e "${o}" são iguais ` +
            `para efeito de comparação — a importação não consegue distinguir as duas`,
        );
      } else {
        vistas.set(k, o);
      }
    }
  });
  return avisos;
}

/**
 * Interpreta uma célula de pergunta COM alternativas próprias.
 * Devolve a posição da alternativa (1-based) ou null (rejeitada).
 */
function lerAlternativa(
  raw: string,
  numLinha: number,
  qi: number,
  opcoes: string[],
  mapa: Map<string, number>,
  coleta: Coleta,
): number | null {
  const pos = mapa.get(chaveAlternativa(raw));
  if (pos !== undefined) return pos;

  // Export que já vem com a posição em número em vez do texto. Só dentro da
  // faixa da pergunta — fora dela é erro, não conversão.
  const n = parseInt(raw, 10);
  if (!isNaN(n) && String(n) === raw.trim() && n >= 1 && n <= opcoes.length) return n;

  const chave = `${qi}|${raw}`;
  const e = coleta.alternativaNaoCasou.get(chave) ?? {
    qi,
    texto: raw,
    total: 0,
    linhas: new Set<number>(),
  };
  e.total++;
  e.linhas.add(numLinha);
  coleta.alternativaNaoCasou.set(chave, e);
  return null;
}

/** Interpreta uma célula de resposta. Devolve o número aceito ou null (rejeitada). */
function lerValor(
  raw: string,
  numLinha: number,
  qi: number,
  escalaMin: number,
  escalaMax: number,
  coleta: Coleta
): number | null {
  const val = parseInt(raw, 10);

  if (isNaN(val)) {
    const e = coleta.naoNumerico.get(raw) ?? { total: 0, linhas: new Set<number>() };
    e.total++;
    e.linhas.add(numLinha);
    coleta.naoNumerico.set(raw, e);
    return null;
  }

  coleta.distintos.add(val);

  if (val < escalaMin || val > escalaMax) {
    const e =
      coleta.foraEscala.get(val) ??
      { total: 0, linhas: new Set<number>(), perguntas: new Set<number>() };
    e.total++;
    e.linhas.add(numLinha);
    e.perguntas.add(qi + 1);
    coleta.foraEscala.set(val, e);
    return null;
  }

  return val;
}

function listaCurta(ns: number[], max = 6): string {
  const ord = [...ns].sort((a, b) => a - b);
  const head = ord.slice(0, max).join(", ");
  return ord.length > max ? `${head}… (+${ord.length - max})` : head;
}

function resumirColeta(
  coleta: Coleta,
  escalaMin: number,
  escalaMax: number,
  perguntas: PerguntaOrdenadaInput[],
): string[] {
  const msgs: string[] = [];

  // Alternativa que não casou vem PRIMEIRO: num questionário de alternativas é
  // a causa raiz, e a mensagem tem que trazer a lista cadastrada do lado, senão
  // a pessoa não tem como saber o que corrigir.
  const naoCasou = [...coleta.alternativaNaoCasou.values()].sort(
    (a, b) => b.total - a.total || a.qi - b.qi,
  );
  for (const e of naoCasou.slice(0, 10)) {
    const opcoes = perguntas[e.qi]?.opcoes ?? [];
    const amostra = e.texto.length > 40 ? `${e.texto.slice(0, 40)}…` : e.texto;
    msgs.push(
      `pergunta ${e.qi + 1}: "${amostra}" não bate com nenhuma alternativa — ` +
        `${e.total} resposta(s) descartada(s), em ${e.linhas.size} linha(s); ` +
        `cadastradas: ${opcoes.map((o) => `"${o}"`).join(" · ")}`,
    );
  }
  if (naoCasou.length > 10) {
    const resto = naoCasou.slice(10).reduce((t, e) => t + e.total, 0);
    msgs.push(
      `… e mais ${naoCasou.length - 10} texto(s) sem alternativa correspondente ` +
        `(${resto} resposta(s))`,
    );
  }

  const fora = [...coleta.foraEscala.entries()].sort((a, b) => a[0] - b[0]);
  for (const [val, e] of fora) {
    msgs.push(
      `valor ${val} fora da escala [${escalaMin}-${escalaMax}]: ` +
        `${e.total} resposta(s) descartada(s), em ${e.linhas.size} linha(s) e ` +
        `${e.perguntas.size} pergunta(s) — linhas ${listaCurta([...e.linhas])}`
    );
  }

  const textos = [...coleta.naoNumerico.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [raw, e] of textos.slice(0, 10)) {
    const amostra = raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
    msgs.push(
      `"${amostra}" não é número: ${e.total} resposta(s) descartada(s) — ` +
        `linhas ${listaCurta([...e.linhas])}`
    );
  }
  if (textos.length > 10) {
    const resto = textos.slice(10).reduce((s, [, e]) => s + e.total, 0);
    msgs.push(
      `… e mais ${textos.length - 10} texto(s) diferente(s) não numérico(s) (${resto} resposta(s))`
    );
  }

  return msgs;
}

function diagValores(coleta: Coleta, perguntas: PerguntaOrdenadaInput[]) {
  const valores = [...coleta.distintos].sort((a, b) => a - b);
  let totalForaEscala = 0;
  for (const e of coleta.foraEscala.values()) totalForaEscala += e.total;
  let totalNaoNumerico = 0;
  for (const e of coleta.naoNumerico.values()) totalNaoNumerico += e.total;

  let totalAlternativaNaoCasou = 0;
  for (const e of coleta.alternativaNaoCasou.values()) totalAlternativaNaoCasou += e.total;

  return {
    // A escala só olha as perguntas NUMÉRICAS: sem isso, um questionário todo
    // de alternativas apareceria como "escala divergente" só por não ter número.
    valorMin: valores.length > 0 ? valores[0] : null,
    valorMax: valores.length > 0 ? valores[valores.length - 1] : null,
    valoresEncontrados: valores,
    totalForaEscala,
    totalNaoNumerico,
    perguntasComAlternativas: perguntas.filter((p) => (p.opcoes?.length ?? 0) >= 2).length,
    totalAlternativaNaoCasou,
  };
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
  const coleta = novaColeta();
  const nPerg = perguntasOrdenadas.length;

  // Índice das alternativas de cada pergunta, montado uma vez — o casamento
  // roda por célula (respondentes × perguntas) e normalizar tudo a cada célula
  // seria caro num arquivo de 150 linhas × 50 perguntas.
  const mapas = perguntasOrdenadas.map((p) =>
    (p.opcoes?.length ?? 0) >= 2 ? mapaAlternativas(p.opcoes as string[]) : null,
  );

  /** Lê uma célula do jeito da pergunta: alternativa se ela tem, número se não. */
  function lerCelula(raw: string, numLinha: number, qi: number): number | null {
    const mapa = mapas[qi];
    if (mapa) {
      return lerAlternativa(
        raw, numLinha, qi, perguntasOrdenadas[qi].opcoes as string[], mapa, coleta,
      );
    }
    return lerValor(raw, numLinha, qi, escalaMin, escalaMax, coleta);
  }

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

    // Colunas de resposta = todos os índices exceto os que são REALMENTE
    // consumidos como meta.
    //
    // `cargoIdx` nasce em 2 como palpite, mas o cargo só é LIDO quando existe
    // coluna de cargo (`cIdx !== -1`). Excluí-lo mesmo assim descartava a
    // coluna 2 de um formulário SEM cargo — que é a primeira pergunta — e
    // deslocava TODAS as respostas em uma casa: cada resposta era gravada na
    // pergunta seguinte. Num questionário numérico isso passava despercebido
    // (os valores continuam dentro da escala); só apareceu quando o PER, que
    // não tem pergunta de cargo, foi importado e nenhuma resposta casou com as
    // alternativas. O setor, esse, é sempre lido — com ou sem detecção —, então
    // continua fora das perguntas.
    const metaIdxs = new Set([tsIdx, setorIdx, cIdx].filter((i) => i !== -1));
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
        const val = lerCelula(raw, numLinha, qi);
        if (val === null) continue;
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
      // O resumo por valor vem antes dos avisos de linha: é ele que explica o resto.
      erros: [
        ...avisosDeCadastro(perguntasOrdenadas),
        ...resumirColeta(coleta, escalaMin, escalaMax, perguntasOrdenadas),
        ...erros,
      ],
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
        ...diagValores(coleta, perguntasOrdenadas),
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
      const val = lerCelula(raw, numLinha, qi);
      if (val === null) continue;
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
    erros: [
      ...avisosDeCadastro(perguntasOrdenadas),
      ...resumirColeta(coleta, escalaMin, escalaMax, perguntasOrdenadas),
      ...erros,
    ],
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
      ...diagValores(coleta, perguntasOrdenadas),
    },
  };
}
