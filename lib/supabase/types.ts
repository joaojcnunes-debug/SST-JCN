// Tipos dos dados do banco. Reflete o schema v2 descrito na spec.

export type StatusInspecao =
  | "RASCUNHO"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "DELETADA";
export type TipoCriacao = "BRANCO" | "REVISAO" | "COPIA_EMPRESA";
export type StatusEmpresa = "Ativo" | "Inativa";
export type PerfilUsuario = "Admin" | "Tecnico" | "Visualizador";

export type ModuloPermitido =
  | "painel"
  | "psicossocial"
  | "conformidade"
  | "nao_conformidade"
  | "apreciacao_maquinas"
  | "inventario_maquinas"
  | "analise_quimicos"
  | "aet";

export const TODOS_MODULOS: ModuloPermitido[] = [
  "painel",
  "psicossocial",
  "conformidade",
  "nao_conformidade",
  "apreciacao_maquinas",
  "inventario_maquinas",
  "analise_quimicos",
  "aet",
];

export const ROTULO_MODULO: Record<ModuloPermitido, string> = {
  painel: "Painel SST",
  psicossocial: "Psicossocial",
  conformidade: "Relatório de Conformidade",
  nao_conformidade: "Relatório de Não Conformidade",
  apreciacao_maquinas: "Apreciação de Máquinas",
  inventario_maquinas: "Inventário de Equipamentos",
  analise_quimicos: "Análise de Químicos Chabra",
  aet: "AET – Análise Ergonômica do Trabalho",
};

export type TipoRisco =
  | "Acidente"
  | "Ergonômico"
  | "Físico"
  | "Químico"
  | "Biológico"
  | "Psicossocial"
  | "Ambiental"
  | "IAPAT Complexidade Laboral"
  | "IAPAT Impactos de Alto Risco";

export type NivelRisco =
  | "Trivial"
  | "Baixo"
  | "Moderado"
  | "Alto"
  | "Muito Alto";

export type CategoriaFoto =
  | "Setor"
  | "EPI"
  | "EPC"
  | "Máquinas e Equipamentos"
  | "Produto Químico"
  | "Kit de Primeiros Socorros"
  | "Extintor"
  | "Geral";

export type ModuloEmpresa =
  | "sst"
  | "psicossocial"
  | "conformidade"
  | "nao_conformidade"
  | "analise_quimicos";

export const MODULOS_EMPRESA: Array<{ value: ModuloEmpresa; label: string }> = [
  { value: "sst", label: "Painel SST (Inspeções)" },
  { value: "psicossocial", label: "Psicossocial" },
  { value: "conformidade", label: "Relatório de Conformidade" },
  { value: "nao_conformidade", label: "Relatório de Não Conformidade" },
  { value: "analise_quimicos", label: "Análise de Químicos" },
];

export interface Empresa {
  id_empresa: string;
  nome_empresa: string;
  razao_social: string | null;
  cnpj: string | null;
  cpf: string | null;
  cei: string | null;
  caepf: string | null;
  cno: string | null;
  grau_risco: number | null;
  status: StatusEmpresa | null;
  observacao: string | null;
  /** Lista de módulos em que a empresa está habilitada (aparece nos selects). */
  modulos_habilitados: ModuloEmpresa[];
  created_at: string;
  updated_at: string | null;
}

export interface Inspecao {
  id_inspecao: string;
  id_empresa: string;
  data_inspecao: string | null;
  status: StatusInspecao;
  revisao: number;
  responsavel: string | null;
  observacoes: string | null;
  tipo_criacao: TipoCriacao | null;
  id_inspecao_base: string | null;
  usuario: string | null;
  created_at: string;
  updated_at: string | null;
  empresas?: { nome_empresa: string } | null;
}

export interface Setor {
  id_setor: string;
  id_inspecao: string;
  id_empresa: string;
  setor_ghe: string;
  descricao: string | null;
  conformidade: string | null;
  nao_conformidade: string | null;
  created_at?: string;
}

export interface Cargo {
  id_cargo: string;
  id_inspecao: string;
  id_empresa: string;
  id_setor: string;
  cargo: string;
  descricao: string | null;
  created_at?: string;
}

