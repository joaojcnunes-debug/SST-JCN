// DRPS — tipos compartilhados entre cliente e camada de dados.

export interface DrpsRespondente {
  id_respondente: string;
  id_empresa: string;
  setor: string;
  cargo: string | null;
  respostas: number[]; // 90 valores 0..4
  data_carimbo: string | null;
  importado_em: string;
  lote_importacao: string;
}

export interface DrpsProbabilidade {
  id_empresa: string;
  setor: string;
  topico_idx: number;
  probabilidade: 1 | 2 | 3;
  updated_at: string;
}

export type NivelGravidade = "Baixa" | "Média" | "Alta";
export type NivelProbabilidade = "Baixa" | "Média" | "Alta";
export type NivelMatriz = "Baixo" | "Médio" | "Alto" | "Crítico";

export interface ClassificacaoGravidade {
  texto: NivelGravidade;
  num: 1 | 2 | 3;
  cor: string;
}

export interface PerguntaCalculada {
  /** Texto da pergunta. */
  texto: string;
  logica: "direta" | "invertida";
  /** Média bruta das respostas dos respondentes (0..4). */
  mediaBruta: number;
  /** Após inversão se logica === "invertida" (0..4). */
  pontuacaoCorrigida: number;
  gravidade: ClassificacaoGravidade;
  /** Quantos respondentes foram considerados (ignorando NaN). */
  n: number;
}

export interface TopicoCalculado {
  idx: number;
  nome: string;
  fonteGeradora: string;
  perguntas: PerguntaCalculada[];
  /** Média aritmética dos gravidade.num das 10 perguntas. */
  mediaGravidade: number;
  classificacaoGravidade: ClassificacaoGravidade;
}

export interface TopicoComMatriz extends TopicoCalculado {
  probabilidade: 1 | 2 | 3;
  classificacaoProbabilidade: NivelProbabilidade;
  matriz: NivelMatriz;
  corMatriz: string;
}
