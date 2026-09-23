// Tipos dos dados do banco. Reflete o schema v2 descrito na spec.

export type StatusInspecao =
  | "RASCUNHO"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "DELETADA";
/** RENOVACAO (23/09): registro de documento, não conta como inspeção. */
export type TipoCriacao = "BRANCO" | "REVISAO" | "COPIA_EMPRESA" | "RENOVACAO";
export type StatusEmpresa = "Ativo" | "Inativa";
export type PerfilUsuario = "Admin" | "Tecnico" | "Visualizador" | "Cliente";
/**
 * Nível dentro da função (v229). Consulta = lê; Operação = escreve no módulo;
 * Aprovação = + supervisiona (reabre elaboração de outro, troca responsável,
 * configura o módulo, assina); Admin = + administra o sistema. O perfil continua
 * decidindo a escrita no banco (`caller_pode_editar`); o nível decide o que a
 * TELA libera — ver `ehSupervisor` em lib/hooks/useUsuario.ts.
 */
export type NivelUsuario = "Consulta" | "Operacao" | "Aprovacao" | "Admin";

/** Uma função do painel (v229, tabela `funcoes_painel`): o padrão que uma conta nova recebe. Editável em Sistema › Funções. */
export interface FuncaoPainel {
  funcao: string;
  ordem: number;
  descricao: string;
  nivel: NivelUsuario;
  perfil_padrao: PerfilUsuario;
  /** null = a função não impõe a flag (Admin contorna). */
  pode_criar_padrao: boolean | null;
  pode_editar_padrao: boolean | null;
  pode_excluir_padrao: boolean | null;
  modulos_padrao: ModuloPermitido[];
  unidades_padrao: "da_base" | "todas";
  /** v231: abre Sistema › Presença e Sistema › Auditoria (só leitura). Admin sempre abre. */
  ve_presenca_auditoria: boolean;
  criado_em?: string;
}

export type ModuloPermitido =
  | "painel"
  | "psicossocial"
  | "conformidade"
  | "nao_conformidade"
  | "apreciacao_maquinas"
  | "analise_quimicos"
  | "aet"
  | "aep"
  | "questionarios_psicossociais"
  | "produtividade"
  | "investigacao_acidente"
  | "gestao_gerencial"
  | "epi"
  | "transferencias"
  | "equipamentos"
  | "frota"
  | "escala_supervisores";

export const TODOS_MODULOS: ModuloPermitido[] = [
  "painel",
  "psicossocial",
  "conformidade",
  "nao_conformidade",
  "apreciacao_maquinas",
  "analise_quimicos",
  "aet",
  "aep",
  "questionarios_psicossociais",
  "produtividade",
  "investigacao_acidente",
  "gestao_gerencial",
  "epi",
  "transferencias",
  "equipamentos",
  "frota",
  "escala_supervisores",
];

export const ROTULO_MODULO: Record<ModuloPermitido, string> = {
  investigacao_acidente: "Investigação de Acidente de Trabalho",
  gestao_gerencial: "Gestão Gerencial",
  painel: "Painel SST",
  psicossocial: "DRPS – Diagnóstico de Riscos Psicossociais",
  conformidade: "Relatório de Conformidade",
  nao_conformidade: "Relatório de Não Conformidade",
  apreciacao_maquinas: "Apreciação de Máquinas",
  analise_quimicos: "Análise de Químicos JCN Consultoria",
  aet: "AET – Análise Ergonômica do Trabalho",
  aep: "AEP – Análise Ergonômica Preliminar",
  questionarios_psicossociais: "Questionários Psicossociais / DRPS",
  produtividade: "Projeção de Produtividade CHABRA",
  epi: "Gestão de EPI",
  transferencias: "Transferência de Equipamentos entre Bases",
  equipamentos: "Equipamentos JCN Consultoria (patrimônio interno)",
  frota: "Frota JCN Consultoria – Checklist de Veículos",
  escala_supervisores: "Escala de Supervisores",
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
  /** v210 — "Fontes Geradoras do Risco" da categoria, como o DRPS tem por tópico. */
  fonte_geradora?: string | null;
}

export interface QpsPergunta {
  id_pergunta: string;
  id_categoria: string;
  texto: string;
  logica: "direta" | "invertida";
  ordem: number;
  ativo: boolean;
  /**
   * Alternativas próprias desta pergunta (v180), na ORDEM do formulário. A
   * POSIÇÃO é o valor gravado: 1 = primeira alternativa. Com `logica`
   * "invertida" — o padrão do questionário ordinal — a primeira é a pior.
   * `null` ou ausente: a pergunta usa a escala numérica do tipo, como sempre.
   */
  opcoes?: string[] | null;
}

/**
 * `ENVIADO_CLIENTE` entrou na v206, junto com o quadro de status do Resumo.
 * O banco só passou a aceitar esse valor nessa migration — antes dela, gravá-lo
 * volta 23514 (check_violation), que foi o que a v106 consertou no DRPS.
 */
