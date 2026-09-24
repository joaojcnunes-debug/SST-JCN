/**
 * O seletor de ano do cadastro de veículo — e por que ele deixou de ser um
 * `<input type="number">`.
 *
 * A CICATRIZ: os campos de ano de fabricação e ano do modelo eram
 * `<input type="number">` sem `min` nem `max`, e o projeto não esconde as
 * setinhas nativas no CSS. O resultado, relatado da operação, era o campo
 * gravar `-1` ou `8` em vez do ano:
 *   • campo vazio + um clique na seta ▼ → o navegador grava -1;
 *   • campo vazio + oito cliques na ▲   → grava 8. É a CONTAGEM de cliques.
 *   • pior e silencioso: com o campo focado, girar a roda do mouse muda o ano
 *     enquanto a pessoa só queria rolar a página.
 * Não era binding nem conversão — `Number(valor)` sempre esteve certo. Era o
 * próprio controle. Lista fechada de anos mata os três casos de uma vez: não há
 * seta para contar nem roda para girar, e todo valor possível é um ano real.
 *
 * O ano mais NOVO é o que vem primeiro: carro de frota é comprado novo com mais
 * frequência do que antigo, e o ano do modelo costuma ser o do ano que vem.
 */

/** Nada anterior a isto é frota em operação — é peça de museu, e se um dia for,
 *  o cadastro aceita pelo campo de observações. Trava o dedo escorregado em
 *  "1019" tanto quanto o zero. */
export const ANO_MINIMO_VEICULO = 1970;

/**
 * Os anos oferecidos, do mais novo para o mais velho.
 *
 * `+1` no topo porque montadora vende 2027 em 2026 — e um cadastro que não
 * aceita o ano do modelo do carro zero na garagem é um cadastro que obriga a
 * mentir. O ano de referência entra por parâmetro para o teste não depender do
 * relógio.
 */
export function anosVeiculo(anoReferencia = new Date().getFullYear()): number[] {
  const topo = anoReferencia + 1;
  const anos: number[] = [];
  for (let a = topo; a >= ANO_MINIMO_VEICULO; a--) anos.push(a);
  return anos;
}

/**
 * Valida o par fabricação/modelo. Devolve null quando está tudo certo.
 *
 * As duas regras são de mundo real, não de banco:
 *   • o ano do modelo nunca é ANTERIOR ao de fabricação — o carro não sai da
 *     linha antes do modelo existir;
 *   • a diferença normal é 0 ou 1 (fabricado em 2025, modelo 2026). Mais que
 *     isso quase sempre é dedo trocado, mas NÃO bloqueia: existe importado
 *     emplacado tarde, e travar o cadastro por causa da exceção obrigaria a
 *     pessoa a inventar um ano — que é pior do que registrar o estranho.
 */
export function erroAnosVeiculo(
  anoFabricacao: number | null,
  anoModelo: number | null,
): string | null {
  if (anoFabricacao == null || anoModelo == null) return null;
  if (anoModelo < anoFabricacao) {
    return `Ano do modelo (${anoModelo}) é anterior ao de fabricação (${anoFabricacao}).`;
  }
  return null;
}

/** Aviso que não bloqueia — ver o porquê em `erroAnosVeiculo`. */
export function avisoAnosVeiculo(
  anoFabricacao: number | null,
  anoModelo: number | null,
): string | null {
  if (anoFabricacao == null || anoModelo == null) return null;
  if (anoModelo - anoFabricacao > 1) {
    return `Diferença de ${anoModelo - anoFabricacao} anos entre fabricação e modelo. Confira, mas dá para salvar assim.`;
  }
  return null;
}
