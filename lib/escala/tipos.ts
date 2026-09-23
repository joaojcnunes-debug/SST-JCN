/**
 * Tipos do módulo Escala de Supervisores (v190).
 *
 * POR QUE AQUI E NÃO EM lib/supabase/types.ts: mesmo motivo da Frota — tipo de
 * entidade no arquivo central faria uma remoção futura mexer num arquivo
 * compartilhado grande. Aqui a remoção é `rm -r lib/escala`.
 *
 * A exceção deliberada são as 3 linhas em lib/supabase/types.ts
 * (ModuloPermitido, TODOS_MODULOS, ROTULO_MODULO): a permissão é do sistema.
 */

// ─── Enums (espelham os CHECK da v190 — mudar aqui exige migration) ──────────

/**
 * As 7 situações da lista suspensa da planilha. A ordem é a de exibição.
 *
 * ⚠️ Os acentos são parte do valor gravado: o CHECK do banco compara string
 * exata. "Ferias" sem acento é recusado pelo Postgres, não convertido.
 */
export const SITUACOES = [
  "Visita ao cliente",
  "Home office",
  "Folga",
  "Férias",
  "Treinamento",
  "Atestado",
  "Feriado",
] as const;
export type SituacaoEscala = (typeof SITUACOES)[number];

export const ORIGENS_DIA = ["padrao", "manual"] as const;
export type OrigemDia = (typeof ORIGENS_DIA)[number];

export const ABRANGENCIAS_FERIADO = ["nacional", "estadual", "municipal"] as const;
export type AbrangenciaFeriado = (typeof ABRANGENCIAS_FERIADO)[number];

export const TIPOS_FERIADO = ["feriado", "facultativo"] as const;
export type TipoFeriado = (typeof TIPOS_FERIADO)[number];

/** 1 = segunda … 5 = sexta. Fim de semana não entra na escala (CHECK do banco). */
export type DiaUtilSemana = 1 | 2 | 3 | 4 | 5;

export const DIAS_UTEIS: { valor: DiaUtilSemana; rotulo: string; curto: string }[] = [
  { valor: 1, rotulo: "Segunda-feira", curto: "Seg" },
  { valor: 2, rotulo: "Terça-feira", curto: "Ter" },
  { valor: 3, rotulo: "Quarta-feira", curto: "Qua" },
  { valor: 4, rotulo: "Quinta-feira", curto: "Qui" },
  { valor: 5, rotulo: "Sexta-feira", curto: "Sex" },
];

// ─── Entidades ───────────────────────────────────────────────────────────────

export interface EscalaSupervisor {
  id_supervisor: string;
  nome: string;
  nome_resumido: string | null;
  funcao: string | null;
  /** Vínculo OPCIONAL com a conta do painel. Sempre minúsculo (CHECK do banco). */
  usuario_email: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * Atributos que só a escala precisa. A unidade em si vive em `public.unidades`
 * (v75) — esta tabela é 1:1 com ela, PK = id_unidade.
 */
export interface EscalaUnidadeConfig {
  id_unidade: string;
  cor_hex: string;
  ordem: number;
  /** Município da unidade. É o que o feriado municipal casa. */
  municipio: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string | null;
}

/** Unidade + config, já juntadas — o formato que as telas consomem. */
export interface UnidadeDaEscala {
  id_unidade: string;
  nome: string;
  cor_hex: string;
  ordem: number;
  municipio: string | null;
  ativo: boolean;
  /** false = a unidade existe em `unidades` mas ainda não foi configurada aqui. */
  configurada: boolean;
}

export interface EscalaPadraoSemanal {
  id_padrao: string;
  id_supervisor: string;
  dia_semana: DiaUtilSemana;
  unidade_ids: string[];
  situacao: SituacaoEscala | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EscalaDia {
  id_dia: string;
  id_supervisor: string;
  /** Data pura `YYYY-MM-DD`. Nunca converta com `new Date(iso)` cru — ver datas.ts. */
  data: string;
  unidade_ids: string[];
  situacao: SituacaoEscala | null;
  origem: OrigemDia;
  observacao: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EscalaFeriado {
  id_feriado: string;
  data: string;
  descricao: string;
  abrangencia: AbrangenciaFeriado;
  /** Obrigatório quando abrangencia = "municipal" (CHECK do banco). */
  municipio: string | null;
  tipo: TipoFeriado;
  created_at: string;
}

export interface EscalaRegra {
  id_regra: string;
  codigo: string;
  descricao: string;
  parametros: Record<string, unknown>;
  ativa: boolean;
  ordem: number;
  created_at: string;
  updated_at: string | null;
}

export interface EscalaLog {
  id_log: string;
  id_dia: string | null;
  id_supervisor: string | null;
  data: string | null;
  ator_email: string;
  valor_anterior: Record<string, unknown> | null;
  valor_novo: Record<string, unknown> | null;
  criado_em: string;
}

// ─── Alocação: o XOR do banco, expresso em tipo ──────────────────────────────

/**
 * O que um supervisor faz num dia: OU está em uma ou mais unidades, OU está numa
 * situação fora de unidade. Nunca os dois, nunca nenhum.
 *
 * O banco garante isso com CHECK (`escala_dias_unidade_xor_situacao`). Aqui o
 * tipo garante o mesmo ANTES da viagem — quem monta um payload à mão erra em
 * silêncio e só descobre no 400 do PostgREST.
 */
export type Alocacao =
  | { tipo: "unidades"; unidade_ids: string[] }
  | { tipo: "situacao"; situacao: SituacaoEscala };

/** Converte a alocação nas duas colunas do banco, no formato que o CHECK aceita. */
export function alocacaoParaColunas(a: Alocacao): {
  unidade_ids: string[];
  situacao: SituacaoEscala | null;
} {
  return a.tipo === "unidades"
    ? { unidade_ids: a.unidade_ids, situacao: null }
    : { unidade_ids: [], situacao: a.situacao };
}

/** Lê as duas colunas de volta como alocação. `null` = linha vazia (não deveria existir). */
export function colunasParaAlocacao(linha: {
  unidade_ids: string[] | null;
  situacao: string | null;
}): Alocacao | null {
  const ids = linha.unidade_ids ?? [];
  if (ids.length > 0) return { tipo: "unidades", unidade_ids: ids };
  if (linha.situacao) return { tipo: "situacao", situacao: linha.situacao as SituacaoEscala };
  return null;
}