export type StatusQpsAplicacao =
  | "RASCUNHO"
  | "EM_ANDAMENTO"
  | "CONCLUIDO"
  | "ENVIADO_CLIENTE"
  | "DELETADO";

export interface QpsAplicacao {
  id_aplicacao: string;
  id_tipo: string;
  id_empresa: string;
  titulo: string;
  status: StatusQpsAplicacao;
  responsavel: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  /** Quantos DEVERIAM responder — denominador da taxa de participação (v201). */
  trabalhadores_previstos: number | null;
  /** Filial/unidade DO CLIENTE. Não é a unidade da JCN Consultoria (empresas.id_unidade). */
  unidade_cliente: string | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  observacoes_dimensoes: Record<string, string> | null;
  /** v210 — tela "Análise" (régua do DRPS): texto por setor; "*" = consolidado. */
  agravos_por_setor?: Record<string, string> | null;
  medidas_por_setor?: Record<string, string> | null;
  conclusoes_por_setor?: Record<string, string> | null;
  /** v226 — laudo: CRP do responsável e data de elaboração impressa. */
  crp?: string | null;
  data_elaboracao?: string | null;
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

// ─── v225 — gestão "igual ao DRPS" (Plano 5W2H, Medidas, Monitoramento, Revisão) ─
// Espelhos de drps_plano_acao_5w2h / drps_plano_medidas / drps_monitoramento /
// drps_revisao, com id_aplicacao no lugar de id_relatorio e id_categoria no
// lugar de topico_idx. Sem id_empresa: o RLS passa pela aplicação-pai.

export type StatusQpsPlanoAcao5w2h = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA";

export interface QpsPlanoAcao5w2h {
  id: string;
  id_aplicacao: string;
  ordem: number;
  acao: string | null; // O quê
  justificativa: string | null; // Por quê
  onde: string | null; // Onde (setores por vírgula)
  prazo: string | null; // Quando (meses por vírgula)
  responsavel: string | null; // Quem
  como: string | null; // Como (catálogo + extras por vírgula)
  quanto_custa: string | null; // Quanto custa
  status: StatusQpsPlanoAcao5w2h;
  created_at: string;
  updated_at: string | null;
}

export interface QpsPlanoMedidas {
  id_aplicacao: string;
  ano: number;
  /** chave = nome do programa (MEDIDAS_CONTROLE do DRPS) */
  plano: Record<string, { meses: boolean[]; responsavel: string }>;
  updated_at: string;
}

export type StatusQpsMonitoramento = "Pendente" | "Em Andamento" | "Concluido" | "Cancelado";

export interface QpsMonitoramento {
  id_aplicacao: string;
  setor: string;
  id_categoria: string;
  data_intervencao: string | null;
  responsavel: string | null;
  status: StatusQpsMonitoramento;
  proxima_avaliacao: string | null;
  observacoes: string | null;
  updated_at: string;
}

export interface QpsRevisao {
  id_aplicacao: string;
  /** chave = id da ação obrigatória (ACOES_OBRIGATORIAS) */
  checklist: Record<string, boolean>;
  /** chave = id do papel (EQUIPE_REVISAO) */
  equipe: Record<string, boolean>;
  anotacoes: string | null;
  updated_at: string;
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

/**
 * Que tipo de cadastro é esta empresa (v140).
 * CLIENTE   = empresa contratante dos serviços, o caso de sempre.
 * TERCEIROS = canteiro, obra ou cliente externo onde se trabalha; aponta para
 *             a contratante em `id_empresa_contratante`.
 */
export type TipoEstabelecimento = "CLIENTE" | "TERCEIROS";

export interface Empresa {
  id_empresa: string;
  nome_empresa: string;
  razao_social: string | null;
  /** Nome fantasia da Receita. Preenchido pela busca por CNPJ. */
  nome_fantasia?: string | null;
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
  // ─── Estabelecimento de terceiros (v140) ──────────────────────────────────
  // ─── Procedência do grau de risco (v141) ──────────────────────────────────
  /**
   * NORMA = derivado do CNAE pelo Anexo I da NR-4; MANUAL = pessoa escolheu
   * outro valor. NULL nos cadastros anteriores à v141, onde não dá para saber.
   */
  grau_risco_origem?: "NORMA" | "MANUAL" | null;
  /** O que a NR-4 indicava quando o cadastro foi gravado. */
  grau_risco_norma?: number | null;
  /** Ausente nos registros anteriores à v140 — trate como "CLIENTE". */
  tipo_estabelecimento?: TipoEstabelecimento | null;
  /** Só preenchido quando tipo_estabelecimento === "TERCEIROS". */
  id_empresa_contratante?: string | null;
  /** Ponto de referência para chegar ao local (canteiro sem número). */
  referencia?: string | null;
  /** Hospital, UPA ou ambulatório mais próximo e telefones. */
  locais_emergencia?: string | null;
  dados_adicionais?: string | null;
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
  /** V154 — data real de conclusão da inspeção (carimbada ao concluir). */
  concluida_em: string | null;
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
  /**
   * V204 — a conta do painel do técnico que foi a campo, quando dá para
   * afirmar quem é.
   *
   * Nulo é resposta legítima, não falta de dado: campo em branco, nome ambíguo,
   * ou técnico de unidade que não tem login. Quem lê deve cair no
   * `tecnico_responsavel` nesses casos, nunca sumir com a linha.
   */
  id_usuario: string | null;
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
  /**
   * LEGADO — congelado na v158 (2026-08-05). O app não escreve mais aqui:
   * use `situacao` + `nao_conformidades`. Mantido como trilha de auditoria.
   */
  status: string | null;
  /** v158 — CONFORME | NAO_CONFORME | null (não avaliado). */
  situacao: string | null;
  /** v158 — causas da não conformidade; vazio quando não é NAO_CONFORME. */
  nao_conformidades: string[];
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
  /** V184: risco da inspeção que gerou esta ação pelo botão "Enviar para
   *  Plano de Ação". Só o envio automático preenche — `id_risco` continua
   *  livre para o vínculo manual feito na tela /acoes. */
  id_risco_origem: string | null;
  /** V208: ação do plano do AET (aet_acoes) que gerou esta pelo botão
   *  "Enviar para o Plano de Ação do PGR". Só o envio preenche; índice único
   *  parcial garante envio único por ação do AET. */
  id_aet_acao: string | null;
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
  /** Função no painel (v229): chave de `funcoes_painel`. Define o padrão de módulos/nível para conta nova. */
  funcao?: string | null;
  /** Nível dentro da função (v229). Sem valor = deduzido do perfil (Admin → Admin, resto → Operacao). */
  nivel?: NivelUsuario | null;
  /** v231: embed da função (useAuth) — só o que a tela precisa da funcoes_painel. */
  funcoes_painel?: Pick<FuncaoPainel, "ve_presenca_auditoria"> | null;
  /** Permissão granular pra criar relatórios/itens. Admin contorna. */
  pode_criar?: boolean;
  /** Permissão granular pra editar dados em geral. Admin contorna. */
  pode_editar?: boolean;
  /** Permissão granular pra excluir relatórios/análises top-level. Admin contorna. */
  pode_excluir?: boolean;
  /**
   * Capability de escrita de químicos desacoplada do perfil (F1.3-A / v189).
   * Serve a RLS (`pode_escrever_quimicos()`) e o front: um Visualizador com esta
   * flag escreve `analises_quimicos`/`base_referencia_quimicos` sem ser Técnico.
   * NÃO é auto-concedível — write de `usuarios` segue gated por admin.
   */
  pode_escrever_quimicos?: boolean;
  /** E-mail de quem concedeu `pode_escrever_quimicos` (auditoria, v189). */
  concedido_por?: string | null;
  /** Quando `pode_escrever_quimicos` foi concedido (auditoria, v189). */
  concedido_em?: string | null;
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
   *  JCN Consultoria (sem IA); "ia" = chamada à edge function Groq. Análises antigas
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

/**
 * Classificação do item no inventário (abas/categorias do sidebar):
 *  - equipamentos: material interno da JCN Consultoria
 *  - maquinas:     material de clientes
 *  - medicoes:     instrumentos de medição
 */
export type CategoriaInventario = "equipamentos" | "maquinas" | "medicoes";

export const CATEGORIA_INVENTARIO_LABELS: Record<CategoriaInventario, string> = {
  equipamentos: "Equipamentos",
  maquinas: "Máquinas",
  medicoes: "Medição",
};

// ─── Equipamentos JCN Consultoria (patrimônio interno, v163) ──────────────────────────
// Tabela própria, escopada por BASE (id_unidade), não por empresa cliente: o
// patrimônio da JCN Consultoria não pertence a cliente nenhum. Reaproveita StatusMaquina
// porque a lista de situações é a mesma — o que muda é tudo o resto.

export interface Equipamento {
  id_equipamento: string;
  /** Base onde o equipamento está. NOT NULL no banco: equipamento sempre está
   *  em algum lugar. */
  id_unidade: string;

