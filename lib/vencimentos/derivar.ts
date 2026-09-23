import type { LaudoValidadeItem } from "@/lib/hooks/useLaudosValidade";

/**
 * VENCIMENTOS DERIVADOS DA LISTA DE LAUDOS — e não buscados de novo.
 *
 * POR QUE ISTO EXISTE. O `useVencimentos` varria as MESMAS 9 tabelas que o
 * `useLaudosValidade` já varre, com o mesmo filtro de status e a mesma leitura
 * de `empresas` — só que acrescentando `data_validade is not null`, que é um
 * SUBCONJUNTO do que o outro já trouxe. Na tela de entrada, onde os dois
 * rodam juntos, isso custava 10 das 45 requisições da página (medidas em
 * 01/09), sem trazer um dado sequer que o outro não tivesse.
 *
 * Agora os dois hooks observam a MESMA entrada de cache e este módulo é o
 * `select` de um deles. Mora fora do hook de propósito: sem React em volta, é
 * função pura e tem teste.
 *
 * 🪤 O QUE NÃO DÁ PARA SIMPLIFICAR. Os dois hooks discordavam de propósito em
 * três pontos, e mudar isso mexeria no que a pessoa vê:
 *   • AET e AEP: a lista de Validades leva para `/aet/<id>/dados`, o cartão de
 *     vencimentos leva para `/aet/<id>`;
 *   • a Apreciação se chama "Apreciação NR-12" no cartão e "Apreciação" na
 *     lista.
 * As duas grafias e os dois destinos seguem exatamente como estavam.
 */

/** Quantos dias à frente ainda contam como "vencendo". */
export const HORIZONTE_DIAS = 60;

export interface VencimentoItem {
  tipo: string;
  empresaNome: string | null;
  data_validade: string;
  href: string;
  /** dias até vencer (negativo = já vencido). */
  dias: number;
}

export interface VencimentosData {
  vencidos: VencimentoItem[];
  vencendo: VencimentoItem[];
}

/** Onde o cartão de vencimentos diverge da lista de Validades. Ver comentário. */
const ROTULO_PROPRIO: Record<string, string> = {
  apreciacoes_maquinas: "Apreciação NR-12",
};
const DESTINO_PROPRIO: Record<string, (id: string) => string> = {
  aet_relatorios: (id) => `/aet/${id}`,
  aep_relatorios: (id) => `/aep/${id}`,
};

export function diasAte(dataIso: string, hoje = new Date()): number {
  const base = new Date(hoje);
  base.setHours(0, 0, 0, 0);
  const d = new Date(dataIso + "T00:00:00");
  return Math.round((d.getTime() - base.getTime()) / 86_400_000);
}

export function derivarVencimentos(
  laudos: LaudoValidadeItem[],
  hoje = new Date(),
): VencimentosData {
  const todos: VencimentoItem[] = [];
  for (const l of laudos) {
    if (!l.data_validade) continue;
    todos.push({
      tipo: ROTULO_PROPRIO[l.tabela] ?? l.tipo,
      empresaNome: l.empresaNome,
      data_validade: l.data_validade,
      href: DESTINO_PROPRIO[l.tabela]?.(l.id) ?? l.href,
      dias: diasAte(l.data_validade, hoje),
    });
  }

  return {
    // mais recentes vencidos primeiro (-1 antes de -90)
    vencidos: todos.filter((v) => v.dias < 0).sort((a, b) => b.dias - a.dias),
    // os que vencem antes primeiro
    vencendo: todos
      .filter((v) => v.dias >= 0 && v.dias <= HORIZONTE_DIAS)
      .sort((a, b) => a.dias - b.dias),
  };
}
