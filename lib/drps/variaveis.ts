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
  { chave: "empresa_nome", rotulo: "Nome da empresa", exemplo: "JCN Consultoria Saúde e Segurança" },
  { chave: "empresa_razao_social", rotulo: "Razão social", exemplo: "JCN Consultoria Ltda" },
  { chave: "cnpj", rotulo: "CNPJ", exemplo: "31.427.455/0001-11" },
  { chave: "cpf", rotulo: "CPF", exemplo: "000.000.000-00" },
  { chave: "cei", rotulo: "CEI", exemplo: "00.000.00000/00" },
  { chave: "caepf", rotulo: "CAEPF", exemplo: "000.000.000/000-00" },
  { chave: "cno", rotulo: "CNO", exemplo: "00.000.00000/00" },
  { chave: "empresa_endereco", rotulo: "Endereço completo", exemplo: "Av. Paulista, 37, Bela Vista, São Paulo - SP, CEP 01311-902" },
  { chave: "empresa_municipio", rotulo: "Município", exemplo: "São Paulo" },
  { chave: "empresa_uf", rotulo: "UF", exemplo: "SP" },
  { chave: "empresa_telefone", rotulo: "Telefone", exemplo: "(11) 2385-1939" },
  { chave: "empresa_email", rotulo: "E-mail", exemplo: "contato@empresa.com.br" },
  { chave: "empresa_cnae", rotulo: "CNAE / atividade principal", exemplo: "94.30-8-00 - Atividades de associações" },
  { chave: "data_elaboracao", rotulo: "Data de elaboração", exemplo: "13/05/2026" },
  { chave: "data_conclusao", rotulo: "Data da conclusão (quando virou CONCLUÍDO)", exemplo: "19/05/2026" },
  { chave: "data_envio_cliente", rotulo: "Data de envio ao cliente (quando virou ENVIADO)", exemplo: "21/05/2026" },
  { chave: "data_atual", rotulo: "Data atual (geração do PDF)", exemplo: "13/05/2026" },
  { chave: "revisao", rotulo: "Número da revisão", exemplo: "1" },
  { chave: "responsavel_tecnico", rotulo: "Responsável técnico (Psicólogo)", exemplo: "Sanmyou" },
  { chave: "crp", rotulo: "CRP", exemplo: "11515" },
  { chave: "carimbo", rotulo: "Carimbo do profissional (nome + título + registro)", exemplo: "João Jefferson\nErgonomista\nCREA 12345-SP" },
  { chave: "importado", rotulo: "Data de importação (dd/mm/aaaa)", exemplo: "15/05/2026" },
  { chave: "data_carimbo_inicio", rotulo: "Período de coleta — data inicial (dd/mm/aaaa)", exemplo: "05/11/2026" },
  { chave: "data_carimbo_fim", rotulo: "Período de coleta — data final (dd/mm/aaaa)", exemplo: "13/05/2026" },
  // Variáveis de documento comuns (Fase 1 expansão SGG, v0.3.172).
  { chave: "grau_risco", rotulo: "Grau de risco (CNAE da empresa)", exemplo: "3" },
  { chave: "ghe", rotulo: "GHE — Grupo Homogêneo de Exposição", exemplo: "GHE-01 Produção" },
  { chave: "funcao", rotulo: "Função / cargo", exemplo: "Operador de Prensa" },
  { chave: "registro_profissional", rotulo: "Registro profissional do responsável", exemplo: "CRP 06/12345" },
  { chave: "usuario_logado", rotulo: "Usuário logado (quem gerou o PDF)", exemplo: "João Jefferson" },
  { chave: "tipo_relatorio", rotulo: "Tipo de relatório", exemplo: "DRPS — Diagnóstico de Riscos Psicossociais" },
  // E1 (Módulo Documentos SST): variáveis de documento adicionais.
  { chave: "unidade", rotulo: "Unidade / filial", exemplo: "Unidade Centro" },
  { chave: "cargo", rotulo: "Cargo", exemplo: "Operador de Máquinas" },
  { chave: "formacao_responsavel", rotulo: "Formação do responsável técnico", exemplo: "Psicólogo(a)" },
  { chave: "data_emissao", rotulo: "Data de emissão do documento", exemplo: "15/05/2026" },
  { chave: "data_inicio_vigencia", rotulo: "Início da vigência", exemplo: "15/05/2026" },
  { chave: "data_fim_vigencia", rotulo: "Fim da vigência", exemplo: "15/05/2027" },
  { chave: "numero_revisao", rotulo: "Número da revisão", exemplo: "1" },
];

