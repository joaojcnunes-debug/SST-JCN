/* eslint-disable @typescript-eslint/no-explicit-any --
   Este arquivo E a fronteira entre o motor .js (copia fiel da origem, sem tipos) e o
   codigo tipado do painel. Os `any` daqui sao o limite declarado dessa fronteira, nao
   desleixo: marcam onde quem manda no formato e o motor. Desativar no arquivo, com esta
   razao, e mais legivel que 21 eslint-disable-next-line identicos. */
/* ==========================================================================
   Tipos do motor de dimensionamento (DIM-01).

   O motor (`calculo.js`) é cópia FIEL da origem e não foi retipado — estes
   tipos são a borda, escritos à mão. Por isso valem duas regras:

     • As ENTRADAS são precisas. É onde a tela erra: montar um colaborador sem
       `alocacoes`, mandar `mes` 1..12 onde o motor espera 0..11, esquecer o
       `ano`. Errar aqui dá número errado sem estourar nada.
     • As SAÍDAS declaram o que a tela usa hoje e deixam uma saída de escape
       (`[campo: string]: any`) para o resto. Declarar 40 campos aninhados que
       ninguém lê seria fingir precisão: quem manda no formato é o motor, e os
       84 testes é que garantem o conteúdo.

   Se um campo novo passar a ser lido pela tela, declare-o aqui em vez de usar
   a escotilha — é assim que este arquivo vai ficando útil.
   ========================================================================== */

export type TipoProducao = "tecnico" | "administrativo" | "nenhuma";
export type Area = "tecnico" | "administrativo";
export type Coordena = "todos" | "tecnicos" | "administrativos";
export type CodigoPorte = string; // 'P' | 'M' | 'G' são o padrão, mas a tabela é cadastrável
export type Condicao = "mensal" | "exclusiva_tst" | "sem_avaliacao" | "contrato_novo";

/** Contagens de um mês de uma unidade. `demanda` é por condição × porte; o motor pondera. */
export interface MesDaUnidade {
  empresasVencidas?: number;
  empresasExclusivaTst?: number;
  clientesAtivos?: number;
  atendidas?: number;
  atendidasPorte?: Record<CodigoPorte, number>;
  demanda?: Partial<Record<Condicao, Record<CodigoPorte, number>>>;
}

export interface Unidade {
  id: string;
  nome: string;
  empresasVencidas?: number;
  empresasExclusivaTst?: number;
  /** Chave = mês 1..12 (um a doze, não zero-indexado — ao contrário de `janela`). */
  meses?: Record<number, MesDaUnidade>;
}

export interface Alocacao {
  unidadeId: string;
  /** 0–100. A soma por colaborador nunca passa de 100 (gatilho no banco). */
  percentual: number;
}

export interface Colaborador {
  id: string;
  nome: string;
  funcao?: string;
  tipoProducao: TipoProducao;
  chefia?: boolean;
  empresasDia?: number;
  inspecoesDia?: number;
  relatoriosDia?: number;
  alocacoes: Alocacao[];
  /** 'AAAA-MM-DD'. Entra no cálculo: define a presença proporcional e o ramp-up. */
  dataAdmissao?: string | null;
  dataDesligamento?: string | null;
  custoMensal?: number | null;
  funcaoCustoMensal?: number | null;
}

export interface Parametros {
  /** 12 posições, janeiro a dezembro. */
  diasUteis: number[];
  /** 0–100. É a "folga para imprevistos" vista pelo avesso (85 = 15% de folga). */
  ocupacaoAlvo: number;
  /** % de produção no 1º, 2º… mês de casa. Padrão [50, 80]; depois 100. */
  rampup?: number[];
  pesosPorte?: Record<CodigoPorte, number>;
  prazoDias?: number;
}

/** Pessoa virtual do "E se…?" — não entra no cadastro. `de`/`ate` são meses 0..11. */
export interface Simulacao {
  unidadeId: string;
  grupo: Area;
  quantidade: number;
  de: number;
  ate: number;
  inspecoesDia?: number;
  relatoriosDia?: number;
  empresasDia?: number;
  custoMensal?: number;
}

/** Meses 0..11, inclusive nas duas pontas. */
export interface Janela {
  de: number;
  ate: number;
}

