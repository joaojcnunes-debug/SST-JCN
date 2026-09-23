// Exportação do módulo Equipamentos em XLSX — Fase 8 do briefing-equipamentos-chabra.md.
//
// Quatro abas, que são as quatro perguntas que a área responde:
//   Registro       — a lista única da tela: um acontecimento por linha (22/09/2026)
//   Saldo          — quanto tem de cada material, em cada base
//   Movimentações  — o extrato cru: por que o saldo é esse
//   Com quem está  — os aparelhos identificados que estão na mão de alguém
//
// A ABA "REGISTRO" É A CÓPIA DO QUE ESTAVA NA TELA — com a busca, a base, o
// tipo e o período que a pessoa tinha escolhido. Ela nasceu com a fusão dos
// três blocos da área ("juntar as 3 partes de registro em uma só", 22/09) e é
// a aba que responde "o que aconteceu"; as outras três respondem "quanto tem",
// "por que" e "com quem". A diferença entre ela e a aba Movimentações é de
// propósito: lá vai o razão do estoque, linha a linha, inclusive as DUAS linhas
// de cada transferência; aqui vai o acontecimento, uma vez.
//
// A REGRA DA CASA VALE AQUI TAMBÉM (definida pelo operador em 2026-08-10 e
// implementada em lib/inventario/exportar-xlsx.ts): uma coluna só entra no
// arquivo se ALGUMA linha daquela aba tiver ela preenchida. Entregar planilha
// com coluna 100% vazia é pior do que não ter a coluna. A diferença é que aqui
// a conta é POR ABA — "motivo" pode estar vazio no extrato e preenchido em
// outro lugar, e cada aba decide sozinha.
//
// ⚠️ A ARMADILHA QUE O ARQUIVO PRECISA CARREGAR JUNTO: transferência entre bases
// lança DUAS linhas no extrato (saída na origem, entrada no destino) e o total
// da JCN Consultoria não muda. Quem somar a coluna de quantidade vai achar que o estoque
// dobrou. A tela avisa isso em texto embaixo da tabela; a planilha sai da tela e
// circula sozinha, então o aviso vai na aba "Sobre" — é o único lugar que
// acompanha o arquivo.
//
// ⚠️ E A SEGUNDA: a aba Saldo só tem material POR QUANTIDADE. Computador e
// notebook (`controla_individual`) não têm saldo — cada um é uma ficha, e eles
// aparecem na aba "Com quem está" quando estão com alguém. Somar as duas abas
// não dá "o patrimônio da JCN Consultoria"; são recortes diferentes, e a aba Sobre diz.

import * as XLSX from "xlsx";

type ValorCelula = string | number | null;

interface Coluna<T> {
  titulo: string;
  largura: number;
  /** Colunas de identidade: saem sempre, mesmo vazias, para a linha nunca ficar
   *  sem referência de a quem ela pertence. */
  sempre?: boolean;
  valor: (linha: T) => ValorCelula;
}

const texto = (v: string | null | undefined): ValorCelula => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

/** dd/mm/aaaa hh:mm. Igual ao inventário: texto, para a célula não virar número
 *  de série do Excel. */
const dataHora = (iso: string | null | undefined): ValorCelula => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const data = (iso: string | null | undefined): ValorCelula => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
};

const preenchida = (v: ValorCelula) =>
  v !== null && v !== undefined && String(v).trim() !== "";

/**
 * Monta uma aba já com a regra da coluna vazia aplicada, largura e autofiltro.
 * Devolve também quantas colunas foram omitidas, para a aba "Sobre" poder contar.
 */
function montarAba<T>(
  linhas: T[],
  colunas: Coluna<T>[]
): { ws: XLSX.WorkSheet; omitidas: number } {
  const ativas = colunas.filter(
    (c) => c.sempre || linhas.some((l) => preenchida(c.valor(l)))
  );

  const aoa: ValorCelula[][] = [ativas.map((c) => c.titulo)];
  for (const l of linhas) aoa.push(ativas.map((c) => c.valor(l) ?? ""));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = ativas.map((c) => ({ wch: c.largura }));
  if (linhas.length > 0) {
    const ultima = XLSX.utils.encode_col(ativas.length - 1);
    ws["!autofilter"] = { ref: `A1:${ultima}${linhas.length + 1}` };
  }
  return { ws, omitidas: colunas.length - ativas.length };
}