  // ── Identificação ──────────────────────────────────────────
  nome: string;
  tipo: string | null;
  fabricante: string | null;
  modelo: string | null;
  numero_serie: string | null;
  /** Único entre os preenchidos (índice parcial). Vazio vira NULL. */
  numero_patrimonio: string | null;
  codigo_interno: string | null;
  tag: string | null;
  status: StatusMaquina;

  // ── Aquisição — o que patrimônio exige e o inventário NR-12 não tinha ─────
  fornecedor: string | null;
  nota_fiscal: string | null;
  data_aquisicao: string | null;
  valor_aquisicao: number | null;
  garantia_ate: string | null;
  termo_garantia_path: string | null;

  // ── Localização ────────────────────────────────────────────
  /** OPCIONAL aqui, ao contrário do MaquinaForm: exigir setor de um mouse em
   *  estoque é atrito puro. */
  setor: string | null;
  localizacao: string | null;
  responsavel: string | null;

  // ── Foto: nasce com miniatura ──────────────────────────────
  foto_url: string | null;
  foto_path: string | null;
  foto_thumb_path: string | null;

  observacoes: string | null;

  /** id_maquina de onde veio na migração da v163. Prova "nenhuma linha
   *  perdida" e é o que permite desfazer. NULL em cadastro novo. */
  id_inventario_origem: string | null;

