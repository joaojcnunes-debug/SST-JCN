/**
 * Consolidação › Dashboard (0.3.335, pedido do usuário em 27/11/2026): os números do módulo numa tela só —
 * a situação da consolidação das empresas e dos grupos, o andamento até a venda, os riscos e as intervenções, as vendas
 * e o tempo das pessoas.
 *
 * Módulo **puro** (sem React/Supabase), testado em `dashboard.test.ts`. As regras são as das listas (situação comercial
 * de `situacaoComercial`, riscos de `riscosDoFechamento`); aqui só se conta.
 */

import { riscosDoFechamento, situacaoComercial, type ItemConciliado, type SituacaoComercial } from "@/lib/comercial/liberacao";
import { duracao, estaAberta, type SessaoDocumento } from "@/lib/inspecoes/sessoes";

// ── Situação da consolidação ───────────────────────────────────────────────────────────────────────────────────────────

/** "sem": nada começado; "pendente": pareceres/ligações começados ou conciliação reaberta; "concluida": fechada. */
export type SituacaoConsolidacao = "sem" | "pendente" | "concluida";

export const ROTULO_SITUACAO_CONSOLIDACAO: Record<SituacaoConsolidacao, string> = {
  sem: "Sem consolidação",
  pendente: "Pendente",
  concluida: "Concluída",
};

/** O último fechamento (o mais recente) de cada alvo — empresa ou grupo. */
export interface FechamentoResumo {
  id: string;
  fechado_em: string;
  reaberta: boolean;
  itens: readonly ItemConciliado[];
}

export function situacaoConsolidacao(ultimo: FechamentoResumo | null, comecou: boolean): SituacaoConsolidacao {
  if (ultimo && !ultimo.reaberta) return "concluida";
  if (ultimo?.reaberta || comecou) return "pendente";
  return "sem";
}

// ── Andamento até a venda ──────────────────────────────────────────────────────────────────────────────────────────────

/** As etapas do funil, na ordem. */
export type EtapaAndamento = "sem" | "pendente" | "sem-risco" | "para-liberar" | "liberado" | "vendido";

export const ETAPAS: { etapa: EtapaAndamento; rotulo: string; dica: string }[] = [
  { etapa: "sem", rotulo: "Sem consolidação", dica: "Tem AEP ou DRPS/QPS, mas a conciliação não começou." },
  { etapa: "pendente", rotulo: "Em conciliação", dica: "Pareceres começados ou conciliação reaberta, ainda não fechada." },
  { etapa: "sem-risco", rotulo: "Fechada sem risco", dica: "Fechada, sem risco confirmado: nada a levar ao Comercial." },
  { etapa: "para-liberar", rotulo: "Fechada, falta liberar", dica: "Fechada com risco: falta indicar as intervenções e liberar." },
  { etapa: "liberado", rotulo: "Liberada ao Comercial", dica: "Liberada, ainda sem venda registrada." },
  { etapa: "vendido", rotulo: "Vendida", dica: "Liberada e com pelo menos uma venda registrada." },
];

export interface AlvoDashboard {
  tipo: "empresa" | "grupo";
  id: string;
  nome: string;
  /** Endereço da conciliação do alvo. */
  href: string;
  situacao: SituacaoConsolidacao;
  comercial: SituacaoComercial;
  vendido: boolean;
  /** Riscos da última conciliação fechada (0 se não fechada). */
  riscos: number;
  /** Riscos dessa conciliação ainda sem nenhuma intervenção indicada. */
  riscosSemIntervencao: number;
}

export function etapaDoAlvo(a: Pick<AlvoDashboard, "situacao" | "comercial" | "vendido">): EtapaAndamento {
  if (a.situacao === "sem") return "sem";
  if (a.situacao === "pendente") return "pendente";
  if (a.comercial === "liberado") return a.vendido ? "vendido" : "liberado";
  if (a.comercial === "sem-risco") return "sem-risco";
  return "para-liberar";
}

/** Monta o alvo (empresa ou grupo) a partir do que as listas já carregam. */
export function montarAlvo(p: {
  tipo: "empresa" | "grupo";
  id: string;
  nome: string;
  href: string;
  ultimo: FechamentoResumo | null;
  comecou: boolean;
  atendimento: { status: "EM_ANDAMENTO" | "CONCLUIDO"; parecer: string | null; concluido_em: string | null } | null;
  /** chaves `setor|fator` com intervenção indicada. */
  comIntervencao: ReadonlySet<string>;
  vendido: boolean;
}): AlvoDashboard {
  const situacao = situacaoConsolidacao(p.ultimo, p.comecou);
  const riscos = situacao === "concluida" ? riscosDoFechamento(p.ultimo!.itens) : [];
  const comercial = situacaoComercial({
    ultimoFechamento: p.ultimo ? { fechado_em: p.ultimo.fechado_em, reaberta: p.ultimo.reaberta } : null,
    atendimento: p.atendimento,
    riscos: riscos.length,
    intervencoes: riscos.filter((r) => p.comIntervencao.has(r.chave)).length,
  });
  return {
    tipo: p.tipo,
    id: p.id,
    nome: p.nome,
    href: p.href,
    situacao,
    comercial,
    vendido: p.vendido,
    riscos: riscos.length,
    riscosSemIntervencao: riscos.filter((r) => !p.comIntervencao.has(r.chave)).length,
  };
}

