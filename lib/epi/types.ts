// EPI — tipos compartilhados entre UI e camada de dados.

export interface EpiColaborador {
  id: string;
  empresa_id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  cargo: string | null;
  setor: string | null;
  ativo: boolean;
  criado_por: string | null;
  criado_em: string;
  updated_at: string | null;
  // Fase 4D — biometria cadastrada (template FMD) p/ verificação 1:1
  biometria_template?: string | null;
  biometria_cadastrada_em?: string | null;
  biometria_consentimento_em?: string | null;
  biometria_expurgada_em?: string | null;
}

export type EpiTipoItem = "EPI" | "EPC";

export interface EpiCatalogoItem {
  id: string;
  empresa_id: string;
  nome: string;
  tipo: EpiTipoItem;
  ca_numero: string | null;
  ca_validade: string | null; // ISO date
  fabricante: string | null;
  descricao: string | null;
  unidade: string;
  estoque_minimo: number;
  foto_url: string | null;
  foto_path: string | null;
  ativo: boolean;
  criado_por: string | null;
  criado_em: string;
  updated_at: string | null;
}

export type EpiTipoMovimentacao = "entrada" | "saida" | "ajuste";

export interface EpiMovimentacao {
  id: string;
  empresa_id: string;
  id_catalogo: string;
  tipo: EpiTipoMovimentacao;
  quantidade: number;
  origem: string;
  ref_id: string | null;
  motivo: string | null;
  responsavel: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface EpiSaldo {
  id_catalogo: string;
  empresa_id: string;
  saldo: number;
}

export const EPI_TIPO_MOV_LABEL: Record<EpiTipoMovimentacao, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
};

// ============================================================
// IMPORTAÇÃO DE NF-e (Fase 2) — cabeçalho append-only
// ============================================================
export interface EpiImportacaoNfe {
  id: string;
  empresa_id: string;
  chnfe: string;
  fornecedor_cnpj: string | null;
  fornecedor_nome: string | null;
  numero_nf: string | null;
  data_emissao: string | null; // ISO date
  xml_nome: string | null;
  total_itens: number;
  itens_lancados: number;
  status: string;
  criado_por: string | null;
  criado_em: string;
}

/** Item extraído do XML da NF-e (antes da conferência). */
export interface EpiNfeItemParsed {
  cprod: string;
  xprod: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number | null;
}

/** Cabeçalho + itens extraídos do XML da NF-e. */
export interface EpiNfeParsed {
  chnfe: string;
  fornecedor_cnpj: string | null;
  fornecedor_nome: string | null;
  numero_nf: string | null;
  data_emissao: string | null; // ISO date
  itens: EpiNfeItemParsed[];
}

/** Como a UI decidiu tratar cada item na conferência. */
export type EpiNfeItemStatusMap = "lancado" | "ignorado";

// ============================================================
// ENTREGAS DE EPI (Fase 3) — cabeçalho + itens append-only
// ============================================================
export interface EpiEntrega {
  id: string;
  empresa_id: string;
  id_colaborador: string;
  data_entrega: string; // ISO date
  responsavel_entrega: string | null;
  observacao: string | null;
  total_itens: number;
  status: string;
  assinatura_recebedor: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface EpiEntregaItem {
  id: string;
  id_entrega: string;
  empresa_id: string;
  id_catalogo: string;
  nome_epi: string | null;
  ca_numero: string | null;
  quantidade: number;
  criado_em: string;
}

// ============================================================
// TRANSFERÊNCIA ENTRE EMPRESAS (Fase 5) — append-only, só interno
// ============================================================
export interface EpiTransferencia {
  id: string;
  empresa_origem: string;
  empresa_destino: string;
  observacao: string | null;
  total_itens: number;
  criado_por: string | null;
  criado_em: string;
}

export interface EpiTransferenciaItem {
  id: string;
  id_transferencia: string;
  empresa_origem: string;
  empresa_destino: string;
  id_catalogo_origem: string;
  id_catalogo_destino: string;
  nome_epi: string | null;
  quantidade: number;
  criado_em: string;
}

// ============================================================
// ASSINATURA DA ENTREGA (Fase 4) — trilha de evidências append-only
// ============================================================
export type EpiAssinaturaMetodo = "canvas" | "digital";

export interface EpiEntregaAssinatura {
  id: string;
  id_entrega: string;
  empresa_id: string;
  id_colaborador: string | null;
  assinante_nome: string | null;
  assinatura_png: string | null;
  pdf_sha256: string | null;
  user_agent: string | null;
  ip: string | null;
  assinado_em: string;
  criado_por: string | null;
  criado_em: string;
  // Fase 4B — método e evidência biométrica (biometria NÃO é persistida)
  metodo: EpiAssinaturaMetodo;
  finger_hash: string | null;
  device_info: string | null;
  qualidade: string | null;
  consentimento_em: string | null;
  // Fase 4D — verificação de identidade 1:1
  verificado: boolean;
  match_score: number | null;
}
