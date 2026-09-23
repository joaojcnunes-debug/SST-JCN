/**
 * As pílulas da lista de Inspeções — a conta, num lugar só e sem React.
 *
 * Um grupo só, exclusivo, como sempre foi: Todos · Rascunho · Em Andamento ·
 * Concluídas — e, desde 21/09, **Associados**: as inspeções que têm alguém no
 * documento (SGG). Pedido de 16/09 ("filtro automático para os associados"),
 * afinado por ele em 21/09: "um ícone como os que já temos ali, clica e puxa
 * os documentos que têm os associados" — sem listar pessoa nenhuma.
 *
 * "Tem alguém no documento" é a MESMA régua nos três lugares: a coluna
 * "Associados" da lista (InspecaoRow), esta contagem e a coluna calculada
 * `tem_associado` do banco (v239), que é o que filtra a lista no servidor:
 * linha em `inspecao_associados` com nome OU `elaboracao_responsavel`
 * preenchido. Os 109 documentos com responsável sem linha contam.
 */

export type FiltroInspecao = "Todos" | "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDA" | "ASSOCIADOS";

/** Contagem de cada pílula — o número é o que a lista mostra ao clicar nela. */
export interface ContagensInspecoes {
  status: Record<FiltroInspecao, number>;
}

/** O que a contagem lê de cada inspeção — só o status e quem está no documento. */
export interface LinhaContagem {
  status: string;
  elaboracao_responsavel: string | null;
  inspecao_associados: { nome: string | null }[] | null;
}

/** Nomes iguais com caixa diferente são a mesma pessoa (mesma régua de lib/dashboard/documentos). */
export function chaveNome(nome: string): string {
  return nome.trim().toLowerCase();
}

// Quem está no documento: os associados (tabela) mais o responsável da
// elaboração, sem repetir — a mesma união que a coluna "Associados" desenha.
export function pessoasDaLinha(row: LinhaContagem): string[] {
  const vistos = new Map<string, string>();
  for (const a of row.inspecao_associados ?? []) {
    const n = (a.nome ?? "").trim();
    if (n && !vistos.has(chaveNome(n))) vistos.set(chaveNome(n), n);
  }
  const resp = (row.elaboracao_responsavel ?? "").trim();
  if (resp && !vistos.has(chaveNome(resp))) vistos.set(chaveNome(resp), resp);
  return [...vistos.values()];
}

// Réplica em memória do filtro de associado do servidor (ilike %termo% em
// inspecao_associados.nome OU elaboracao_responsavel): substring sem caixa.
function casaAssociado(pessoas: string[], associado: string): boolean {
  const termo = associado.trim().toLowerCase();
  if (termo.length < 2) return true;
  return pessoas.some((p) => p.toLowerCase().includes(termo));
}

/**
 * Conta as pílulas a partir das linhas já filtradas por empresa/técnico/
 * unidade/período. `associado` é a caixa de texto: ela vale para todas as
 * pílulas, como no servidor.
 */
export function contarPilulas(rows: readonly LinhaContagem[], associado: string): ContagensInspecoes {
  const status: Record<FiltroInspecao, number> = { Todos: 0, RASCUNHO: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0, ASSOCIADOS: 0 };
  for (const row of rows) {
    const pessoas = pessoasDaLinha(row);
    if (!casaAssociado(pessoas, associado)) continue;
    status.Todos++;
    const s = row.status;
    if (s === "RASCUNHO" || s === "EM_ANDAMENTO" || s === "CONCLUIDA") status[s]++;
    if (pessoas.length > 0) status.ASSOCIADOS++;
  }
  return { status };
}