export interface Risco {
  id_risco: string;
  id_inspecao: string;
  id_empresa: string;
  id_setor: string | null;
  id_cargo: string | null;
  tipo_risco: TipoRisco;
  agente: string | null;
  fonte_geradora: string | null;
  probabilidade: string | null;
  severidade: string | null;
  nivel_risco: NivelRisco | null;
  meio_propagacao: string[] | null;
  id_matriz: string | null;
  situacao: string | null;
  tempo_exposicao: string | null;
  tecnica_utilizada: string | null;
  concentracao_exposicao: string | null;
  limite_tolerancia: string | null;
  insalubridade: string | null;
  periculosidade: string | null;
  numero_cas: string | null;
  via_absorcao: string | null;
  tipo_agente_biologico: string | null;
  fator_ergonomico: string | null;
  fator_psicossocial: string | null;
  pontuacao_iapat: string | null;
  // Campos físicos novos
  fisico_necessita_medicao: string | null;
  fisico_qual_medicao: string | null;
  fisico_motivo_medicao: string | null;
  // Campos químicos novos (perguntas Q1-Q6)
  quim_q1: string | null;
  quim_q2: string | null;
  quim_q3: string | null;
  quim_q4: string | null;
  quim_q5: string | null;
  quim_q6: string | null;
  uso_processo: string | null;
  foto_quim_url: string | null;
  // Comuns
  medidas_adotadas: string | null;
  medidas_recomendadas: string | null;
  observacoes_risco: string | null;
  // V3: respostas a perguntas customizadas dinâmicas (chave → valor)
  respostas_custom?: Record<string, string> | null;
  // V5: ponteiro pro modelo que originou esse risco (opcional — riscos
  // antigos ou criados sem modelo escolhido ficam null).
  id_modelo?: string | null;
  created_at?: string;
  updated_at?: string | null;
}

// V3: tipos de risco editáveis pelo Admin via /config (única fonte de verdade)
export interface TipoRiscoCustom {
  id_tipo: string;
  nome: string;
  icone: string | null;
  ordem: number;
  ativo: boolean;
  sistema: boolean;
  created_at?: string;
  updated_at?: string | null;
}

// V4: catálogo de itens pré-cadastrados por tipo de risco.
// Cada tipo guarda listas que alimentam selects/datalists do RiscoForm
// (agentes, fontes geradoras, EPIs, EPCs e medidas). 8 categorias
// espelham a planilha modelo do cliente.
export type CategoriaCatalogo =
  | "agente"
  | "fonte_geradora"
  | "epi_utilizado"
  | "epi_recomendado"
  | "epc_utilizado"
  | "epc_recomendado"
  | "medida_adotada"
  | "medida_recomendada";

export interface ItemCatalogoTipo {
  id_item: string;
  id_tipo: string;
  categoria: CategoriaCatalogo;
  texto: string;
  ordem: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string | null;
}

// V5: modelo de risco — kit fechado centrado num agente.
// Coexiste com itens_catalogo_tipo (V4): V4 é a biblioteca compartilhada
// do tipo, V5 é o "modelo específico" que pré-preenche o RiscoForm.
export interface ModeloRisco {
  id_modelo: string;
  id_tipo: string;
  agente: string;
  fonte_geradora: string | null;
  ordem: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string | null;
}

// V5: categoria dos itens dentro de um modelo. Subset de
// CategoriaCatalogo — não inclui agente porque esse é atributo
// do próprio modelo. V6 incluiu fonte_geradora pra permitir
// múltiplas fontes por modelo.
export type CategoriaModelo =
  | "fonte_geradora"
  | "epi_utilizado"
  | "epi_recomendado"
  | "epc_utilizado"
  | "epc_recomendado"
  | "medida_adotada"
  | "medida_recomendada";

export interface ItemModeloRisco {
  id_item: string;
  id_modelo: string;
  categoria: CategoriaModelo;
  texto: string;
  ordem: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string | null;
}

// V5: pergunta customizada vinculada a um modelo (não ao tipo).
// Estrutura espelha PerguntaTipoRisco. No form, perguntas do tipo
// + perguntas do modelo aparecem combinadas.
export interface PerguntaModeloRisco {
  id_pergunta: string;
  id_modelo: string;
  chave: string;
  texto: string;
  input_type: "select" | "text" | "textarea";
  opcoes: string[];
  ordem: number;
  obrigatoria: boolean;
  ativo: boolean;
  created_at?: string;
}

