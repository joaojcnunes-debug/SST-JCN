/**
 * Quais tabelas a "Visão geral por unidade" do Início pode contar para a conta.
 *
 * Até 28/09/2026 o `useVisaoGeralUnidades` lia as 8 tabelas para TODO mundo:
 * a v0.3.635/641 filtrou o `useHomeStats`, o `useRegistrosEmpresa` e o
 * `useLaudosValidade`, mas este ficou de fora — e o log da trava (v236) seguiu
 * anotando `/inicio` lendo DRPS, AET, AEP… de 23 contas sem o módulo.
 *
 * A régua é a mesma dos outros (`modulos_permitidos`, sem exceção para Admin —
 * igual ao hub de Módulos), e o módulo de cada tabela vem de `FONTES`, o mapa
 * que o teste de lib/validades confere contra `rls_modulo_tabelas`.
 */
import type { ModuloPermitido } from "@/lib/supabase/types";
import { FONTES } from "@/lib/validades/fontes";

/** Inspeções + as 7 tabelas de laudo que a Visão geral soma. */
export const TABELAS_VISAO_GERAL = [
  "inspecoes",
  "relatorios_conformidade",
  "relatorios_nao_conformidade",
  "aet_relatorios",
  "aep_relatorios",
  "drps_relatorios",
  "analises_quimicos",
  "apreciacoes_maquinas",
] as const;

export type TabelaVisaoGeral = (typeof TABELAS_VISAO_GERAL)[number];

const MODULO_DA_TABELA = new Map<string, ModuloPermitido>(FONTES.map((f) => [f.tabela, f.modulo]));

export function moduloDaTabela(tabela: TabelaVisaoGeral): ModuloPermitido | undefined {
  return MODULO_DA_TABELA.get(tabela);
}

/** Tabela sem módulo conhecido NÃO é lida — melhor faltar número que vazar. */
export function tabelaPermitida(tabela: TabelaVisaoGeral, modulos: readonly string[]): boolean {
  const m = moduloDaTabela(tabela);
  return !!m && modulos.includes(m);
}
