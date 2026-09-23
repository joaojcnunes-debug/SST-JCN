// QPS — a etapa REAL de uma aplicação.
//
// Saiu de dentro de `useQpsResumo` em 2026-09-10, sem mudar uma linha da
// regra, por um motivo concreto: o hook fala com o Supabase do navegador e
// não é testável, e esta conta passou a ter uma armadilha que precisa de
// trava (veja `ENVIADO_CLIENTE` abaixo).
//
// A etapa é DEDUZIDA do que já existe na aplicação — respondente importado,
// ação de plano — e não do status que alguém escolheu à mão. As duas leituras
// convivem de propósito na tela de Resumo: o quadro de status mostra o que
// foi declarado, e esta mostra onde o trabalho está de verdade.

import type { StatusQpsAplicacao } from "@/lib/supabase/types";

export type EtapaQps = "COLETA" | "ANALISE" | "PLANO" | "CONCLUIDO";

export interface DadosDaEtapa {
  status: StatusQpsAplicacao;
  /** Quantos respondentes já foram importados. */
  nRespondentes: number;
  /** Quantas ações existem no plano de ação da aplicação. */
  nPlanos: number;
}

/**
 * ⚠️ `ENVIADO_CLIENTE` é fim de fila, igual a `CONCLUIDO`.
 *
 * Sem esta linha, uma aplicação entregue ao cliente voltaria a ser classificada
 * pela dedução — e uma entrega feita sem importar respondente no painel
 * apareceria como "Coleta", parada há N dias, dentro do alerta de aplicações
 * abandonadas. Ou seja: quem terminou o trabalho apareceria como quem não
 * começou.
 */
export function etapaDaAplicacao({
  status,
  nRespondentes,
  nPlanos,
}: DadosDaEtapa): EtapaQps {
  if (status === "CONCLUIDO" || status === "ENVIADO_CLIENTE") return "CONCLUIDO";
  if (nRespondentes === 0) return "COLETA";
  if (nPlanos > 0) return "PLANO";
  return "ANALISE";
}

/** Status que significam "não há mais nada a fazer nesta aplicação". */
export function statusEncerrado(status: StatusQpsAplicacao): boolean {
  return status === "CONCLUIDO" || status === "ENVIADO_CLIENTE";
}
