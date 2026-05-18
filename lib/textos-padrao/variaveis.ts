// Variáveis dinâmicas substituídas nos capítulos de Texto Padrão na hora de
// gerar o PDF. Sintaxe: {{nome_variavel}}.
//
// Cada módulo (SST, Conformidade, Análise Químicos) tem seu próprio conjunto
// de variáveis disponíveis. A interseção (campos da empresa) está em comum.

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
  analise_quimicos: [
    ...VARIAVEIS_EMPRESA,
    ...VARIAVEIS_DATA_RESPONSAVEL,
    { chave: "titulo", rotulo: "Título da análise", exemplo: "MC-2BK106 MAKE-UP" },
    { chave: "nome_quimico", rotulo: "Nome químico", exemplo: "2-Butanone; Ethanol" },
    { chave: "numero_cas", rotulo: "Número CAS", exemplo: "78-93-3" },
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
