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
import { VARIAVEIS_AEP } from "./variaveis-aep";
import { VARIAVEIS_AET } from "./variaveis-aet";
export { formatarDataBR } from "./formatters";

export interface VariavelDef {
  chave: string;
  rotulo: string;
  exemplo: string;
}

const VARIAVEIS_EMPRESA: VariavelDef[] = [
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
  { chave: "empresa_cep", rotulo: "CEP", exemplo: "01311-902" },
  { chave: "empresa_telefone", rotulo: "Telefone", exemplo: "(11) 2385-1939" },
  { chave: "empresa_email", rotulo: "E-mail", exemplo: "contato@empresa.com.br" },
  { chave: "empresa_cnae", rotulo: "CNAE / atividade principal", exemplo: "94.30-8-00 - Atividades de associações" },
  { chave: "empresa_bairro", rotulo: "Bairro", exemplo: "Bela Vista" },
  { chave: "empresa_atividade", rotulo: "Atividade principal (descrição do CNAE)", exemplo: "Atividades de associações de defesa de direitos sociais" },
  { chave: "empresa_porte", rotulo: "Porte da empresa", exemplo: "DEMAIS" },
];

/** Monta o endereço completo da empresa em uma linha (campos estruturados). */
export function montarEnderecoEmpresa(empresa: Empresa | null | undefined): string {
  if (!empresa) return "";
  const cep = empresa.cep?.trim();
  return [
    [empresa.logradouro, empresa.numero].filter(Boolean).join(", "),
    empresa.complemento,
    empresa.bairro,
    [empresa.municipio, empresa.uf].filter(Boolean).join(" - "),
    cep && `CEP ${cep}`,
  ]
    .filter(Boolean)
    .join(", ");
}

const VARIAVEIS_DATA_RESPONSAVEL: VariavelDef[] = [
  { chave: "data_atual", rotulo: "Data atual (geração do PDF)", exemplo: "15/05/2026" },
  { chave: "responsavel", rotulo: "Responsável técnico", exemplo: "João Jefferson" },
  { chave: "cidade", rotulo: "Cidade", exemplo: "Catanduva - SP" },
  { chave: "carimbo", rotulo: "Carimbo do profissional (nome + título + registro)", exemplo: "João Jefferson\nEngenheiro de Segurança\nCREA 12345-SP" },
  { chave: "importado", rotulo: "Data de importação (dd/mm/aaaa)", exemplo: "15/05/2026" },
];