/** Campos de documento preenchidos pela rota (contexto do request). */
export interface ValoresDocExtras {
  ghe?: string;
  funcao?: string;
  registro_profissional?: string;
  usuario_logado?: string;
  tipo_relatorio?: string;
  unidade?: string;
  cargo?: string;
  formacao_responsavel?: string;
  data_emissao?: string;
  data_inicio_vigencia?: string;
  data_fim_vigencia?: string;
  numero_revisao?: string;
}

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
  relatorio: DrpsRelatorio | null | undefined,
  extras?: ValoresDocExtras
): Record<string, string> {
  return {
    empresa_nome: empresa?.nome_empresa ?? "",
    empresa_razao_social: empresa?.razao_social ?? "",
    cnpj: empresa?.cnpj ? formatCNPJ(empresa.cnpj) : "",
    cpf: empresa?.cpf ? formatCPF(empresa.cpf) : "",
    cei: empresa?.cei ? formatCEI(empresa.cei) : "",
    caepf: empresa?.caepf ? formatCAEPF(empresa.caepf) : "",
    cno: empresa?.cno ? formatCNO(empresa.cno) : "",
    empresa_endereco: [
      [empresa?.logradouro, empresa?.numero].filter(Boolean).join(", "),
      empresa?.complemento,
      empresa?.bairro,
      [empresa?.municipio, empresa?.uf].filter(Boolean).join(" - "),
      empresa?.cep ? `CEP ${empresa.cep}` : "",
    ]
      .filter(Boolean)
      .join(", "),
    empresa_municipio: empresa?.municipio ?? "",
    empresa_uf: empresa?.uf ?? "",
    empresa_telefone: empresa?.telefone ?? "",
    empresa_email: empresa?.email ?? "",
    empresa_cnae: [empresa?.cnae_principal, empresa?.cnae_descricao]
      .filter(Boolean)
      .join(" - "),
    data_elaboracao: formatarDataBR(relatorio?.data_elaboracao),
    data_conclusao: formatarDataBR(relatorio?.data_conclusao),
    data_envio_cliente: formatarDataBR(relatorio?.data_envio_cliente),
    data_atual: new Date().toLocaleDateString("pt-BR"),
    revisao: relatorio?.revisao != null ? String(relatorio.revisao) : "",
    responsavel_tecnico: relatorio?.responsavel_tecnico ?? "",
    crp: relatorio?.crp ?? "",
    carimbo: [relatorio?.responsavel_tecnico, relatorio?.crp ? `CRP ${relatorio.crp}` : ""]
      .filter(Boolean)
      .join("\n"),
    empresa_bairro: empresa?.bairro ?? "",
    empresa_atividade: empresa?.cnae_descricao ?? "",
    empresa_porte: empresa?.porte ?? "",
    unidade: extras?.unidade ?? "",
    cargo: extras?.cargo ?? "",
    formacao_responsavel: extras?.formacao_responsavel ?? "",
    data_emissao: extras?.data_emissao ?? "",
    data_inicio_vigencia: extras?.data_inicio_vigencia ?? "",
    data_fim_vigencia: extras?.data_fim_vigencia ?? "",
    numero_revisao: extras?.numero_revisao ?? (relatorio?.revisao != null ? String(relatorio.revisao) : ""),
    importado: formatarDataBR(relatorio?.created_at),
    // Variáveis de documento (Fase 1): grau_risco vem da empresa; o resto da rota.
    grau_risco: empresa?.grau_risco != null ? String(empresa.grau_risco) : "",
    ghe: extras?.ghe ?? "",
    funcao: extras?.funcao ?? "",
    registro_profissional:
      extras?.registro_profissional ?? (relatorio?.crp ? `CRP ${relatorio.crp}` : ""),
    usuario_logado: extras?.usuario_logado ?? "",
    tipo_relatorio: extras?.tipo_relatorio ?? "",
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
