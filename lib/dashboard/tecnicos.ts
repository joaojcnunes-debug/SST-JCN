/**
 * Quem é o técnico, quando o nome foi digitado à mão.
 *
 * ─── O problema medido em 2026-08-25 ───────────────────────────────────────
 *
 * O painel guarda o técnico em DOIS lugares e eles nunca conversaram:
 *
 *   `inspecoes.responsavel`          quem ABRIU a inspeção no sistema.
 *                                    Vem do usuário logado, então é sempre o
 *                                    nome exato do cadastro.
 *   `responsaveis.tecnico_responsavel`  quem FOI A CAMPO. Texto livre,
 *                                    digitado na recepção do cliente.
 *
 * O texto dos dois difere em 255 de 426 inspeções — o que parecia 60% de
 * divergência. Não era: quebrando por causa, ~244 são a MESMA pessoa escrita
 * de outro jeito ("Nathalia Correa" × "Nathalia Corrêa de Oliveira",
 * "Lédimo" × "Lédimo Duarte", 7 grafias de "Estefano do Rosario silva").
 * Pessoas de fato diferentes eram 5.
 *
 * Este arquivo é o tradutor: 43 grafias → 15 pessoas.
 *
 * ─── A regra, e por que ela recusa em vez de chutar ────────────────────────
 *
 * O casamento é por CONJUNTO DE PALAVRAS, não por parecença: o nome digitado
 * casa com o do cadastro quando todas as palavras de um cabem no outro. Isso
 * cobre nome curto, nome completo, acento e caixa — que é o defeito real.
 *
 * O que ele NÃO faz é adivinhar. Se o nome digitado casa com DOIS cadastros
 * (um "João" sozinho, com quatro Joões no painel), a função devolve o texto
 * original em vez de escolher: crédito de trabalho na pessoa errada é pior que
 * um nome fora do agrupamento, e some sem ninguém perceber. Mesma disciplina
 * do parser do QPS, que recusa alternativa parecida em vez de chutar.
 */

/** Minúscula, sem acento, sem pontuação, espaço único. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palavras que não identificam ninguém e atrapalham o casamento por conjunto
 * ("Estefano do Rosario" × "Estefano Rosário").
 */
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e"]);

function palavras(nome: string): string[] {
  return normalizarNome(nome)
    .split(" ")
    .filter((p) => p.length > 0 && !LIGACOES.has(p));
}

/**
 * Grafias que a regra de conjunto NÃO alcança, confirmadas a mão.
 *
 * Só entra aqui o que foi decidido por gente, não por parecença. Hoje é um
 * caso só: no cadastro do painel o Robson é `Robson Alves` e nas inspeções
 * sempre foi digitado `Robson Silva` (31 inspeções, mais um `ROBSON SILVS` que
 * é erro de digitação). Sobrenome diferente não casa por conjunto nenhum —
 * e é a mesma pessoa, confirmado pelo Sanmyo em 2026-08-25.
 */
export const APELIDOS: Record<string, string> = {
  "robson silva": "Robson Alves",
  "robson silvs": "Robson Alves",
};

/**
 * Devolve o nome canônico do técnico, ou o texto original quando não dá para
 * afirmar quem é.
 *
 * @param digitado  o que veio do campo de texto
 * @param cadastro  nomes dos usuários do painel (a lista canônica)
 */
export function canonicalizarTecnico(
  digitado: string | null | undefined,
  cadastro: readonly string[],
): string | null {
  const bruto = (digitado ?? "").trim();
  if (!bruto) return null;

  const apelido = APELIDOS[normalizarNome(bruto)];
  if (apelido) return apelido;

  const candidatos = candidatosDoTecnico(bruto, cadastro);

  // Nenhum casou: nome de fora do painel (técnico de unidade, por exemplo).
  // Devolve como veio — aparecer com o próprio nome é melhor que sumir.
  if (candidatos.length === 0) return bruto;

  // Ambíguo: recusa, não escolhe. Ver o cabeçalho.
  if (candidatos.length > 1) return bruto;

  return candidatos[0];
}

/**
 * Os nomes do cadastro que casam com o texto digitado — 0, 1 ou vários.
 *
 * Extraído de `canonicalizarTecnico` (que continua sendo o único jeito de
 * responder "quem é"), porque quem vai GRAVAR o vínculo precisa saber a
 * diferença entre os dois motivos de não casar: **ambíguo** (vários candidatos,
 * a regra se recusa a escolher) e **fora do painel** (nenhum candidato, é gente
 * de verdade sem login). Os dois devolvem o mesmo texto original aqui, e para a
 * tela dá no mesmo — para o backfill, não: um pede decisão humana e o outro é
 * o estado correto e definitivo.
 *
 * ⚠️ NÃO aplica os APELIDOS de propósito: apelido é decisão de gente, não
 * parecença, e quem chama precisa poder separar as duas coisas.
 */
export function candidatosDoTecnico(
  digitado: string,
  cadastro: readonly string[],
): string[] {
  const alvo = palavras(digitado);
  if (alvo.length === 0) return [];

  return cadastro.filter((nome) => {
    const c = palavras(nome);
    if (c.length === 0) return false;
    const contemTodas = (a: string[], b: string[]) => a.every((p) => b.includes(p));
    return contemTodas(c, alvo) || contemTodas(alvo, c);
  });
}
