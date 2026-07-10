// Tipos dos dados do banco. Reflete o schema v2 descrito na spec.

export type StatusInspecao =
  | "RASCUNHO"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "DELETADA";
export type TipoCriacao = "BRANCO" | "REVISAO" | "COPIA_EMPRESA";
export type StatusEmpresa = "Ativo" | "Inativa";
export type PerfilUsuario = "Admin" | "Tecnico" | "Visualizador" | "Cliente";

export type ModuloPermitido =
  | "painel"
  | "psicossocial"
  | "conformidade"
  | "nao_conformidade"
  | "apreciacao_maquinas"
  | "inventario_maquinas"
  | "analise_quimicos"
  | "aet"
  | "aep"
  | "questionarios_psicossociais"
  | "produtividade"
  | "investigacao_acidente"
  | "epi"
  | "gestao_gerencial";

export const TODOS_MODULOS: ModuloPermitido[] = [
  "painel",
  "psicossocial",
  "conformidade",
  "nao_conformidade",
  "apreciacao_maquinas",
  "inventario_maquinas",
  "analise_quimicos",
  "aet",
  "aep",
  "questionarios_psicossociais",
  "produtividade",
  "investigacao_acidente",
  "epi",
  "gestao_gerencial",
];

export const ROTULO_MODULO: Record<ModuloPermitido, string> = {
  investigacao_acidente: "Investigação de Acidente de Trabalho",
  painel: "Painel SST",
  psicossocial: "DRPS – Diagnóstico de Riscos Psicossociais",
  conformidade: "Relatório de Conformidade",
  nao_conformidade: "Relatório de Não Conformidade",
  apreciacao_maquinas: "Apreciação de Máquinas",
  inventario_maquinas: "Inventário de Equipamentos",
  analise_quimicos: "Análise de Químicos Chabra",
  aet: "AET – Análise Ergonômica do Trabalho",
  aep: "AEP – Análise Ergonômica Preliminar",
  questionarios_psicossociais: "Questionários Psicossociais / DRPS",
  produtividade: "Projeção de Produtividade CHABRA",
  epi: "EPI – Equipamentos de Proteção Individual",
  gestao_gerencial: "Gestão Gerencial",
};

// ─── Investigação de Acidente de Trabalho ────────────────────────────────────

export type TipoAcidente = "TIPICO" | "TRAJETO" | "DOENCA";
export type GravidadeAcidente = "LEVE" | "GRAVE" | "FATAL";
export type StatusInvestigacao = "RASCUNHO" | "CONCLUIDA" | "DELETADA";

export interface TestemunhaAcidente {
  nome: string;
  depoimento: string;
}

export type VinculoPessoa = "equipe" | "chefia_direta" | "chefia_indireta" | "comando";

/** Pessoa envolvida no acidente (equipe, chefia, comando) — Item 8. */
export interface PessoaEnvolvida {
  nome: string;
  cpf: string;
  funcao: string;
  telefone: string;
  email: string;
  vinculo: VinculoPessoa;
}

/** Relato de uma pessoa envolvida (ponto de vista) — Item 11. */
export interface RelatoEnvolvido {
  pessoa: string;
  relato: string;
}

/** Organização do trabalho da tarefa — Item 9 (campos por aspecto). */
export interface OrganizacaoTrabalho {
  planejamento?: string;
  orientacao?: string;
  recursos?: string;       // materiais, máquinas, ferramentas, EPI/EPC
  processos?: string;      // processos e controle de tempo
  sinalizacao?: string;
  hierarquia?: string;
}

/** Arquivo de mídia (foto/croqui/mapa): url pública + path de storage — Item 7. */
export interface MidiaArquivo {
  url: string;
  path: string;
}

/** Vídeo do acidente (link externo) — Item 7. */
export interface VideoLink {
  url: string;
  descricao?: string;
}

/** Avaliação de um fator contribuinte (questionário causal) — Item 12. */
export interface FatorAvaliacao {
  resposta: "" | "sim" | "nao" | "parcial" | "na";
  obs: string;
}

/** Laudo/documento externo (LPAT, perícia, BO, bombeiros…) — Item 13. */
export interface LaudoExterno {
  tipo: string;
  numero: string;
  data: string;
  url: string;
  obs: string;
}

/** Consultor / membro da equipe técnica da análise — Item 14. */
export interface Consultor {
  nome: string;
  registro: string;
}

/** Item de cronograma de medida adotada — Item 17. */
export interface Cronograma {
  tipo: string;          // manutenção, aquisições, treinamentos, procedimentos…
  descricao: string;
  prazo: string;
  responsavel: string;
  status: string;        // pendente, em andamento, concluído
}

