// Parser de FISPQ (Ficha de Informações de Segurança de Produto Químico)
// no formato ABNT NBR 14725. Roda 100% no navegador via regex sobre o texto
// extraído do PDF (pdfjs-dist).
//
// Objetivo: reduzir drasticamente o consumo de tokens da IA. Em vez de mandar
// 12-30k chars de PDF, mandamos:
//   1. Os campos estruturados extraídos aqui (nome, CAS, forma física, etc.)
//   2. Snippets curtos das seções 2, 8 e 11 (perigos, exposição, toxicologia)
//
// O usuário REVISA o que foi extraído antes de submeter — qualquer erro de
// parser pode ser corrigido manualmente. Princípio: "humano + parser" >
// "IA tentando ler PDF inteiro com tokens limitados".

export interface ComponenteQuimico {
  cas: string;
  nome?: string;
  concentracao?: string;
}

export interface FispqExtracted {
  /** Texto bruto extraído do PDF (preservado pra auditoria). */
  texto_completo: string;
  /** Confiança da extração: alta = pegou tudo; baixa = FISPQ fora do padrão. */
  confianca: "alta" | "media" | "baixa";

  // Seção 1 — Identificação
  nome_produto?: string;
  fabricante?: string;

  // Seção 3 — Composição
  nome_quimico?: string;
  numero_cas?: string;
  cas_componentes?: ComponenteQuimico[];
  formula_quimica?: string;
  concentracao?: string;

  // Seção 9 — Propriedades físico-químicas
  forma_fisica?: string;

  // Seção 2 — Identificação de perigos (GHS)
  frases_h?: string[];
  pictogramas_ghs?: string[];

  // Snippets das seções relevantes pra análise NR-15 (curtos, ~600 chars cada)
  snippet_perigos?: string;
  snippet_exposicao?: string;
  snippet_toxicologia?: string;
}

// =====================================================
// Helpers de regex
// =====================================================

/**
 * Procura o primeiro match de uma lista de padrões.
 * Retorna o grupo 1 (limpo) ou undefined.
 */
function primeiroMatch(
  texto: string,
  patterns: RegExp[],
  maxLen = 200
): string | undefined {
  for (const pat of patterns) {
    const m = texto.match(pat);
    if (m && m[1]) {
      const limpo = m[1].trim().replace(/\s+/g, " ");
      if (limpo.length > 1 && limpo.length < maxLen) {
        return limpo;
      }
    }
  }
  return undefined;
}

/**
 * Divide o texto em seções numeradas (1..16) procurando markers.
 * FISPQs ABNT NBR 14725 sempre têm 16 seções.
 */
function dividirEmSecoes(texto: string): Map<number, string> {
  const secoes = new Map<number, string>();

  // Padrões que indicam início de seção numerada:
  //   "SEÇÃO 1", "Seção 1", "1. IDENTIFICAÇÃO", "1 - IDENTIFICAÇÃO"
  const markerRegex =
    /(?:^|\n)\s*(?:SEÇÃO|Seção|Section)?\s*(\d{1,2})\s*[.\-:]\s+([A-ZÀ-Ÿ][^\n]{4,120})/g;

  const matches = [...texto.matchAll(markerRegex)];

  // Filtra só números 1-16 e ordena por posição
  const valid = matches
    .filter((m) => {
      const n = parseInt(m[1], 10);
      return n >= 1 && n <= 16;
    })
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  for (let i = 0; i < valid.length; i++) {
    const num = parseInt(valid[i][1], 10);
    const startIdx = (valid[i].index ?? 0) + valid[i][0].length;
    const endIdx = i + 1 < valid.length ? valid[i + 1].index ?? texto.length : texto.length;
    const conteudo = texto.slice(startIdx, endIdx).trim();

    // Só guarda se não tinha (primeira ocorrência) e tem conteúdo razoável
    if (!secoes.has(num) && conteudo.length > 20) {
      secoes.set(num, conteudo);
    }
  }

  return secoes;
}

// =====================================================
// Parser principal
// =====================================================

