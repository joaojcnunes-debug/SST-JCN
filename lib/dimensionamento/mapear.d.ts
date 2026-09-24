/* Tipos de `mapear.js` (DIM-01) — linha do banco → domínio do motor.
   Entradas precisas (é onde o campo errado muda o número em silêncio); saídas com
   escotilha, porque quem manda no formato final é `calculo.js`. */

import type { Colaborador, Parametros, Unidade as UnidadeMotor } from "./calculo";

export type Condicao = "mensal" | "exclusiva_tst" | "sem_avaliacao" | "contrato_novo";

export interface DescricaoCondicao {
  condicao: Condicao;
  /** Nome do campo derivado no mês (`empresasVencidas`, `empresasExclusivaTst`…). */
  campo: string;
  rotulo: string;
  ajuda: string;
}

export interface Funcao {
  id: string;
  nome: string;
  tipoProducao: "tecnico" | "administrativo" | "nenhuma";
  chefia: boolean;
  coordena: "todos" | "tecnicos" | "administrativos";
  respondeParaId: string | null;
  ordem: number;
  custoMensal: number;
}

export interface Porte {
  codigo: string;
  nome: string;
  peso: number;
  ordem: number;
}

/** Unidade do cadastro (com todos os anos), antes de virar `Unidade` do motor. */
export interface UnidadeCadastro {
  id: string;
  nome: string;
  codigoApi: string | null;
  /** `mesesPorAno[ano][mes 1..12]` */
  mesesPorAno: Record<number, Record<number, Record<string, unknown>>>;
}

export interface ColaboradorCadastro {
  id: string;
  nome: string;
  funcaoId: string | null;
  inspecoesDia: number;
  relatoriosDia: number;
  empresasDia: number;
  dataAdmissao: string | null;
  dataDesligamento: string | null;
  custoMensal: number | null;
  /** v257 — sem produção diária (treinamento, outra área). Tira a pessoa do FTE da equipe. */
  semProducaoDiaria: boolean;
  /** v257 — faz parte da gestão. Mesmo efeito no cálculo; muda só o rótulo. */
  gestao: boolean;
  alocacoes: Array<{ unidadeId: string; percentual: number }>;
}

/** '' quando a pessoa está dentro do cálculo. 'gestao' ganha de 'sem_producao_diaria'. */
export declare function motivoForaDoCalculo(
  c: Partial<Pick<ColaboradorCadastro, "semProducaoDiaria" | "gestao">> | null | undefined,
): "" | "gestao" | "sem_producao_diaria";

export interface Cadastro {
  funcoes: Funcao[];
  unidades: UnidadeCadastro[];
  colaboradores: ColaboradorCadastro[];
  portes: Porte[];
  parametros: Parametros & { prazoDias: number };
}

/** Linhas cruas, como o PostgREST devolve (snake_case). */
export interface LinhasCruas {
  funcoes?: Array<Record<string, unknown>>;
  unidades?: Array<Record<string, unknown>>;
  colaboradores?: Array<Record<string, unknown>>;
  alocacoes?: Array<Record<string, unknown>>;
  demanda?: Array<Record<string, unknown>>;
  ativos?: Array<Record<string, unknown>>;
  portes?: Array<Record<string, unknown>>;
  parametros?: Record<string, unknown> | null;
}

export declare const CONDICOES: DescricaoCondicao[];
export declare const TIPOS_PRODUCAO: Array<{ id: string; rotulo: string; descricao: string }>;
export declare const COORDENA: Array<{ id: string; rotulo: string }>;
export declare const PARAMETROS_PADRAO: Parametros & { prazoDias: number };

export declare function funcaoDeLinha(r: Record<string, unknown>): Funcao;
export declare function funcaoParaLinha(f: Partial<Funcao> & { nome: string }): Record<string, unknown>;
export declare function colaboradorDeLinha(r: Record<string, unknown>): ColaboradorCadastro;
export declare function colaboradorParaLinha(
  c: Partial<ColaboradorCadastro> & { nome: string },
): Record<string, unknown>;
export declare function porteDeLinha(r: Record<string, unknown>): Porte;
export declare function parametrosDeLinha(r: Record<string, unknown> | null | undefined): Parametros & { prazoDias: number };

export declare function montarMes(
  demanda?: Record<string, Record<string, number>>,
  clientesAtivos?: number,
  atendidas?: number,
  atendidasPorte?: Record<string, number> | null,
): Record<string, unknown>;

export declare function mesesPorUnidade(
  demanda: Array<Record<string, unknown>>,
  ativos: Array<Record<string, unknown>>,
): Record<string, Record<number, Record<number, Record<string, unknown>>>>;

export declare function montarCadastro(linhas: LinhasCruas): Cadastro;

/** Junta função + unidades em cada colaborador — o formato que o motor lê. */
export declare function colaboradoresCompletos(
  colaboradores: ColaboradorCadastro[],
  funcoes: Funcao[],
  unidades: UnidadeCadastro[],
): Colaborador[];

export declare function unidadesDoAno(unidades: UnidadeCadastro[], ano: number): UnidadeMotor[];
export declare function pesosPorte(portes: Porte[]): Record<string, number>;
export declare function anosDisponiveis(unidades: UnidadeCadastro[], anoSelecionado?: number): number[];
