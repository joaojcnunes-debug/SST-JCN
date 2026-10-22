/**
 * Regras do seletor de Responsável do QPS. Módulo **puro de propósito**: o
 * `npm test` só varre os arquivos `.test.ts` sob `lib/`, então lógica que
 * mora dentro do componente não tem detector nenhum. Aqui tem
 * (`responsavel.test.ts`).
 *
 * `qps_aplicacoes.responsavel` é texto livre, não FK. Medido em 2026-10-06:
 * dos 10 valores gravados, 7 estão em CAIXA ALTA e 3 são nome parcial, um
 * deles ambíguo entre três cadastros. É isso que estas regras evitam repetir.
 */

export interface MembroTime {
  nome: string;
  cargo?: string | null;
  funcao?: string | null;
}

/** Minúscula, sem acento, sem espaço nas pontas. */
export function normalizarNome(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Acha no time o membro correspondente a um valor já gravado. Casamento por
 * nome normalizado — é o que recupera `SANMYO MICHAEL MENDES DE PAIVA` para o
 * cadastro `Sanmyo Michael Mendes de Paiva`. **Não** resolve nome parcial:
 * `João` bate com três cadastros e adivinhar escolheria a pessoa errada.
 */
export function acharMembro<T extends MembroTime>(time: T[], salvo: string): T | null {
  const q = normalizarNome(salvo);
  if (!q) return null;
  return time.find((u) => normalizarNome(u.nome) === q) ?? null;
}

/** Filtra por nome, cargo ou função — por isso "Psicossocial" devolve gente. */
export function filtrarTime<T extends MembroTime>(time: T[], busca: string): T[] {
  const q = normalizarNome(busca);
  if (!q) return time;
  return time.filter(
    (u) =>
      normalizarNome(u.nome).includes(q) ||
      normalizarNome(u.cargo ?? "").includes(q) ||
      normalizarNome(u.funcao ?? "").includes(q),
  );
}

/**
 * Oferece "Usar «texto»" — o caso do psicólogo externo, que não tem conta no
 * painel.
 *
 * **`filtrados.length === 0` é a guarda que importa**, e faltava: sem ela, a
 * mesma caixa serve para filtrar e para gravar, e o Enter da pessoa que só
 * queria filtrar grava o que ela digitou. Dois estragos reais medidos:
 * digitar `Psicossocial` (que o filtro casa por `funcao`) gravava a função
 * como se fosse pessoa; digitar `Ana Paula` com dois cadastros gravava o nome
 * parcial ambíguo — exatamente a sujeira que este módulo existe para não
 * repetir. Com a guarda, enquanto a lista tem alguém o texto só filtra.
 *
 * Também não oferece para texto curto demais (1 caractere é tecla errada, não
 * nome), para quem já é do time por nome exato, nem para o valor já gravado.
 */
export function podeUsarNomeManual(args: {
  busca: string;
  filtrados: MembroTime[];
  time: MembroTime[];
  salvo: string;
}): boolean {
  const manual = args.busca.trim();
  if (manual.length <= 1) return false;
  if (args.filtrados.length > 0) return false;
  if (args.time.some((u) => normalizarNome(u.nome) === normalizarNome(manual))) return false;
  return normalizarNome(manual) !== normalizarNome(args.salvo);
}
