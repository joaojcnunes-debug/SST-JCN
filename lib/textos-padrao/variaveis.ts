// Variáveis dinâmicas substituídas nos capítulos de Texto Padrão na hora de
// gerar o PDF. Sintaxe: {{nome_variavel}}.
//
// Cada módulo (SST, Conformidade, Análise Químicos) tem seu próprio conjunto
// de variáveis disponíveis. A interseção (campos da empresa) está em comum.

import {
  formatCNPJ,
  formatCPF,
  formatCEI,
  formatCAEPF,
  formatCNO,
} from "@/lib/utils";
import type { Empresa } from "@/lib/supabase/types";
import type { ModuloTextoPadrao } from "./types";

export interface VariavelDef {
  chave: string;
  rotulo: string;
  exemplo: string;
}

const VARIAVEIS_EMPRESA: VariavelDef[] = [
  { chave: "empresa_nome", rotulo: "Nome da empresa", exemplo: "Chabra Saúde e Segurança" },
  { chave: "empresa_razao_social", rotulo: "Razão social", exemplo: "Chabra Ltda" },
  { chave: "cnpj", rotulo: "CNPJ", exemplo: "31.427.455/0001-11" },
  { chave: "cpf", rotulo: "CPF", exemplo: "000.000.000-00" },
  { chave: "cei", rotulo: "CEI", exemplo: "00.000.00000/00" },
  { chave: "caepf", rotulo: "CAEPF", exemplo: "000.000.000/000-00" },
  { chave: "cno", rotulo: "CNO", exemplo: "00.000.00000/00" },
];

const VARIAVEIS_DATA_RESPONSAVEL: VariavelDef[] = [
  { chave: "data_atual", rotulo: "Data atual (geração do PDF)", exemplo: "15/05/2026" },
  { chave: "responsavel", rotulo: "Responsável técnico", exemplo: "João Jefferson" },
  { chave: "cidade", rotulo: "Cidade", exemplo: "Catanduva - SP" },
];

export const VARIAVEIS_POR_MODULO: Record<ModuloTextoPadrao, VariavelDef[]> = {
  sst: [
    ...VARIAVEIS_EMPRESA,
    ...VARIAVEIS_DATA_RESPONSAVEL,
    { chave: "data_inspecao", rotulo: "Data da inspeção", exemplo: "15/05/2026" },
    { chave: "revisao", rotulo: "Número da revisão", exemplo: "1" },
  ],
  conformidade: [
    ...VARIAVEIS_EMPRESA,
    ...VARIAVEIS_DATA_RESPONSAVEL,
    { chave: "nr_codigo", rotulo: "Código da NR", exemplo: "NR-24" },
    { chave: "nr_titulo", rotulo: "Título da NR", exemplo: "Condições Sanitárias..." },
    { chave: "setor", rotulo: "Setor auditado", exemplo: "Produção" },
    { chave: "responsavel_empresa", rotulo: "Responsável da empresa", exemplo: "Maria Silva" },
    { chave: "data_inspecao", rotulo: "Data da auditoria", exemplo: "15/05/2026" },
  ],
  nao_conformidade: [
    ...VARIAVEIS_EMPRESA,
    ...VARIAVEIS_DATA_RESPONSAVEL,
    { chave: "titulo", rotulo: "Título do relatório", exemplo: "Auditoria pré-NR-12 jan/2026" },
    { chave: "setor", rotulo: "Setor auditado", exemplo: "Produção" },
    { chave: "responsavel_empresa", rotulo: "Responsável da empresa", exemplo: "Maria Silva" },
    { chave: "data_inspecao", rotulo: "Data da auditoria", exemplo: "15/05/2026" },
    { chave: "total_ncs", rotulo: "Total de NCs encontradas", exemplo: "7" },
    { chave: "total_ncs_alta", rotulo: "NCs de criticidade ALTA", exemplo: "2" },
  ],
  analise_quimicos: [
    ...VARIAVEIS_EMPRESA,
    ...VARIAVEIS_DATA_RESPONSAVEL,
    { chave: "titulo", rotulo: "Título da análise", exemplo: "MC-2BK106 MAKE-UP" },
    { chave: "nome_quimico", rotulo: "Nome químico", exemplo: "2-Butanone; Ethanol" },
    { chave: "numero_cas", rotulo: "Número CAS", exemplo: "78-93-3" },
  ],
  apreciacao_maquinas: [
    ...VARIAVEIS_EMPRESA,
    ...VARIAVEIS_DATA_RESPONSAVEL,
    { chave: "titulo", rotulo: "Título do laudo", exemplo: "Apreciação Prensa Hidráulica" },
    { chave: "maquina_nome", rotulo: "Nome da máquina", exemplo: "Prensa Hidráulica 50t" },
    { chave: "setor", rotulo: "Setor", exemplo: "Produção" },
    { chave: "responsavel_empresa", rotulo: "Responsável da empresa", exemplo: "Maria Silva" },
    { chave: "data_apreciacao", rotulo: "Data da apreciação", exemplo: "15/05/2026" },
    { chave: "total_itens", rotulo: "Total de itens avaliados", exemplo: "37" },
    { chave: "total_nao_conforme", rotulo: "Itens não conformes", exemplo: "8" },
    { chave: "risco_residual", rotulo: "Risco residual final", exemplo: "ALTO" },
  ],
};

/** Substitui {{chave}} em HTML, com escape; chaves desconhecidas ficam literais. */
export function substituirVariaveis(
  html: string | null | undefined,
  valores: Record<string, string>
): string {
  if (!html) return "";
  return html.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, chave: string) => {
    const k = chave.toLowerCase();
    if (k in valores) return escapeHtml(valores[k]);
    return match;
  });
}

/** Substitui {{chave}} em texto plano (sem escape — pra título). */
export function substituirVariaveisTexto(
  texto: string | null | undefined,
  valores: Record<string, string>
): string {
  if (!texto) return "";
  return texto.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, chave: string) => {
    const k = chave.toLowerCase();
    if (k in valores) return valores[k];
    return match;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Formata data ISO (yyyy-mm-dd) para "dd/mm/yyyy". String vazia se inválido. */
export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

/**
 * Monta o subconjunto comum de variáveis (dados da empresa + data atual).
 * Cada módulo combina isso com suas variáveis específicas.
 */
export function montarValoresEmpresa(
  empresa: Empresa | null | undefined
): Record<string, string> {
  return {
    empresa_nome: empresa?.nome_empresa ?? "",
    empresa_razao_social: empresa?.razao_social ?? "",
    cnpj: empresa?.cnpj ? formatCNPJ(empresa.cnpj) : "",
    cpf: empresa?.cpf ? formatCPF(empresa.cpf) : "",
    cei: empresa?.cei ? formatCEI(empresa.cei) : "",
    caepf: empresa?.caepf ? formatCAEPF(empresa.caepf) : "",
    cno: empresa?.cno ? formatCNO(empresa.cno) : "",
    data_atual: new Date().toLocaleDateString("pt-BR"),
  };
}