// ─── As três abas ─────────────────────────────────────────────────────────────

export interface LinhaSaldo {
  nomeBase: string;
  item: string;
  tipo: string | null;
  unidadeMedida: string | null;
  quantidade: number;
  estoqueMinimo: number;
}

const COLUNAS_SALDO: Coluna<LinhaSaldo>[] = [
  { titulo: "Base", largura: 24, sempre: true, valor: (l) => l.nomeBase },
  { titulo: "Item", largura: 34, sempre: true, valor: (l) => l.item },
  { titulo: "Quantidade", largura: 12, sempre: true, valor: (l) => l.quantidade },
  { titulo: "Tipo", largura: 18, valor: (l) => texto(l.tipo) },
  { titulo: "Unidade", largura: 12, valor: (l) => texto(l.unidadeMedida) },
  {
    titulo: "Estoque mínimo",
    largura: 15,
    valor: (l) => (l.estoqueMinimo > 0 ? l.estoqueMinimo : null),
  },
  {
    // Coluna derivada, e de propósito: é a única pergunta que a planilha
    // responde melhor que a tela, porque dá para filtrar por ela no Excel.
    titulo: "Abaixo do mínimo",
    largura: 16,
    valor: (l) =>
      l.estoqueMinimo > 0 ? (l.quantidade < l.estoqueMinimo ? "Sim" : "Não") : null,
  },
];

export interface LinhaMovimentacao {
  criadoEm: string;
  nomeBase: string;
  item: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  origem: string;
  motivo: string | null;
  responsavel: string | null;
  criadoPor: string | null;
}

const COLUNAS_MOVIMENTACAO: Coluna<LinhaMovimentacao>[] = [
  { titulo: "Data", largura: 17, sempre: true, valor: (l) => dataHora(l.criadoEm) },
  { titulo: "Base", largura: 24, sempre: true, valor: (l) => l.nomeBase },
  { titulo: "Item", largura: 34, sempre: true, valor: (l) => l.item },
  {
    titulo: "Movimento",
    largura: 12,
    sempre: true,
    valor: (l) => (l.tipo === "entrada" ? "Entrada" : "Saída"),
  },
  { titulo: "Quantidade", largura: 12, sempre: true, valor: (l) => l.quantidade },
  { titulo: "Origem", largura: 18, sempre: true, valor: (l) => l.origem },
  { titulo: "Motivo", largura: 40, valor: (l) => texto(l.motivo) },
  { titulo: "Responsável", largura: 26, valor: (l) => texto(l.responsavel) },
  { titulo: "Lançado por", largura: 26, valor: (l) => texto(l.criadoPor) },
];

export interface LinhaComColaborador {
  colaborador: string;
  matricula: string | null;
  cargo: string | null;
  nomeBase: string;
  equipamento: string;
  numeroSerie: string | null;
  numeroPatrimonio: string | null;
  status: string | null;
  entregueEm: string | null;
}

const COLUNAS_COM_COLABORADOR: Coluna<LinhaComColaborador>[] = [
  { titulo: "Colaborador", largura: 30, sempre: true, valor: (l) => l.colaborador },
  { titulo: "Equipamento", largura: 34, sempre: true, valor: (l) => l.equipamento },
  { titulo: "Base", largura: 24, sempre: true, valor: (l) => l.nomeBase },
  { titulo: "Matrícula", largura: 14, valor: (l) => texto(l.matricula) },
  { titulo: "Cargo", largura: 24, valor: (l) => texto(l.cargo) },
  { titulo: "Nº de série", largura: 20, valor: (l) => texto(l.numeroSerie) },
  { titulo: "Nº de patrimônio", largura: 18, valor: (l) => texto(l.numeroPatrimonio) },
  { titulo: "Situação", largura: 16, valor: (l) => texto(l.status) },
  { titulo: "Entregue em", largura: 14, valor: (l) => data(l.entregueEm) },
];

