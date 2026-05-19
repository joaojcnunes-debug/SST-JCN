// Variaveis substituidas nos capitulos de Texto Padrao na hora de gerar o PDF.
// Sintaxe: {{nome_variavel}}

import {
  formatCNPJ,
  formatCPF,
  formatCEI,
  formatCAEPF,
  formatCNO,
} from "@/lib/utils";
import type { Empresa } from "@/lib/supabase/types";
import type { DrpsRelatorio } from "@/lib/drps/types";

export interface VariavelDef {
  chave: string;
  rotulo: string;
  exemplo: string;
}

/** Lista de variaveis disponiveis (mostrada no menu do editor). */
export const VARIAVEIS: VariavelDef[] = [
  { chave: "empresa_nome", rotulo: "Nome da empresa", exemplo: "Chabra Saúde e Segurança" },
  { chave: "empresa_razao_social", rotulo: "Razão social", exemplo: "Chabra Ltda" },
  { chave: "cnpj", rotulo: "CNPJ", exemplo: "31.427.455/0001-11" },
  { chave: "cpf", rotulo: "CPF", exemplo: "000.000.000-00" },
  { chave: "cei", rotulo: "CEI", exemplo: "00.000.00000/00" },
  { chave: "caepf", rotulo: "CAEPF", exemplo: "000.000.000/000-00" },
  { chave: "cno", rotulo: "CNO", exemplo: "00.000.00000/00" },
  { chave: "data_elaboracao", rotulo: "Data de elaboração", exemplo: "13/05/2026" },
  { chave: "data_conclusao", rotulo: "Data da conclusão (quando virou CONCLUÍDO)", exemplo: "19/05/2026" },
  { chave: "data_atual", rotulo: "Data atual (geração do PDF)", exemplo: "13/05/2026" },
  { chave: "revisao", rotulo: "Número da revisão", exemplo: "1" },
  { chave: "responsavel_tecnico", rotulo: "Responsável técnico (Psicólogo)", exemplo: "Sanmyou" },
  { chave: "crp", rotulo: "CRP", exemplo: "11515" },
];

function formatarDataBR(iso: string | null | undefined): string {
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
 * Devolve o valor textual de cada variavel a partir de empresa + relatorio.
 * Retorna string vazia para campos nao preenchidos (em vez do token literal).
 */
export function montarValoresVariaveis(
  empresa: Empresa | null | undefined,
  relatorio: DrpsRelatorio | null | undefined
): Record<string, string> {
  return {
    empresa_nome: empresa?.nome_empresa ?? "",
    empresa_razao_social: empresa?.razao_social ?? "",
    cnpj: empresa?.cnpj ? formatCNPJ(empresa.cnpj) : "",
    cpf: empresa?.cpf ? formatCPF(empresa.cpf) : "",
    cei: empresa?.cei ? formatCEI(empresa.cei) : "",
    caepf: empresa?.caepf ? formatCAEPF(empresa.caepf) : "",
    cno: empresa?.cno ? formatCNO(empresa.cno) : "",
    data_elaboracao: formatarDataBR(relatorio?.data_elaboracao),
    data_conclusao: formatarDataBR(relatorio?.data_conclusao),
    data_atual: new Date().toLocaleDateString("pt-BR"),
    revisao: relatorio?.revisao != null ? String(relatorio.revisao) : "",
    responsavel_tecnico: relatorio?.responsavel_tecnico ?? "",
    crp: relatorio?.crp ?? "",
  };
}

/**
 * Substitui {{chave}} por valores.chave numa string HTML. Os valores sao
 * escapados (para evitar quebrar o markup). Chaves desconhecidas
 * sao deixadas como estavam (facilita debug visual).
 */
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

/**
 * Substitui {{chave}} por valores.chave em texto puro (sem escape HTML).
 * Use em campos que vao para JSX como string normal (ex.: titulos).
 */
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
