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