export function contarPor<T, K extends string>(itens: readonly T[], chave: (x: T) => K, ordem: readonly K[]): Record<K, number> {
  const out = Object.fromEntries(ordem.map((k) => [k, 0])) as Record<K, number>;
  for (const x of itens) out[chave(x)] = (out[chave(x)] ?? 0) + 1;
  return out;
}

// ── Riscos e intervenções ──────────────────────────────────────────────────────────────────────────────────────────────

export interface Contagem {
  nome: string;
  valor: number;
}

/** Ordena do maior para o menor (empate: nome) e corta em `max`; o resto vira "Outros". */
export function topo(mapa: ReadonlyMap<string, number>, max = 8): Contagem[] {
  const lista = [...mapa].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"));
  if (lista.length <= max) return lista;
  const resto = lista.slice(max - 1).reduce((s, x) => s + x.valor, 0);
  return [...lista.slice(0, max - 1), { nome: "Outros", valor: resto }];
}

/** Os fatores mais confirmados: cada setor × fator de cada conciliação fechada conta 1. AET = os que pediram aprofundar. */
export function fatoresConfirmados(fechamentos: readonly FechamentoResumo[]): { fatores: Map<string, number>; total: number; aet: number } {
  const fatores = new Map<string, number>();
  let total = 0;
  let aet = 0;
  for (const f of fechamentos) {
    if (f.reaberta) continue;
    for (const r of riscosDoFechamento(f.itens)) {
      fatores.set(r.fator, (fatores.get(r.fator) ?? 0) + 1);
      total++;
      if (r.aet) aet++;
    }
  }
  return { fatores, total, aet };
}

/** Quantas vezes cada valor aparece (vazio vira `vazio`). */
export function contarValores(valores: readonly (string | null | undefined)[], vazio = "Sem informação"): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of valores) {
    const k = v?.trim() || vazio;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// ── Vendas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** "2026-11" de uma data ISO, no fuso de São Paulo. */
export function mesSP(iso: string): string {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Os últimos `n` meses até `hoje` (inclusive), com zero onde não houve venda. */
export function porMes(datas: readonly string[], hoje: string, n = 12): { chave: string; mes: string; valor: number }[] {
  const conta = new Map<string, number>();
  for (const d of datas) {
    const k = mesSP(d);
    conta.set(k, (conta.get(k) ?? 0) + 1);
  }
  const [a, m] = hoje.slice(0, 7).split("-").map(Number);
  const out: { chave: string; mes: string; valor: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = a * 12 + (m - 1) - i;
    const ano = Math.floor(total / 12);
    const mes = total % 12;
    const chave = `${ano}-${String(mes + 1).padStart(2, "0")}`;
    out.push({ chave, mes: `${MESES[mes]}/${String(ano).slice(2)}`, valor: conta.get(chave) ?? 0 });
  }
  return out;
}

// ── Tempo e pessoas ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SessaoComAlvo extends SessaoDocumento {
  alvoTipo: "empresa" | "grupo";
}

/** Só o pedaço da sessão dentro do período [desde, agora]. */
function duracaoNoPeriodo(s: SessaoDocumento, agora: number, desde: number | null): number {
  if (desde == null) return duracao(s, agora);
  const ini = new Date(s.inicio).getTime();
  const total = duracao(s, agora);
  const fim = ini + total;
  if (fim <= desde) return 0;
  return fim - Math.max(ini, desde);
}

/** Horas por pessoa e por alvo no período, e quem está com a sessão aberta agora. */
export function resumirTempo(sessoes: readonly SessaoComAlvo[], agora: number, desde: number | null) {
  const porPessoa = new Map<string, number>();
  const porAlvo = new Map<string, number>();
  let total = 0;
  const abertas: SessaoComAlvo[] = [];
  for (const s of sessoes) {
    if (estaAberta(s, agora)) abertas.push(s);
    const ms = duracaoNoPeriodo(s, agora, desde);
    if (ms <= 0) continue;
    total += ms;
    porPessoa.set(s.nome || "Sem nome", (porPessoa.get(s.nome || "Sem nome") ?? 0) + ms);
    const k = `${s.alvoTipo}:${s.id_inspecao}`;
    porAlvo.set(k, (porAlvo.get(k) ?? 0) + ms);
  }
  return { total, porPessoa, porAlvo, abertas };
}

/** Tempo médio trabalhado (todas as sessões) nos alvos já liberados ao Comercial. */
export function tempoMedioAteLiberar(sessoes: readonly SessaoComAlvo[], liberados: ReadonlySet<string>, agora: number): number | null {
  const porAlvo = new Map<string, number>();
  for (const s of sessoes) {
    const k = `${s.alvoTipo}:${s.id_inspecao}`;
    if (!liberados.has(k)) continue;
    porAlvo.set(k, (porAlvo.get(k) ?? 0) + duracao(s, agora));
  }
  if (porAlvo.size === 0) return null;
  return [...porAlvo.values()].reduce((a, b) => a + b, 0) / porAlvo.size;
}

/** Horas com uma casa ("12,5 h"); abaixo de 1 h, em minutos. */
export function fmtHoras(ms: number): string {
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${(ms / 3_600_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}