export interface InvestigacaoAcidente {
  id_investigacao: string;
  id_empresa: string;
  // Dados gerais
  data_acidente: string | null;
  hora_acidente: string | null;
  local_acidente: string | null;
  setor: string | null;
  data_investigacao: string | null;
  responsavel_tecnico: string | null;
  numero_cat: string | null;
  data_cat: string | null;
  // Acidentado
  acidentado_nome: string | null;
  acidentado_cargo: string | null;
  acidentado_admissao: string | null;
  tipo_acidente: TipoAcidente | null;
  houve_afastamento: boolean;
  dias_afastamento: number | null;
  gravidade: GravidadeAcidente | null;
  /** Setores e funções do acidentado (múltiplos). `setor`/`acidentado_cargo` (single) ficam de legado. */
  setores: string[];
  acidentado_funcoes: string[];
  // Ficha completa do acidentado (Bloco 1 / Item 6)
  acidentado_cpf: string | null;
  acidentado_pis: string | null;
  acidentado_estado_civil: string | null;
  acidentado_nascimento: string | null;
  acidentado_escolaridade: string | null;
  acidentado_telefone: string | null;
  acidentado_endereco: string | null;
  acidentado_cbo: string | null;
  acidentado_tempo_funcao: string | null;
  acidentado_tempo_empresa: string | null;
  acidentado_jornada: string | null;
  acidentado_tempo_apos_inicio: string | null;
  // Dados do acidente (Bloco 1 / Item 5)
  qtd_acidentados: number | null;
  /** Consequências graves (checklist). */
  consequencias: string[];
  /** Fator de morbi/mortalidade (checklist). */
  fatores_morbi: string[];
  // Local, pessoas e organização (Bloco 2 / Itens 8-11)
  pessoas_envolvidas: PessoaEnvolvida[];
  organizacao_trabalho: OrganizacaoTrabalho;
  atividade_momento: string | null;
  relatos_envolvidos: RelatoEnvolvido[];
  // Mídia do local (Bloco 2b / Item 7)
  croqui: MidiaArquivo[];
  mapa_riscos: MidiaArquivo[];
  fotos_anteriores: MidiaArquivo[];
  fotos_momento: MidiaArquivo[];
  fotos_atuais: MidiaArquivo[];
  videos: VideoLink[];
  // Fatores contribuintes (Bloco 3 / Item 12) — chave do fator → avaliação
  fatores_contribuintes: Record<string, FatorAvaliacao>;
  // Documentação técnica e medidas (Bloco 4 / Itens 13-14-17)
  laudos_externos: LaudoExterno[];
  analise_equipe: string | null;
  consultores: Consultor[];
  analise_links: VideoLink[];        // filmes/esquemas do dia (links)
  medidas_adotadas: string | null;   // `medidas` (existente) = recomendadas
  cronogramas: Cronograma[];
  fotos_pos: MidiaArquivo[];          // relatório fotográfico pós-acidente
  responsavel_legal_nome: string | null;
  responsavel_legal_cargo: string | null;
  responsavel_legal_data: string | null;
  // Descrição
  descricao: string | null;
  agente_causador: string | null;
  /** Parte do corpo (legado single) + partes do corpo atingidas (lista + silhueta). */
  parte_corpo: string | null;
  partes_corpo: string[];
  natureza_lesao: string | null;
  cid: string | null;
  // Testemunhas (JSONB)
  testemunhas: TestemunhaAcidente[];
  // Análise de causas
  causas_imediatas: string | null;
  causas_basicas: string | null;
  /** 5 Porquês — pergunta + resposta em ordem (até 5). */
  cinco_porques: { pergunta: string; resposta: string }[];
  /** Diagrama de Ishikawa: categoria (6M) → causas. */
  ishikawa: Record<string, string[]>;
  // Medidas + conclusão
  medidas: string | null;
  conclusao: string | null;
  // Evidências
  foto_urls: string[];
  foto_legendas: string[];
  // Controle
  status: StatusInvestigacao;
  data_validade: string | null;
  created_at: string;
  updated_at: string | null;
}

// ─── QPS — Questionários Psicossociais ───────────────────────────────────────

export interface QpsTipo {
  id_tipo: string;
  nome: string;
  descricao: string | null;
  instrucoes: string | null;
  escala_min: number;
  escala_max: number;
  ativo: boolean;
  criado_em: string;
}

export interface QpsCategoria {
  id_categoria: string;
  id_tipo: string;
  nome: string;
  descricao: string | null;
  ordem: number;
}

export interface QpsPergunta {
  id_pergunta: string;
  id_categoria: string;
  texto: string;
  logica: "direta" | "invertida";
  ordem: number;
  ativo: boolean;
}

export type StatusQpsAplicacao = "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDO" | "DELETADO";

export interface QpsAplicacao {
  id_aplicacao: string;
  id_tipo: string;
  id_empresa: string;
  titulo: string;
  status: StatusQpsAplicacao;
  responsavel: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  observacoes_dimensoes: Record<string, string> | null;
  criado_em: string;
  atualizado_em: string | null;
}

