/**
 * Tamanho mínimo de senha (v0.3.932): 8 caracteres, decisão do usuário em 11/11/2026. O servidor de login (GoTrue
 * self-host) exigia 10 ("Password should be at least 10 characters") e a tela de Usuários e as rotas de criar/trocar
 * credenciais conferiam só 6: a senha curta passava pela tela e o Salvar inteiro falhava com a mensagem em inglês.
 * A regra fica aqui, uma vez, para a tela e as rotas checarem o MESMO número que o GoTrue. O GoTrue tem de estar com
 * GOTRUE_PASSWORD_MIN_LENGTH=8; se esse valor mudar, mude SENHA_MIN junto.
 */
export const SENHA_MIN = 8;

/** Mensagem de erro da senha, ou null se ela serve. `nova`: texto para troca ("A nova senha…"). */
export function erroSenha(senha: string, nova = false): string | null {
  if (senha.length >= SENHA_MIN) return null;
  return `${nova ? "A nova senha" : "A senha"} deve ter pelo menos ${SENHA_MIN} caracteres`;
}

/** Tradução da recusa do GoTrue, para o caso de o mínimo do servidor ser maior que o SENHA_MIN. */
export function traduzirErroSenha(msg: string): string {
  const m = /password should be at least (\d+) characters/i.exec(msg);
  return m ? `A senha deve ter pelo menos ${m[1]} caracteres` : msg;
}