export interface LinhaRegistro {
  quando: string;
  registradoEm: string;
  tipo: string;
  itens: string;
  quantidade: number | null;
  sinal: "+" | "-" | null;
  base: string;
  baseDestino: string | null;
  pessoa: string | null;
  responsavel: string | null;
  situacao: string | null;
  assinado: boolean;
  motivo: string | null;
  observacao: string | null;
  patrimonio: string | null;
  serie: string | null;
  lancamentos: number;
  codigo: string;
}

const COLUNAS_REGISTRO: Coluna<LinhaRegistro>[] = [
  { titulo: "Data", largura: 12, sempre: true, valor: (l) => data(l.quando) },
  { titulo: "Registro", largura: 15, sempre: true, valor: (l) => l.tipo },
  { titulo: "Item(ns)", largura: 44, sempre: true, valor: (l) => l.itens },
  {
    // Com sinal, para a coluna poder ser somada por tipo no Excel sem armadilha:
    // a transferência sai SEM sinal justamente porque não muda o total.
    titulo: "Quantidade",
    largura: 12,
    sempre: true,
    valor: (l) =>
      l.quantidade == null ? null : l.sinal === "-" ? -l.quantidade : l.quantidade,
  },
  { titulo: "Base", largura: 24, sempre: true, valor: (l) => l.base },
  { titulo: "Destino", largura: 24, valor: (l) => texto(l.baseDestino) },
  { titulo: "Colaborador", largura: 28, valor: (l) => texto(l.pessoa) },
  { titulo: "Responsável", largura: 26, valor: (l) => texto(l.responsavel) },
  { titulo: "Situação", largura: 18, valor: (l) => texto(l.situacao) },
  { titulo: "Assinado", largura: 10, valor: (l) => (l.assinado ? "Sim" : null) },
  { titulo: "Motivo", largura: 40, valor: (l) => texto(l.motivo) },
  { titulo: "Observação", largura: 40, valor: (l) => texto(l.observacao) },
  { titulo: "Nº de patrimônio", largura: 18, valor: (l) => texto(l.patrimonio) },
  { titulo: "Nº de série", largura: 20, valor: (l) => texto(l.serie) },
  {
    titulo: "Lançamentos no estoque",
    largura: 20,
    valor: (l) => (l.lancamentos > 0 ? l.lancamentos : null),
  },
  { titulo: "Registrado em", largura: 17, valor: (l) => dataHora(l.registradoEm) },
  { titulo: "Código", largura: 26, sempre: true, valor: (l) => l.codigo },
];

// ─── A planilha ───────────────────────────────────────────────────────────────

export interface OpcoesExportEquipamentos {
  /** A lista única da tela, já com busca e filtros aplicados. */
  registro: LinhaRegistro[];
  saldo: LinhaSaldo[];
  movimentacoes: LinhaMovimentacao[];
  comColaborador: LinhaComColaborador[];
  /** Frase que descreve o recorte, ex.: 'Base: Teresópolis'. Vai para a aba
   *  "Sobre" — o arquivo circula sozinho e precisa dizer o que ele é. */
  filtroDescrito: string;
  /** Quantos lançamentos a TELA mostrava quando o botão foi clicado. O arquivo
   *  traz o extrato inteiro do recorte; se os dois números diferirem, a aba
   *  Sobre explica, em vez de deixar a pessoa achar que um dos dois está errado. */
  movimentacoesNaTela?: number;
}