  // ── Posse (v166) ───────────────────────────────────────────
  /** Colaborador que está com o equipamento. NULL = está na base, livre para
   *  entrega. É esta coluna que a RPC de entrega usa para recusar entregar duas
   *  vezes o mesmo aparelho, e a de devolução para soltá-lo de volta. */
  id_colaborador: string | null;
  entregue_em: string | null;

  criado_por: string | null;
  criado_em: string;
  updated_at: string | null;
}

// ─── Entrega, devolução e roster de colaboradores (v166/v167) ────────────────
// O banco destas seis tabelas foi aplicado em produção junto com o módulo, mas
// nada no frontend as lia — por isso elas nunca chegaram aqui. Os tipos abaixo
// são transcrição direta das migrations, não inferência.

export interface ColaboradorChabra {
  id_colaborador: string;
  /** Base à qual a pessoa pertence. A RPC de entrega recusa colaborador de
   *  outra base — não é decoração de tela. */
  id_unidade: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  cargo: string | null;
  setor: string | null;
  /** Opcional e só para aviso. Não é credencial: o roster existe justamente
   *  para quem NÃO tem login no painel. */
  email: string | null;
  ativo: boolean;
  criado_por: string | null;
  criado_em: string;
  updated_at: string | null;
  /** Metadados NÃO-secretos da digital. O template cifrado vive em
   *  `colaboradores_chabra_biometria`, tabela sem policy que só as RPCs
   *  `security definer` alcançam — a policy de SELECT da v166 liberaria a
   *  linha inteira para a base, e o template sairia junto (v188). */
  biometria_em: string | null;
  biometria_dedo: string | null;
}

/** Estado do bem no retorno. Diferente de `integro` exige descrição — o banco
 *  cobra isso por constraint (`equip_dev_estado_exige_obs`). */
export type EstadoRetorno = "integro" | "avariado" | "inservivel";

export interface EquipamentoEntrega {
  id_entrega: string;
  id_unidade: string;
  id_colaborador: string;
  data_entrega: string;
  responsavel_entrega: string | null;
  observacao: string | null;
  total_itens: number;
  status: string;
  criado_por: string | null;
  criado_em: string;
  /** v192 — a emissão virou um ato. Enquanto `null`, o termo é rascunho: sai com marca
   *  d'água, sem campos de assinatura, e a assinatura biométrica é recusada. */
  emitido_em: string | null;
  emitido_por: string | null;
  /** Documento assinado não se apaga, se cancela — apagar destruiria a prova que a
   *  biometria existe para produzir. */
  cancelado_em: string | null;
  cancelado_por: string | null;
  cancelado_motivo: string | null;
}

/** Item entregue. `id_equipamento` = ativo individualizado; `id_catalogo` =
 *  produto de estoque por quantidade. Um dos dois, nunca os dois vazios.
 *  Os campos `nome_equipamento`/`numero_serie`/`numero_patrimonio` são
 *  SNAPSHOT: o termo emitido tem de continuar legível depois que o
 *  equipamento for editado ou baixado. */
export interface EquipamentoEntregaItem {
  id_item: string;
  id_entrega: string;
  id_unidade: string;
  id_catalogo: string | null;
  id_equipamento: string | null;
  nome_equipamento: string | null;
  numero_serie: string | null;
  numero_patrimonio: string | null;
  quantidade: number;
  devolvido_em: string | null;
  criado_em: string;
}

/** Quem pode assinar `envia` e `valida` numa retirada — em QUALQUER base (v189).
 *  Tabela própria e não uma flag em `colaboradores_chabra`: campo de controle de
 *  segurança não mora em cadastro com CRUD aberto. Escrita só por
 *  `equip_definir_equipe_entrega`, que exige Admin. */
export interface EquipEquipeEntrega {
  id_colaborador: string;
  definido_por: string | null;
  definido_em: string;
}

/** Alterações da retirada depois de criada (v192). Só as RPCs escrevem: a tabela não
 *  tem policy de INSERT, porque histórico que o usuário pode escrever não é histórico. */
export interface EquipamentoEntregaHistorico {
  id_historico: string;
  id_entrega: string;
  id_unidade: string;
  acao: "emitiu" | "editou" | "item_add" | "item_edit" | "item_rem" | "cancelou" | "excluiu";
  campo: string | null;
  valor_antes: string | null;
  valor_depois: string | null;
  motivo: string | null;
  usuario_email: string | null;
  criado_em: string;
}

export interface EquipamentoEntregaAssinatura {
  id_assinatura: string;
  id_entrega: string;
  id_unidade: string;
  id_colaborador: string | null;
  assinante_nome: string | null;
  metodo: "canvas" | "digital";
  assinatura_png: string | null;
  user_agent: string | null;
  ip: string | null;
  consentimento_em: string | null;
  assinado_em: string;
  criado_por: string | null;
  criado_em: string;
  /** Quem assinou: quem envia, quem recebe e quem valida. Uma assinatura por
   *  papel — índice único `(id_entrega, papel)` na v188, que substituiu a
   *  regra "uma assinatura por entrega" da v166. As três pessoas são distintas
   *  duas a duas: separação de funções é a razão do terceiro papel. */
  papel: "envia" | "recebe" | "valida";
  /** Herdado da v166 (aceite eletrônico da transferência). Na assinatura digital de
   *  retirada fica `null`: vinha do corpo da requisição, ou seja, o próprio signatário
   *  escolhia o valor, e nunca era lido de volta. Foi substituído por
   *  `conteudo_sha256`. */
  pdf_sha256: string | null;
  /** Hash canônico do CONTEÚDO da retirada no instante da assinatura, calculado pelo
   *  banco (`equip_hash_conteudo_entrega`). Recalculado na impressão e comparado: se
   *  divergir, o termo para de afirmar "digital verificada" e denuncia a alteração. */
  conteudo_sha256: string | null;
  /** Vêm do matcher, no servidor. `metodo='digital'` só é gravado por
   *  `equipamento_assinar_entrega_digital`, que não é concedida a
   *  `authenticated` — o cliente não consegue afirmar que verificou. */
  match_score: number | null;
  finger_verificado: boolean | null;
}

export interface EquipamentoDevolucao {
  id_devolucao: string;
  id_unidade: string;
  id_colaborador: string;
  /** Entrega de origem, quando conhecida. `on delete set null`: a devolução
   *  sobrevive ao sumiço da entrega. */
  id_entrega: string | null;
  data_devolucao: string;
  recebido_por: string | null;
  observacao: string | null;
  total_itens: number;
  criado_por: string | null;
  criado_em: string;
}

export interface EquipamentoDevolucaoItem {
  id_item: string;
  id_devolucao: string;
  id_unidade: string;
  id_catalogo: string | null;
  id_equipamento: string | null;
  nome_equipamento: string | null;
  numero_serie: string | null;
  numero_patrimonio: string | null;
  quantidade: number;
  estado_retorno: EstadoRetorno;
  observacao_estado: string | null;
  criado_em: string;
}

export interface Maquina {
  id_maquina: string;
  /** NULL = patrimônio interno da JCN Consultoria; preenchido = máquina de cliente. */
  id_empresa: string | null;
  /** Origem da importação (v66): inspeção de onde a máquina veio, se importada. */
  id_inspecao: string | null;
  /** Origem da importação (v66): registro original em inspecao_maquinas (dedupe). */
  id_maquina_inspecao: string | null;

