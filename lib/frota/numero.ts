/**
 * Entrada de número no módulo Frota — sem `<input type="number">`.
 *
 * POR QUE O CAMPO NUMÉRICO NATIVO FOI BANIDO DAQUI: ele produziu, em produção,
 * exatamente o bug que o operador relatou nos dois campos de ano — o campo
 * gravava `-1` ou `8` em vez do valor. As três formas de errar, todas do próprio
 * controle e nenhuma do nosso código:
 *   • campo vazio + um clique na seta ▼ → o navegador grava -1;
 *   • campo vazio + oito cliques na ▲   → grava 8, a CONTAGEM de cliques;
 *   • campo focado + roda do mouse      → o valor muda em silêncio enquanto a
 *     pessoa só queria rolar a página. Este é o pior: não deixa rastro.
 * O projeto não esconde as setinhas no CSS, então os três valem em todo campo.
 *
 * A troca é por campo de texto com `inputMode`, que mantém o teclado numérico no
 * celular — a única coisa boa que o `type="number"` dava — e filtra o que entra.
 *
 * O ANO virou `<select>` (lib/frota/ano.ts) porque ali o conjunto de valores
 * válidos é pequeno e fechado. Km e dinheiro não são: 84.210 não cabe em lista.
 */

/** Só dígito. Para km e odômetro, onde casa decimal não existe. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Dígitos e UM separador decimal, vírgula ou ponto — o que a pessoa digitar.
 *
 * Guardar o que foi digitado, em vez de normalizar na tecla, é deliberado:
 * trocar a vírgula por ponto enquanto se digita faz o cursor pular e o campo
 * "brigar" com quem escreve. A normalização acontece uma vez, no `paraDecimal`,
 * na hora de salvar.
 *
 * ⚠️ NÃO ACEITA SEPARADOR DE MILHAR, e isso é decisão, não esquecimento.
 * "1.500" é ambíguo: mil e quinhentos para um brasileiro, um vírgula cinco para
 * o `Number`. Qualquer regra que tente adivinhar erra em silêncio em algum caso
 * — e errar em silêncio num campo de dinheiro é o pior desfecho possível. Aqui
 * o segundo separador é descartado na hora, à vista de quem digita: "1.500,00"
 * vira "1.50000" na tela, feio e evidente, em vez de virar R$ 1,50 escondido.
 * Por isso os placeholders destes campos são "1500,00", sem ponto de milhar.
 */
export function apenasDecimal(valor: string): string {
  const limpo = valor.replace(/[^\d.,]/g, "");
  const primeiro = limpo.search(/[.,]/);
  if (primeiro === -1) return limpo;
  const separador = limpo[primeiro];
  return (
    limpo.slice(0, primeiro + 1) + limpo.slice(primeiro + 1).replace(/[.,]/g, "")
  ).replace(/[.,]/, separador);
}

/**
 * Texto do campo → número, ou null quando vazio/inválido.
 *
 * ACEITA VÍRGULA. É o motivo de esta função existir: `Number("12,5")` é NaN, e
 * um NaN entrando como litros faz a média de consumo do painel virar "—" sem
 * ninguém entender por quê. Aqui o problema morre na conversão.
 */
export function paraDecimal(valor: string): number | null {
  const texto = valor.trim().replace(",", ".");
  if (texto === "" || texto === ".") return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}

/** Texto do campo → inteiro, ou null. Par de `apenasDigitos`. */
export function paraInteiro(valor: string): number | null {
  const texto = valor.trim();
  if (texto === "") return null;
  const n = Number(texto);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
