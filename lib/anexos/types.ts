// Anexos genéricos por (modulo, id_referencia) — Fase 3 expansão SGG.
// Tabela public.anexos; bucket de storage público 'anexos'.

export type ModuloAnexo =
  | "conformidade"
  | "nao_conformidade"
  | "analise_quimicos"
  | "apreciacao_maquinas"
  | "aep"
  | "psicossocial";

export type TipoAnexo = "pdf" | "imagem" | "arquivo";

/** Vínculo técnico do anexo (E2 Módulo Documentos SST). */
export type VinculoAnexo =
  | "empresa" | "unidade" | "setor" | "cargo" | "funcao" | "ghe"
  | "risco" | "maquina" | "equipamento" | "relatorio" | "plano_acao"
  | "treinamento" | "inspecao" | "evidencia";

export const VINCULOS_ANEXO: { value: VinculoAnexo; label: string }[] = [
  { value: "relatorio", label: "Relatório" },
  { value: "empresa", label: "Empresa" },
  { value: "unidade", label: "Unidade" },
  { value: "setor", label: "Setor" },
  { value: "cargo", label: "Cargo" },
  { value: "funcao", label: "Função" },
  { value: "ghe", label: "GHE" },
  { value: "risco", label: "Risco" },
  { value: "maquina", label: "Máquina" },
  { value: "equipamento", label: "Equipamento" },
  { value: "plano_acao", label: "Plano de ação" },
  { value: "treinamento", label: "Treinamento" },
  { value: "inspecao", label: "Inspeção" },
  { value: "evidencia", label: "Evidência" },
];

export interface Anexo {
  id_anexo: string;
  modulo: ModuloAnexo;
  id_referencia: string;
  nome: string;
  descricao: string | null;
  storage_path: string;
  url: string;
  mime: string | null;
  tamanho_bytes: number | null;
  tipo: TipoAnexo;
  ordem: number;
  incluir_no_pdf: boolean;
  criado_por: string | null;
  created_at: string;
  // E2: vínculo técnico
  empresa_id: string | null;
  vinculo_tipo: VinculoAnexo | null;
  vinculo_id: string | null;
  validade: string | null;
  obrigatorio: boolean;
  capitulo_destino: string | null;
  mostrar_no_corpo: boolean;
}

/** Classifica o anexo a partir do MIME (define como entra no PDF). */
export function classificarAnexo(mime: string | null | undefined): TipoAnexo {
  if (!mime) return "arquivo";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "imagem";
  return "arquivo";
}
