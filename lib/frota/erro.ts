/**
 * Erro cuja mensagem JÁ está escrita para o usuário final.
 *
 * POR QUE ISTO PRECISA EXISTIR: `mensagemErro()` (lib/errors.ts) nunca devolve
 * a mensagem crua de um `Error` comum — e faz certo, porque a mensagem crua de
 * um erro qualquer é SQL ou texto do driver. Ela só deixa passar quando o erro
 * traz `code: "P0001"`, que é o código do `raise exception` dos nossos próprios
 * procedimentos: "esta frase foi escrita para ser lida por gente".
 *
 * Sem este helper, um `throw new Error("Este veículo tem 12 saídas…")` chega ao
 * usuário como o fallback genérico do toast, e o motivo — que é a única parte
 * útil — some no caminho.
 *
 * Carimbar P0001 num erro que nasceu no navegador é usar o contrato que já
 * existe em vez de mexer num arquivo compartilhado por todos os módulos.
 */
export function erroParaUsuario(mensagem: string): Error {
  return Object.assign(new Error(mensagem), { code: "P0001" });
}
