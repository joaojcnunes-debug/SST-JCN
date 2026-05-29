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
  /** Mapa setor -> texto de agravos (bullets) aplicaveis ao setor. */
  agravos_por_setor: Record<string, string> | null;
  /** Mapa setor -> texto de medidas de controle existentes no setor. */
  medidas_por_setor: Record<string, string> | null;
  /** Mapa setor -> texto de conclusao manuscrita pelo psicologo. */
  conclusoes_por_setor: Record<string, string> | null;
  /** Conclusão técnica consolidada do relatório (todos os setores juntos). */
  conclusao_geral: string | null;
  /** Carimbo automático do momento em que o status passou pra CONCLUIDO (V54). */
  data_conclusao: string | null;
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
/**
 * Caixa de texto posicionada livremente sobre a imagem de fundo (capa).
 * Posicoes em percentual (0-100) para manter o layout em qualquer escala.
 */
export interface CaixaTexto {
  id: string;
  /** Posicao X em % da largura da pagina (0-100, canto sup esq do texto). */
  x: number;
  /** Posicao Y em % da altura da pagina (0-100). */
  y: number;
  /** Largura em % (opcional; default 40). */
  w?: number;
  /** Tamanho da fonte em px (default 14). */
  fontSize?: number;
  /** Alinhamento horizontal do texto dentro da caixa. */
  align?: "left" | "center" | "right";
  /** Texto em negrito. */
  bold?: boolean;
  /** Cor do texto em hex (default #ffffff). */
  color?: string;
  /** Texto da caixa (suporta variaveis {{xxx}}). */
  conteudo: string;
}

/** V53: Posição do capítulo no PDF do DRPS (mesmos valores da tabela genérica). */
export type DrpsPosicaoPdf =
  | "inicio"
  | "apos_sumario"
  | "apos_setores"
  | "apos_conclusao"
  | "apos_medidas"
  | "fim";

export const DRPS_POSICAO_PDF_LABELS: Record<DrpsPosicaoPdf, string> = {
  inicio: "Início — antes do sumário (capa, dedicatória)",
  apos_sumario: "Após o sumário (introdução, metodologia)",
  apos_setores: "Após a análise por setor (antes da conclusão geral)",
  apos_conclusao: "Após a conclusão geral (antes do plano)",
  apos_medidas: "Após medidas/monitoramento/revisão",
  fim: "Fim do PDF (considerações finais)",
};

export const DRPS_POSICAO_PDF_ORDEM: DrpsPosicaoPdf[] = [
  "inicio",
  "apos_sumario",
  "apos_setores",
  "apos_conclusao",
  "apos_medidas",
  "fim",
];

export interface DrpsTextoPadraoCapitulo {
  id_capitulo: string;
  ordem: number;
  titulo: string;
  conteudo: string | null;
  /** URL publica da imagem de fundo. Se setada, vira pagina inteira no PDF. */
  bg_imagem_url: string | null;
  /** Caixas de texto posicionadas sobre a bg (so usadas quando ha bg). */
  caixas_texto: CaixaTexto[] | null;
  /** V53: posição do capítulo no PDF do relatório DRPS. */
  posicao_pdf: DrpsPosicaoPdf;
  orientacao: string | null;
  quebra_pagina: string | null;
  ativo: boolean;
  tipo: "fixo" | "editavel";
  slug_fixo: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Descrição de um capítulo fixo (gerado automaticamente) do DRPS. */
export interface DrpsFixoCapitulo {
  titulo: string;
  slug_fixo: string;
  descricao: string;
  ordem_base: number;
}

export const DRPS_FIXOS: DrpsFixoCapitulo[] = [
  { titulo: "Caracterização dos Trabalhadores",  slug_fixo: "drps_caracterizacao",  descricao: "Dados quantitativos de trabalhadores por setor — gerado automaticamente.", ordem_base: 1500 },
  { titulo: "Análise por Setor",                 slug_fixo: "drps_analise_setor",   descricao: "Tópicos × setores com matriz Gravidade × Probabilidade — gerado automaticamente.", ordem_base: 2000 },
  { titulo: "Conclusão Técnica Consolidada",     slug_fixo: "drps_conclusao",       descricao: "Consolidação dos riscos críticos e altos de todos os setores — gerada automaticamente.", ordem_base: 4000 },
  { titulo: "Plano de Medidas de Controle",      slug_fixo: "drps_plano_medidas",   descricao: "Plano anual de ações com responsáveis e prazos — gerado automaticamente.", ordem_base: 4500 },
  { titulo: "Revisão e Monitoramento",           slug_fixo: "drps_revisao",         descricao: "Checklist de revisão e equipe responsável — gerado automaticamente.", ordem_base: 5000 },
  { titulo: "Assinatura Técnica",                slug_fixo: "drps_assinatura",      descricao: "Rodapé de assinatura do responsável técnico — gerado automaticamente.", ordem_base: 9000 },
];

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
