import type { VariavelDef } from "./variaveis";
import { formatarDataBR } from "./formatters";
import type { AepRelatorio } from "@/lib/supabase/types";

export const VARIAVEIS_AEP: VariavelDef[] = [
  { chave: "empresa_nome",         rotulo: "Nome da empresa",                       exemplo: "Metalúrgica Exemplo Ltda" },
  { chave: "cnpj",                 rotulo: "CNPJ da empresa",                       exemplo: "31.427.455/0001-11" },
  { chave: "endereco_empresa",     rotulo: "Endereço da empresa",                   exemplo: "Rua das Indústrias, 100" },
  { chave: "responsavel_tecnico",  rotulo: "Responsável pela elaboração",           exemplo: "João Jefferson" },
  { chave: "titulo_profissional",  rotulo: "Título profissional",                   exemplo: "Ergonomista" },
  { chave: "registro_profissional",rotulo: "Registro profissional",                 exemplo: "CREA 12345-SP" },
  { chave: "carimbo",              rotulo: "Carimbo (nome + título + registro)",    exemplo: "João Jefferson\nErgonomista\nCREA 12345-SP" },
  { chave: "data_elaboracao",      rotulo: "Data de elaboração",                    exemplo: "15/05/2026" },
  { chave: "data_atual",           rotulo: "Data atual (geração do PDF)",           exemplo: "15/05/2026" },
];

export function montarValoresAep(
  rel: Pick<
    AepRelatorio,
    | "responsavel_elaboracao"
    | "titulo_profissional"
    | "registro_profissional"
    | "data_elaboracao"
    | "endereco_empresa"
  > & { empresas?: { nome_empresa: string; cnpj: string | null } | null }
): Record<string, string> {
  const nome     = rel.responsavel_elaboracao  ?? "";
  const titulo   = rel.titulo_profissional     ?? "";
  const registro = rel.registro_profissional   ?? "";
  const carimbo  = [nome, titulo, registro].filter(Boolean).join("\n");

  return {
    empresa_nome:          rel.empresas?.nome_empresa ?? "",
    cnpj:                  rel.empresas?.cnpj         ?? "",
    endereco_empresa:      rel.endereco_empresa        ?? "",
    responsavel_tecnico:   nome,
    titulo_profissional:   titulo,
    registro_profissional: registro,
    carimbo,
    data_elaboracao: formatarDataBR(rel.data_elaboracao),
    data_atual:      new Date().toLocaleDateString("pt-BR"),
    // Variáveis de documento (Fase 1): sempre resolvem (default ""), não vazam token.
    grau_risco:      "",
    ghe:             "",
    funcao:          "",
    usuario_logado:  "",
    tipo_relatorio:  "AEP — Análise Ergonômica Preliminar",
    // E1 (Módulo Documentos SST): sempre resolvem (default "").
    unidade:               "",
    cargo:                 "",
    formacao_responsavel:  "",
    data_emissao:          "",
    data_inicio_vigencia:  "",
    data_fim_vigencia:     "",
    numero_revisao:        "",
  };
}
