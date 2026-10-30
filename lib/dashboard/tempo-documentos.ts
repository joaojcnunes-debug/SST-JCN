/**
 * Dashboard › Tempo nos documentos (v0.3.183, 30/10/2026) — as contas da página, testadas em
 * tempo-documentos.test.ts. Fase 3 do apontamento de tempo (v311): horas apontadas por mês e
 * por pessoa, tempo médio por complexidade, quem está trabalhando agora e documentos parados.
 *
 * Régua: a sessão entra no mês do INÍCIO (São Paulo), com a duração inteira (lib/inspecoes/
 * sessoes: aberta conta até agora; parada há 30 min, até a última atividade). "Aguardando
 * cliente" fica fora do trabalhado e aparece à parte.
 */

import { mesAbsSP } from "./mes";
import { duracao, estaAberta, fimEfetivo, resumirSessoes, type SessaoDocumento } from "@/lib/inspecoes/sessoes";

/** O documento como a página precisa (das inspeções com sessão). */
export interface DocTempo {
  id_inspecao: string;
  id_empresa: string | null;
  empresa: string;
  complexidade: string | null;
  elaboracao_status: string | null;
  elaboracao_concluida_em: string | null;
}

export function agruparPorDoc(sessoes: readonly SessaoDocumento[]): Map<string, SessaoDocumento[]> {
  const m = new Map<string, SessaoDocumento[]>();
  for (const s of sessoes) {
    const l = m.get(s.id_inspecao);
    if (l) l.push(s);
    else m.set(s.id_inspecao, [s]);
  }
  return m;
}

/** Horas apontadas em cada um dos `n` meses até `mesAtual` (mês absoluto, ver lib/dashboard/mes). */
export function horasPorMes(sessoes: readonly SessaoDocumento[], mesAtual: number, n: number, agora: number) {
  const out = Array.from({ length: n }, (_, i) => ({ chave: mesAtual - (n - 1 - i), ms: 0 }));
  const idx = new Map(out.map((m, i) => [m.chave, i]));
  for (const s of sessoes) {
    const i = idx.get(mesAbsSP(s.inicio));
    if (i !== undefined) out[i].ms += duracao(s, agora);
  }
  return out;
}

/** Horas por pessoa no mês (ou em todos, com `mes` nulo), quem mais primeiro. */
export function horasPorPessoa(sessoes: readonly SessaoDocumento[], mes: number | null, agora: number) {
  const m = new Map<string, { pessoa: string; ms: number; documentos: Set<string> }>();
  for (const s of sessoes) {
    if (mes != null && mesAbsSP(s.inicio) !== mes) continue;
    const p = m.get(s.id_usuario) ?? { pessoa: s.nome, ms: 0, documentos: new Set<string>() };
    p.ms += duracao(s, agora);
    p.documentos.add(s.id_inspecao);
    m.set(s.id_usuario, p);
  }
  return [...m.values()]
    .map((p) => ({ pessoa: p.pessoa, ms: p.ms, documentos: p.documentos.size }))
    .sort((a, b) => b.ms - a.ms);
}

export interface MediaComplexidade {
  complexidade: string | null;
  documentos: number;
  trabalhadoMs: number;
  aguardandoClienteMs: number;
  /** Do primeiro início à conclusão (tempo de calendário). */
  calendarioMs: number;
}

/** Média por complexidade dos documentos ENTREGUES que têm sessão. */
export function mediasPorComplexidade(docs: readonly DocTempo[], porDoc: ReadonlyMap<string, SessaoDocumento[]>, agora: number): MediaComplexidade[] {
  const soma = new Map<string | null, { n: number; t: number; a: number; c: number }>();
  for (const d of docs) {
    const ss = porDoc.get(d.id_inspecao);
    if (d.elaboracao_status !== "CONCLUIDO" || !d.elaboracao_concluida_em || !ss?.length) continue;
    const ate = new Date(d.elaboracao_concluida_em).getTime();
    const r = resumirSessoes(ss, agora, ate);
    const x = soma.get(d.complexidade) ?? { n: 0, t: 0, a: 0, c: 0 };
    x.n += 1;
    x.t += r.trabalhadoMs;
    x.a += r.aguardandoClienteMs;
    x.c += Math.max(0, ate - new Date(r.primeiraEm!).getTime());
    soma.set(d.complexidade, x);
  }
  return [...soma.entries()].map(([complexidade, x]) => ({
    complexidade,
    documentos: x.n,
    trabalhadoMs: x.t / x.n,
    aguardandoClienteMs: x.a / x.n,
    calendarioMs: x.c / x.n,
  }));
}

/** Sessões correndo agora. */
export function trabalhandoAgora(sessoes: readonly SessaoDocumento[], agora: number) {
  return sessoes.filter((s) => estaAberta(s, agora)).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export interface DocParado {
  doc: DocTempo;
  /** Última atividade no documento (fim da última sessão). */
  ultimaEm: number;
  diasParado: number;
  aguardandoCliente: boolean;
}

/** Documentos em elaboração sem ninguém trabalhando há `dias` dias ou mais (mais antigos primeiro). */
export function documentosParados(docs: readonly DocTempo[], porDoc: ReadonlyMap<string, SessaoDocumento[]>, agora: number, dias = 3): DocParado[] {
  const out: DocParado[] = [];
  for (const d of docs) {
    const ss = porDoc.get(d.id_inspecao);
    if (d.elaboracao_status !== "EM_ELABORACAO" || !ss?.length || ss.some((s) => estaAberta(s, agora))) continue;
    const ultimaEm = Math.max(...ss.map((s) => fimEfetivo(s, agora)));
    const diasParado = Math.floor((agora - ultimaEm) / 86_400_000);
    if (diasParado < dias) continue;
    out.push({ doc: d, ultimaEm, diasParado, aguardandoCliente: resumirSessoes(ss, agora).aguardandoClienteAgora });
  }
  return out.sort((a, b) => a.ultimaEm - b.ultimaEm);
}
