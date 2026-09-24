/**
 * O REGISTRO ÚNICO de movimentação de equipamentos — a régua que funde as três
 * listas da área numa só.
 *
 * O PEDIDO (22/09/2026): "existe uma área onde registra a movimentação dos
 * itens… podemos juntar as 3 partes de registro que mostra nessa área em uma só
 * com suas determinadas especificações".
 *
 * AS TRÊS PARTES ERAM:
 *   1. Extrato             — `equipamentos_movimentacoes` (o razão do saldo)
 *   2. Transferências      — `transferencias` (entre bases, com termo)
 *   3. Retiradas/devoluções— `equipamentos_entregas` + `_devolucoes` (posse)
 *
 * ⚠️ POR QUE NÃO BASTA EMPILHAR AS TRÊS. Retirada, devolução e transferência
 * de material por quantidade JÁ LANÇAM no extrato (`origem` = 'entrega',
 * 'devolucao', 'transferencia', com `ref_id` apontando para o ato). Empilhar as
 * listas mostraria o mesmo acontecimento duas vezes — uma como ato, outra como
 * lançamento de saldo — e quem contasse linhas contaria errado. Medido na
 * produção em 22/09: das 9 linhas do extrato, 2 eram o reflexo de UMA retirada,
 * e o `ref_id` das duas casava com ela (2 de 2).
 *
 * A REGRA, então: **uma linha por ATO**. O lançamento do extrato que aponta
 * para um ato é ABSORVIDO por ele (fica contado em `lancamentos`, e aparece na
 * gaveta da linha). O lançamento que não aponta para ato nenhum — entrada
 * manual, nota fiscal, ajuste de contagem — é um ato por si só e vira linha.
 *
 * ⚠️ E UM LANÇAMENTO ÓRFÃO NUNCA SOME. Se o `ref_id` aponta para um ato que
 * esta tela não carregou (o extrato vem das 300 mais recentes; entregas, das
 * 200), a linha entra sozinha, classificada pela origem. Sumir em silêncio
 * seria pior do que aparecer sem o dono — foi assim que a exportação do
 * inventário perdeu linhas em 2026-08-10.
 *
 * ⚠️ DE QUEBRA, A ARMADILHA DA TRANSFERÊNCIA MORRE AQUI. No extrato, uma
 * transferência entre bases são DUAS linhas (saída lá, entrada cá) e somar a
 * coluna dá estoque dobrado. No registro ela é UMA linha, com "de → para" e
 * sem sinal — porque o total da JCN Consultoria não mudou. O aviso continua valendo
 * para quem lê o extrato cru (a aba "Movimentações" da planilha), não aqui.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** O que aconteceu. É o filtro "Tipo de registro" da tela e a coluna "Registro"
 *  da planilha. Os valores coincidem de propósito com `MovOrigem` do extrato
 *  (`manual`/`nf`/`ajuste`/`transferencia`/`entrega`/`devolucao`) — assim o
 *  mesmo filtro serve o registro e a exportação do extrato cru, sem tradução. */
export type TipoRegistro =
  | "manual"
  | "nf"
  | "ajuste"
  | "transferencia"
  | "entrega"
  | "devolucao";

export const TIPOS_REGISTRO: TipoRegistro[] = [
  "manual",
  "nf",
  "transferencia",
  "entrega",
  "devolucao",
  "ajuste",
];

export const ROTULO_TIPO: Record<TipoRegistro, string> = {
  manual: "Entrada",
  nf: "Nota fiscal",
  ajuste: "Ajuste",
  transferencia: "Transferência",
  entrega: "Retirada",
  devolucao: "Devolução",
};

/** Cores da pílula do tipo. Ficam aqui, e não na tela, porque a planilha e a
 *  tela precisam concordar no NOME, e o nome mora ao lado da cor. */
export const CLASSE_TIPO: Record<TipoRegistro, string> = {
  manual: "bg-emerald-50 text-emerald-700",
  nf: "bg-blue-50 text-blue-700",
  ajuste: "bg-amber-50 text-amber-800",
  transferencia: "bg-violet-50 text-violet-700",
  entrega: "bg-emerald-50 text-emerald-700",
  devolucao: "bg-sky-50 text-sky-700",
};

