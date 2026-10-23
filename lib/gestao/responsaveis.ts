// v295 — gestao_tarefas.responsavel guarda TODOS os responsáveis ("Ana Souza, João Lima"),
// espelhados pelo banco a partir dos vínculos. Quem filtra/agrupa por responsável separa aqui.

/** Nomes dos responsáveis a partir do texto espelhado. */
export function nomesResponsaveis(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** O nome está entre os responsáveis? */
export function temResponsavel(texto: string | null | undefined, nome: string | null | undefined): boolean {
  const n = (nome ?? "").trim();
  return !!n && nomesResponsaveis(texto).includes(n);
}
