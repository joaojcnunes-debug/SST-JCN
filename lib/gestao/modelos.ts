/**
 * Modelos de tarefa (item 13 da comparação, v354 — como os templates do Notion): escolher um modelo na Nova tarefa
 * preenche o que estiver vazio e SOMA listas, sem apagar o que a pessoa já escreveu. Funções puras — testadas offline.
 */
import { somarDias } from "./datas-rapidas";

export interface ModeloAplicavel {
  titulo: string;
  descricao?: string | null;
  checklist?: string[];
  itens?: { texto: string }[];
  prioridade?: string | null;
  etiquetas?: string[];
  prazo_dias?: number | null;
  prazo_uteis?: boolean;
}

export interface EstadoNovaTarefa<P extends string = string> {
  titulo: string;
  descricao: string;
  prioridade: P;
  prazo: string;
  etiquetas: string[];
  checklist: string[];
  subtarefas: { texto: string; feito: boolean; responsavel_email: string | null }[];
}

/** Soma n dias úteis (segunda a sexta; feriado não entra) a uma data 'YYYY-MM-DD'. 0 = a própria data. */
export function somarDiasUteis(iso: string, n: number): string {
  let d = iso;
  let falta = Math.max(0, Math.floor(n));
  while (falta > 0) {
    d = somarDias(d, 1);
    const dia = new Date(`${d}T12:00:00`).getDay();
    if (dia !== 0 && dia !== 6) falta -= 1;
  }
  return d;
}

const mesmo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function aplicarModelo<P extends string>(e: EstadoNovaTarefa<P>, m: ModeloAplicavel, hoje: string): EstadoNovaTarefa<P> {
  const desc = (m.descricao ?? "").trim();
  const descricao = !desc ? e.descricao : !e.descricao.trim() ? desc : e.descricao.includes(desc) ? e.descricao : `${e.descricao.trimEnd()}\n\n${desc}`;
  const checklist = [...e.checklist];
  for (const t of m.checklist ?? []) if (t.trim() && !checklist.some((x) => mesmo(x, t))) checklist.push(t.trim());
  const subtarefas = [...e.subtarefas];
  for (const it of m.itens ?? []) {
    if (it.texto?.trim() && !subtarefas.some((s) => mesmo(s.texto, it.texto))) subtarefas.push({ texto: it.texto.trim(), feito: false, responsavel_email: null });
  }
  const etiquetas = [...e.etiquetas];
  for (const t of m.etiquetas ?? []) if (t.trim() && !etiquetas.some((x) => mesmo(x, t))) etiquetas.push(t.trim());
  const prazo = m.prazo_dias == null ? e.prazo : m.prazo_uteis ? somarDiasUteis(hoje, m.prazo_dias) : somarDias(hoje, m.prazo_dias);
  return {
    titulo: e.titulo.trim() ? e.titulo : m.titulo,
    descricao,
    prioridade: (m.prioridade as P | null | undefined) ?? e.prioridade,
    prazo,
    etiquetas,
    checklist,
    subtarefas,
  };
}

/** "3 itens no checklist · 2 subtarefas · prazo em 5 dias úteis" — o resumo do modelo na lista. */
export function resumoModelo(m: ModeloAplicavel): string {
  const p: string[] = [];
  const nc = (m.checklist ?? []).filter((t) => t.trim()).length;
  const ns = (m.itens ?? []).filter((t) => t.texto?.trim()).length;
  if ((m.descricao ?? "").trim()) p.push("descrição");
  if (nc) p.push(`${nc} ${nc === 1 ? "item" : "itens"} no checklist`);
  if (ns) p.push(`${ns} ${ns === 1 ? "subtarefa" : "subtarefas"}`);
  if (m.prazo_dias != null) p.push(m.prazo_dias === 0 ? "prazo hoje" : `prazo em ${m.prazo_dias} ${m.prazo_uteis ? (m.prazo_dias === 1 ? "dia útil" : "dias úteis") : m.prazo_dias === 1 ? "dia" : "dias"}`);
  return p.join(" · ") || "vazio";
}