export function parseFispq(texto: string): FispqExtracted {
  const result: FispqExtracted = {
    texto_completo: texto,
    confianca: "baixa",
  };

  // ----- Nome do produto -----
  result.nome_produto = primeiroMatch(texto, [
    /(?:Nome\s+(?:do\s+|comercial\s+do\s+)?produto)\s*[:\-]\s*([^\n]+)/i,
    /(?:Identificação\s+do\s+produto)\s*[:\-]\s*([^\n]+)/i,
    /(?:Nome\s+da\s+substância)\s*[:\-]\s*([^\n]+)/i,
    /(?:Product\s+name)\s*[:\-]\s*([^\n]+)/i,
  ]);

  // ----- Fabricante / Fornecedor -----
  result.fabricante = primeiroMatch(
    texto,
    [
      /(?:Nome\s+(?:da\s+)?empresa)\s*[:\-]\s*([^\n]+)/i,
      /(?:Fabricante|Fornecedor)\s*[:\-]\s*([^\n]+)/i,
      /(?:Manufacturer|Supplier)\s*[:\-]\s*([^\n]+)/i,
    ],
    150
  );

  // ----- CAS numbers (todos os encontrados) -----
  // Formato CAS: 1-7 dígitos / 2 dígitos / 1 dígito (ex: 108-88-3 = Tolueno)
  const casMatches = [...texto.matchAll(/\b(\d{2,7}-\d{2}-\d)\b/g)];
  if (casMatches.length > 0) {
    const unicos = [...new Set(casMatches.map((m) => m[1]))];
    result.numero_cas = unicos[0];
    if (unicos.length > 1) {
      result.cas_componentes = unicos.slice(1, 8).map((cas) => ({ cas }));
    }
  }

  // ----- Frases H (códigos GHS de hazard) -----
  const hMatches = [...texto.matchAll(/\b(H[23]\d{2}[A-Za-z]?)\b/g)];
  if (hMatches.length > 0) {
    result.frases_h = [...new Set(hMatches.map((m) => m[1]))].sort();
  }

  // ----- Pictogramas GHS -----
  const picMatches = [...texto.matchAll(/\b(GHS0[1-9])\b/g)];
  if (picMatches.length > 0) {
    result.pictogramas_ghs = [...new Set(picMatches.map((m) => m[0]))].sort();
  }

  // ----- Fórmula química -----
  result.formula_quimica = primeiroMatch(
    texto,
    [
      /(?:Fórmula\s+(?:molecular|química|empírica))\s*[:\-]\s*([A-Z][A-Za-z0-9₀-₉()]{1,40})/,
      /(?:Molecular\s+formula)\s*[:\-]\s*([A-Z][A-Za-z0-9()]{1,40})/i,
    ],
    50
  );

  // ----- Forma física / Estado -----
  result.forma_fisica = primeiroMatch(
    texto,
    [
      /(?:Forma\s+física|Estado\s+físico|Aspecto|Physical\s+state)\s*[:\-]\s*([^\n.]+)/i,
    ],
    80
  );

  // Normaliza forma física pros valores do select
  if (result.forma_fisica) {
    const lower = result.forma_fisica.toLowerCase();
    if (lower.includes("líquid") || lower.includes("liqu")) result.forma_fisica = "Líquido";
    else if (lower.includes("sólid") || lower.includes("solid")) result.forma_fisica = "Sólido";
    else if (lower.includes("gás") || lower.includes("gas")) result.forma_fisica = "Gás";
    else if (lower.includes("vapor")) result.forma_fisica = "Vapor";
    else if (lower.includes("aerossol") || lower.includes("aerosol")) result.forma_fisica = "Aerossol";
    else if (lower.includes("pó") || lower.includes("pó")) result.forma_fisica = "Pó";
    else if (lower.includes("past")) result.forma_fisica = "Pasta";
    // senão mantém o texto original
  }

  // ----- Concentração / Pureza -----
  result.concentracao = primeiroMatch(
    texto,
    [
      /(?:Concentração)\s*(?:\(%\))?\s*[:\-]\s*([^\n]+?)(?:\n|$)/i,
      /(?:Pureza)\s*[:\-]\s*([^\n]+?)(?:\n|$)/i,
    ],
    80
  );

  // ----- Snippets das seções relevantes pra NR-15 -----
  const secoes = dividirEmSecoes(texto);
  const truncar = (s: string | undefined, max: number): string | undefined => {
    if (!s) return undefined;
    const limpo = s.replace(/\s+/g, " ").trim();
    return limpo.length > max ? limpo.slice(0, max) + "..." : limpo;
  };

  result.snippet_perigos = truncar(secoes.get(2), 600);
  result.snippet_exposicao = truncar(secoes.get(8), 600);
  result.snippet_toxicologia = truncar(secoes.get(11), 600);

  // ----- Calcula confiança baseado no que foi extraído -----
  let pontos = 0;
  if (result.nome_produto) pontos++;
  if (result.numero_cas) pontos += 2;
  if (result.frases_h && result.frases_h.length > 0) pontos += 2;
  if (result.snippet_perigos) pontos++;
  if (result.snippet_exposicao || result.snippet_toxicologia) pontos++;

  if (pontos >= 5) result.confianca = "alta";
  else if (pontos >= 3) result.confianca = "media";
  else result.confianca = "baixa";

  // Nome químico: se não tem, tenta usar o nome do produto
  if (!result.nome_quimico && result.nome_produto) {
    result.nome_quimico = result.nome_produto;
  }

  return result;
}

// =====================================================
// Montar contexto compacto pra enviar à IA
// =====================================================

/**
 * Gera string de "contexto FISPQ" pra enviar à IA junto com os dados manuais.
 * Inclui só o essencial pra análise NR-15: CAS, GHS hazards, snippets de
 * perigos/exposição/toxicologia. Total: ~1.500-2.000 chars.
 */
export function montarContextoFispq(dados: FispqExtracted): string {
  const linhas: string[] = [];

  if (dados.cas_componentes && dados.cas_componentes.length > 0) {
    linhas.push(
      `Componentes adicionais (CAS): ${dados.cas_componentes
        .map((c) => c.cas)
        .join(", ")}`
    );
  }

  if (dados.frases_h && dados.frases_h.length > 0) {
    linhas.push(`Frases H (GHS): ${dados.frases_h.join(", ")}`);
  }

  if (dados.pictogramas_ghs && dados.pictogramas_ghs.length > 0) {
    linhas.push(`Pictogramas GHS: ${dados.pictogramas_ghs.join(", ")}`);
  }

  if (dados.snippet_perigos) {
    linhas.push("");
    linhas.push("--- Seção 2 (Perigos) — extrato da FISPQ ---");
    linhas.push(dados.snippet_perigos);
  }

  if (dados.snippet_exposicao) {
    linhas.push("");
    linhas.push("--- Seção 8 (Controle de exposição) — extrato da FISPQ ---");
    linhas.push(dados.snippet_exposicao);
  }

  if (dados.snippet_toxicologia) {
    linhas.push("");
    linhas.push("--- Seção 11 (Toxicologia) — extrato da FISPQ ---");
    linhas.push(dados.snippet_toxicologia);
  }

  return linhas.join("\n");
}