// V7: triagem — banco de perguntas que aparecem ANTES do agente no
// RiscoForm. Cada pergunta tem opções multi-selecionáveis, e cada
// opção pode (opcionalmente) estar vinculada a um modelo. Selecionar
// múltiplas opções no save replica o risco (1 por opção).
export interface TriagemTipoRisco {
  id_triagem: string;
  id_tipo: string;
  texto: string;
  ordem: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface TriagemOpcao {
  id_opcao: string;
  id_triagem: string;
  texto: string;
  id_modelo: string | null;
  ordem: number;
  ativo: boolean;
  created_at?: string;
}

// V8: relação direta triagem ↔ modelos. Substitui o sistema antigo
// de TriagemOpcao (texto livre + id_modelo opcional). Cada triagem
// agora "lista" modelos como checkboxes no RiscoForm.
export interface TriagemModeloRel {
  id_triagem: string;
  id_modelo: string;
  ordem: number;
  created_at?: string;
}

// V3: pergunta customizada vinculada a um tipo de risco
export interface PerguntaTipoRisco {
  id_pergunta: string;
  id_tipo: string;
  chave: string;
  texto: string;
  input_type: "select" | "text" | "textarea";
  opcoes: string[];
  ordem: number;
  obrigatoria: boolean;
  ativo: boolean;
  created_at?: string;
}

// V3.2: faixa de score → nível (cálculo automático por pesos)
export interface FaixaRisco {
  nivel: NivelRisco;
  min: number;
  max: number;
}

// V3: matriz de risco NxM com lookup table.
// lookup[iP][iS] retorna o nome do nível (NivelRisco).
// V3.2: pesos_prob/pesos_sev/faixas opcionais — se preenchidos,
// o usuário pode gerar o lookup automaticamente via score = pesoP × pesoS
// e procurar o nível correspondente nas faixas.
export interface MatrizRisco {
  id_matriz: string;
  nome: string;
  descricao: string | null;
  probabilidades: string[];
  severidades: string[];
  lookup: string[][];
  pesos_prob: number[] | null;
  pesos_sev: number[] | null;
  faixas: FaixaRisco[] | null;
  ativa: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface EpiEpc {
  id_protecao: string;
  id_risco: string;
  id_inspecao: string;
  id_empresa: string;
  id_setor: string | null;
  tipo: "EPI" | "EPC";
  descricao: string;
  ca: string | null;
  recomendado: "Sim" | "Não" | null;
  created_at?: string;
}

export interface Foto {
  id_foto: string;
  id_inspecao: string;
  id_empresa: string;
  id_setor: string | null;
  categoria: CategoriaFoto;
  legenda: string | null;
  arquivo_foto: string;
  storage_path: string | null;
  data_upload: string;
  usuario: string | null;
}

export interface Responsavel {
  id_responsavel: string;
  id_inspecao: string;
  id_empresa: string;
  tecnico_responsavel: string | null;
  recepcionado_por: string | null;
  cargo: string | null;
  data_hora: string | null;
}

// V11: Treinamento NR — direcionado por setor, cargo e/ou risco.
export interface TreinamentoNR {
  id_treinamento: string;
  id_inspecao: string;
  id_empresa: string;
  nr: string;
  titulo: string;
  descricao: string | null;
  carga_horaria: string | null;
  periodicidade: string | null;
  observacoes: string | null;
  ordem: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface TreinamentoSetorRel {
  id_treinamento: string;
  id_setor: string;
}

export interface TreinamentoCargoRel {
  id_treinamento: string;
  id_cargo: string;
}

export interface TreinamentoRiscoRel {
  id_treinamento: string;
  id_risco: string;
}

// V13: Plano de Ação (5W2H)
export type AcaoStatus =
  | "Pendente"
  | "Em Andamento"
  | "Concluida"
  | "Cancelada";

export type AcaoPrioridade = "Baixa" | "Media" | "Alta" | "Critica";

export interface Acao5W2H {
  id_acao: string;
  id_empresa: string;
  id_setor: string | null;
  id_risco: string | null;
  id_inspecao: string | null;
  /** V49: FK opcional pro item da Apreciação NR-12 que originou a ação. */
  id_apreciacao_item: string | null;
  what_acao: string;
  why_justificativa: string | null;
  where_local: string | null;
  when_prazo: string | null; // ISO date
  who_responsavel: string | null;
  how_metodo: string | null;
  how_much_custo: string | null;
  status: AcaoStatus;
  prioridade: AcaoPrioridade;
  data_conclusao: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at?: string;
  updated_at?: string | null;
}

// V10: Plano de Ação e Emergência (PAE) — árvore de contatos
// (nome/cargo/telefone) com hierarquia via id_parent.
export interface PaeContato {
  id_contato: string;
  id_inspecao: string;
  id_empresa: string;
  id_parent: string | null;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  ordem: number;
  created_at?: string;
  updated_at?: string | null;
}

export interface Complemento {
  id_complemento: string;
  id_inspecao: string;
  id_empresa: string;
  id_setor: string | null;
  tipo: string | null;
  titulo: string | null;
  descricao: string | null;
  dados: string | null;
  created_at?: string;
}

export interface Usuario {
  id_usuario: string;
  nome: string;
  email: string;
  cargo: string | null;
  perfil: PerfilUsuario;
  ativo_sistema: boolean;
  empresas_vinculadas: string[];
  modulos_permitidos?: ModuloPermitido[];
  /** Permissão granular pra criar relatórios/itens. Admin contorna. */
  pode_criar?: boolean;
  /** Permissão granular pra editar dados em geral. Admin contorna. */
  pode_editar?: boolean;
  /** Permissão granular pra excluir relatórios/análises top-level. Admin contorna. */
  pode_excluir?: boolean;
  senha_hash?: string | null;
  created_at?: string;
}

export interface Configuracao {
  chave: string;
  valor: unknown;
  updated_at: string;
  updated_by: string | null;
}

// ---- Análise de Químicos ----

/** Um componente químico de uma mistura/produto.
 *  Modo Manual pode ter 1 ou vários (ex: tíner = tolueno + acetona + xileno). */
export interface ComponenteQuimico {
  nome_quimico?: string | null;
  numero_cas?: string | null;
  formula_quimica?: string | null;
  concentracao?: string | null;
}

export interface CondicoesUsoQuimico {
  atividade?: string | null;
  frequencia?: string | null;
  duracao?: string | null;
  ventilacao?: string | null;
  geracao_nevoa_vapor?: string | null;
  epis_utilizados?: string | null;
}

export interface ConclusaoRapidaQuimico {
  insalubridade_nr15?: string;
  insalubridade_grau?: string;
  insalubridade_anexo?: string;
  insalubridade_fundamentacao?: string;
  aposentadoria_especial?: string;
  aposentadoria_tempo?: string;
  decreto_3048?: string;
  codigo_gfip?: string;
  esocial_tab24?: string;
  oleo_mineral?: string;
  carcinogenico?: string;
  periculosidade_nr16?: string;
  epi_necessarios?: string;
  epc_necessarios?: string;
  medidas_controle?: string;
  emergencia_acidente?: string;
  medicao_necessaria?: string;
  metodologia?: string;
  como_medir?: string;
  limite_exposicao?: string;
  resumo_tecnico?: string;
  /** Origem da análise: "template" = gerada client-side a partir da base
   *  Chabra (sem IA); "ia" = chamada à edge function Groq. Análises antigas
   *  sem essa marca são tratadas como "ia" pela UI (fallback). */
  _fonte?: "template" | "ia";
}

export type ModoAnaliseQuimico = "PDF" | "Manual";

export interface AnaliseQuimico {
  id_analise: string;
  id_empresa: string | null;
  titulo: string;
  nome_quimico: string | null;
  numero_cas: string | null;
  formula_quimica: string | null;
  forma_fisica: string | null;
  concentracao: string | null;
  modo: ModoAnaliseQuimico;
  fonte_arquivo: string | null;
  texto_extraido: string | null;
  condicoes_uso: CondicoesUsoQuimico | null;
  resultado_texto: string;
  conclusao_rapida: ConclusaoRapidaQuimico | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  created_at: string;
  updated_at: string | null;
}

// =====================================================
// Módulo Inventário de Máquinas e Equipamentos
// =====================================================

export type StatusMaquina = "OPERANTE" | "MANUTENCAO" | "INATIVA" | "BAIXADA";

export const STATUS_MAQUINA_LABELS: Record<StatusMaquina, string> = {
  OPERANTE: "Operante",
  MANUTENCAO: "Em manutenção",
  INATIVA: "Inativa",
  BAIXADA: "Baixada",
};

export interface Maquina {
  id_maquina: string;
  /** NULL = patrimônio interno da Chabra; preenchido = máquina de cliente. */
  id_empresa: string | null;
  nome: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  ano_fabricacao: number | null;
  numero_patrimonio: string | null;
  localizacao: string | null;
  status: StatusMaquina;
  observacoes: string | null;
  foto_url: string | null;
  foto_storage_path: string | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  created_at: string;
  updated_at: string | null;
}

// =====================================================
// Módulo Apreciação de Máquinas (NR-12)
// =====================================================

export type StatusApreciacao = "RASCUNHO" | "FINALIZADO";
export type SituacaoApreciacaoItem =
  | "CONFORME"
  | "NAO_CONFORME"
  | "NAO_APLICAVEL"
  | "PENDENTE";
export type RiscoResidual = "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";

export const SITUACAO_APRECIACAO_LABELS: Record<SituacaoApreciacaoItem, string> = {
  CONFORME: "Conforme",
  NAO_CONFORME: "Não conforme",
  NAO_APLICAVEL: "Não aplicável",
  PENDENTE: "Pendente",
};

export const RISCO_RESIDUAL_LABELS: Record<RiscoResidual, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
  CRITICO: "Crítico",
};

export interface ApreciacaoMaquina {
  id_apreciacao: string;
  id_empresa: string;
  id_maquina: string | null;
  maquina_descricao: string | null;
  titulo: string | null;
  setor: string | null;
  responsavel: string | null;
  responsavel_empresa: string | null;
  cidade: string | null;
  data_apreciacao: string | null;
  conclusao_tecnica: string | null;
  recomendacoes: string | null;
  risco_residual: RiscoResidual | null;
  status: StatusApreciacao;
  finalizado_em: string | null;
  observacoes_gerais: string | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  created_at: string;
  updated_at: string | null;
}

export type StatusAcaoApreciacao =
  | "Pendente"
  | "Em Andamento"
  | "Concluida"
  | "Cancelada";

export type PrioridadeAcaoApreciacao = "Baixa" | "Media" | "Alta" | "Critica";

export interface ApreciacaoAcao {
  id_acao: string;
  id_apreciacao: string;
  /** Item NAO_CONFORME que originou a ação. NULL quando é ação geral do laudo. */
  id_item: string | null;
  ordem: number;
  what_acao: string;
  why_justificativa: string | null;
  where_local: string | null;
  when_prazo: string | null; // ISO date
  who_responsavel: string | null;
  how_metodo: string | null;
  how_much_custo: string | null;
  status: StatusAcaoApreciacao;
  prioridade: PrioridadeAcaoApreciacao;
  data_conclusao: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ApreciacaoMaquinaItem {
  id_item: string;
  id_apreciacao: string;
  item_codigo: string;
  item_categoria: string;
  item_titulo: string;
  item_descricao: string | null;
  /** NULL = snapshot do catálogo NR-12. "LIVRE" = adicionado manualmente. */
  item_origem: string | null;
  ordem: number;
  situacao: SituacaoApreciacaoItem;
  observacao: string | null;
  recomendacao: string | null;
  /** Probabilidade da matriz ativa (snapshot do label, ex: "Improvável"). */
  probabilidade: string | null;
  /** Severidade da matriz ativa (snapshot do label, ex: "Moderada"). */
  severidade: string | null;
  /** Nível calculado via `calcularNivelComMatriz` (NivelRisco do Painel SST). */
  nivel_risco_calculado: NivelRisco | null;
  /** FK da matriz usada — snapshot pra preservar avaliação se a matriz mudar. */
  id_matriz: string | null;
  foto_urls: string[];
  foto_storage_paths: string[];
  created_at: string;
  updated_at: string | null;
}

// =====================================================
// Módulo Relatório de Conformidade NR
// =====================================================

export type SituacaoConformidade = "CONFORME" | "NAO_APLICAVEL" | "PENDENTE";
export type StatusRelatorioConformidade = "RASCUNHO" | "FINALIZADO";

export interface RelatorioConformidade {
  id_relatorio: string;
  id_empresa: string;
  nr_codigo: string;
  nr_titulo: string;
  setor: string | null;
  /** Responsável técnico Chabra (quem assina a auditoria pelo prestador). */
  responsavel: string | null;
  /** Pessoa do lado da empresa que acompanhou a auditoria e co-assina o relatório. */
  responsavel_empresa: string | null;
  /** Cidade da auditoria, usada na linha de fechamento ("Cidade, dd de mês de YYYY"). */
  cidade: string | null;
  data_inspecao: string | null;
  observacoes_gerais: string | null;
  status: StatusRelatorioConformidade;
  finalizado_em: string | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface RelatorioConformidadeItem {
  id_item: string;
  id_relatorio: string;
  item_codigo: string;
  item_titulo: string;
  item_descricao: string | null;
  ordem: number;
  situacao: SituacaoConformidade;
  observacao: string | null;
  /**
   * Origem do item (v44+):
   *   - `null` → snapshot do checklist da NR principal do relatório (imutável)
   *   - `"LIVRE"` → item adicionado livremente pelo auditor (título/desc editáveis)
   *   - `"NR-XX"` → cross-ref: snapshot do catálogo de outra NR (imutável)
   */
  item_nr_origem: string | null;
  /** URLs públicas das fotos do item (Supabase Storage, bucket `fotos`). */
  foto_urls: string[];
  /** Paths dos arquivos no bucket — pareados 1:1 com `foto_urls`, na mesma ordem. */
  foto_storage_paths: string[];
  created_at: string;
  updated_at: string | null;
}

// --- Relatório de Não Conformidade (RNC) ---
// Diferente do Conformidade NR (checklist por norma), o RNC é uma lista
// aberta de NCs encontradas em campo. Cada item descreve um desvio livre,
// com criticidade, causa raiz, ação corretiva e prazo.

export type CriticidadeNC = "ALTA" | "MEDIA" | "BAIXA";
export type StatusTratativaNC = "ABERTA" | "EM_TRATAMENTO" | "ENCERRADA";
export type StatusRelatorioNC = "RASCUNHO" | "FINALIZADO";

export interface RelatorioNaoConformidade {
  id_relatorio: string;
  id_empresa: string;
  titulo: string;
  /** NR vinculada ao relatório (opcional). Quando setada, libera o
   *  quick-pick de itens do catálogo na tela de detalhe. */
  nr_codigo: string | null;
  /** Snapshot do título da NR no momento em que foi vinculada (catálogo
   *  pode mudar; relatório fica congelado). */
  nr_titulo: string | null;
  setor: string | null;
  /** Responsável técnico Chabra (quem assina pelo prestador). */
  responsavel: string | null;
  /** Pessoa do lado da empresa que acompanhou a auditoria. */
  responsavel_empresa: string | null;
  /** Cidade da auditoria, usada na linha de fechamento. */
  cidade: string | null;
  data_inspecao: string | null;
  observacoes_gerais: string | null;
  status: StatusRelatorioNC;
  finalizado_em: string | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface RelatorioNaoConformidadeItem {
  id_item: string;
  id_relatorio: string;
  ordem: number;
  /** Quando a NC veio do quick-pick de uma NR, guarda o código do item
   *  no catálogo (ex: "12.5.10"). NCs adicionadas livremente ficam null. */
  item_codigo_origem: string | null;
  /** Descrição da NC encontrada (texto livre, obrigatório). */
  descricao: string;
  /** Norma violada — texto livre ("NR-12 12.5.10" / "ISO 9001 §5.2"). */
  norma_violada: string | null;
  criticidade: CriticidadeNC;
  causa_raiz: string | null;
  acao_corretiva: string | null;
  /** Prazo pra encerrar a NC (ISO yyyy-mm-dd). */
  prazo: string | null;
  /** Quem é responsável pela tratativa do lado da empresa. */
  responsavel_tratativa: string | null;
  status_tratativa: StatusTratativaNC;
  /** Evidência fotográfica — múltiplas fotos. */
  foto_urls: string[];
  foto_storage_paths: string[];
  created_at: string;
  updated_at: string | null;
}

// Schema esperado pelo @supabase/ssr / supabase-js (Database genérico).
type TableShape<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      empresas: TableShape<Empresa>;
      inspecoes: TableShape<Inspecao>;
      setores: TableShape<Setor>;
      cargos: TableShape<Cargo>;
      riscos: TableShape<Risco>;
      epi_epc: TableShape<EpiEpc>;
      fotos: TableShape<Foto>;
      responsaveis: TableShape<Responsavel>;
      complementos: TableShape<Complemento>;
      pae_contatos: TableShape<PaeContato>;
      treinamentos_nr: TableShape<TreinamentoNR>;
      treinamentos_setor: TableShape<TreinamentoSetorRel>;
      treinamentos_cargo: TableShape<TreinamentoCargoRel>;
      treinamentos_risco: TableShape<TreinamentoRiscoRel>;
      acoes_5w2h: TableShape<Acao5W2H>;
      usuarios: TableShape<Usuario>;
      configuracoes: TableShape<Configuracao>;
      tipos_risco: TableShape<TipoRiscoCustom>;
      perguntas_tipo_risco: TableShape<PerguntaTipoRisco>;
      matrizes_risco: TableShape<MatrizRisco>;
      itens_catalogo_tipo: TableShape<ItemCatalogoTipo>;
      modelos_risco: TableShape<ModeloRisco>;
      itens_modelo_risco: TableShape<ItemModeloRisco>;
      perguntas_modelo_risco: TableShape<PerguntaModeloRisco>;
      triagens_tipo: TableShape<TriagemTipoRisco>;
      triagens_opcao: TableShape<TriagemOpcao>;
      triagens_modelo: TableShape<TriagemModeloRel>;
      analises_quimicos: TableShape<AnaliseQuimico>;
      inventario_maquinas: TableShape<Maquina>;
      apreciacoes_maquinas: TableShape<ApreciacaoMaquina>;
      apreciacoes_maquinas_itens: TableShape<ApreciacaoMaquinaItem>;
      apreciacao_acoes: TableShape<ApreciacaoAcao>;
      aet_relatorios: TableShape<AetRelatorio>;
    };
  };
}

// ─── AET – Análise Ergonômica do Trabalho ────────────────────────────────────

export type StatusAET = "RASCUNHO" | "CONCLUIDO";

export type ClassificacaoRiscoAET =
  | "Trivial"
  | "De Atenção"
  | "Moderado"
  | "Alto"
  | "Crítico";

export type TipoRiscoAET =
  | "Acidentes"
  | "Ergonômico"
  | "Físico"
  | "Químico"
  | "Biológico";

export type PosturaCostas = 1 | 2 | 3 | 4;
export type PosturaBracos = 1 | 2 | 3;
export type PosturaPernas = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type EsforcoOWAS = 1 | 2 | 3;

export interface AetRisco {
  id: string;
  tipo: TipoRiscoAET;
  risco: string;
  intensidade_concentracao: string;
  tecnica_metodologia: string;
  epi_ca: string;
  epi_eficaz: string;
  classificacao_risco: ClassificacaoRiscoAET;
}

export interface AetChecklist {
  levantamento_acima_limite: boolean;
  posturas_forcadas_tipo: "Ocasionais" | "Eventuais" | "Habituais" | "Não Aplica";
  trabalho_predominante: "Em pé" | "Sentado" | "Alternando";
  pausas_descanso: boolean;
  uso_cadeira: boolean;
  cadeira_adequada: boolean;
  monitor: boolean;
  exigencia_levantamento: boolean;
  ritmo_por_demanda: boolean;
  pausas_formais: boolean;
  rodizios_sistematizados: boolean;
}

export interface AetOwas {
  posturas_costas: PosturaCostas[];
  posturas_bracos: PosturaBracos[];
  posturas_pernas: PosturaPernas[];
  esforco: EsforcoOWAS[];
}

export interface AetSetor {
  id: string;
  nome_setor: string;
  maquinas_equipamentos: string;
  cargos: string;
  descricao_atividade: string;
  riscos: AetRisco[];
  owas: AetOwas;
  checklist: AetChecklist;
  fotos: string[];
  parecer_tecnico: string;
  recomendacoes: string;
}

export interface AetRelatorio {
  id_relatorio: string;
  id_empresa: string;
  data_elaboracao: string | null;
  responsavel_elaboracao: string;
  titulo_profissional: string;
  registro_profissional: string;
  status: StatusAET;
  setores: AetSetor[];
  consideracoes_finais: string;
  textos_secoes: Record<string, string> | null;
  created_at: string;
  updated_at: string | null;
  usuario: string | null;
  empresas?: { nome_empresa: string; cnpj: string | null } | null;
}