export interface QpsRespondente {
  id_respondente: string;
  id_aplicacao: string;
  setor: string;
  cargo: string | null;
  respostas: Record<string, number>;
  lote: string | null;
  importado_em: string;
}

export interface QpsProbabilidade {
  id_aplicacao: string;
  setor: string;
  id_categoria: string;
  probabilidade: 1 | 2 | 3;
  atualizado_em: string;
}

export type StatusQpsPlano = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";

export interface QpsPlanoAcao {
  id_plano: string;
  id_aplicacao: string;
  setor: string | null;
  id_categoria: string | null;
  descricao: string;
  responsavel: string | null;
  prazo: string | null;
  status: StatusQpsPlano;
  criado_em: string;
  atualizado_em: string | null;
}

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
  | "analise_quimicos"
  | "aep";

export const MODULOS_EMPRESA: Array<{ value: ModuloEmpresa; label: string }> = [
  { value: "sst", label: "Painel SST (Inspeções)" },
  { value: "psicossocial", label: "Psicossocial" },
  { value: "conformidade", label: "Relatório de Conformidade" },
  { value: "nao_conformidade", label: "Relatório de Não Conformidade" },
  { value: "analise_quimicos", label: "Análise de Químicos" },
  { value: "aep", label: "AEP – Análise Ergonômica Preliminar" },
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
  // Endereço e contato (preenchidos pela busca por CNPJ na Receita)
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  // Dados cadastrais da Receita
  cnae_principal: string | null;
  cnae_descricao: string | null;
  situacao_cadastral: string | null;
  porte: string | null;
  /** Unidade (agrupamento de acesso). Null = visível a todos os usuários. */
  id_unidade: string | null;
  /** Lista de módulos em que a empresa está habilitada (aparece nos selects). */
  modulos_habilitados: ModuloEmpresa[];
  created_at: string;
  updated_at: string | null;
}

export interface Unidade {
  id_unidade: string;
  nome: string;
  created_at: string;
  updated_at: string | null;
}

export interface Inspecao {
  id_inspecao: string;
  id_empresa: string;
  data_inspecao: string | null;
  /** Validade do documento (PGR) — alerta de vencimento. */
  data_validade?: string | null;
  status: StatusInspecao;
  revisao: number;
  responsavel: string | null;
  observacoes: string | null;
  tipo_criacao: TipoCriacao | null;
  id_inspecao_base: string | null;
  usuario: string | null;
  /** Elaboração do documento no SGG pelo ADM (rastreio de produção). */
  elaboracao_responsavel: string | null;
  elaboracao_status: "PENDENTE" | "EM_ELABORACAO" | "CONCLUIDO" | null;
  elaboracao_concluida_em: string | null;
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
  fotos_urls: string[];
  fotos_storage_paths: string[];
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

// V60: Extintores — NR-23 Proteção Contra Incêndios
export interface Extintor {
  id_extintor: string;
  id_inspecao: string;
  id_empresa: string;
  id_setor: string | null;
  tipo_agente: string;
  capacidade: string | null;
  numero_identificacao: string | null;
  localizacao: string | null;
  data_validade: string | null;
  status: string | null;
  observacoes: string | null;
  fotos_urls: string[];
  fotos_storage_paths: string[];
  ordem: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string | null;
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
  /** V67: ação do plano de adequação (apreciacao_acoes) que originou esta —
   *  índice único parcial garante envio único por ação da apreciação. */
  id_apreciacao_acao: string | null;
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
  /** Unidades de acesso do usuário. Vê as empresas dessas unidades + as sem unidade. */
  unidades?: string[];
  modulos_permitidos?: ModuloPermitido[];
  /** Permissão granular pra criar relatórios/itens. Admin contorna. */
  pode_criar?: boolean;
  /** Permissão granular pra editar dados em geral. Admin contorna. */
  pode_editar?: boolean;
  /** Permissão granular pra excluir relatórios/análises top-level. Admin contorna. */
  pode_excluir?: boolean;
  senha_hash?: string | null;
  created_at?: string;
  /** URL pública da imagem de assinatura do técnico (Storage bucket fotos). */
  assinatura_url?: string | null;
  /** Tipo de certificado digital vinculado: A1 (software) ou A3 (token/hardware). */
  tipo_certificado?: "A1" | "A3" | null;
  /** Path do arquivo .pfx no bucket privado `certificados`. Só preenchido quando tipo_certificado = 'A1'. */
  certificado_pfx_path?: string | null;
  /** Quando false, exibe apenas o selo do certificado digital no bloco de assinatura (ignora assinatura_url). */
  mostrar_assinatura_imagem?: boolean;
  /** Registro profissional (ex: CRP para psicólogos, CREA para engenheiros). */
  crp?: string | null;
  /** CRM — Conselho Regional de Medicina (médicos do trabalho). */
  crm?: string | null;
  /** Registro no MTE — Ministério do Trabalho (técnicos de segurança). */
  registro_mte?: string | null;
  /** CPF do profissional — exibido sempre mascarado (LGPD). */
  cpf?: string | null;
  /** Validade (notAfter) do certificado A1, extraída do .pfx quando a senha é fornecida. */
  certificado_validade?: string | null;
  /** Titular (CN) do certificado A1. */
  certificado_titular?: string | null;
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
  /** Validade do documento (informada pelo usuário) — alerta de vencimento. */
  data_validade?: string | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  created_at: string;
  updated_at: string | null;
}

// =====================================================
// Módulo Inventário de Máquinas e Equipamentos
// =====================================================

export type StatusMaquina =
  | "OPERANTE"
  | "MANUTENCAO"
  | "INATIVA"
  | "BAIXADA"
  | "RESERVA";

export const STATUS_MAQUINA_LABELS: Record<StatusMaquina, string> = {
  OPERANTE: "Em operação",
  MANUTENCAO: "Em manutenção",
  INATIVA: "Desativada",
  BAIXADA: "Baixada",
  RESERVA: "Reserva",
};

export type GrauRiscoMaquina = "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";

export const GRAU_RISCO_MAQUINA_LABELS: Record<GrauRiscoMaquina, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
  CRITICO: "Crítico",
};

