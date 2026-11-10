/**
 * Prazo de atendimento dos chamados (item 8 da comparação, v353): o banco calcula os prazos em horário comercial
 * (gestao_sla_tarefas); aqui só se decide a SITUAÇÃO para a tela. Funções puras — testadas offline.
 *   1ª resposta: cumprida / cumprida com atraso / estourada / no prazo.
 *   Resolução: idem + "perto" (passou de 75% do prazo — o mesmo ponto do aviso).
 */

export interface SlaTarefa {
  id_tarefa: string;
  meta_resposta: number | null;
  meta_resolucao: number | null;
  prazo_resposta: string | null;
  respondido_em: string | null;
  prazo_resolucao: string | null;
  resolvido_em: string | null;
  alerta_resolucao: string | null;
}

export type EstadoSla = "no_prazo" | "perto" | "estourado" | "cumprido" | "cumprido_atrasado";

export interface SituacaoSla {
  estado: EstadoSla;
  prazo: string | null;
  em: string | null;
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);

export function situacaoResposta(s: SlaTarefa, agora = Date.now()): SituacaoSla {
  if (s.respondido_em) {
    return { estado: s.prazo_resposta && ms(s.respondido_em) > ms(s.prazo_resposta) ? "cumprido_atrasado" : "cumprido", prazo: s.prazo_resposta, em: s.respondido_em };
  }
  if (s.prazo_resposta && agora >= ms(s.prazo_resposta)) return { estado: "estourado", prazo: s.prazo_resposta, em: null };
  return { estado: "no_prazo", prazo: s.prazo_resposta, em: null };
}

export function situacaoResolucao(s: SlaTarefa, agora = Date.now()): SituacaoSla {
  if (s.resolvido_em) {
    return { estado: s.prazo_resolucao && ms(s.resolvido_em) > ms(s.prazo_resolucao) ? "cumprido_atrasado" : "cumprido", prazo: s.prazo_resolucao, em: s.resolvido_em };
  }
  if (s.prazo_resolucao && agora >= ms(s.prazo_resolucao)) return { estado: "estourado", prazo: s.prazo_resolucao, em: null };
  if (s.alerta_resolucao && agora >= ms(s.alerta_resolucao)) return { estado: "perto", prazo: s.prazo_resolucao, em: null };
  return { estado: "no_prazo", prazo: s.prazo_resolucao, em: null };
}

/** "hoje 14:00", "amanhã 09:00", "12/11 10:00". */
export function fmtPrazo(iso: string, agora = Date.now()): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dia = (x: Date) => x.toLocaleDateString("sv-SE");
  const hoje = new Date(agora);
  const amanha = new Date(agora + 86_400_000);
  if (dia(d) === dia(hoje)) return `hoje ${hora}`;
  if (dia(d) === dia(amanha)) return `amanhã ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

/** O que mostrar no cartão: a etapa que está valendo (1ª resposta enquanto não houver; depois, a resolução). */
export function resumoSla(s: SlaTarefa, agora = Date.now()): { rotulo: string; estado: EstadoSla } | null {
  const resp = situacaoResposta(s, agora);
  const resol = situacaoResolucao(s, agora);
  if (resol.estado === "cumprido" || resol.estado === "cumprido_atrasado") return null; // resolvida: o cartão não precisa mais
  if (resp.estado === "no_prazo" || resp.estado === "estourado") {
    if (!resp.prazo) return null;
    return { estado: resp.estado, rotulo: resp.estado === "estourado" ? `1ª resposta atrasada (${fmtPrazo(resp.prazo, agora)})` : `1ª resposta até ${fmtPrazo(resp.prazo, agora)}` };
  }
  if (!resol.prazo) return null;
  return { estado: resol.estado, rotulo: resol.estado === "estourado" ? `Resolução atrasada (${fmtPrazo(resol.prazo, agora)})` : `Resolver até ${fmtPrazo(resol.prazo, agora)}` };
}

/** Minutos → "2h", "16h", "1h30". */
export function fmtMeta(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