  // ── Identificação ──────────────────────────────────────────
  nome: string;
  tipo: string | null;
  categoria: string | null;
  /** Aba/categoria do inventário: Equipamentos (interno) · Máquinas (cliente) · Medição. */
  categoria_inventario: CategoriaInventario | null;
  codigo_interno: string | null;
  tag: string | null;
  marca: string | null; // fabricante
  modelo: string | null;
  numero_serie: string | null;
  ano_fabricacao: number | null;
  numero_patrimonio: string | null;
  status: StatusMaquina;

  // ── Localização e Processo ─────────────────────────────────
  id_unidade: string | null;   // base/unidade (FK unidades) — isolamento e transferência (v136)
  unidade: string | null;      // espelho em texto do nome da unidade (legado/exibição)
  setor: string | null;
  linha_processo: string | null;
  area: string | null;
  responsavel_setor: string | null;
  operacao_executada: string | null;
  /** V145: operadores da máquina, texto livre (nomes separados por vírgula). */
  operadores: string | null;
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
  /** Caminho da miniatura (~320px) no bucket `fotos`. A LISTAGEM lê isto; a
   *  original só é baixada ao abrir o item. NULL enquanto o mutirão não passou
   *  — o código cai na original. v173, 2026-08-10. */
  foto_thumb_path: string | null;
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
  /** V149: número da notificação SIT/MTE que originou o laudo. */
  notificacao_sit: string | null;
  /** V153: imprime também o checklist de 37 itens no PDF (além da ficha HRN). */
  incluir_checklist_pdf: boolean;
  /**
   * V146: narrativa do que foi verificado em campo naquela máquina. Sai acima da
   * tabela de risco na ficha. Não confundir com `observacoes_gerais` nem com
   * `conclusao_tecnica`, que é o parecer e sai depois da tabela.
   */
  constatacoes_inspecao: string | null;

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

/**
 * Índice HRN (POD × FEP × GPD). Impresso ao lado da classificação na ficha do
 * laudo, no formato "24 · MÉDIO". Retorna null se faltar qualquer um dos três.
 */
export function calcularIndiceHrn(
  pod: string | null,
  fep: string | null,
  gpd: string | null
): number | null {
  const p = _POD_SCORE[pod as PodHrn];
  const f = _FEP_SCORE[fep as FepHrn];
  const g = _GPD_SCORE[gpd as GpdHrn];
  if (!p || !f || !g) return null;
  return p * f * g;
}

export function calcularClassificacaoHrn(
  pod: string | null,
  fep: string | null,
  gpd: string | null
): ClassificacaoRiscoHrn | null {
  const score = calcularIndiceHrn(pod, fep, gpd);
  if (!score) return null;
  // Faixas do laudo de referência TERE PÃO, alinhadas em 2026-07-31 a pedido do
  // usuário (antes: 4 / 12 / 32). Aplicado com a tabela HRN ainda em ZERO linhas
  // — nenhum laudo existente foi reclassificado. A função apenas SUGERE: o valor
  // que o técnico gravar é o que vale e o que sai impresso.
  if (score <= 8) return "DESPREZIVEL";
  if (score <= 18) return "BAIXO";
  if (score <= 36) return "MEDIO";
  return "ALTO";
}

export interface RiscoHrn {
  id_risco: string;
  id_apreciacao: string;
  /** Máquina (ficha) a que o perigo pertence — v148. */
  id_ficha: string | null;
  tipo_perigo: string;
  origem: string | null;
  potenciais_consequencias: string | null;
  /**
   * V147: item(ns) da NR-12 ligados ao perigo — texto livre ("12.38 a 12.55").
   * NÃO confundir com `npe_item`, que é o Número de Pessoas Expostas.
   */
  item_nr12: string | null;
  /**
   * V149: itens da NR-12 como lista — substitui `item_nr12`. O campo texto fica
   * como legado enquanto houver código antigo em produção escrevendo nele.
   */
  itens_nr12: string[] | null;
  /** V149: categoria de segurança do comando (NBR 14153). */
  categoria_seguranca: CategoriaSeguranca | null;
  pod: PodHrn | null;
  fep: FepHrn | null;
  gpd: GpdHrn | null;
  npe_item: NpeHrn | null;
  classificacao_risco: ClassificacaoRiscoHrn | null;
  nivel_acoes: string | null;
  /** LEGADO (anterior à v146): campo único de medidas. A ficha usa os dois abaixo. */
  medidas_preventivas: string | null;