export interface Maquina {
  id_maquina: string;
  /** NULL = patrimônio interno da Chabra; preenchido = máquina de cliente. */
  id_empresa: string | null;
  /** Origem da importação (v66): inspeção de onde a máquina veio, se importada. */
  id_inspecao: string | null;
  /** Origem da importação (v66): registro original em inspecao_maquinas (dedupe). */
  id_maquina_inspecao: string | null;

  // ── Identificação ──────────────────────────────────────────
  nome: string;
  tipo: string | null;
  categoria: string | null;
  codigo_interno: string | null;
  tag: string | null;
  marca: string | null; // fabricante
  modelo: string | null;
  numero_serie: string | null;
  ano_fabricacao: number | null;
  numero_patrimonio: string | null;
  status: StatusMaquina;

  // ── Localização e Processo ─────────────────────────────────
  unidade: string | null;
  setor: string | null;
  linha_processo: string | null;
  area: string | null;
  responsavel_setor: string | null;
  operacao_executada: string | null;
  localizacao: string | null; // campo legado mantido

  // ── Capacidade e Finalidade ────────────────────────────────
  capacidade_operacional: string | null;
  producao_estimada: string | null;
  potencia: string | null;
  tensao: string | null;
  pressao: string | null;
  capacidade_carga: string | null;
  velocidade: string | null;
  dimensoes: string | null;
  finalidade: string | null;
  descricao_tecnica: string | null;

  // ── Segurança e Conformidade ───────────────────────────────
  protecao_fixa: boolean | null;
  descricao_protecao_fixa: string | null;   // texto descritivo (NR-12 inventário)
  protecao_movel: boolean | null;
  descricao_protecao_movel: string | null;  // texto descritivo (NR-12 inventário)
  dispositivos_seguranca: string | null;    // ex: "Botões de parada de emergência, proteção lateral"
  intertravamento: boolean | null;
  botao_emergencia: boolean | null;
  sistema_bloqueio: boolean | null;
  possui_manual: boolean | null;
  possui_diagrama_eletrico: boolean | null;
  aterramento: boolean | null;
  sinalizacao: boolean | null;
  necessita_adequacao_nr12: boolean | null;
  grau_risco: GrauRiscoMaquina | null;
  observacoes_tecnicas: string | null;

  // ── Meta ───────────────────────────────────────────────────
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
  /** Inspeção de origem (v66) — preenchido quando a máquina veio de uma inspeção. */
  id_inspecao: string | null;
  maquina_descricao: string | null;
  titulo: string | null;
  setor: string | null;
  responsavel: string | null;
  responsavel_empresa: string | null;
  cidade: string | null;
  data_apreciacao: string | null;
  /** Validade do documento (informada pelo usuário) — alerta de vencimento. */
  data_validade?: string | null;
  conclusao_tecnica: string | null;
  recomendacoes: string | null;
  risco_residual: RiscoResidual | null;
  status: StatusApreciacao;
  finalizado_em: string | null;
  observacoes_gerais: string | null;

  // ── Identificação dos Componentes (ABNT ISO/TR 14121-2:2018) ──────────────
  componentes_maquina: string[] | null;   // tipos de componentes presentes
  limite_uso: string | null;
  limite_espaco: string | null;
  limite_tempo: string | null;
  limite_produtividade: string | null;
  npe: string | null;                     // Número de Pessoas Expostas (padrão)
  sistemas_atual: string[] | null;        // sistemas de segurança existentes
  sistemas_necessario: string[] | null;   // sistemas de segurança necessários

  usuario_email: string | null;
  usuario_nome: string | null;
  created_at: string;
  updated_at: string | null;
}

