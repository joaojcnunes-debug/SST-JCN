/**
 * As 12 ajudas de modulo que existem no painel.
 *
 * NAO existe uma Ajuda global -- cada modulo tem a sua, alcancada de dentro
 * dele. A aba Atualizacoes entra em todas (decisao do Sanmyo, 01/09),
 * mas o CONTEUDO mora num componente so (AtualizacoesAba): a lista aparece em
 * todas elas e e mantida em um.
 *
 * Esta lista precisa acompanhar as rotas de verdade. O teste em
 * ajuda-rotas.test.ts varre app/ e falha se alguem criar uma ajuda nova sem
 * registrar aqui -- senao a aba simplesmente nao apareceria naquele modulo e
 * ninguem perceberia.
 */
export const ROTAS_AJUDA = [
  "/aep/ajuda",
  "/aet/ajuda",
  "/analise-quimicos/ajuda",
  "/apreciacao-maquinas/ajuda",
  "/relatorio-conformidade/ajuda",
  "/equipamentos/ajuda",
  "/escala/ajuda",
  "/frota/ajuda",
  "/relatorio-nao-conformidade/ajuda",
  "/psicossocial/ajuda",
  "/questionarios-psicossociais/ajuda",
] as const;

/**
 * A ajuda do modulo em que a pessoa esta agora, ou null.
 *
 * Devolve null de proposito no hub, na Gestao e nos modulos sem ajuda: mandar
 * alguem do hub para a ajuda da Frota so para ler as novidades a deixaria
 * perdida num modulo que ela nao abriu.
 */
export function ajudaDaRotaAtual(pathname: string): string | null {
  const primeiro = pathname.split("/").filter(Boolean)[0];
  if (!primeiro) return null;
  const alvo = `/${primeiro}/ajuda`;
  return (ROTAS_AJUDA as readonly string[]).includes(alvo) ? alvo : null;
}