  // ── V146: medidas separadas e risco residual (colunas da ficha do laudo) ──
  medidas_engenharia: string | null;
  medidas_administrativas: string | null;
  pod_residual: PodHrn | null;
  fep_residual: FepHrn | null;
  gpd_residual: GpdHrn | null;
  classificacao_residual: ClassificacaoRiscoHrn | null;

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
  /** TEXTO LIVRE desde a v185 ("imediato", "30 dias após a entrega"). Linhas
   *  antigas ainda podem estar em ISO — use formatarPrazoAcao() para exibir. */
  when_prazo: string | null;
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

/** Plano de Ação 5W2H do laudo AET — tabela aet_acoes (v207). Standalone,
 *  como InvestigacaoAcao: nasce e morre com o relatório. */
export interface AetAcao {
  id_acao: string;
  id_relatorio: string;
  /** Setor do AET (aet_relatorios.setores[].id, JSONB, sem FK). NULL = ação geral. */
  id_setor: string | null;
  ordem: number;
  what_acao: string;
  why_justificativa: string | null;
  where_local: string | null;
  /** TEXTO LIVRE de nascença ("imediato", "30 dias após a entrega"). Exibir
   *  com formatarPrazoAcao(). */
  when_prazo: string | null;
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

// ── Ficha de máquina (v148) — 1 laudo cobre N máquinas ────────────────────

/** Operador/responsável de uma máquina. Sai no PDF como "Nome — Cargo". */
export interface OperadorFicha {
  nome: string;
  cargo: string;
}

/**
 * Uma máquina dentro do laudo. Os campos de identificação são SNAPSHOT: mudar
 * o inventário depois não altera laudo já emitido.
 */
export interface FichaMaquina {
  id_ficha: string;
  id_apreciacao: string;
  id_maquina: string | null;
  numero_ordem: number;