// ── Análise de Riscos HRN (ABNT ISO/TR 14121-2:2018) ──────────────────────
export type PodHrn = "MUITO_PROVAVEL" | "PROVAVEL" | "IMPROVAVEL" | "REMOTA";
export type FepHrn = "DIARIAMENTE" | "SEMANALMENTE" | "MENSALMENTE" | "ANUALMENTE";
export type GpdHrn = "CATASTROFICA" | "GRAVE" | "MODERADA" | "BAIXA";
export type NpeHrn = "ACIMA_50" | "DE_16_50" | "DE_8_15" | "DE_3_7" | "DE_1_2";
export type ClassificacaoRiscoHrn = "ALTO" | "MEDIO" | "BAIXO" | "DESPREZIVEL";

export const POD_HRN_LABELS: Record<PodHrn, string> = {
  MUITO_PROVAVEL: "Muito Provável",
  PROVAVEL: "Provável",
  IMPROVAVEL: "Improvável",
  REMOTA: "Remota",
};
export const FEP_HRN_LABELS: Record<FepHrn, string> = {
  DIARIAMENTE: "Diariamente",
  SEMANALMENTE: "Semanalmente",
  MENSALMENTE: "Mensalmente",
  ANUALMENTE: "Anualmente",
};
export const GPD_HRN_LABELS: Record<GpdHrn, string> = {
  CATASTROFICA: "Catastrófica",
  GRAVE: "Grave",
  MODERADA: "Moderada",
  BAIXA: "Baixa",
};
export const NPE_HRN_LABELS: Record<NpeHrn, string> = {
  ACIMA_50: ">50 pessoas",
  DE_16_50: "16–50 pessoas",
  DE_8_15: "8–15 pessoas",
  DE_3_7: "3–7 pessoas",
  DE_1_2: "1–2 pessoas",
};
export const CLASSIFICACAO_HRN_LABELS: Record<ClassificacaoRiscoHrn, string> = {
  ALTO: "Alto",
  MEDIO: "Médio",
  BAIXO: "Baixo",
  DESPREZIVEL: "Desprezível",
};

/** Pontuações para cálculo automático: POD × FEP × GPD → score */
const _POD_SCORE: Record<PodHrn, number> = { MUITO_PROVAVEL: 4, PROVAVEL: 3, IMPROVAVEL: 2, REMOTA: 1 };
const _FEP_SCORE: Record<FepHrn, number> = { DIARIAMENTE: 4, SEMANALMENTE: 3, MENSALMENTE: 2, ANUALMENTE: 1 };
const _GPD_SCORE: Record<GpdHrn, number> = { CATASTROFICA: 4, GRAVE: 3, MODERADA: 2, BAIXA: 1 };

export function calcularClassificacaoHrn(
  pod: string | null,
  fep: string | null,
  gpd: string | null
): ClassificacaoRiscoHrn | null {
  const p = _POD_SCORE[pod as PodHrn];
  const f = _FEP_SCORE[fep as FepHrn];
  const g = _GPD_SCORE[gpd as GpdHrn];
  if (!p || !f || !g) return null;
  const score = p * f * g;
  if (score <= 4) return "DESPREZIVEL";
  if (score <= 12) return "BAIXO";
  if (score <= 32) return "MEDIO";
  return "ALTO";
}

export interface RiscoHrn {
  id_risco: string;
  id_apreciacao: string;
  tipo_perigo: string;
  origem: string | null;
  potenciais_consequencias: string | null;
  pod: PodHrn | null;
  fep: FepHrn | null;
  gpd: GpdHrn | null;
  npe_item: NpeHrn | null;
  classificacao_risco: ClassificacaoRiscoHrn | null;
  nivel_acoes: string | null;
  medidas_preventivas: string | null;
  ordem: number;
  created_at: string;
}

// ── Tipos de componentes de máquina (Identificação NR-12) ─────────────────
export const COMPONENTES_MAQUINA_NR12 = [
  "Transmissão por Engrenagens",
  "Superfície Rotativa",
  "Esteira",
  "Equip. Móvel/Corte das Partes Superiores",
  "Facas, Punções e Lâminas",
  "Equipamento Fixo Horizontal",
  "Impacto ou Prensamento",
  "Lâmina Rotativa",
  "Equipamento Rotativo",
  "Transmissões por Corrente",
  "Roletes Tracionados",
  "Máquina Automática",
] as const;

// ── Sistemas de segurança analisados (NR-12 / ABNT NBR 14153) ────────────
export const SISTEMAS_SEGURANCA_NR12 = [
  "Sistema de Emergência",
  "Borda de Segurança/Bumper",
  "Seccionadora",
  "Inercial",
  "Monit. Proteções Físicas Móveis",
  "Proteções Físicas",
  "Rearme/Reset Manual",
  "Treinamentos Específicos",
  "Autorização para Utilização",
  "Desligamento Seguro",
] as const;

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

/** Ação 5W2H do plano de ação da Investigação de Acidente (tabela investigacao_acoes).
 *  Espelha ApreciacaoAcao, escopada por investigação (sem item de origem). */
