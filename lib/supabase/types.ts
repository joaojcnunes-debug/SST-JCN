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
  | "nao_conformidade";

export const TODOS_MODULOS: ModuloPermitido[] = [
  "painel",
  "psicossocial",
  "conformidade",
  "nao_conformidade",
];

export const ROTULO_MODULO: Record<ModuloPermitido, string> = {
  painel: "Painel SST",
  psicossocial: "Psicossocial",
  conformidade: "Relatório de Conformidade",
  nao_conformidade: "Relatório de Não Conformidade",
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

export interface Empresa {
  id_empresa: string;
  nome_empresa: string;
  razao_social: string | null;
  cnpj: string | null;
  grau_risco: number | null;
  status: StatusEmpresa | null;
  observacao: string | null;
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
  senha_hash?: string | null;
  created_at?: string;
}

export interface Configuracao {
  chave: string;
  valor: unknown;
  updated_at: string;
  updated_by: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