  maquina_descricao: string | null;
  equipamento: string | null;
  tipo: string | null;
  modelo: string | null;
  fabricante: string | null;
  serie: string | null;
  ano: string | null;
  capacidade: string | null;
  setor: string | null;

  componentes_maquina: string[] | null;
  limite_uso: string | null;
  limite_espaco: string | null;
  limite_tempo: string | null;
  limite_produtividade: string | null;
  npe: string | null;
  sistemas_atual: string[] | null;
  sistemas_necessario: string[] | null;

  constatacoes_inspecao: string | null;
  /** Parecer DAQUELA máquina — não confundir com a conclusão geral do laudo. */
  parecer_tecnico: string | null;
  operadores: OperadorFicha[] | null;
  prioridade_manual: boolean;

  foto_urls: string[];
  foto_storage_paths: string[];

  usuario_email: string | null;
  usuario_nome: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Perigo reutilizável — pré-preenche a linha HRN (v150). */
export interface PerigoCatalogo {
  id_perigo: string;
  nome: string;
  origem_consequencias: string | null;
  itens_nr12: string[] | null;
  medidas_eng: string | null;
  medidas_adm: string | null;
  pod_default: PodHrn | null;
  fep_default: FepHrn | null;
  gpd_default: GpdHrn | null;
  pod_residual_default: PodHrn | null;
  fep_residual_default: FepHrn | null;
  gpd_residual_default: GpdHrn | null;
  categoria_seguranca_default: CategoriaSeguranca | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string | null;
}

/** Categoria de segurança do comando (ABNT NBR 14153 / ISO 13849). */
export type CategoriaSeguranca = "B" | "1" | "2" | "3" | "4";
export const CATEGORIAS_SEGURANCA: CategoriaSeguranca[] = ["B", "1", "2", "3", "4"];

/**
 * Agrupa fichas por setor, na hierarquia Empresa → Setor → Máquina.
 * Setores entram na ordem da 1ª aparição; máquinas por `numero_ordem`.
 * `seqDe` devolve a numeração sequencial impressa (4.1, 4.2, ...).
 */
export function agruparFichasPorSetor(fichas: FichaMaquina[]): {
  grupos: { setor: string; fichas: FichaMaquina[] }[];
  flat: FichaMaquina[];
  seqDe: (f: FichaMaquina) => number;
} {
  const SEM_SETOR = "Sem setor";
  const ordem: string[] = [];
  const porSetor = new Map<string, FichaMaquina[]>();

  for (const f of [...fichas].sort((a, b) => (a.numero_ordem ?? 0) - (b.numero_ordem ?? 0))) {
    const setor = (f.setor ?? "").trim() || SEM_SETOR;
    if (!porSetor.has(setor)) {
      porSetor.set(setor, []);
      ordem.push(setor);
    }
    porSetor.get(setor)!.push(f);
  }

  const grupos = ordem.map((setor) => ({ setor, fichas: porSetor.get(setor)! }));
  const flat = grupos.flatMap((g) => g.fichas);
  const posicao = new Map(flat.map((f, i) => [f.id_ficha, i + 1]));
  return { grupos, flat, seqDe: (f) => posicao.get(f.id_ficha) ?? 0 };
}

export interface ApreciacaoMaquinaItem {
  id_item: string;
  id_apreciacao: string;
  /** Máquina (ficha) a que o item pertence — v148. */
  id_ficha: string | null;
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
  /**
   * LEGADO — congelado na v160 (2026-08-05). A máquina pode estar em vários
   * setores: use `ids_setores`. Mantido como trilha e base do rollback.
   */
  id_setor: string | null;
  /**
   * v160 — setores em que a máquina é utilizada, de
   * `inspecao_maquinas_setores`. Derivado: não é coluna da tabela.
   */
  ids_setores: string[];
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
  /** Responsável técnico JCN Consultoria (quem assina a auditoria pelo prestador). */
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
  /** Responsável técnico JCN Consultoria (quem assina pelo prestador). */
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
      // ── Tabelas que o painel acessa sem declarar aqui ─────────────────────
      // La o cliente tipa `from`/`rpc` de forma solta (ComposedSupabaseClient),
      // entao elas nunca precisaram entrar no Database. Aqui o cliente e o
      // supabase-js estritamente tipado, e sem estas linhas cada insert/update
      // vira `never`. Shape permissivo de proposito: o dominio destas tabelas
      // mora no modulo que as usa, nao neste arquivo.
      equipamentos_catalogo: TableShape<Record<string, unknown>>;
      equipamentos_movimentacoes: TableShape<Record<string, unknown>>;
      equipamentos_importacoes_nfe: TableShape<Record<string, unknown>>;
      equipamentos_importacoes_nfe_itens: TableShape<Record<string, unknown>>;
      equipamentos_status_historico: TableShape<Record<string, unknown>>;
      novidades_avisos: TableShape<Record<string, unknown>>;
      novidades_vistas: TableShape<Record<string, unknown>>;
      gestao_google_contas: TableShape<Record<string, unknown>>;
      gestao_google_eventos: TableShape<Record<string, unknown>>;
      gestao_google_fila: TableShape<Record<string, unknown>>;
      gestao_tarefa_vinculados: TableShape<Record<string, unknown>>;
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
      apreciacao_fichas_maquina: TableShape<FichaMaquina>;
      apreciacao_perigos_catalogo: TableShape<PerigoCatalogo>;
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
      colaboradores_chabra: TableShape<ColaboradorChabra>;
      equipamentos_entregas: TableShape<EquipamentoEntrega>;
      equipamentos_entregas_itens: TableShape<EquipamentoEntregaItem>;
      equipamentos_entrega_assinaturas: TableShape<EquipamentoEntregaAssinatura>;
      equip_equipe_entrega: TableShape<EquipEquipeEntrega>;
      equipamentos_entregas_historico: TableShape<EquipamentoEntregaHistorico>;
      equipamentos_devolucoes: TableShape<EquipamentoDevolucao>;
      equipamentos_devolucoes_itens: TableShape<EquipamentoDevolucaoItem>;
      auditoria_eventos: TableShape<AuditoriaEvento>;
      auditoria_tabelas: TableShape<AuditoriaTabela>;
    };
  };
}


// ─── Auditoria de movimentação (v212) ────────────────────────────────────────

export type AuditoriaAcao = "criou" | "editou" | "excluiu";

/**
 * Uma linha de `auditoria_eventos`, gravada por GATILHO em 167 tabelas (v212).
 * Só Admin lê (RLS); ninguém edita nem apaga pela API.
 * `antes`/`depois`: na edição, só os campos que mudaram; na criação, a linha
 * inteira em `depois`; na exclusão, a linha inteira em `antes`.
 */
export interface AuditoriaEvento {
  id: number;
  ocorrido_em: string;
  tabela: string;
  registro_id: string | null;
  acao: AuditoriaAcao;
  /** Id do módulo do hub (ModuloPermitido) ou um dos extras: gestao_chabra · sistema · pdfs. */
  modulo: string;
  id_empresa: string | null;
  titulo: string | null;
  /** NULL quando a gravação veio pelo token de serviço ou por psql — ver usuario_role. */
  usuario_email: string | null;
  usuario_role: string | null;
  campos_alterados: string[];
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}

export interface AuditoriaTabela {
  tabela: string;
  modulo: string;
  pk_colunas: string[];
  coluna_titulo: string | null;
  ativo: boolean;
  criado_em: string;
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
  assedio: RespostaChecklistAep;
  falta_suporte: RespostaChecklistAep;
  gestao_mudancas: RespostaChecklistAep;
  clareza_papel: RespostaChecklistAep;
  recompensas: RespostaChecklistAep;
  baixo_controle: RespostaChecklistAep;
  justica_organizacional: RespostaChecklistAep;
  eventos_traumaticos: RespostaChecklistAep;
  subcarga: RespostaChecklistAep;
  sobrecarga: RespostaChecklistAep;
  maus_relacionamentos: RespostaChecklistAep;
  comunicacao_dificil: RespostaChecklistAep;
  trabalho_remoto: RespostaChecklistAep;
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
  /**
   * Sinais observáveis marcados em cada fator organizacional respondido "sim"
   * — `{ assedio: ["tom_agressivo", ...] }`. Opcional: os laudos anteriores a
   * 2026-08-06 não têm o campo, e `aep_relatorios.setores` é jsonb, então nada
   * precisou de migration. Catálogo em `lib/aep/sinais-organizacional.ts`.
   */
  sinais_organizacional?: Record<string, string[]>;
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
  /** Só no código: a tabela NÃO tem esta coluna (ver lib/aet/checklist.ts). */
  tipo?: "tristate" | "texto";
  /** v209: excluída na tela de configuração — some da análise, da prévia e do PDF. */
  oculta?: boolean | null;
}

export type RespostaChecklist = "sim" | "nao" | "nao_aplica";

/**
 * A Ergonomia Organizacional do AEP tem um quarto estado: "N/I — não
 * identificável", para o fator que não foi possível verificar em campo (não é
 * "não existe", nem "não se aplica"). Fica só no AEP organizacional de
 * propósito: a física, a cognitiva e todos os checklists do AET seguem
 * tristate, e nada do que já está gravado muda de significado.
 */
export type RespostaChecklistAep = RespostaChecklist | "nao_identificado";

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
  /** Setor do laudo (id dentro do JSONB aet_relatorios.setores). v135: os
   *  fatores passaram a ser por setor — antes eram um só para o laudo todo. */
  id_setor: string;
  codigo_fator: string;
  avaliado: boolean;
  media: number | null;
  pct_zona_risco: number | null;
  pergunta_critica: string | null;
  observacao: string | null;
  zona: ZonaPsi | null;
  updated_at?: string;
}
