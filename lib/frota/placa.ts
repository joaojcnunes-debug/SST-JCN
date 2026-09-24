/**
 * Placa: normalização e validação dos dois formatos brasileiros em circulação.
 *
 * Por que existe: a placa é digitada de todas as formas — "RJP2A45", "rjp-2a45",
 * "RJP 2A45". Se cada tela normalizar do seu jeito, o índice único do banco
 * (que compara `upper(replace(replace(placa,'-',''),' ',''))`) deixa passar
 * duplicata que a tela achava que já existia. Uma fonte só para as duas coisas.
 *
 * O banco guarda a placa COMO O USUÁRIO DIGITOU (formatada). A unicidade é
 * garantida pelo índice funcional, não por gravar tudo maiúsculo sem separador —
 * assim a tela mostra "RJP-2A45" e a busca continua achando "rjp2a45".
 */

/** Antiga: 3 letras + 4 dígitos (ABC1234). */
const RE_ANTIGA = /^[A-Z]{3}[0-9]{4}$/;
/** Mercosul: 3 letras + dígito + letra + 2 dígitos (ABC1D23). */
const RE_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

/**
 * Forma canônica para comparação: sem separador, maiúscula.
 * Espelha exatamente o índice `uniq_frota_veiculos_placa` da v177 — mudar um
 * exige mudar o outro, senão a tela e o banco discordam sobre o que é duplicata.
 */
export function normalizarPlaca(entrada: string): string {
  return entrada
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export type FormatoPlaca = "ANTIGA" | "MERCOSUL";

export function formatoPlaca(entrada: string): FormatoPlaca | null {
  const p = normalizarPlaca(entrada);
  if (RE_MERCOSUL.test(p)) return "MERCOSUL";
  if (RE_ANTIGA.test(p)) return "ANTIGA";
  return null;
}

export function placaValida(entrada: string): boolean {
  return formatoPlaca(entrada) !== null;
}

/**
 * Formatação para exibição: "RJP2A45" → "RJP-2A45".
 * Placa inválida volta como veio — formatar o que não é placa esconderia o erro
 * do usuário em vez de mostrá-lo.
 */
export function formatarPlaca(entrada: string): string {
  const p = normalizarPlaca(entrada);
  if (!placaValida(p)) return entrada;
  return `${p.slice(0, 3)}-${p.slice(3)}`;
}

/**
 * Mensagem de erro para o formulário. Devolve null quando está válida.
 * Texto explícito sobre os dois formatos: "placa inválida" sozinho faz o usuário
 * ficar tentando sem saber o que o sistema espera.
 */
export function erroPlaca(entrada: string): string | null {
  const bruta = entrada.trim();
  if (!bruta) return "Informe a placa.";
  const p = normalizarPlaca(bruta);
  if (p.length !== 7) {
    return "A placa tem 7 caracteres: ABC1234 (antiga) ou ABC1D23 (Mercosul).";
  }
  if (!placaValida(p)) {
    return "Formato não reconhecido. Use ABC1234 (antiga) ou ABC1D23 (Mercosul).";
  }
  return null;
}
