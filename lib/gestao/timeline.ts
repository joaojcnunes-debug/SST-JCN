// Linha do tempo unificada da tarefa (G1.2): mescla comentários (gestao_comentarios) e
// movimentações (gestao_tarefa_historico) numa lista ordenada por created_at.
//
// Módulo PURO e testável — SEM React, SEM supabase, SEM I/O. O hook useTarefaHistorico e a
// sidebar do TarefaModal consomem daqui; o teste offline exercita mergeTimeline diretamente.

export interface ComentarioRow {
  id_comentario: string;
  id_tarefa: string;
  autor: string | null;
  texto: string;
  created_at: string;
}

export interface HistoricoRow {
  id: number | string;
  id_tarefa: string;
  ator: string | null;
  tipo: string; // status | prioridade | prazo | data_inicio | titulo | criada
  campo: string | null;
  de: string | null;
  para: string | null;
  created_at: string;
}

export type TimelineItem =
  | {
      key: string;
      kind: "comentario";
      ator: string | null;
      created_at: string;
      texto: string;
    }
  | {
      key: string;
      kind: "movimentacao";
      ator: string | null;
      created_at: string;
      tipo: string;
      de: string | null;
      para: string | null;
    };

/**
 * Mescla comentários + movimentações numa única linha do tempo ordenada por `created_at`.
 * Ordem padrão ascendente (cronológica: mais antigo primeiro). Desempate determinístico por
 * (kind, key) para render estável quando dois itens têm o mesmo timestamp.
 */
export function mergeTimeline(
  comentarios: ComentarioRow[],
  historico: HistoricoRow[],
  ordem: "asc" | "desc" = "asc",
): TimelineItem[] {
  const itens: TimelineItem[] = [];

  for (const c of comentarios) {
    itens.push({
      key: `cmt:${c.id_comentario}`,
      kind: "comentario",
      ator: c.autor,
      created_at: c.created_at,
      texto: c.texto,
    });
  }

  for (const h of historico) {
    itens.push({
      key: `hist:${h.id}`,
      kind: "movimentacao",
      ator: h.ator,
      created_at: h.created_at,
      tipo: h.tipo,
      de: h.de,
      para: h.para,
    });
  }

  const dir = ordem === "asc" ? 1 : -1;
  itens.sort((a, b) => {
    const ta = Date.parse(a.created_at);
    const tb = Date.parse(b.created_at);
    if (ta !== tb) return (ta - tb) * dir;
    // desempate estável (independente da direção): comentario antes de movimentacao, depois key
    if (a.kind !== b.kind) return a.kind === "comentario" ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  return itens;
}

/**
 * Texto da movimentação (PURO). `nomeStatus` opcional traduz o slug de status para o rótulo
 * amigável do quadro; sem ele, mostra o valor cru. Render final é TEXTO (React-escaped) — R1.
 */
export function descreverMovimentacao(
  item: Extract<TimelineItem, { kind: "movimentacao" }>,
  nomeStatus?: (slug: string | null) => string,
): string {
  const nome = (v: string | null) => (nomeStatus ? nomeStatus(v) : v ?? "—") || "—";
  const de = item.de ?? "—";
  const para = item.para ?? "—";
  switch (item.tipo) {
    case "criada":
      return "criou a tarefa";
    case "status":
      return `moveu de ${nome(item.de)} para ${nome(item.para)}`;
    case "prioridade":
      return `prioridade: ${de} → ${para}`;
    case "prazo":
      return `prazo: ${de} → ${para}`;
    case "data_inicio":
      return `início: ${de} → ${para}`;
    case "titulo":
      return `renomeou: "${de}" → "${para}"`;
    default:
      return `${item.tipo}: ${de} → ${para}`;
  }
}
