// DRPS — tipos compartilhados entre cliente e camada de dados.

export type StatusRelatorio =
  | "RASCUNHO"
  | "EM_ANDAMENTO"
  | "CONCLUIDO"
  | "DELETADO";

export interface DrpsRelatorio {
  id_relatorio: string;
  id_empresa: string;
  revisao: number;
  status: StatusRelatorio;
  data_elaboracao: string | null;
  responsavel_tecnico: string | null;
  crp: string | null;
  funcoes: string | null;
  qtd_trabalhadores: number | null;
  qtd_homens: number | null;
  qtd_mulheres: number | null;
  agravos_saude_mental: string | null;
  medidas_existentes: string | null;
  usuario_email: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface DrpsRespondente {
  id_respondente: string;
  id_relatorio: string;
  id_empresa: string;
  setor: string;
  cargo: string | null;
  respostas: number[];
  data_carimbo: string | null;
  importado_em: string;
  lote_importacao: string;
}

export interface DrpsProbabilidade {
  id_relatorio: string;
  id_empresa: string;
  setor: string;
  topico_idx: number;
  probabilidade: 1 | 2 | 3;
  updated_at: string;
}

export interface MedidaPlano {
  /** 12 booleanos, índice = mês (0=Jan, 11=Dez) */
  meses: boolean[];
  responsavel: string;
}

export interface DrpsPlanoMedidas {
  id_relatorio: string;
  id_empresa: string;
  ano: number;
  plano: Record<string, MedidaPlano>; // chave = nome da ação
  updated_at: string;
}

export type StatusMonitoramento =
  | "Pendente"
  | "Em Andamento"
  | "Concluido"
  | "Cancelado";

export interface DrpsMonitoramento {
  id_relatorio: string;
  id_empresa: string;
  setor: string;
  topico_idx: number;
  data_intervencao: string | null;
  responsavel: string | null;
  status: StatusMonitoramento;
  proxima_avaliacao: string | null;
  observacoes: string | null;
  updated_at: string;
}

/**
 * Texto padrao do relatorio DRPS — capitulos globais (intro/metodologia/etc)
 * que entram no PDF. Nao vinculado a empresa/relatorio.
 */
export interface DrpsTextoPadraoCapitulo {
  id_capitulo: string;
  ordem: number;
  titulo: string;
  conteudo: string | null;
  /** URL publica da imagem de fundo. Se setada, vira pagina inteira no PDF. */
  bg_imagem_url: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface DrpsRevisao {
  id_relatorio: string;
  id_empresa: string;
  /** chave = id da ação obrigatória; valor = data ISO (se marcada) ou true/false */
  checklist: Record<string, boolean | string>;
  /** chave = id do membro da equipe; valor = boolean */
  equipe: Record<string, boolean>;
  anotacoes: string | null;
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
