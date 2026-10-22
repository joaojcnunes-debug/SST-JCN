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
 *
 * **Não associados** (21/10, pedido dele) é o avesso exato: ninguém no
 * documento — `tem_associado = false`. Associados + Não associados = Todos.
 *
 * **Várias pílulas ao mesmo tempo** (21/10, pedido dele: "não associados +
 * em andamento"). São dois grupos: STATUS (Rascunho, Em Andamento,
 * Concluídas) e ASSOCIAÇÃO (Associados, Não associados). Dentro do grupo os
 * marcados se SOMAM (ou); entre os grupos se CRUZAM (e). "Todos" = nada
 * marcado. A contagem de cada pílula é cruzada com o OUTRO grupo — marcado
 * "Não associados", Em Andamento mostra quantas em andamento não têm ninguém
 * — então o número é sempre o que a lista ganha ao marcar aquela pílula
 * sozinha no seu grupo.
 */

export type FiltroInspecao = "Todos" | "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDA" | "ASSOCIADOS" | "NAO_ASSOCIADOS";

export type FiltroStatus = "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDA";
export type FiltroAssociacao = "ASSOCIADOS" | "NAO_ASSOCIADOS";

export const FILTROS_STATUS: readonly FiltroStatus[] = ["RASCUNHO", "EM_ANDAMENTO", "CONCLUIDA"];
export const FILTROS_ASSOCIACAO: readonly FiltroAssociacao[] = ["ASSOCIADOS", "NAO_ASSOCIADOS"];

/** O que está marcado, separado nos dois grupos. Lista vazia = o grupo não filtra. */
export interface SelecaoPilulas {
  status: FiltroStatus[];
  associacao: FiltroAssociacao[];
}

/** Separa as pílulas marcadas nos dois grupos ("Todos" não entra em nenhum). */
export function separarSelecao(marcados: readonly FiltroInspecao[]): SelecaoPilulas {
  return {
    status: FILTROS_STATUS.filter((f) => marcados.includes(f)),
    associacao: FILTROS_ASSOCIACAO.filter((f) => marcados.includes(f)),
  };
}

/**
 * Marca/desmarca uma pílula. "Todos" limpa tudo; marcar todas as de um grupo
 * é o mesmo que não filtrar por ele, então o grupo volta a vazio.
 */
export function alternarPilula(marcados: readonly FiltroInspecao[], f: FiltroInspecao): FiltroInspecao[] {
  if (f === "Todos") return [];
  const prox = marcados.includes(f) ? marcados.filter((x) => x !== f) : [...marcados, f];
  const sel = separarSelecao(prox);
  const status = sel.status.length === FILTROS_STATUS.length ? [] : sel.status;
  const associacao = sel.associacao.length === FILTROS_ASSOCIACAO.length ? [] : sel.associacao;
  return [...status, ...associacao];
}

/** Contagem de cada pílula — o número é o que a lista mostra ao clicar nela. */
export interface ContagensInspecoes {
  status: Record<FiltroInspecao, number>;
  /** Quantas a lista mostra com o que está marcado agora (os dois grupos cruzados). */
  selecionadas: number;
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
export function contarPilulas(
  rows: readonly LinhaContagem[],
  associado: string,
  selecao: SelecaoPilulas = { status: [], associacao: [] },
): ContagensInspecoes {
  const status: Record<FiltroInspecao, number> = { Todos: 0, RASCUNHO: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0, ASSOCIADOS: 0, NAO_ASSOCIADOS: 0 };
  let selecionadas = 0;
  for (const row of rows) {
    const pessoas = pessoasDaLinha(row);
    if (!casaAssociado(pessoas, associado)) continue;
    status.Todos++;
    const s = row.status;
    const assoc: FiltroAssociacao = pessoas.length > 0 ? "ASSOCIADOS" : "NAO_ASSOCIADOS";
    const casaStatus = selecao.status.length === 0 || selecao.status.includes(s as FiltroStatus);
    const casaAssoc = selecao.associacao.length === 0 || selecao.associacao.includes(assoc);
    // Cada grupo conta dentro do que o OUTRO grupo deixou passar.
    if (casaAssoc && (s === "RASCUNHO" || s === "EM_ANDAMENTO" || s === "CONCLUIDA")) status[s]++;
    if (casaStatus) status[assoc]++;
    if (casaStatus && casaAssoc) selecionadas++;
  }
  return { status, selecionadas };
}