export function montarPlanilhaEquipamentos({
  registro,
  saldo,
  movimentacoes,
  comColaborador,
  filtroDescrito,
  movimentacoesNaTela,
}: OpcoesExportEquipamentos): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // Primeira aba de propósito: é a que espelha a tela, e é por ela que quem
  // abre o arquivo reconhece de onde ele veio.
  const abaRegistro = montarAba(registro, COLUNAS_REGISTRO);
  XLSX.utils.book_append_sheet(wb, abaRegistro.ws, "Registro");

  const abaSaldo = montarAba(saldo, COLUNAS_SALDO);
  XLSX.utils.book_append_sheet(wb, abaSaldo.ws, "Saldo");

  const abaMovs = montarAba(movimentacoes, COLUNAS_MOVIMENTACAO);
  XLSX.utils.book_append_sheet(wb, abaMovs.ws, "Movimentações");

  const abaPosse = montarAba(comColaborador, COLUNAS_COM_COLABORADOR);
  XLSX.utils.book_append_sheet(wb, abaPosse.ws, "Com quem está");

  const omitidas =
    abaRegistro.omitidas + abaSaldo.omitidas + abaMovs.omitidas + abaPosse.omitidas;

  const linhasSobre: ValorCelula[][] = [
    ["Exportação de Equipamentos"],
    [],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    ["Recorte", filtroDescrito],
    [],
    ["Aba Registro", `${registro.length} acontecimento(s) — a lista da tela`],
    ["Aba Saldo", `${saldo.length} linha(s) — material por quantidade, por base`],
    ["Aba Movimentações", `${movimentacoes.length} lançamento(s)`],
    ["Aba Com quem está", `${comColaborador.length} aparelho(s) na mão de alguém`],
    [],
    [
      "Colunas omitidas",
      omitidas === 0
        ? "nenhuma"
        : `${omitidas} — estavam vazias em todas as linhas da sua aba`,
    ],
  ];

  if (movimentacoesNaTela !== undefined && movimentacoesNaTela !== movimentacoes.length) {
    linhasSobre.push(
      [],
      [
        "Extrato completo",
        `A tela mostra os ${movimentacoesNaTela} lançamentos mais recentes; este arquivo traz os ${movimentacoes.length} do recorte.`,
      ]
    );
  }

  linhasSobre.push(
    [],
    ["Como ler este arquivo"],
    [
      "Registro x Movimentações",
      "A aba Registro tem UM acontecimento por linha: a retirada aparece uma vez, com os itens dela. A aba Movimentações tem o razão do estoque, onde a MESMA retirada pode ser várias linhas — uma por produto que saiu do saldo. As duas não se somam.",
    ],
    [
      "Transferência",
      "Na aba Movimentações, uma transferência entre bases gera DUAS linhas: a saída na base de origem e a entrada na de destino. O total da JCN Consultoria não muda, e somar a coluna Quantidade não dá o estoque. Na aba Registro ela é uma linha só, com Base e Destino, e sem sinal na quantidade.",
    ],
    [
      "Até onde a aba Registro vai",
      "A aba Registro é o que estava na tela, e a tela monta a lista a partir dos 300 lançamentos de estoque mais recentes e das 200 últimas retiradas e devoluções. A aba Movimentações traz o extrato INTEIRO do recorte, sem esse teto — é nela que se confere o saldo.",
    ],
    [
      "Saldo x Com quem está",
      "A aba Saldo tem só material por quantidade (fone, mouse, cabo). Computador e notebook são controlados um a um e não têm saldo: aparecem em 'Com quem está' quando estão com alguém. As duas abas não se somam.",
    ]
  );

  const sobre = XLSX.utils.aoa_to_sheet(linhasSobre);
  sobre["!cols"] = [{ wch: 22 }, { wch: 88 }];
  XLSX.utils.book_append_sheet(wb, sobre, "Sobre");

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/** Nome de arquivo com a data, para não empilhar "equipamentos (3).xlsx". */
export function nomeArquivoEquipamentos(sufixo?: string): string {
  const hoje = new Date().toISOString().slice(0, 10);
  const extra = sufixo
    ? "-" +
      sufixo
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 30)
    : "";
  return `equipamentos-${hoje}${extra}.xlsx`;
}

export function baixarEquipamentosXlsx(
  opcoes: OpcoesExportEquipamentos,
  sufixo?: string
) {
  const buffer = montarPlanilhaEquipamentos(opcoes);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivoEquipamentos(sufixo);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
