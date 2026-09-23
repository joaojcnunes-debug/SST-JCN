/**
 * NOVIDADES — o que o painel conta para quem usa.
 *
 * A régua editorial, decidida com o Sanmyo em 01/09, é uma só:
 *
 *   Entra o que a pessoa perceberia sozinha, sem ninguém contar.
 *
 * O tamanho da mudança no código não tem nada a ver com o tamanho dela para
 * quem usa. Renomear o card "Inspeções" (uma linha) ENTRA, porque é a primeira
 * coisa que ela vê ao logar. Mudar a exclusão de foto para passar pelo servidor
 * (reescrita inteira) NÃO ENTRA, porque o botão sempre esteve lá e sempre
 * funcionou igual para ela.
 *
 * O que fica de fora: migration, refactor, infra, e bug corrigido antes de
 * chegar em produção — esse último principalmente. Contar defeito que ninguém
 * chegou a ver não informa, só assusta. O trabalho invisível aparece agrupado
 * por mês em MELHORIAS_INTERNAS, uma linha, sem detalhe.
 */

/**
 * As quatro gavetas.
 *
 * `atencao` é a que existe por sermos SST: mudança que faz documento antigo e
 * documento novo divergirem. Quando a tarja de AET passou a sair com 2
 * Moderados, `necessita_aet` já estava GRAVADA nos laudos anteriores — os dois
 * deixaram de bater. Isso a pessoa precisa saber, e precisa vir com o que
 * fazer a respeito no campo `impacto`.
 */
export type TipoNovidade = "novidade" | "melhoria" | "correcao" | "atencao";

export const ROTULO_TIPO: Record<TipoNovidade, string> = {
  novidade: "Novidade",
  melhoria: "Melhoria",
  correcao: "Correção",
  atencao: "Atenção",
};

/**
 * As cores usam só os tokens que o modo noturno remapeia em globals.css
 * (bg-white, bg-gray-50/100, text-gray-400..900, border-gray-100/200/300).
 * Um `bg-slate-50` aqui ficaria branco no escuro — a camada não conhece slate.
 */
export const COR_TIPO: Record<TipoNovidade, string> = {
  novidade: "bg-blue-50 text-blue-700 ring-blue-600/20",
  melhoria: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  correcao: "bg-amber-50 text-amber-800 ring-amber-600/20",
  atencao: "bg-red-50 text-red-700 ring-red-600/20",
};

export interface Novidade {
  /**
   * Estável e para sempre. É por ele que se sabe o que a pessoa já leu, então
   * renomear um id existente faz a entrada reaparecer como nova para as 55
   * contas. Se o texto mudar, mantenha o id; se virou outro assunto, id novo.
   */
  id: string;
  /** AAAA-MM-DD — o dia em que de fato subiu, não o dia em que foi escrito. */
  data: string;
  tipo: TipoNovidade;
  /** Uma frase curta. É o que aparece na lista e no modal. */
  titulo: string;
  /**
   * O que mudou PARA ELA — nunca o que foi implementado. Quando for `correcao`,
   * diga o que ela via de errado antes, senão a frase não faz sentido para quem
   * não acompanhou.
   *
   *   ✗ "o dashboard separa entregue de assumido"
   *   ✓ "Dá para ver quanto cada pessoa entregou e quanto assumiu. Antes os
   *      dois vinham somados e o número parecia impossível."
   */
  texto: string;
  /** Onde ver, no caminho da tela: "Inspeções › Nova Inspeção". */
  onde?: string;
  /** "Você não precisa fazer nada" ou "Confira seus laudos de antes de 26/08". */
  impacto?: string;
  /** Metadado, em letra miúda. Uma entrada pode cobrir várias versões. */
  versoes?: string[];
  /** Ganha lugar de honra no modal. Use com parcimônia — tudo destacado é nada destacado. */
  destaque?: boolean;
}

/**
 * O trabalho que ninguém vê, agrupado. Não aparece no modal (modal comprido
 * ninguém lê, e aí a pessoa aprende a fechar sem ler) — só na aba, uma linha
 * por mês, para que mês de trabalho de base não pareça mês parado.
 */
export interface MelhoriasInternas {
  /** AAAA-MM */
  mes: string;
  quantidade: number;
  resumo: string;
}

/**
 * Aviso avulso, vindo do banco (tabela `novidades_avisos`, v194).
 *
 * Existe para o que NÃO é versão: "o sistema fica fora do ar sábado de manhã",
 * "a base de Lafaiete mudou de endereço". Isso não pode esperar deploy.
 * Novidade de versão continua morando no catálogo em código, junto da mudança.
 */
export interface AvisoBanco {
  id_aviso: string;
  data: string;
  tipo: TipoNovidade;
  titulo: string;
  texto: string;
  onde: string | null;
  impacto: string | null;
  destaque: boolean;
  ativo: boolean;
  created_at: string;
}

/** O que a tela consome — catálogo e banco já achatados na mesma forma. */
export type ItemNovidade = Novidade & { origem: "catalogo" | "banco" };
