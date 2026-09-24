/* Tipos de `derivar.js` (DIM-01) — orquestração do motor sobre o cadastro.
   A parte que importa está no .js: a fila atravessa os anos. */

import type { Cadastro } from "./mapear";
import type { Parametros, ResultadoCalculo, ResultadoHeadcount } from "./calculo";

export interface PessoaDaEquipe {
  id: string;
  nome: string;
  funcao: string;
  tipoProducao: "tecnico" | "administrativo" | "nenhuma";
  chefia: boolean;
  /** % da jornada nesta unidade (ou a soma, quando o alvo é "todas"). */
  alocacao: number;
  /** Fração do mês em que esteve na casa (admissão/desligamento). */
  presenca: number;
  ritmo: string;
  /** Quanto equivale de uma pessoa integral no mês. */
  equivalente: number;
  /** v257 — marcado a mão como fora do cálculo; `equivalente` é sempre 0. */
  foraDoCalculo: boolean;
  /** Qual marcação tirou a pessoa do cálculo; '' quando está dentro. */
  motivoFora: "" | "gestao" | "sem_producao_diaria";
  /**
   * Produz por função mas tem ritmo diário zerado — conta no quadro e não produz.
   * É o caso do CADASTRO INCOMPLETO, e exclui `foraDoCalculo`: quem foi marcado tem
   * resposta, não lacuna.
   */
  semProducao: boolean;
  parametros: Parametros;
}

export interface HeadcountDaUnidade {
  id: string;
  nome: string;
  headcount: ResultadoHeadcount | null;
}

export interface Derivado {
  resultado: ResultadoCalculo;
  fluxo: { unidades: Array<Record<string, unknown>>; total: Record<string, unknown>; [k: string]: unknown };
  alvo: Record<string, unknown> | undefined;
  titulo: string;
  headcount: ResultadoHeadcount | null;
  /**
   * Mesma conta do total, aberta por unidade — do MESMO `fluxo`, não de outra execução.
   * A soma dos déficits das unidades não fecha com o déficit do total (cada um arredonda
   * para cima na sua conta); a quebra responde "onde", o total continua sendo a verdade.
   */
  porUnidade: HeadcountDaUnidade[];
}

export declare function parametrosMotor(cadastro: Cadastro): Parametros;
export declare function prazoMeses(cadastro: Cadastro): number;
export declare function anosComLancamento(cadastro: Cadastro): number[];
export declare function atendidasDoAno(cadastro: Cadastro, ano: number): Record<string, Record<number, Record<string, number>>>;
/** Saldo que atravessa os anos anteriores — é daqui que vêm os "88 de 2025". */
export declare function filaInicial(cadastro: Cadastro, ano: number, mesAtual: number): Record<string, unknown> | null;
export declare function derivarHeadcount(
  cadastro: Cadastro,
  opcoes: { ano: number; mesAtual: number; unidadeId?: string; prazos?: number[] },
): Derivado;
export declare function equipeDoMes(
  cadastro: Cadastro,
  opcoes: { ano: number; mesAtual: number; unidadeId?: string },
): PessoaDaEquipe[];
