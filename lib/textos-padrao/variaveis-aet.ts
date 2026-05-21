// Variáveis dinâmicas para os capítulos de Texto Padrão do módulo AET.
// Substituição via {{chave}} — mesma convenção do sistema unificado.
// Integração: montarValoresAet() no laudo/page.tsx antes de renderizar cada capítulo.

import type { VariavelDef } from "./variaveis";
import { formatarDataBR } from "./variaveis";
import type { AetRelatorio } from "@/lib/supabase/types";

export const VARIAVEIS_AET: VariavelDef[] = [
  { chave: "empresa_nome", rotulo: "Nome da empresa", exemplo: "Metalúrgica Exemplo Ltda" },
  { chave: "cnpj", rotulo: "CNPJ da empresa", exemplo: "31.427.455/0001-11" },
  { chave: "endereco_empresa", rotulo: "Endereço da empresa", exemplo: "Rua das Indústrias, 100" },
  { chave: "responsavel_tecnico", rotulo: "Responsável pela elaboração", exemplo: "João Jefferson" },
  { chave: "titulo_profissional", rotulo: "Título profissional", exemplo: "Ergonomista" },
  { chave: "registro_profissional", rotulo: "Registro profissional", exemplo: "CREA 12345-SP" },
  { chave: "carimbo", rotulo: "Carimbo (nome + título + registro — multilinha)", exemplo: "João Jefferson\nErgonomista\nCREA 12345-SP" },
  { chave: "data_elaboracao", rotulo: "Data de elaboração", exemplo: "15/05/2026" },
  { chave: "data_atual", rotulo: "Data atual (geração do PDF)", exemplo: "15/05/2026" },
];

/**
 * Monta o mapa chave → valor para substituição de variáveis nos capítulos AET.
 * Chama `substituirVariaveis(conteudo, montarValoresAet(rel))` antes de renderizar.
 */
export function montarValoresAet(
  rel: Pick<
    AetRelatorio,
    | "responsavel_elaboracao"
    | "titulo_profissional"
    | "registro_profissional"
    | "data_elaboracao"
    | "endereco_empresa"
  > & {
    empresas?: { nome_empresa: string; cnpj: string | null } | null;
  },
  /** Sobrescreve campos que vieram de state local (formulário de dados do laudo). */
  overrides?: Partial<{
    responsavel_elaboracao: string;
    titulo_profissional: string;
    registro_profissional: string;
    data_elaboracao: string;
    endereco_empresa: string;
  }>
): Record<string, string> {
  const nome = overrides?.responsavel_elaboracao ?? rel.responsavel_elaboracao ?? "";
  const titulo = overrides?.titulo_profissional ?? rel.titulo_profissional ?? "";
  const registro = overrides?.registro_profissional ?? rel.registro_profissional ?? "";
  const dataElab = overrides?.data_elaboracao ?? rel.data_elaboracao ?? "";
  const endereco = overrides?.endereco_empresa ?? rel.endereco_empresa ?? "";
  const carimbo = [nome, titulo, registro].filter(Boolean).join("\n");

  return {
    empresa_nome: rel.empresas?.nome_empresa ?? "",
    cnpj: rel.empresas?.cnpj ?? "",
    endereco_empresa: endereco,
    responsavel_tecnico: nome,
    titulo_profissional: titulo,
    registro_profissional: registro,
    carimbo,
    data_elaboracao: formatarDataBR(dataElab),
    data_atual: new Date().toLocaleDateString("pt-BR"),
  };
}
