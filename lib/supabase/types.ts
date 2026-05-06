// Tipos dos dados do banco. Reflete exatamente o schema descrito na spec.
// Mantenha sincronizado com a estrutura real das tabelas no Supabase.

export type StatusInspecao = "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDA";
export type TipoCriacao = "BRANCO" | "REVISAO";
export type StatusEmpresa = "Ativo" | "Inativa";
export type PerfilUsuario = "Admin" | "Tecnico" | "Visualizador";

export type TipoRisco =
  | "Acidente"
  | "Ergonômico"
  | "Físico"
  | "Químico"
  | "Biológico"
  | "Psicossocial"
  | "Ambiental";

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
}

export interface Cargo {
  id_cargo: string;
  id_inspecao: string;
  id_empresa: string;
  id_setor: string;
  cargo: string;
  descricao: string | null;
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
  medio_propagacao: string | null;
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
  medidas_adotadas: string | null;
  medidas_recomendadas: string | null;
  observacoes_risco: string | null;
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

export interface Usuario {
  id_usuario: string;
  nome: string;
  email: string;
  cargo: string | null;
  perfil: PerfilUsuario;
  ativo_sistema: boolean;
  empresas_vinculadas: string[];
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
      usuarios: TableShape<Usuario>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
