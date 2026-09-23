/**
 * De onde sai a lista de documentos com validade (tela "Validades de
 * Documentos", "Saúde dos documentos", "Laudos por tipo" e "Vencidos / A
 * vencer" da Visão geral) — e QUAL MÓDULO abre cada uma.
 *
 * Separado do hook para poder ser exercido sem navegador: a regra "só as
 * tabelas dos módulos da conta" é a mesma do hub de Módulos
 * (`modulos_permitidos`) e a mesma do mapa da trava no banco
 * (`rls_modulo_tabelas`, v236) — ver o teste ao lado, que compara as duas.
 */

import type { ModuloPermitido } from "@/lib/supabase/types";

export type TipoLaudo =
  | "Inspeção" | "Conformidade" | "Não Conformidade" | "AET" | "AEP" | "DRPS"
  | "Análise de Químicos" | "Apreciação" | "Investigação";

export interface Fonte {
  tabela: string;
  idCol: string;
  dataCol: string;
  tipo: TipoLaudo;
  /**
   * O módulo que abre este documento. É a MESMA chave de `modulos_permitidos`
   * e a mesma do mapa da trava no banco — conferido tabela a tabela contra
   * `rls_modulo_tabelas` em 22/09 (o teste refaz essa conferência).
   */
  modulo: ModuloPermitido;
  href: (id: string) => string;
  /** Exclui registros com esse status (soft-delete). */
  excluirStatus?: string;
}

export const FONTES: Fonte[] = [
  { tabela: "inspecoes", idCol: "id_inspecao", dataCol: "data_inspecao", tipo: "Inspeção", modulo: "painel", href: (id) => `/inspecoes/${id}`, excluirStatus: "DELETADA" },
  { tabela: "relatorios_conformidade", idCol: "id_relatorio", dataCol: "data_inspecao", tipo: "Conformidade", modulo: "conformidade", href: (id) => `/relatorio-conformidade/${id}` },
  { tabela: "relatorios_nao_conformidade", idCol: "id_relatorio", dataCol: "data_inspecao", tipo: "Não Conformidade", modulo: "nao_conformidade", href: (id) => `/relatorio-nao-conformidade/${id}` },
  { tabela: "aet_relatorios", idCol: "id_relatorio", dataCol: "data_elaboracao", tipo: "AET", modulo: "aet", href: (id) => `/aet/${id}/dados` },
  { tabela: "aep_relatorios", idCol: "id_relatorio", dataCol: "data_elaboracao", tipo: "AEP", modulo: "aep", href: (id) => `/aep/${id}/dados` },
  { tabela: "drps_relatorios", idCol: "id_relatorio", dataCol: "data_elaboracao", tipo: "DRPS", modulo: "psicossocial", href: (id) => `/psicossocial/${id}/metadados`, excluirStatus: "DELETADO" },
  { tabela: "analises_quimicos", idCol: "id_analise", dataCol: "created_at", tipo: "Análise de Químicos", modulo: "analise_quimicos", href: (id) => `/analise-quimicos/${id}` },
  { tabela: "apreciacoes_maquinas", idCol: "id_apreciacao", dataCol: "data_apreciacao", tipo: "Apreciação", modulo: "apreciacao_maquinas", href: (id) => `/apreciacao-maquinas/${id}` },
  { tabela: "investigacoes_acidente", idCol: "id_investigacao", dataCol: "data_acidente", tipo: "Investigação", modulo: "investigacao_acidente", href: (id) => `/investigacao-acidente/${id}`, excluirStatus: "DELETADA" },
];

/**
 * As fontes que esta conta pode abrir.
 *
 * `null` quer dizer "o perfil ainda não chegou" — e aí não se varre nada, em
 * vez de varrer tudo: sem a lista de módulos não dá para decidir. Quem chama
 * trata esse intervalo como CARREGANDO, não como "não há documento".
 */
export function fontesPermitidas(modulos: readonly string[] | null | undefined): Fonte[] {
  if (!modulos) return [];
  return FONTES.filter((f) => modulos.includes(f.modulo));
}

/** Os tipos que a conta enxerga — alimenta o filtro "Tipo" da tela. */
export function tiposPermitidos(modulos: readonly string[] | null | undefined): TipoLaudo[] {
  return fontesPermitidas(modulos).map((f) => f.tipo);
}
