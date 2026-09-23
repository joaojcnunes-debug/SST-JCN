import { buscar, type ResultadoBusca } from "./texto";

/** O mínimo que a busca precisa de uma ação 5W2H — serve ao tipo e ao registro cru do PDF. */
export interface AcaoBuscavel {
  what_acao?: unknown;
  who_responsavel?: unknown;
  where_local?: unknown;
}

/**
 * ÚNICO critério da busca do Plano de Ação — usado pela tela, pelo contador do
 * modal de PDF e pela rota do PDF no servidor. Se os três divergirem, o PDF
 * traz linhas que a tela escondeu (ou esconde linhas que a tela mostrou).
 * Mantém a ordem de prazo em que as ações vêm do banco.
 */
export function buscarAcoes<T extends AcaoBuscavel>(acoes: T[], consulta: string): ResultadoBusca<T> {
  const texto = (v: unknown) => (v == null ? "" : String(v));
  return buscar(
    acoes,
    consulta,
    (a) => [texto(a.what_acao), texto(a.who_responsavel), texto(a.where_local)],
    { manterOrdem: true },
  );
}