export interface ItemRegistro {
  nome: string;
  /** null = ato sem quantidade declarada (aparelho identificado conta 1). */
  quantidade: number | null;
  numeroSerie: string | null;
  numeroPatrimonio: string | null;
  /** Só na devolução: íntegro, avariado, inservível. */
  estado: string | null;
}

export interface SituacaoRegistro {
  rotulo: string;
  classe: string;
}

export interface RegistroMov {
  /** Chave de lista e de seleção. Único entre os tipos. */
  id: string;
  /** Id na tabela de origem — é ele que as ações (termo, cancelar) usam. */
  idOriginal: string;
  tipo: TipoRegistro;
  /** Data do ATO (a que a pessoa reconhece), em ISO. Ordena e aparece na tela. */
  quando: string;
  /** Instante em que foi registrado no painel. Desempata a ordem e explica, na
   *  gaveta, a retirada lançada com data retroativa. */
  registradoEm: string;
  idUnidade: string | null;
  base: string;
  /** Só transferência. */
  idUnidadeDestino: string | null;
  baseDestino: string | null;
  /** Colaborador, na retirada e na devolução. */
  pessoa: string | null;
  itens: ItemRegistro[];
  /** Quantas peças o ato moveu (soma das quantidades, 1 por aparelho com ficha). */
  quantidade: number | null;
  /** Efeito no saldo da base: entrou, saiu, ou nenhum (transferência interna). */
  sinal: "+" | "-" | null;
  responsavel: string | null;
  motivo: string | null;
  observacao: string | null;
  situacao: SituacaoRegistro | null;
  assinado: boolean;
  /** Termo em PDF, quando o ato tem um. */
  termo: { tipo: "entrega" | "devolucao" | "transferencia"; id: string } | null;
  /** Quantas linhas do extrato este ato absorveu (0 = não mexeu em saldo). */
  lancamentos: number;
  /** Transferência pendente pode ser cancelada por Admin ou por quem criou. */
  emailCriador: string | null;
  cancelavel: boolean;
  rascunho: boolean;
  cancelado: boolean;
}

// ─── Entrada da função ────────────────────────────────────────────────────────