export interface EntradaCalculo {
  unidades?: Unidade[];
  colaboradores?: Colaborador[];
  parametros: Parametros;
  janela?: Janela;
  simulacoes?: Simulacao[];
  /** Ano dos meses calculados. Manda na presença (admissão/desligamento) e no ramp-up. */
  ano?: number;
}

export type Status = "ok" | "atencao" | "falta";

export interface ResumoArea {
  funcao: Area;
  rotulo: string;
  pessoas: number;
  deficit: number;
  quadro: number;
  cabecas: number;
  custoDeficit: number;
  custoTotal: number;
  etapaCritica: string;
  impossivel: boolean;
  [campo: string]: any;
}

/** Uma linha de "quadro necessário para o prazo X". */
export interface PrazoDoHeadcount {
  prazoMeses: number;
  mesesEstimados: boolean;
  entradaPeriodo: number;
  entradaReal: number;
  trabalhoTotal: number;
  pessoas: number;
  deficit: number;
  custoDeficit: number;
  custoTotal: number;
  impossivel: boolean;
  areas: Record<Area, ResumoArea>;
  [campo: string]: any;
}

export interface ResultadoHeadcount {
  mes: number;
  nomeMes: string;
  backlog: { total: number; porEtapa: Record<string, number>; idade: any };
  demandaDoMes: number;
  clientesDoMes: number;
  quadroAtual: number;
  cabecasAtual: number;
  cenarios: PrazoDoHeadcount[];
  [campo: string]: any;
}

export interface ResultadoCalculo {
  meses: any[];
  unidades: any[];
  total: any;
  [campo: string]: any;
}

export interface Motor {
  MESES: string[];
  MESES_LONGO: string[];
  TEC: "tecnico";
  ADM: "administrativo";
  FUNCOES: Area[];
  FUNCAO_CURTA: Record<Area, string>;
  FUNCAO_SINGULAR: Record<Area, string>;
  ENTREGAS: Array<{ id: string; rotulo: string; funcao: Area; [campo: string]: any }>;
  ENTREGAS_DA_FUNCAO: Record<Area, Array<{ id: string; rotulo: string; funcao: Area }>>;
  COLAB_PADRAO: { empresasDia: number; inspecoesDia: number; relatoriosDia: number };
  MARGEM_ATENCAO: number;
  FAIXAS_IDADE: Array<{ [campo: string]: any }>;

  /** Núcleo. Recebe o cadastro inteiro e devolve o cálculo mês a mês. */
  calcular(entrada: EntradaCalculo): ResultadoCalculo;

  /** Cadeia produtiva, coortes de backlog e QLP. `fila`/`evolucao` são adaptadores dele. */
  fluxo(
    resultado: ResultadoCalculo,
    opcoes?: {
      mesAtual?: number;
      prazoMeses?: number;
      filaInicial?: number | null;
      atendidas?: any;
      parametros?: Parametros | null;
      ano?: number;
    },
  ): any;

  /** A tela principal: quantas pessoas para zerar o vencido acumulado em cada prazo. */
  headcount(item: any, opcoes?: { mes?: number; prazos?: number[] }): ResultadoHeadcount;

  fila(resultado: ResultadoCalculo, opcoes?: Record<string, any>): any;
  evolucao(resultado: ResultadoCalculo, opcoes?: Record<string, any>): any;

  /** Preenche o que faltar e normaliza escalas — chame antes de usar `parametros` cru. */
  normalizarParametros(p: Partial<Parametros> | null | undefined): Parametros;

  empresasDoMes(u: Unidade, mes: number): number;
  empresasPonderadas(u: Unidade, p: Parametros, mes: number): number;
  pesoPorte(p: Parametros, porte: CodigoPorte): number;
  /** Fração do mês em que a pessoa esteve na casa (admissão/desligamento). */
  presencaNoMes(c: Colaborador, ano: number, mes: number): number;
  fatorRampup(mesesDeCasa: number, rampup?: number[]): number;
  producaoMes(colab: Colaborador, entrega: string, mes: number, p: Parametros): number;
  precisaMes(u: Unidade, entrega: string, mes: number, p: Parametros): number;
  custoFuncao(resumo: any, custoPessoa: number): any;
  colaboradoresSimulados(simulacoes: Simulacao[]): Colaborador[];
  /** "2,0 inspeções · 2,0 relatórios/dia" — o texto que a tela mostra. */
  ritmoTexto(c: Colaborador): string;
  piorStatus(...status: Status[]): Status;
}

declare const Calculo: Motor;
export default Calculo;