export interface InvestigacaoAcao {
  id_acao: string;
  id_investigacao: string;
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

/** Usuário associado à elaboração de uma inspeção (Documento SGG) — tabela inspecao_associados. */
export interface InspecaoAssociado {
  id: string;
  id_inspecao: string;
  id_usuario: string;
  nome: string;
  created_by: string | null;
  created_at: string;
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
  /** Legenda por foto (v68) — pareado 1:1 com foto_urls; "" = sem legenda. */
  foto_legendas: string[];
  created_at: string;
  updated_at: string | null;
}

// =====================================================
// Módulo Máquinas por Inspeção (NR-12)
// =====================================================

export type GrauRiscoInspecaoMaquina = "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";

export const GRAU_RISCO_INSPECAO_MAQUINA_LABELS: Record<GrauRiscoInspecaoMaquina, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
  CRITICO: "Crítico",
};

export interface InspecaoMaquina {
  id_maquina_inspecao: string;
  id_inspecao: string;
  id_empresa: string | null;
  id_setor: string | null;
  nome: string;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  tag: string | null;
  ano_fabricacao: number | null;
  potencia: string | null;
  tensao: string | null;
  protecao_fixa: boolean | null;
  protecao_movel: boolean | null;
  intertravamento: boolean | null;
  botao_emergencia: boolean | null;
  sistema_bloqueio: boolean | null;
  possui_manual: boolean | null;
  aterramento: boolean | null;
  sinalizacao: boolean | null;
  necessita_adequacao_nr12: boolean | null;
  grau_risco: GrauRiscoInspecaoMaquina | null;
  observacoes: string | null;
  parecer_ia: string | null;
  foto_urls: string[];
  foto_storage_paths: string[];
  ordem: number;
  ativo: boolean;
  usuario_email: string | null;
  usuario_nome: string | null;
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
  /** Validade do documento (informada pelo usuário) — alerta de vencimento. */
  data_validade?: string | null;
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
  /** Validade do documento (informada pelo usuário) — alerta de vencimento. */
  data_validade?: string | null;
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

// ─────────────────────────────────────────────
// Portal do Cliente
// ─────────────────────────────────────────────

export type StatusDocumentoPortal = "liberado" | "assinado" | "vencido" | "substituido";
export type StatusPendenciaPortal = "pendente" | "recebido" | "em_analise" | "resolvido";
export type PrioridadePortal = "baixa" | "media" | "alta";
export type StatusSolicitacaoPortal = "aberta" | "em_analise" | "em_execucao" | "concluida" | "cancelada";
export type TipoSolicitacaoPortal =
  | "visita_tecnica"
  | "atualizacao_documento"
  | "treinamento"
  | "inclusao_setor"
  | "inclusao_maquina"
  | "duvida"
  | "outro";
export type TipoDocumentoPortal =
  | "AET" | "AEP" | "RNC" | "Conformidade" | "DRPS" | "NR-12" | "Quimicos" | "Inspecao" | "Outro";
export type ReferenciaPortalTipo = "pendencia" | "solicitacao" | "nao_conformidade" | "documento";

export interface PortalDocumentoCliente {
  id: string;
  empresa_id: string;
  titulo: string;
  tipo_documento: TipoDocumentoPortal;
  modulo_origem: string;
  arquivo_pdf_url: string | null;
  status: StatusDocumentoPortal;
  versao: number;
  data_emissao: string | null;
  data_validade: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  referencia_tipo: string | null;
  referencia_id: string | null;
}

export interface PortalPendenciaCliente {
  id: string;
  empresa_id: string;
  titulo: string;
  descricao: string | null;
  status: StatusPendenciaPortal;
  prioridade: PrioridadePortal;
  prazo: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface PortalSolicitacaoCliente {
  id: string;
  empresa_id: string;
  tipo_solicitacao: TipoSolicitacaoPortal;
  descricao: string;
  prioridade: PrioridadePortal;
  status: StatusSolicitacaoPortal;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface PortalComentario {
  id: string;
  empresa_id: string;
  referencia_tipo: ReferenciaPortalTipo;
  referencia_id: string;
  texto: string;
  criado_por: string | null;
  criado_em: string;
}

export interface PortalAnexo {
  id: string;
  empresa_id: string;
  referencia_tipo: ReferenciaPortalTipo;
  referencia_id: string;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number | null;
  mime_type: string | null;
  criado_por: string | null;
  criado_em: string;
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
      apreciacao_riscos_hrn: TableShape<RiscoHrn>;
      aet_relatorios: TableShape<AetRelatorio>;
      aet_textos_padrao: TableShape<AetTextoPadraoCapitulo>;
      aep_relatorios: TableShape<AepRelatorio>;
      aep_textos_padrao: TableShape<AepTextoPadraoCapitulo>;
      relatorios_nao_conformidade: TableShape<RelatorioNaoConformidade>;
      relatorios_nao_conformidade_itens: TableShape<RelatorioNaoConformidadeItem>;
      portal_documentos_cliente: TableShape<PortalDocumentoCliente>;
      portal_pendencias_cliente: TableShape<PortalPendenciaCliente>;
      portal_solicitacoes_cliente: TableShape<PortalSolicitacaoCliente>;
      portal_comentarios: TableShape<PortalComentario>;
      portal_anexos: TableShape<PortalAnexo>;
    };
  };
}

// ─── AEP – Análise Ergonômica Preliminar ─────────────────────────────────────

export type StatusAEP = "RASCUNHO" | "CONCLUIDO";

export interface AepRisco {
  id: string;
  tipo: TipoRiscoAET;
  risco: string;
  classificacao_risco: ClassificacaoRiscoAET;
  medida_preventiva: string;
}

export interface AepChecklistFisica {
  postura: RespostaChecklist;
  repetitividade: RespostaChecklist;
  levantamento_carga: RespostaChecklist;
  mobiliario: RespostaChecklist;
  esforco_fisico: RespostaChecklist;
  iluminacao: RespostaChecklist;
  ruido: RespostaChecklist;
  vibracao: RespostaChecklist;
  desconforto_termico: RespostaChecklist;
}

export interface AepChecklistCognitiva {
  atencao_continua: RespostaChecklist;
  sobrecarga_mental: RespostaChecklist;
  pressao_psicologica: RespostaChecklist;
  excesso_informacoes: RespostaChecklist;
  ritmo_mental: RespostaChecklist;
}

export interface AepChecklistOrganizacional {
  assedio: RespostaChecklist;
  falta_suporte: RespostaChecklist;
  gestao_mudancas: RespostaChecklist;
  clareza_papel: RespostaChecklist;
  recompensas: RespostaChecklist;
  baixo_controle: RespostaChecklist;
  justica_organizacional: RespostaChecklist;
  eventos_traumaticos: RespostaChecklist;
  subcarga: RespostaChecklist;
  sobrecarga: RespostaChecklist;
  maus_relacionamentos: RespostaChecklist;
  comunicacao_dificil: RespostaChecklist;
  trabalho_remoto: RespostaChecklist;
}

export interface AepCargoSetor {
  id: string;
  cargo: string;
  descricao: string;
  quantidade: number;
}

export interface AepSetor {
  id: string;
  nome_setor: string;
  unidade: string;
  ghe: string;
  cargo: string;
  funcao: string;
  jornada: string;
  qtd_expostos: number;
  descricao_atividade: string;
  metodo_coleta: string;
  trabalhadores_consultados: string;
  cargos: AepCargoSetor[];
  observacoes_checklist: Record<string, string>;
  riscos: AepRisco[];
  checklist_fisica: AepChecklistFisica;
  checklist_cognitiva: AepChecklistCognitiva;
  checklist_organizacional: AepChecklistOrganizacional;
  parecer_tecnico: string;
  recomendacoes: string;
  necessita_aet: boolean;
}

export interface AepRelatorio {
  id_relatorio: string;
  id_empresa: string;
  status: StatusAEP;
  setores: AepSetor[];
  responsavel_elaboracao: string;
  titulo_profissional: string;
  registro_profissional: string;
  data_elaboracao: string | null;
  /** Validade do documento (informada pelo usuário) — alerta de vencimento. */
  data_validade?: string | null;
  endereco_empresa: string | null;
  conclusao: string;
  usuario: string | null;
  created_at: string;
  updated_at: string | null;
  empresas?: { nome_empresa: string; cnpj: string | null } | null;
}

export interface AepTextoPadraoCapitulo {
  id_capitulo: string;
  titulo: string;
  conteudo: string | null;
  tipo: "fixo" | "editavel";
  slug_fixo: string | null;
  mostrar: boolean;
  ordem: number;
  ordem_global: number | null;
  orientacao: string | null;
  quebra_pagina: string | null;
  posicao_pdf: string | null;
  bg_imagem_url: string | null;
  caixas_texto: import("@/lib/drps/types").CaixaTexto[] | null;
  created_at: string;
  updated_at: string | null;
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

export interface AetOwasSelectCampo {
  slug: string;
  label: string;
  opcoes: string[];
}

export interface AetChecklistPergunta {
  slug: string;
  label: string;
  secao: string;
  tipo?: "tristate" | "texto";
}

export type RespostaChecklist = "sim" | "nao" | "nao_aplica";

export interface AetChecklist {
  levantamento_acima_limite: RespostaChecklist;
  posturas_forcadas_tipo: string;
  trabalho_predominante: string;
  pausas_descanso: RespostaChecklist;
  uso_cadeira: RespostaChecklist;
  cadeira_adequada: RespostaChecklist;
  monitor: RespostaChecklist;
  exigencia_levantamento: RespostaChecklist;
  ritmo_por_demanda: RespostaChecklist;
  pausas_formais: RespostaChecklist;
  rodizios_sistematizados: RespostaChecklist;
}

export interface AetOwas {
  posturas_costas: PosturaCostas[];
  posturas_bracos: PosturaBracos[];
  posturas_pernas: PosturaPernas[];
  esforco: EsforcoOWAS[];
}

export interface AetOwasOpcao {
  value: number;
  label: string;
}

export interface AetOwasCategoria {
  id: string;
  slug: string;
  titulo: string;
  imagem_url: string | null;
  opcoes: AetOwasOpcao[];
  ordem: number;
}

export interface AetPerfilOwas {
  id: string;
  nome: string;
  posturas_costas: PosturaCostas[];
  posturas_bracos: PosturaBracos[];
  posturas_pernas: PosturaPernas[];
  esforco: EsforcoOWAS[];
  created_at: string;
}

export interface AetCargo {
  nome: string;
  descricao: string;
  quantidade: number;
}

export interface AetSetor {
  id: string;
  nome_setor: string;
  funcao: string;
  maquinas_equipamentos: string;
  cargos: AetCargo[];
  descricao_atividade: string;
  riscos: AetRisco[];
  owas: AetOwas;
  checklist: AetChecklist;
  respostas_extras: Record<string, RespostaChecklist>;
  fotos: string[];
  parecer_tecnico: string;
  recomendacoes: string;
  demais_condicoes: string;
}

export interface AetRelatorio {
  id_relatorio: string;
  id_empresa: string;
  data_elaboracao: string | null;
  /** Validade do documento (informada pelo usuário) — alerta de vencimento. */
  data_validade?: string | null;
  responsavel_elaboracao: string;
  titulo_profissional: string;
  registro_profissional: string;
  endereco_empresa: string | null;
  status: StatusAET;
  setores: AetSetor[];
  consideracoes_finais: string;
  textos_secoes: Record<string, string> | null;
  created_at: string;
  updated_at: string | null;
  usuario: string | null;
  empresas?: { nome_empresa: string; cnpj: string | null } | null;
}

export interface AetTextoPadraoCapitulo {
  id_capitulo: string;
  titulo: string;
  conteudo: string | null;
  ordem: number;
  /** Posição legada — substituída por ordem_global na v56. Mantida para retrocompatibilidade. */
  posicao_pdf: string | null;
  /** Orientação da página no PDF: 'retrato' | 'paisagem'. */
  orientacao: string | null;
  /** Quebra de página antes do capítulo: 'nova' | 'continua'. */
  quebra_pagina: string | null;
  bg_imagem_url: string | null;
  caixas_texto: import("@/lib/drps/types").CaixaTexto[] | null;
  created_at: string;
  updated_at: string | null;
  /** 'fixo' = capítulo gerado pelo sistema; 'editavel' = texto livre do usuário. */
  tipo: "fixo" | "editavel";
  /** Identificador do capítulo fixo. Null para capítulos editáveis. */
  slug_fixo: string | null;
  /** Se false, o capítulo não aparece no laudo impresso. */
  mostrar: boolean;
  /** Ordem global unificada entre capítulos fixos e editáveis. */
  ordem_global: number | null;
}

// ─── AET — 13 Fatores Psicossociais ──────────────────────────────────────────

export type ZonaPsi = "verde" | "amarela" | "laranja" | "vermelha";

export interface Aet13FatorConfig {
  codigo: string;           // F01–F13
  nome: string;
  descricao: string | null;
  perigos_tipicos: string | null;
  possiveis_danos: string | null;
  foco_plano: string | null;
  acao_plano: string | null;
  responsavel_plano: string | null;
  prazo_plano: string | null;
  ordem: number;
  updated_at?: string;
}

export interface Aet13FatorPergunta {
  id: string;
  codigo_fator: string;
  texto: string;
  logica: "direta" | "invertida";
  ordem: number;
  updated_at?: string;
}

export interface Aet13FatorSemaforo {
  id: ZonaPsi;
  label: string;
  min_score: number | null;
  max_score: number | null;
  nivel_pgr: string;
  prazo_texto: string;
  cor_fundo: string;
  cor_texto: string;
  updated_at?: string;
}

export interface AetLaudoQpsMeta {
  id_relatorio: string;
  n_respondentes: number | null;
  total_elegivel: number | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  modo_aplicacao: string | null;
  tecnico_aplicador: string | null;
  observacao_geral: string | null;
  updated_at?: string;
}

export interface AetLaudoQpsResposta {
  id_relatorio: string;
  id_setor: string;
  codigo_fator: string;
  pergunta_ordem: number;
  resposta: number;
  updated_at?: string;
}

export interface AetLaudoFatorPsi {
  id_relatorio: string;
  codigo_fator: string;
  avaliado: boolean;
  media: number | null;
  pct_zona_risco: number | null;
  pergunta_critica: string | null;
  observacao: string | null;
  zona: ZonaPsi | null;
  updated_at?: string;
}
