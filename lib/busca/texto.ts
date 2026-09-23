/**
 * Busca tolerante para listas carregadas em memória (empresas, setores, cargos…).
 *
 * Nasceu em 21/09/2026 do caso "empresa não aparece quando digito com acento":
 * a base segue o padrão da Receita (96% dos nomes sem acento, em MAIÚSCULAS) e
 * o filtro antigo comparava letra por letra. Aqui a comparação:
 *
 *  • ignora acento, caixa e pontuação ("Comércio" = "COMERCIO" = "comercio.");
 *  • aceita as palavras em qualquer ordem ("estoril condominio");
 *  • aceita começo de palavra ("cond" acha "CONDOMINIO");
 *  • tolera erro de digitação ("condominoi", "hopsital") — 1 erro a partir de
 *    4 letras, 2 a partir de 7;
 *  • compara código só pelos dígitos ("13.267.504" = "13267504");
 *  • quando nada bate por inteiro, devolve os MAIS PARECIDOS (parte das
 *    palavras bateu), marcando `aproximado: true` para a tela avisar.
 *
 * O resultado vem ORDENADO por semelhança: nome que começa pela busca primeiro,
 * depois quem contém a frase inteira, depois palavra a palavra.
 */

export interface ResultadoBusca<T> {
  itens: T[];
  /** true = ninguém bateu por inteiro; os itens são os mais parecidos. */
  aproximado: boolean;
}

export interface OpcoesBusca<T> {
  /** Campos comparados só pelos dígitos (CNPJ, CPF, CEI…). */
  codigos?: (item: T) => Array<string | null | undefined>;
  /** Teto de itens devolvidos quando o resultado é aproximado (padrão 50). */
  limiteAproximados?: number;
  /**
   * true = FILTRA sem reordenar (tabela já ordenada por data/status continua
   * como está). false (padrão) = RANQUEIA por semelhança — o certo para
   * seletores e listas de cadastro.
   */
  manterOrdem?: boolean;
}

/** Tira acento, baixa a caixa e troca pontuação por espaço. */
export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenizar(s: string | null | undefined): string[] {
  const n = normalizarTexto(s);
  return n ? n.split(" ") : [];
}

export function somenteDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Quantos erros de digitação uma palavra desse tamanho perdoa. */
export function toleranciaPara(tamanho: number): number {
  if (tamanho >= 7) return 2;
  if (tamanho >= 4) return 1;
  return 0;
}

/**
 * Distância de Damerau-Levenshtein (alinhamento ótimo): inserção, remoção,
 * troca e TRANSPOSIÇÃO de vizinhos contam 1 cada. Para de contar acima de
 * `max` e devolve `max + 1` — o que interessa é só "cabe na tolerância?".
 */
export function distanciaEdicao(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let anterior2: number[] = [];
  let anterior: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual: number[] = [i];
    let menorDaLinha = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, anterior2[j - 2] + 1);
      }
      atual[j] = v;
      if (v < menorDaLinha) menorDaLinha = v;
    }
    if (menorDaLinha > max) return max + 1;
    anterior2 = anterior;
    anterior = atual;
  }
  return anterior[b.length] > max ? max + 1 : anterior[b.length];
}

/** Pontuação de UMA palavra digitada contra UMA palavra do alvo (0 = não bate). */
function pontuarPalavra(digitada: string, alvo: string): number {
  if (alvo === digitada) return 10;
  if (alvo.startsWith(digitada)) return 8;
  if (digitada.length >= 3 && alvo.includes(digitada)) return 6;
  const tol = toleranciaPara(digitada.length);
  if (tol === 0) return 0;
  // Palavra inteira com erro, OU o começo da palavra do alvo com erro
  // ("condmi" → "condom|inio").
  const d = Math.min(
    distanciaEdicao(digitada, alvo, tol),
    distanciaEdicao(digitada, alvo.slice(0, digitada.length), tol),
  );
  return d <= tol ? 5 - d : 0;
}

interface Pontuado<T> {
  item: T;
  ordem: number;
  pontos: number;
  batidas: number;
}

/**
 * Filtra e ORDENA `itens` pela semelhança com `consulta`.
 * `textos` devolve os campos de texto do item (nome, razão social…).
 */
export function buscar<T>(
  itens: T[],
  consulta: string,
  textos: (item: T) => Array<string | null | undefined>,
  opcoes: OpcoesBusca<T> = {},
): ResultadoBusca<T> {
  const consultaNorm = normalizarTexto(consulta);
  if (!consultaNorm) return { itens, aproximado: false };

  const palavras = consultaNorm.split(" ");
  // Palavras curtas ("de", "do", "e") não derrubam o item se faltarem no alvo —
  // salvo quando a busca é SÓ delas.
  let obrigatorias = palavras.filter((p) => p.length >= 3 || /^\d+$/.test(p));
  if (obrigatorias.length === 0) obrigatorias = palavras;
  const obrigatoria = new Set(obrigatorias);

  const exatos: Pontuado<T>[] = [];
  const aproximados: Pontuado<T>[] = [];

  itens.forEach((item, ordem) => {
    const campos = textos(item).map(normalizarTexto).filter(Boolean);
    const palavrasAlvo = Array.from(new Set(campos.flatMap((c) => c.split(" "))));
    const codigos = (opcoes.codigos?.(item) ?? []).map(somenteDigitos).filter(Boolean);

    let pontos = 0;
    let batidas = 0;
    let faltouObrigatoria = false;
    for (const p of palavras) {
      let melhor = 0;
      for (const a of palavrasAlvo) {
        const v = pontuarPalavra(p, a);
        if (v > melhor) melhor = v;
        if (melhor === 10) break;
      }
      if (melhor === 0 && /^\d+$/.test(p) && codigos.some((c) => c.includes(p))) melhor = 10;
      if (melhor > 0) {
        pontos += melhor;
        batidas++;
      } else if (obrigatoria.has(p)) {
        faltouObrigatoria = true;
      }
    }
    if (batidas === 0) return;

    if (!faltouObrigatoria) {
      // Bônus de frase: começar pela busca vale mais que só conter a frase.
      if (campos.some((c) => c.startsWith(consultaNorm))) pontos += 25;
      else if (campos.some((c) => c.includes(consultaNorm))) pontos += 15;
      exatos.push({ item, ordem, pontos, batidas });
    } else if (batidas * 2 >= palavras.length) {
      aproximados.push({ item, ordem, pontos, batidas });
    }
  });

  const porSemelhanca = opcoes.manterOrdem
    ? (x: Pontuado<T>, y: Pontuado<T>) => x.ordem - y.ordem
    : (x: Pontuado<T>, y: Pontuado<T>) =>
        y.pontos - x.pontos || y.batidas - x.batidas || x.ordem - y.ordem;

  if (exatos.length > 0) {
    return { itens: exatos.sort(porSemelhanca).map((r) => r.item), aproximado: false };
  }
  const limite = opcoes.limiteAproximados ?? 50;
  return {
    itens: aproximados.sort(porSemelhanca).slice(0, limite).map((r) => r.item),
    aproximado: true,
  };
}
