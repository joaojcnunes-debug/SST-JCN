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

/**
 * Origem de um campo extraído da FISPQ — usado pra UI mostrar pro
 * usuário o nível de confiança por campo. Marcado em cascata:
 *   parser (regex local) → base (catálogo JCN Consultoria) → ia (fallback IA)
 *   → manual (usuário editou).
 */
export type FonteCampo = "base" | "parser" | "ia" | "manual";

export interface FontesCampos {
  nome_produto?: FonteCampo;
  fabricante?: FonteCampo;
  formula_quimica?: FonteCampo;
  forma_fisica?: FonteCampo;
  nome_quimico?: FonteCampo;
  numero_cas?: FonteCampo;
  concentracao?: FonteCampo;
}

export interface ComponenteQuimico {
  cas: string;
  nome?: string;
  concentracao?: string;
  /** Origem do nome deste componente (catálogo / parser / IA / manual). */
  fonte_nome?: FonteCampo;
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

  /** Origem de cada campo top-level (pra indicador visual no review). */
  _fontes?: FontesCampos;
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

// Rótulos de campos de FISPQ — usados pra strippar quando pdfjs junta
// label+valor numa linha só (layout em colunas/tabela).
const LABEL_PRODUTO_PATTERNS = [
  /^Nome\s+(?:do\s+|comercial\s+do\s+)?produto\s*[:\-]?\s*/i,
  /^Identificador\s+do\s+produto\s*[:\-]?\s*/i,
  /^Identificação\s+do\s+produto\s*[:\-]?\s*/i,
  /^Designação\s+comercial\s*[:\-]?\s*/i,
  /^Nome\s+comercial\s*[:\-]?\s*/i,
  /^Nome\s+da\s+(?:substância|mistura)\s*[:\-]?\s*/i,
  /^(?:Product|Trade)\s+name\s*[:\-]?\s*/i,
];

const LABEL_COMPONENTE_PATTERNS = [
  /^Nome\s+(?:químico|da\s+substância|do\s+ingrediente|do\s+componente)\s*[:\-]?\s*/i,
  /^Identificação\s+química\s*[:\-]?\s*/i,
  /^(?:Chemical|Component|Ingredient)\s+name\s*[:\-]?\s*/i,
  /^Número\s+(?:CAS|CE|de\s+registo)\s*[:\-]?\s*/i,
  /^(?:CAS|CE|EC|REACH)\s*(?:n[°º.]?|number|no\.?)?\s*[:\-]?\s*/i,
  /^Concentração\s*(?:\(%\))?\s*[:\-]?\s*/i,
  /^Concentration\s*(?:\(%\))?\s*[:\-]?\s*/i,
];

/** Remove rótulo de prefixo se a string começa com um. */
function stripLabel(s: string | undefined, patterns: RegExp[]): string | undefined {
  if (!s) return s;
  let cleaned = s.trim();
  // Aplica em loop pq pode ter múltiplos rótulos concatenados
  // (ex.: "Nome do produto Identificador do produto MC-2BK106")
  for (let i = 0; i < 3; i++) {
    let changed = false;
    for (const pat of patterns) {
      const next = cleaned.replace(pat, "");
      if (next !== cleaned) {
        cleaned = next.trim();
        changed = true;
      }
    }
    if (!changed) break;
  }
  return cleaned || undefined;
}

/** Verdadeiro se a string é só palavra(s) de cabeçalho/rótulo (sem dado real). */
function ehSoRotulo(s: string | undefined): boolean {
  if (!s) return true;
  const trimmed = s.trim();
  if (!trimmed) return true;
  // Rótulos puros: "Número", "Nome", "CAS", "Concentração" etc.
  const rotuloPuro = /^(?:número|nome|cas|ce|ec|reach|concentração|concentration|component|ingredient|chemical|substance|substância|mistura|produto|product|trade|identificação|identificador|designação|endereço|telefone|fax|email|e-mail|cnpj|cep|fabricante|fornecedor|manufacturer|supplier|address|phone)(?:\s+(?:químico|comercial|cas|ce|do\s+produto|da\s+substância|da\s+mistura|da\s+empresa|name|number))?\s*[:\-#]?\s*$/i;
  return rotuloPuro.test(trimmed);
}

/**
 * Detecta linhas que são cabeçalhos/labels de seções da FISPQ (NÃO podem
 * ser nome de produto nem nome de componente). Cobre seções 1-16 e
 * sub-seções típicas (1.1 Identificação do produto, 1.2 Usos recomendados,
 * 3.1 Substância, 3.2 Mistura, etc.).
 */
const FISPQ_HEADER_PATTERNS: RegExp[] = [
  // Section 1 sub-headers
  /^principais?\s+usos?\b/i,
  /^usos?\s+(recomendados?|identificados?|relevantes?)\b/i,
  /^recomendações?\s+de\s+uso\b/i,
  /^restriçõe?s?\s+de\s+uso\b/i,
  /^restriçõe?s?\s+recomendadas?\b/i,
  /^uso\s+(industrial|profissional|do\s+produto)\b/i,
  // Identification labels
  /^identificação\s+(do|da|de)\b/i,
  /^identificador\b/i,
  // Company / contact labels
  /^(fabricante|fornecedor|distribuidor|importador|empresa)\b\s*[:\-]?\s*$/i,
  /^(endereço|telefone|fax|e-?mail|cnpj|cep|site|website|contato)\b/i,
  /^(manufacturer|supplier|address|phone|email)\b/i,
  // Emergency
  /^(emergência|emergency|telefone\s+de\s+emergência)\b/i,
  // Section 9 leak (physical properties)
  /^(estado\s+físico|forma\s+física|aparência|aspecto|cor|odor|p\.?\s*ebulição|p\.?\s*fusão)\b\s*[:\-]?\s*$/i,
  // Section 2 / 3 / 8 labels that might appear before a CAS
  /^(composição|composition|misturas?|substâncias?)\b\s*[:\-]?\s*$/i,
  /^(classificação|classification)\b/i,
  /^(perigos?|hazard)\b/i,
];

/**
 * Verdadeiro se a linha bate em algum padrão de header conhecido de FISPQ.
 * Use junto com `ehSoRotulo` pra filtrar lixo antes de aceitar texto como
 * nome de produto / componente.
 */
function ehHeaderFispq(s: string | undefined): boolean {
  if (!s) return true;
  const trimmed = s.trim();
  if (!trimmed) return true;
  for (const pat of FISPQ_HEADER_PATTERNS) {
    if (pat.test(trimmed)) return true;
  }
  return false;
}

/**
 * Limpa um valor extraído cortando-o no primeiro rótulo subsequente
 * (Endereço, Telefone, CNPJ, etc.). Útil quando pdfjs concatena
 * colunas e a regex captura "Acme Corp Endereço: Rua X" — queremos
 * só "Acme Corp".
 */
function cortarNoProximoLabel(s: string | undefined): string | undefined {
  if (!s) return s;
  const labels = /\b(endereço|telefone|fax|e-?mail|cnpj|cep|site|website|contato|address|phone|manufacturer|supplier)\s*[:\-]/i;
  const m = s.match(labels);
  if (m && m.index !== undefined) {
    const cortado = s.slice(0, m.index).trim();
    return cortado || undefined;
  }
  return s;
}

/**
 * Extrai concentração de uma string. Aceita:
 *   - "60%"                     (valor simples com %)
 *   - "10-15%" ou "10 - 15 %"   (range com %)
 *   - "21,750 - 36,250"         (range sem % — comum em tabela ABNT
 *     onde o cabeçalho da coluna já diz "(%)")
 *
 * Remove CAS da string antes de buscar — evita confundir "100-41-4"
 * com um range "100-41".
 *
 * Retorna o valor já normalizado (sem espaços) com `%` no final se
 * estava faltando.
 */
function extrairConcentracao(target: string): string | undefined {
  // Tira CAS e CE/EC da linha pra evitar falso positivo:
  //   - CAS: `\d{2,7}-\d{2}-\d` (ex: 64-17-5, 100-41-4)
  //   - CE/EC: `\d{3}-\d{3}-\d` (ex: 200-578-6, 205-500-4)
  const limpa = target
    .replace(/\b\d{2,7}-\d{2}-\d\b/g, "")
    .replace(/\b\d{3}-\d{3}-\d\b/g, "");

  // Padrão 1: range COM `%` (ex: "10-15%", "21,5-30%")
  let m = limpa.match(
    /(\d{1,3}(?:[,.]\d+)?\s*[-–]\s*\d{1,3}(?:[,.]\d+)?\s*%)/
  );
  if (!m) {
    // Padrão 2: range SEM `%` mas com decimal em AMBOS os números.
    // `\d{1,4}` no decimal limita capacidade da regex, e `(?!\d)` no
    // final impede capturar concatenação tipo "21,750-36,25021,000"
    // como se fosse uma única string "21,750-36,25021".
    m = limpa.match(
      /(\d{1,3}[,.]\d{1,4}\s*[-–]\s*\d{1,3}[,.]\d{1,4})(?!\d)/
    );
  }
  if (!m) {
    // Padrão 3: valor único com `%` obrigatório
    m = limpa.match(/(\d{1,3}(?:[,.]\d+)?\s*%)/);
  }
  if (!m) return undefined;
  let val = m[1].replace(/\s+/g, "");
  // Heurística: se não tem `%` mas é range, assume concentração
  // (cabeçalho da coluna ABNT diz `(%)`).
  if (!val.includes("%")) val = val + "%";
  return val;
}

/**
 * Extrai TODAS as concentrações encontradas no texto, na ORDEM em
 * que aparecem. Usado como fallback column-major: se a seção 3 do PDF
 * tem layout em coluna (todos os CAS empilhados, depois todas as
 * concentrações), o lookup ±N por linha não encontra. Aqui pegamos a
 * lista completa e pareamos por índice com os componentes.
 */
function extrairTodasConcentracoes(texto: string): string[] {
  // Strippa CAS e CE primeiro pra evitar falsos positivos
  const limpa = texto
    .replace(/\b\d{2,7}-\d{2}-\d\b/g, " ")
    .replace(/\b\d{3}-\d{3}-\d\b/g, " ");
  const resultados: string[] = [];
  // Padrão 1: range com `%`
  const padraoComPercent =
    /\d{1,3}(?:[,.]\d+)?\s*[-–]\s*\d{1,3}(?:[,.]\d+)?\s*%/g;
  // Padrão 2: range com decimal em ambos
  const padraoDecimal =
    /\d{1,3}[,.]\d{1,4}\s*[-–]\s*\d{1,3}[,.]\d{1,4}(?!\d)/g;

  // Coleta todos os matches com posição pra ordenar depois
  const itens: Array<{ idx: number; val: string }> = [];
  for (const m of limpa.matchAll(padraoComPercent)) {
    if (m.index !== undefined) {
      itens.push({ idx: m.index, val: m[0].replace(/\s+/g, "") });
    }
  }
  // Marca regiões já cobertas pra padrão 2 não duplicar
  const cobertos = new Set<number>();
  for (const it of itens) {
    for (let k = it.idx; k < it.idx + it.val.length; k++) cobertos.add(k);
  }
  for (const m of limpa.matchAll(padraoDecimal)) {
    if (m.index === undefined) continue;
    if (cobertos.has(m.index)) continue;
    let val = m[0].replace(/\s+/g, "");
    if (!val.includes("%")) val = val + "%";
    itens.push({ idx: m.index, val });
  }
  itens.sort((a, b) => a.idx - b.idx);
  for (const it of itens) resultados.push(it.val);
  return resultados;
}

/**
 * Tenta extrair componentes vinculados (nome + CAS + concentração) da
 * seção 3 da FISPQ.
 *
 * FISPQs reais variam muito de formato:
 *   FORMATO A (1 linha):  "Tolueno   108-88-3   60%"
 *   FORMATO B (multi-linha):
 *      "2-Butanone"
 *      "Número CAS: 78-93-3    Número CE: ...    80-84.9%"
 *
 * Estratégia: pra cada CAS encontrado, olha:
 *   - LINHAS ANTERIORES (até 3) pra achar o nome (pula linhas de cabeçalho,
 *     linhas só com %, linhas com outro CAS)
 *   - LINHA ATUAL + ±1 pra achar a concentração
 *
 * Se nome NÃO foi achado nas linhas anteriores, tenta extrair do início
 * da própria linha (FORMATO A).
 */
function extrairComponentesDeSecao3(secao3: string | undefined): ComponenteQuimico[] {
  if (!secao3) return [];

  const linhas = secao3.split(/\n/).map((l) => l.trim());
  const componentes: ComponenteQuimico[] = [];

  // Padrões de linhas que NÃO podem ser nome de químico
  const ehCabecalho = (s: string): boolean => {
    if (s.length < 2 || s.length > 100) return true;
    if (!/[a-zA-ZÀ-ÿ]/.test(s)) return true; // só números/símbolos
    // Rótulo puro (Número, Nome, CAS, Concentração, Endereço, Fabricante...)
    if (ehSoRotulo(s)) return true;
    // Headers genéricos de FISPQ (Principais usos, Identificação, Endereço,
    // Estado físico, etc.) — cobre seções 1, 2, 8 e 9 que costumam vazar
    // na seção 3 quando pdfjs concatena colunas.
    if (ehHeaderFispq(s)) return true;
    // Cabeçalhos numerados / título de seção
    if (/^(seção|section|capítulo)\b/i.test(s)) return true;
    if (/^\d+\.\d/.test(s)) return true; // "3.1.", "3.2."
    // Frases H, pictogramas, advertências
    if (/^h\d{3}\b/i.test(s)) return true;
    if (/(GHS|pictograma|advertência|hazard\s+statement)/i.test(s)) return true;
    // Linhas só com CAS ou só com %
    if (/^(número\s+cas|cas\s*[:#]|cas\s*n[°º]?)/i.test(s)) return true;
    if (/^(número\s+ce|ce\s*[:#])/i.test(s)) return true;
    if (/^(número\s+(de\s+)?registo|reach\b)/i.test(s)) return true;
    if (/^\d+\s*[-–,.]?\s*\d*\s*%/.test(s)) return true;
    if (/^\d{2,7}-\d{2}-\d\b/.test(s)) return true;
    return false;
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha) continue;
    const casMatch = linha.match(/\b(\d{2,7}-\d{2}-\d)\b/);
    if (!casMatch) continue;

    const cas = casMatch[1];

    // ----- Procura nome do componente -----
    // 1) Primeiro tenta extrair do início da MESMA linha (FORMATO A)
    let nome: string | undefined;
    const idxCas = linha.indexOf(casMatch[0]);
    let prefixo = linha
      .slice(0, idxCas)
      // Strippa bullets de lista (1), 1., *, •, "1 -") mas PRESERVA
      // locators químicos (1,3,5-, 2-, 1,1-) — não strippa "1," nem
      // "1-" seguido de letra.
      .replace(
        /^(?:\d+\)\s*|\d+\.\s+|\d+:\s+|\d+\s+[-–]\s+|\*+\s*|•+\s*|[-–]\s+)/,
        ""
      )
      .replace(/(número\s+cas|cas\s*n[°º]?|cas\s*[:#])\s*$/i, "")
      .replace(/[:#]\s*$/, "")
      .trim();
    // Strippa rótulos no INÍCIO do prefixo (ex.: "Nome químico 2-Butanone" → "2-Butanone")
    prefixo = stripLabel(prefixo, LABEL_COMPONENTE_PATTERNS) ?? "";
    if (prefixo && /[a-zA-ZÀ-ÿ]/.test(prefixo) && prefixo.length <= 80 && !ehCabecalho(prefixo)) {
      nome = prefixo;
    }

    // 2) Se não achou na linha, olha linhas ANTERIORES (até 15 voltando).
    // Lookback maior cobre layout em coluna onde pdfjs extrai TODOS os
    // nomes primeiro, depois TODOS os CAS — fica até 8-10 linhas entre
    // nome e CAS correspondente em tabelas ABNT.
    if (!nome) {
      for (let back = 1; back <= 15 && i - back >= 0; back++) {
        const candidato = linhas[i - back];
        if (!candidato) continue;
        if (ehCabecalho(candidato)) continue;
        // Tenta strippar rótulos da linha candidata
        const candidatoLimpo = stripLabel(candidato, LABEL_COMPONENTE_PATTERNS);
        if (!candidatoLimpo || ehCabecalho(candidatoLimpo)) continue;
        nome = candidatoLimpo;
        break;
      }
    }

    // ----- Procura concentração (na linha atual + ±5) -----
    // Aceita: "60%", "10-15%", "21,750 - 36,250" (sem % — comum em tabelas
    // ABNT onde o cabeçalho da coluna já diz "(%)"). Remove CAS e CE da
    // linha antes de buscar pra evitar falsos positivos. Range maior
    // (±5) cobre layout em coluna onde pdfjs separa CAS e concentração
    // em mais linhas.
    let concentracao: string | undefined;
    for (let off = 0; off <= 5 && !concentracao; off++) {
      for (const dir of [0, -1, 1]) {
        const idx = i + dir * off;
        if (idx < 0 || idx >= linhas.length) continue;
        const target = linhas[idx];
        if (!target) continue;
        concentracao = extrairConcentracao(target);
        if (concentracao) break;
      }
    }

    // ----- Limpa o nome: se trouxe % ou range junto, separa -----
    // FISPQs frequentemente tem "2-Butanone     80-84.9%" na mesma linha;
    // pdfjs extrai isso colado. Extrai o % pra concentracao se ainda não
    // foi achado, e tira do nome.
    if (nome) {
      const concNoNome = nome.match(
        /(\d{1,3}(?:[,.]\d+)?(?:\s*[-–]\s*\d{1,3}(?:[,.]\d+)?)?\s*%)/
      );
      if (concNoNome) {
        if (!concentracao) concentracao = concNoNome[0].replace(/\s+/g, "");
        nome = nome.replace(concNoNome[0], "").trim();
      }
      // Strippa rótulos novamente (defesa em profundidade)
      nome = stripLabel(nome, LABEL_COMPONENTE_PATTERNS);
      // Limpa lixo final (vírgulas, dois-pontos, hyphens órfãos)
      if (nome) {
        nome = nome.replace(/[,;:\-–\s]+$/, "").trim();
        if (!nome || !/[a-zA-ZÀ-ÿ]/.test(nome) || ehSoRotulo(nome)) {
          nome = undefined;
        } else if (nome.length > 120) {
          nome = nome.slice(0, 120) + "...";
        }
      }
    }

    componentes.push({ cas, nome, concentracao });
  }

  // Remove duplicados (mesmo CAS aparecendo várias vezes) — mantem 1ª ocorrência
  const vistos = new Set<string>();
  const unicos: ComponenteQuimico[] = [];
  for (const c of componentes) {
    if (!vistos.has(c.cas)) {
      vistos.add(c.cas);
      unicos.push(c);
    }
  }

  // ----- Fallback column-major pra concentração -----
  // Se sobraram componentes sem concentração e a quantidade de concs
  // encontradas globalmente na seção 3 bate com a quantidade de
  // componentes, pareia por índice (assume tabela com 1 conc por
  // componente, na mesma ordem). Cobre layout pdfjs em coluna.
  const semConc = unicos.filter((c) => !c.concentracao).length;
  if (semConc > 0) {
    const todasConcs = extrairTodasConcentracoes(secao3);
    if (todasConcs.length === unicos.length) {
      for (let k = 0; k < unicos.length; k++) {
        if (!unicos[k].concentracao && todasConcs[k]) {
          unicos[k].concentracao = todasConcs[k];
        }
      }
    }
  }

  return unicos.slice(0, 12);
}

/**
 * Divide o texto em seções numeradas (1..16) procurando markers.
 * FISPQs ABNT NBR 14725 sempre têm 16 seções.
 *
 * Aceita variações:
 *   - "SEÇÃO 1: Identificação"
 *   - "Seção 1 - Identificação"
 *   - "1. IDENTIFICAÇÃO" (sem palavra "seção")
 *   - "Section 3" (em inglês)
 *   - "3.2. Misturas" → conta como início da seção 3 também
 */
function dividirEmSecoes(texto: string): Map<number, string> {
  const secoes = new Map<number, string>();

  // Padrões que indicam início de seção numerada (no início de linha).
  // Aceita `.`, `:`, `-`, `–` como separador. O `\s+` obrigatório depois
  // do separador evita conflito com nomes químicos tipo "2-Butanone" ou
  // CAS "100-41-4" (que não têm espaço depois do `-`). E o grupo de
  // título exige começar com letra, descartando combinações com dígitos.
  const markerRegex =
    /(?:^|\n)\s*(?:SEÇÃO|Seção|Section)?\s*(\d{1,2})(?:\.\d+)?\s*[-–.:]\s+([A-ZÀ-Ÿa-zà-ÿ][^\n]{3,120})/g;

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
    // Procura próximo marker que seja de OUTRA seção numérica
    let endIdx = texto.length;
    for (let j = i + 1; j < valid.length; j++) {
      const proxNum = parseInt(valid[j][1], 10);
      if (proxNum !== num) {
        endIdx = valid[j].index ?? texto.length;
        break;
      }
    }
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
  // Tenta vários padrões comuns em FISPQs brasileiras e internacionais.
  // Também tenta achar o nome em formato "Nome do produto\nValor" (com
  // o valor na linha de baixo).
  result.nome_produto = primeiroMatch(texto, [
    // Formato "Nome: X" na mesma linha
    /(?:^|\n)\s*(?:Nome\s+(?:do\s+|comercial\s+do\s+)?produto)\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:Identificador\s+do\s+produto)\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:Identificação\s+do\s+produto)\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:Designação\s+comercial)\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:Nome\s+comercial)\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:Nome\s+da\s+substância)\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:Nome\s+da\s+mistura)\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:Nome\s+químico)\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:Product\s+name)\s*[:\-]\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:Trade\s+name)\s*[:\-]\s*([^\n]+)/i,
    // Formato "Nome do produto\nValor" (label e valor em linhas separadas)
    /(?:Nome\s+(?:do\s+|comercial\s+do\s+)?produto|Identificador\s+do\s+produto|Designação\s+comercial)\s*\n\s*([A-ZÀ-Ÿa-zà-ÿ][^\n]{2,80})/i,
    /(?:Product\s+name|Trade\s+name)\s*\n\s*([A-Za-z][^\n]{2,80})/i,
  ]);

  // Fallback: pega a seção 1 e tenta achar o nome dentro dela
  if (!result.nome_produto) {
    const secoes = dividirEmSecoes(texto);
    const s1 = secoes.get(1) ?? "";
    // Procura linha que comece com texto razoável (ex. nome do produto
    // pode estar logo após o título da seção 1, sem rótulo)
    const linhas1 = s1.split(/\n/).map((l) => l.trim());
    for (const linha of linhas1) {
      if (!linha) continue;
      if (linha.length < 3 || linha.length > 150) continue;
      if (!/[a-zA-ZÀ-ÿ]/.test(linha)) continue;
      // Pula linhas com dados óbvios de não-nome
      if (/(cnpj|telefone|endereço|address|phone|emergência|email|@)/i.test(linha)) continue;
      // Pula sub-headers de FISPQ (Principais usos, Identificação, etc.)
      if (ehHeaderFispq(linha)) continue;
      // Se a linha começa com rótulo "Nome do produto X" (sem `:` ou `-`),
      // tira o rótulo e usa o resto. Acontece com PDFs em colunas onde
      // pdfjs junta rótulo+valor na mesma linha sem separador.
      const stripped = stripLabel(linha, LABEL_PRODUTO_PATTERNS);
      if (
        stripped &&
        stripped !== linha &&
        stripped.length >= 3 &&
        !ehSoRotulo(stripped) &&
        !ehHeaderFispq(stripped)
      ) {
        result.nome_produto = stripped;
        break;
      }
      // Pula linhas que parecem ser cabeçalho de seção
      if (/^(seção|section|\d+\.|identific|nome|product|trade)\b/i.test(linha)) continue;
      result.nome_produto = linha;
      break;
    }
  }

  // Defesa em profundidade: se chegou um valor com rótulo grudado (ex.:
  // "Nome do produto MC-2BK106"), strippa o rótulo aqui também e
  // descarta se sobrar só header.
  if (result.nome_produto) {
    const limpo = stripLabel(result.nome_produto, LABEL_PRODUTO_PATTERNS);
    if (limpo && !ehSoRotulo(limpo) && !ehHeaderFispq(limpo)) {
      result.nome_produto = limpo;
    } else {
      result.nome_produto = undefined;
    }
  }

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

  // Limpa fabricante: corta no próximo label (caso pdfjs grude
  // "Acme Corp Endereço: Rua X") e descarta se o que sobrou for só
  // rótulo ("Endereço:", "Telefone:" etc.) sem dado real.
  if (result.fabricante) {
    const cortado = cortarNoProximoLabel(result.fabricante);
    if (cortado && !ehSoRotulo(cortado) && !ehHeaderFispq(cortado)) {
      result.fabricante = cortado;
    } else {
      result.fabricante = undefined;
    }
  }

  // ----- Componentes (nome + CAS + concentração vinculados) -----
  // Estratégia: primeiro tenta extrair da Seção 3 (composição) — vai ter
  // nome + CAS + concentração ligados. Se não achar nada, faz fallback pro
  // método antigo (pega TODOS os CAS soltos no documento).
  const secoes = dividirEmSecoes(texto);
  const componentesS3 = extrairComponentesDeSecao3(secoes.get(3));

  if (componentesS3.length > 0) {
    // Achamos na Seção 3 — usa o 1º como "principal"
    result.numero_cas = componentesS3[0].cas;
    if (componentesS3[0].nome) result.nome_quimico = componentesS3[0].nome;
    if (componentesS3[0].concentracao)
      result.concentracao = componentesS3[0].concentracao;
    // Demais ficam em cas_componentes
    result.cas_componentes = componentesS3.slice(1);
  } else {
    // Fallback: pega todos CAS soltos no documento (método antigo)
    const casMatches = [...texto.matchAll(/\b(\d{2,7}-\d{2}-\d)\b/g)];
    if (casMatches.length > 0) {
      const unicos = [...new Set(casMatches.map((m) => m[1]))];
      result.numero_cas = unicos[0];
      if (unicos.length > 1) {
        result.cas_componentes = unicos.slice(1, 8).map((cas) => ({ cas }));
      }
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
  // Tenta primeiro com separador `:` ou `-`, depois com `\s+` (colunas
  // sem separador), e por fim faz fallback procurando palavras-chave
  // diretamente na seção 9 (Propriedades físico-químicas).
  result.forma_fisica = primeiroMatch(
    texto,
    [
      /(?:Forma\s+física|Estado\s+físico|Aspecto|Physical\s+state)\s*[:\-]\s*([^\n.]+)/i,
      /(?:Forma\s+física|Estado\s+físico|Aspecto|Physical\s+state)\s*\n\s*([A-ZÀ-Ÿa-zà-ÿ][^\n.]{2,60})/i,
      // Sem separador (colunas) — captura a primeira palavra "líquido/sólido/gás/etc"
      /(?:Forma\s+física|Estado\s+físico|Aspecto)\s+(Líquido|Sólido|Gás|Vapor|Aerossol|Pó|Pasta|Granulado|Cristalino)\b/i,
    ],
    80
  );

  // Fallback: procura palavra-chave na seção 9
  if (!result.forma_fisica) {
    const s9 = secoes.get(9);
    if (s9) {
      const m = s9.match(
        /\b(L[ií]quido|S[óo]lido|G[áa]s(?:oso)?|Vapor|Aeross?ol|P[óo]\b|Pasta|Granulado|Cristalino)\b/i
      );
      if (m) result.forma_fisica = m[1];
    }
  }

  // Normaliza forma física pros valores do select
  if (result.forma_fisica) {
    const lower = result.forma_fisica.toLowerCase();
    if (lower.includes("líquid") || lower.includes("liqu")) result.forma_fisica = "Líquido";
    else if (lower.includes("sólid") || lower.includes("solid")) result.forma_fisica = "Sólido";
    else if (lower.includes("gás") || lower.includes("gas")) result.forma_fisica = "Gás";
    else if (lower.includes("vapor")) result.forma_fisica = "Vapor";
    else if (lower.includes("aerossol") || lower.includes("aerosol")) result.forma_fisica = "Aerossol";
    else if (lower.includes("pó") || lower === "po") result.forma_fisica = "Pó";
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
  // (variavel `secoes` ja' foi calculada acima pra extrair componentes)
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

  // Marca origem de cada campo como "parser" — etapas subsequentes
  // (enrichment via base, fallback IA, edição manual) sobrescrevem
  // essas fontes conforme o valor for atualizado.
  result._fontes = {
    nome_produto: result.nome_produto ? "parser" : undefined,
    fabricante: result.fabricante ? "parser" : undefined,
    formula_quimica: result.formula_quimica ? "parser" : undefined,
    forma_fisica: result.forma_fisica ? "parser" : undefined,
    nome_quimico: result.nome_quimico ? "parser" : undefined,
    numero_cas: result.numero_cas ? "parser" : undefined,
    concentracao: result.concentracao ? "parser" : undefined,
  };
  // Idem para componentes secundários
  if (result.cas_componentes) {
    result.cas_componentes = result.cas_componentes.map((c) => ({
      ...c,
      fonte_nome: c.nome ? "parser" : undefined,
    }));
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