// Variáveis de documento comuns a todos os módulos (Fase 1 expansão SGG, v0.3.172).
// Sempre resolvidas (default ""), nunca vazam o token literal no PDF.
export const VARIAVEIS_DOC: VariavelDef[] = [
  { chave: "grau_risco", rotulo: "Grau de risco (CNAE da empresa)", exemplo: "3" },
  { chave: "ghe", rotulo: "GHE — Grupo Homogêneo de Exposição", exemplo: "GHE-01 Produção" },
  { chave: "funcao", rotulo: "Função / cargo", exemplo: "Operador de Prensa" },
  { chave: "registro_profissional", rotulo: "Registro profissional do responsável", exemplo: "CREA 12345-SP" },
  { chave: "usuario_logado", rotulo: "Usuário logado (quem gerou o PDF)", exemplo: "João Jefferson" },
  { chave: "tipo_relatorio", rotulo: "Tipo de relatório", exemplo: "Relatório de Conformidade" },
  // E1 (Módulo Documentos SST): variáveis de documento adicionais. Sempre
  // resolvem (default ""); preenchidas pela rota quando houver dado.
  { chave: "unidade", rotulo: "Unidade / filial", exemplo: "Unidade Centro" },
  { chave: "cargo", rotulo: "Cargo", exemplo: "Operador de Máquinas" },
  { chave: "formacao_responsavel", rotulo: "Formação do responsável técnico", exemplo: "Engenheiro de Segurança do Trabalho" },
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

/** Concatena listas de variáveis ignorando chaves já presentes (1ª lista vence). */
function mesclarVariaveis(...listas: VariavelDef[][]): VariavelDef[] {
  const vistas = new Set<string>();
  const out: VariavelDef[] = [];
  for (const lista of listas) {
    for (const v of lista) {
      if (vistas.has(v.chave)) continue;
      vistas.add(v.chave);
      out.push(v);
    }
  }
  return out;
}

export const VARIAVEIS_POR_MODULO: Record<ModuloTextoPadrao, VariavelDef[]> = {
  sst: [
    ...VARIAVEIS_EMPRESA,
    ...VARIAVEIS_DATA_RESPONSAVEL,
    { chave: "data_inspecao", rotulo: "Data da inspeção", exemplo: "15/05/2026" },
    { chave: "revisao", rotulo: "Número da revisão", exemplo: "1" },
    ...VARIAVEIS_DOC,
  ],
  conformidade: [
    ...VARIAVEIS_EMPRESA,
    ...VARIAVEIS_DATA_RESPONSAVEL,
    { chave: "nr_codigo", rotulo: "Código da NR", exemplo: "NR-24" },
    { chave: "nr_titulo", rotulo: "Título da NR", exemplo: "Condições Sanitárias..." },
    { chave: "setor", rotulo: "Setor auditado", exemplo: "Produção" },
    { chave: "responsavel_empresa", rotulo: "Responsável da empresa", exemplo: "Maria Silva" },
    { chave: "data_inspecao", rotulo: "Data da auditoria", exemplo: "15/05/2026" },
    ...VARIAVEIS_DOC,
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
    ...VARIAVEIS_DOC,
  ],
  analise_quimicos: [
    ...VARIAVEIS_EMPRESA,
    ...VARIAVEIS_DATA_RESPONSAVEL,
    { chave: "titulo", rotulo: "Título da análise", exemplo: "MC-2BK106 MAKE-UP" },
    { chave: "nome_quimico", rotulo: "Nome químico", exemplo: "2-Butanone; Ethanol" },
    { chave: "numero_cas", rotulo: "Número CAS", exemplo: "78-93-3" },
    ...VARIAVEIS_DOC,
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
    ...VARIAVEIS_DOC,
  ],
  aep: mesclarVariaveis(VARIAVEIS_AEP, VARIAVEIS_DOC),
  aet: mesclarVariaveis(VARIAVEIS_AET, VARIAVEIS_DOC),
  psicossocial: [
    { chave: "empresa_nome",        rotulo: "Nome da empresa",                   exemplo: "Metalúrgica Exemplo Ltda" },
    { chave: "cnpj",                rotulo: "CNPJ",                              exemplo: "31.427.455/0001-11" },
    { chave: "responsavel_tecnico", rotulo: "Responsável técnico",               exemplo: "Ana Silva" },
    { chave: "crp",                 rotulo: "Registro profissional (CRP/CRP)",   exemplo: "CRP 06/12345" },
    { chave: "data_elaboracao",     rotulo: "Data de elaboração",                exemplo: "15/05/2026" },
    { chave: "data_atual",          rotulo: "Data atual (geração do PDF)",       exemplo: "15/05/2026" },
    { chave: "data_carimbo_inicio", rotulo: "Início da coleta (QPS)",            exemplo: "01/04/2026" },
    { chave: "data_carimbo_fim",    rotulo: "Fim da coleta (QPS)",               exemplo: "30/04/2026" },
    ...VARIAVEIS_DOC,
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

/**
 * Monta o subconjunto comum de variáveis (dados da empresa + data atual).
 * Cada módulo combina isso com suas variáveis específicas.
 */
export function montarValoresEmpresa(
  empresa: Empresa | null | undefined,
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
    empresa_endereco: montarEnderecoEmpresa(empresa),
    empresa_municipio: empresa?.municipio ?? "",
    empresa_uf: empresa?.uf ?? "",
    empresa_cep: empresa?.cep ?? "",
    empresa_telefone: empresa?.telefone ?? "",
    empresa_email: empresa?.email ?? "",
    empresa_cnae: [empresa?.cnae_principal, empresa?.cnae_descricao]
      .filter(Boolean)
      .join(" - "),
    data_atual: new Date().toLocaleDateString("pt-BR"),
    empresa_bairro: empresa?.bairro ?? "",
    empresa_atividade: empresa?.cnae_descricao ?? "",
    empresa_porte: empresa?.porte ?? "",
    // Variáveis de documento (Fase 1): grau_risco vem da empresa; o resto é
    // preenchido pela rota via extras e sempre resolve (default "").
    grau_risco: empresa?.grau_risco != null ? String(empresa.grau_risco) : "",
    ghe: extras?.ghe ?? "",
    funcao: extras?.funcao ?? "",
    registro_profissional: extras?.registro_profissional ?? "",
    usuario_logado: extras?.usuario_logado ?? "",
    tipo_relatorio: extras?.tipo_relatorio ?? "",
    // E1 (Módulo Documentos SST): sempre resolvem (default "").
    unidade: extras?.unidade ?? "",
    cargo: extras?.cargo ?? "",
    formacao_responsavel: extras?.formacao_responsavel ?? "",
    data_emissao: extras?.data_emissao ?? "",
    data_inicio_vigencia: extras?.data_inicio_vigencia ?? "",
    data_fim_vigencia: extras?.data_fim_vigencia ?? "",
    numero_revisao: extras?.numero_revisao ?? "",
  };
}
