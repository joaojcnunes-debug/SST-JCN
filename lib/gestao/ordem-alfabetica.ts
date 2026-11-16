// Menu da Gestão em ordem alfabética (12/11/2026). Pedido do usuário: "coloque a lista em ordem alfabética e toda vez
// que criar uma lista nova já atualiza essa ordem". A ordem é feita na hora de mostrar (não grava nada): lista nova ou
// renomeada já entra no lugar. Português: sem diferença de maiúscula/acento ("eSocial" fica no E, "Petrópolis" antes
// de "Piabetá") e números na ordem natural ("Lista 2" antes de "Lista 10"). Nome igual mantém a ordem de antes.

const COLADOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true, ignorePunctuation: false });

export function ordenarPorNome<T extends { nome: string }>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => COLADOR.compare((a.nome ?? "").trim(), (b.nome ?? "").trim()));
}
