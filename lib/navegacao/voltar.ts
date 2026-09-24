/**
 * PARA ONDE O BOTÃO "VOLTAR" LEVA.
 *
 * O botão vive no rodapé do SidebarShell, que é o shell de 19 dos 20 módulos.
 * Ele fazia `router.back()` cego: quem chega por link, favorito, atalho do
 * Electron ou aba nova não tem para onde voltar, e o clique não fazia NADA —
 * medido em 01/09 (`history.length` igual antes e depois, `pathname` idem).
 *
 * A decisão mora aqui, fora do componente, porque é a única parte testável sem
 * navegador: o resto é `router.push`/`router.back`, que é do Next.
 *
 * A ORDEM IMPORTA e é esta:
 *   1. `backHref` explícito ganha de tudo — quem passou sabe para onde quer ir.
 *   2. Havendo navegação interna nesta aba, `back()` — é o que a pessoa espera
 *      de um botão chamado "Voltar", e preserva a volta para a lista filtrada.
 *   3. Sem histórico interno, o PISO — uma CASCATA, e não um destino só: a home
 *      do módulo (`logoHref`), o hub (`/modulos`), a Visão geral. Desce até
 *      achar uma que não seja a rota atual, porque mandar a pessoa para onde
 *      ela já está é o mesmo botão morto de antes, só que recarregando. O teste
 *      é quem cobra isso — o caso `/modulos` com `logoHref` `/modulos` passava
 *      pela versão de um destino só.
 */

export interface EntradaVoltar {
  /** Destino explícito do layout. Só a Sinalização Psicossocial passa hoje. */
  backHref?: string;
  /** Rota atual. */
  pathname: string;
  /** Home do módulo — o mesmo destino do logotipo no topo da barra. */
  logoHref: string;
  /** Esta aba já navegou entre rotas depois de carregar? */
  temHistoricoInterno: boolean;
}

export type DecisaoVoltar =
  | { acao: "back" }
  | { acao: "push"; destino: string };

/** Hub de módulos — segundo piso, quando a home do módulo é a própria rota. */
export const HUB_MODULOS = "/modulos";
/** Último piso. Existe para todo perfil que enxerga o shell. */
export const INICIO = "/inicio";

export function decidirVoltar({
  backHref,
  pathname,
  logoHref,
  temHistoricoInterno,
}: EntradaVoltar): DecisaoVoltar {
  if (backHref) return { acao: "push", destino: backHref };
  if (temHistoricoInterno) return { acao: "back" };
  const piso = [logoHref, HUB_MODULOS, INICIO].find((r) => r !== pathname) ?? INICIO;
  return { acao: "push", destino: piso };
}
