/**
 * Lista fixa de tipos de equipamento — decisão do operador em 2026-08-11.
 *
 * POR QUE FIXA. O campo `tipo` era texto livre e a base provou o custo disso:
 * 15 grafias para 9 categorias reais nos 99 itens migrados. "Ar", "Splinter" e
 * "Ar-condicionado" eram a mesma coisa; "Desktop" e "Computador" também; e
 * 90 dos 99 valores ainda tinham espaço sobrando no fim, o que fazia
 * "Notebook" e "Notebook " virarem dois grupos distintos no agrupamento.
 * Com texto livre, filtrar ou contar por tipo simplesmente não funciona.
 *
 * POR QUE COM ESCAPE. Lista 100% fechada trava o cadastro no dia em que
 * chegar uma cadeira ou uma furadeira. O padrão da casa para isso já existe no
 * briefing (§3.7, motivos de status): lista fechada MAIS campo livre. A lista
 * fechada é o que dá relatório agregável; o campo livre é o que evita a pessoa
 * escolher qualquer coisa só para conseguir salvar.
 *
 * COMO ACRESCENTAR UM TIPO. Uma linha aqui. Não há `check` no banco de
 * propósito: `equipamentos.tipo` continua text, então acrescentar tipo não
 * exige migration nem derruba nada que já esteja gravado.
 */

export interface GrupoTipos {
  grupo: string;
  tipos: string[];
}

export const TIPOS_EQUIPAMENTO: GrupoTipos[] = [
  { grupo: "Informática", tipos: ["Notebook", "Desktop", "Monitor", "Impressora", "No-break"] },
  { grupo: "Rede", tipos: ["Roteador", "Switch", "DVR", "Câmera"] },
  // Pedido dele em 21/09/2026: "informática, rede e etc. — precisamos de um
  // campo que mostre os periféricos e que registre eles como tal". Periférico
  // não tem plaqueta: nasce POR QUANTIDADE (ver `controlePadraoDoTipo`).
  { grupo: "Periféricos", tipos: ["Mouse", "Teclado", "Headset", "Webcam", "Mouse pad", "Cabo", "Carregador", "Capa / case", "Hub USB", "Pen drive", "Adaptador"] },
  { grupo: "Climatização", tipos: ["Ar-condicionado", "Cortina de ar", "Ventilador", "Purificador de ar"] },
  // Grupos abaixo nasceram do que a base JÁ tinha digitado à mão em 21/09/2026
  // (7 TV, 7 no-break, 6 ventilador, 4 purificador, 3 centrífuga, 2 DVR,
  // audiometria, espirometria, micro-ondas): tipo fora da lista não entrava
  // no filtro da Visão geral. "Outros" deixou de ser grupo — o que não está
  // aqui continua aceito pelo campo livre e cai em "Outros" no agrupamento.
  { grupo: "Eletrodomésticos", tipos: ["Frigobar", "Micro-ondas", "TV"] },
  { grupo: "Saúde ocupacional", tipos: ["Audiômetro", "Espirômetro", "Centrífuga"] },
];

/** Valor que abre o campo livre no formulário. Nunca é gravado como tipo —
 *  o que vai para o banco é o texto que a pessoa digitou. */
export const TIPO_OUTRO = "__outro__";

/** Grupos cujos itens são controlados POR QUANTIDADE por padrão (sem plaqueta,
 *  sem ficha própria): periférico se conta, não se identifica. Os demais
 *  grupos nascem "um a um". É só o padrão do formulário — a pessoa pode mudar. */
export const GRUPOS_POR_QUANTIDADE: readonly string[] = ["Periféricos"];

/** true = "um a um" (ficha individual); false = por quantidade. */
export function controlePadraoDoTipo(tipo: string | null | undefined): boolean {
  return !GRUPOS_POR_QUANTIDADE.includes(grupoDoTipo(tipo));
}

export const ehPeriferico = (tipo: string | null | undefined): boolean =>
  grupoDoTipo(tipo) === "Periféricos";

/** Todos os tipos da lista, achatados. Usado pelo filtro da listagem. */
export const TIPOS_PLANOS: string[] = TIPOS_EQUIPAMENTO.flatMap((g) => g.tipos);

/** O tipo informado está na lista fixa? Um item antigo (ou cadastrado por outra
 *  via) pode ter tipo fora dela — nesse caso o formulário abre no campo livre
 *  já preenchido, em vez de apagar em silêncio o que estava lá. */
export const tipoNaLista = (tipo: string | null | undefined): boolean =>
  !!tipo && TIPOS_PLANOS.includes(tipo.trim());

/** Grupo a que um tipo pertence, para agrupar na listagem. "Outros" cobre
 *  qualquer tipo fora da lista, inclusive os digitados à mão. */
export function grupoDoTipo(tipo: string | null | undefined): string {
  const t = (tipo ?? "").trim();
  return TIPOS_EQUIPAMENTO.find((g) => g.tipos.includes(t))?.grupo ?? "Outros";
}
