/**
 * O nome curto que aparece na grade, DERIVADO do nome da conta do painel.
 *
 * Por que derivar em vez de perguntar: a partir de 02/09 o supervisor é
 * cadastrado escolhendo a conta do painel, e não digitando um nome. Pedido
 * dele ao testar: "apenas a conta do painel já basta... não precisaríamos
 * colocar outro nome". A grade continua precisando de algo curto — a coluna
 * tem largura de dia de semana, não de nome completo — então o curto sai do
 * próprio nome da conta.
 *
 * O DESEMPATE É A RAZÃO DE ISTO SER UMA FUNÇÃO, e não um `split(" ")[0]`:
 * duas Marias na equipe virariam duas colunas "Maria" e a grade mentiria sobre
 * quem trabalha onde. Quando o primeiro nome já está em uso, entra a inicial
 * do sobrenome; se ainda assim empatar, o sobrenome inteiro.
 */

/** "de", "da", "dos" não identificam ninguém — não servem de desempate. */
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "del", "di"]);

function normalizar(s: string): string {
  return s.trim().toLocaleLowerCase("pt-BR");
}

/**
 * @param nomeCompleto nome como está na conta do painel
 * @param jaUsados nomes curtos já ocupados por OUTROS supervisores
 */
export function nomeCurto(nomeCompleto: string, jaUsados: readonly string[] = []): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";

  const usados = new Set(jaUsados.map(normalizar).filter(Boolean));
  const primeiro = partes[0];
  if (!usados.has(normalizar(primeiro))) return primeiro;

  const sobrenomes = partes.slice(1).filter((p) => !PARTICULAS.has(normalizar(p)));
  const ultimo = sobrenomes[sobrenomes.length - 1];
  // Só tem um nome: não há desempate possível. Devolve como está — a tela
  // avisa do empate, e inventar "Maria 2" seria pior do que mostrar o conflito.
  if (!ultimo) return primeiro;

  const comInicial = `${primeiro} ${ultimo[0].toLocaleUpperCase("pt-BR")}.`;
  if (!usados.has(normalizar(comInicial))) return comInicial;

  return `${primeiro} ${ultimo}`;
}