export interface MovimentacaoBruta {
  id_movimentacao: string;
  id_catalogo: string;
  id_unidade: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  origem: string;
  ref_id: string | null;
  motivo: string | null;
  responsavel: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface TransferenciaBruta {
  id_transferencia: string;
  status?: string | null;
  data_hora: string;
  created_at?: string;
  de_unidade: string | null;
  para_unidade: string | null;
  de_localizacao?: string | null;
  para_localizacao?: string | null;
  de_id_unidade?: string | null;
  para_id_unidade?: string | null;
  maquina_nome: string | null;
  maquina_modelo?: string | null;
  maquina_numero_serie?: string | null;
  maquina_numero_patrimonio?: string | null;
  maquina_codigo_interno?: string | null;
  maquina_tag?: string | null;
  quantidade?: number | null;
  motivo: string | null;
  observacoes?: string | null;
  responsavel_nome?: string | null;
  responsavel_email?: string | null;
  transportado_por?: string | null;
  assinado_em?: string | null;
}

export interface EntregaBruta {
  id_entrega: string;
  id_unidade: string;
  id_colaborador: string;
  data_entrega: string;
  responsavel_entrega: string | null;
  observacao: string | null;
  total_itens: number;
  criado_por: string | null;
  criado_em: string;
  emitido_em: string | null;
  cancelado_em: string | null;
}

export interface DevolucaoBruta {
  id_devolucao: string;
  id_unidade: string;
  id_colaborador: string;
  data_devolucao: string;
  recebido_por: string | null;
  observacao: string | null;
  total_itens: number;
  criado_por: string | null;
  criado_em: string;
}

export interface ItemBruto {
  id_entrega?: string;
  id_devolucao?: string;
  nome_equipamento: string | null;
  numero_serie: string | null;
  numero_patrimonio: string | null;
  quantidade: number;
  estado_retorno?: string | null;
}

export interface FontesDoRegistro {
  movimentacoes: MovimentacaoBruta[];
  transferencias: TransferenciaBruta[];
  entregas: EntregaBruta[];
  devolucoes: DevolucaoBruta[];
  entregaItens: ItemBruto[];
  devolucaoItens: ItemBruto[];
  /** id_catalogo → nome do produto. */
  nomeItem: (id: string) => string;
  /** id_unidade → nome da base. */
  nomeBase: (id: string | null | undefined) => string;
  /** id_colaborador → nome. */
  nomeColaborador: (id: string) => string;
}

// ─── Situações ────────────────────────────────────────────────────────────────

const SITUACAO_TRANSFERENCIA: Record<string, SituacaoRegistro> = {
  pendente: { rotulo: "Aguardando aceite", classe: "bg-amber-100 text-amber-700" },
  aceita: { rotulo: "Aceita", classe: "bg-emerald-100 text-emerald-700" },
  recusada: { rotulo: "Recusada", classe: "bg-red-100 text-red-700" },
  cancelada: { rotulo: "Cancelada", classe: "bg-gray-100 text-gray-600" },
};

/** Data-só (aaaa-mm-dd) vira meio-dia local: sem isso, o fuso joga a retirada
 *  para o dia anterior em todo o Brasil. */
function instante(d: string | null | undefined): string {
  if (!d) return "";
  return d.length <= 10 ? `${d}T12:00:00` : d;
}

function somaItens(itens: ItemRegistro[]): number | null {
  if (itens.length === 0) return null;
  return itens.reduce((t, i) => t + (i.quantidade ?? 1), 0);
}

// ─── A fusão ──────────────────────────────────────────────────────────────────

/**
 * Monta a lista única, do mais recente para o mais antigo.
 *
 * Ordena pela data do ATO e desempata pelo instante do registro: duas retiradas
 * lançadas no mesmo dia aparecem na ordem em que foram feitas, não ao acaso.
 */
export function montarRegistro(f: FontesDoRegistro): RegistroMov[] {
  const linhas: RegistroMov[] = [];

  // ── Retiradas ───────────────────────────────────────────────
  const itensPorEntrega = new Map<string, ItemRegistro[]>();
  for (const i of f.entregaItens) {
    if (!i.id_entrega) continue;
    const lista = itensPorEntrega.get(i.id_entrega) ?? [];
    lista.push({
      nome: i.nome_equipamento ?? "—",
      quantidade: Number(i.quantidade) || 1,
      numeroSerie: i.numero_serie,
      numeroPatrimonio: i.numero_patrimonio,
      estado: null,
    });
    itensPorEntrega.set(i.id_entrega, lista);
  }

  for (const e of f.entregas) {
    const itens = itensPorEntrega.get(e.id_entrega) ?? [];
    linhas.push({
      id: `entrega-${e.id_entrega}`,
      idOriginal: e.id_entrega,
      tipo: "entrega",
      quando: instante(e.data_entrega) || e.criado_em,
      registradoEm: e.criado_em,
      idUnidade: e.id_unidade,
      base: f.nomeBase(e.id_unidade),
      idUnidadeDestino: null,
      baseDestino: null,
      pessoa: f.nomeColaborador(e.id_colaborador),
      itens,
      quantidade: somaItens(itens) ?? e.total_itens,
      sinal: "-",
      responsavel: e.responsavel_entrega,
      motivo: null,
      observacao: e.observacao,
      situacao: e.cancelado_em
        ? { rotulo: "Cancelada", classe: "bg-red-100 text-red-700" }
        : !e.emitido_em
          ? { rotulo: "Rascunho", classe: "bg-amber-100 text-amber-800" }
          : { rotulo: "Emitida", classe: "bg-emerald-100 text-emerald-700" },
      assinado: false,
      termo: { tipo: "entrega", id: e.id_entrega },
      lancamentos: 0,
      emailCriador: e.criado_por,
      cancelavel: false,
      rascunho: !e.emitido_em,
      cancelado: !!e.cancelado_em,
    });
  }

  // ── Devoluções ──────────────────────────────────────────────
  const itensPorDevolucao = new Map<string, ItemRegistro[]>();
  for (const i of f.devolucaoItens) {
    if (!i.id_devolucao) continue;
    const lista = itensPorDevolucao.get(i.id_devolucao) ?? [];
    lista.push({
      nome: i.nome_equipamento ?? "—",
      quantidade: Number(i.quantidade) || 1,
      numeroSerie: i.numero_serie,
      numeroPatrimonio: i.numero_patrimonio,
      estado: i.estado_retorno ?? null,
    });
    itensPorDevolucao.set(i.id_devolucao, lista);
  }

  for (const d of f.devolucoes) {
    const itens = itensPorDevolucao.get(d.id_devolucao) ?? [];
    linhas.push({
      id: `devolucao-${d.id_devolucao}`,
      idOriginal: d.id_devolucao,
      tipo: "devolucao",
      quando: instante(d.data_devolucao) || d.criado_em,
      registradoEm: d.criado_em,
      idUnidade: d.id_unidade,
      base: f.nomeBase(d.id_unidade),
      idUnidadeDestino: null,
      baseDestino: null,
      pessoa: f.nomeColaborador(d.id_colaborador),
      itens,
      quantidade: somaItens(itens) ?? d.total_itens,
      sinal: "+",
      responsavel: d.recebido_por,
      motivo: null,
      observacao: d.observacao,
      situacao: { rotulo: "Recebida", classe: "bg-emerald-100 text-emerald-700" },
      assinado: false,
      termo: { tipo: "devolucao", id: d.id_devolucao },
      lancamentos: 0,
      emailCriador: d.criado_por,
      cancelavel: false,
      rascunho: false,
      cancelado: false,
    });
  }

  // ── Transferências ──────────────────────────────────────────
  for (const t of f.transferencias) {
    const status = t.status ?? "aceita";
    const nome = t.maquina_nome ?? "material";
    linhas.push({
      id: `transferencia-${t.id_transferencia}`,
      idOriginal: t.id_transferencia,
      tipo: "transferencia",
      quando: t.data_hora,
      registradoEm: t.created_at ?? t.data_hora,
      // A base da transferência é a de ORIGEM: é dela que o material sai, e é
      // por ela que o filtro de base tem de pegar a linha. O destino anda junto.
      idUnidade: t.de_id_unidade ?? null,
      base: t.de_unidade || t.de_localizacao || "—",
      idUnidadeDestino: t.para_id_unidade ?? null,
      baseDestino: t.para_unidade || t.para_localizacao || "—",
      pessoa: t.transportado_por ?? null,
      itens: [
        {
          nome,
          quantidade: t.quantidade ?? null,
          numeroSerie: t.maquina_numero_serie ?? null,
          numeroPatrimonio: t.maquina_numero_patrimonio ?? null,
          estado: null,
        },
      ],
      quantidade: t.quantidade ?? 1,
      // Sem sinal de propósito: o item trocou de lugar dentro da JCN Consultoria, o
      // total não mudou. É a armadilha do extrato, resolvida no desenho.
      sinal: null,
      responsavel: t.responsavel_nome ?? null,
      motivo: t.motivo,
      observacao: t.observacoes ?? null,
      situacao: SITUACAO_TRANSFERENCIA[status] ?? SITUACAO_TRANSFERENCIA.aceita,
      assinado: !!t.assinado_em,
      termo: { tipo: "transferencia", id: t.id_transferencia },
      lancamentos: 0,
      emailCriador: t.responsavel_email ?? null,
      cancelavel: status === "pendente",
      rascunho: false,
      cancelado: status === "cancelada",
    });
  }

  // ── Lançamentos do extrato ──────────────────────────────────
  // Os que apontam para um ato acima são o MESMO acontecimento visto pelo lado
  // do saldo: somam-se ao ato (contador) em vez de virar linha.
  const porId = new Map(linhas.map((l) => [l.idOriginal, l]));

  for (const m of f.movimentacoes) {
    const ato = m.ref_id ? porId.get(m.ref_id) : undefined;
    if (ato) {
      ato.lancamentos += 1;
      continue;
    }
    const tipo = (TIPOS_REGISTRO as string[]).includes(m.origem)
      ? (m.origem as TipoRegistro)
      : "manual";
    const nome = f.nomeItem(m.id_catalogo);
    linhas.push({
      id: `mov-${m.id_movimentacao}`,
      idOriginal: m.id_movimentacao,
      tipo,
      quando: m.criado_em,
      registradoEm: m.criado_em,
      idUnidade: m.id_unidade,
      base: f.nomeBase(m.id_unidade),
      idUnidadeDestino: null,
      baseDestino: null,
      pessoa: null,
      itens: [
        {
          nome,
          quantidade: Number(m.quantidade) || 0,
          numeroSerie: null,
          numeroPatrimonio: null,
          estado: null,
        },
      ],
      quantidade: Number(m.quantidade) || 0,
      sinal: m.tipo === "entrada" ? "+" : "-",
      responsavel: m.responsavel,
      motivo: m.motivo,
      observacao: null,
      situacao: null,
      assinado: false,
      termo: null,
      lancamentos: 1,
      emailCriador: m.criado_por,
      cancelavel: false,
      rascunho: false,
      cancelado: false,
    });
  }

  // ⚠️ ORDENA PELO DIA, DESEMPATA PELO INSTANTE DO REGISTRO. Comparar `quando`
  // como texto não serve: a retirada guarda DATA (aaaa-mm-dd, que virou meio-dia
  // local) e o lançamento guarda INSTANTE com fuso ("…T12:00:02+00:00"). São
  // formatos diferentes, e o maior em texto não é o mais recente no relógio —
  // foi assim que a entrada manual das 09:00 apareceu na frente da retirada das
  // 09:00:46 do mesmo dia. Pelo dia + instante do registro, duas coisas do mesmo
  // dia saem na ordem em que foram lançadas.
  const momento = (iso: string): number => {
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  return linhas.sort(
    (a, b) =>
      b.quando.slice(0, 10).localeCompare(a.quando.slice(0, 10)) ||
      momento(b.registradoEm) - momento(a.registradoEm),
  );
}

// ─── Busca e filtros ──────────────────────────────────────────────────────────

/**
 * Os campos de texto que a busca tolerante (`lib/busca/texto.ts`) compara.
 *
 * O NOME DO ITEM ENTRA MESMO QUANDO ESTÁ DENTRO DE UMA RETIRADA: a pergunta
 * que se faz nesta tela é "para onde foi o teclado", e o teclado é um item da
 * retirada, não o assunto dela. Sem isso, procurar por "teclado" acharia a
 * entrada de estoque e perderia a retirada que o entregou.
 */
export function textosDoRegistro(r: RegistroMov): Array<string | null | undefined> {
  return [
    ROTULO_TIPO[r.tipo],
    r.base,
    r.baseDestino,
    r.pessoa,
    r.responsavel,
    r.motivo,
    r.observacao,
    r.situacao?.rotulo,
    r.idOriginal,
    ...r.itens.map((i) => i.nome),
    ...r.itens.map((i) => i.numeroSerie),
    ...r.itens.map((i) => i.numeroPatrimonio),
  ];
}

/** Campos comparados só pelos dígitos: plaqueta e número de série batem com ou
 *  sem ponto, traço e zero à esquerda digitado de memória. */
export function codigosDoRegistro(r: RegistroMov): Array<string | null | undefined> {
  return [
    ...r.itens.map((i) => i.numeroPatrimonio),
    ...r.itens.map((i) => i.numeroSerie),
    r.idOriginal,
  ];
}

export interface FiltroRegistro {
  /** id_unidade ou "TODAS". */
  base: string;
  /** TipoRegistro ou "TODOS". */
  tipo: string;
  /** aaaa-mm-dd, inclusive. */
  de?: string;
  ate?: string;
}

/**
 * Recorte por base, tipo e período — o mesmo para a tela e para a planilha,
 * para o arquivo nunca discordar do que estava sendo olhado.
 *
 * NA TRANSFERÊNCIA, A BASE PEGA DOS DOIS LADOS. Filtrar "Piabetá" e não ver a
 * transferência que chegou lá seria esconder metade do movimento da base.
 */
export function filtrarRegistro(linhas: RegistroMov[], f: FiltroRegistro): RegistroMov[] {
  return linhas.filter((l) => {
    if (f.base !== "TODAS" && l.idUnidade !== f.base && l.idUnidadeDestino !== f.base)
      return false;
    if (f.tipo !== "TODOS" && l.tipo !== f.tipo) return false;
    const dia = l.quando.slice(0, 10);
    if (f.de && dia < f.de) return false;
    if (f.ate && dia > f.ate) return false;
    return true;
  });
}

/** Contagem por tipo do recorte — alimenta as pílulas de filtro, que mostram
 *  quantos existem antes de a pessoa clicar. */
export function contarPorTipo(linhas: RegistroMov[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of linhas) out[l.tipo] = (out[l.tipo] ?? 0) + 1;
  return out;
}
