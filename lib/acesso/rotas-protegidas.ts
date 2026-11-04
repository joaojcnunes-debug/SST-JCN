/**
 * Telas de configuração que só o menu escondia (achado na auditoria das
 * Configurações, 04/11): quem não supervisiona não via o link, mas abria a
 * tela digitando o endereço. As listas abaixo são as mesmas do menu de cada
 * layout; a trava (components/layout/TravaRota.tsx) usa estas listas.
 *
 * Módulo puro, sem React, para o teste (rotas-protegidas.test.ts).
 */

export const ROTAS_CONFIG_AET = [
  "/aet/texto-padrao",
  "/aet/owas-config",
  "/aet/perfis-owas",
  "/aet/13fatores-config",
] as const;

export const ROTAS_CONFIG_AEP = ["/aep/texto-padrao"] as const;

export const ROTAS_CONFIG_QUIMICOS = ["/analise-quimicos/base"] as const;

export const ROTAS_CONFIG_QPS = [
  "/questionarios-psicossociais/tipos",
  "/questionarios-psicossociais/como-funciona",
  "/questionarios-psicossociais/texto-padrao",
] as const;

/** A rota é uma das listadas ou fica abaixo dela (`/aet/texto-padrao/x`). */
export function rotaNaLista(pathname: string, rotas: readonly string[]): boolean {
  return rotas.some((r) => pathname === r || pathname.startsWith(r + "/"));
}
