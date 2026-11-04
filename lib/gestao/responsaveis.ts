// v295 — gestao_tarefas.responsavel guarda TODOS os responsáveis ("Ana Souza, João Lima"),
// espelhados pelo banco a partir dos vínculos. Quem filtra/agrupa por responsável separa aqui.

/** Nomes dos responsáveis a partir do texto espelhado. */
export function nomesResponsaveis(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Nomes digitados/escolhidos → e-mails dos usuários (minúsculos), para gravar o VÍNCULO de responsável
 *  (é ele que avisa a pessoa e põe na agenda; o texto `responsavel` o banco espelha). Nome sem usuário
 *  volta em `desconhecidos` — quem chama recusa, em vez de gravar um responsável só de texto. */
export function emailsDosNomes(
  texto: string | null | undefined,
  usuarios: { nome: string; email: string }[],
): { emails: string[]; desconhecidos: string[] } {
  const porNome = new Map(usuarios.map((u) => [u.nome.trim().toLowerCase(), u.email.toLowerCase()]));
  const emails: string[] = [];
  const desconhecidos: string[] = [];
  for (const n of nomesResponsaveis(texto)) {
    const e = porNome.get(n.toLowerCase());
    if (e) { if (!emails.includes(e)) emails.push(e); } else desconhecidos.push(n);
  }
  return { emails, desconhecidos };
}

/** O nome está entre os responsáveis? */
export function temResponsavel(texto: string | null | undefined, nome: string | null | undefined): boolean {
  const n = (nome ?? "").trim();
  return !!n && nomesResponsaveis(texto).includes(n);
}
