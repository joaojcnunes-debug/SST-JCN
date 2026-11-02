// v315 (Painel v322) — "Funcionários por produto" (aba das Automações). Regras puras da tela; quem decide no
// servidor é gestao_automacao_acao (criar_subtarefas_modelo sem responsável na própria ação).

interface Clausula { campo?: string; op?: string; valor?: string }
interface AcaoMin { tipo?: string; responsavel_email?: string }
export interface AutomacaoMin {
  ativo?: boolean;
  condicao?: { all?: Clausula[]; any?: Clausula[] } | null;
  acoes?: AcaoMin[] | null;
  acao?: AcaoMin | null;
}

/** O produto de uma automação de checklist: o valor que a condição procura num campo ("Produtos contém PGR"). */
export function produtosDaAutomacao(a: AutomacaoMin): string[] {
  const acoes = a.acoes?.length ? a.acoes : a.acao?.tipo ? [a.acao] : [];
  if (!acoes.some((x) => x.tipo === "criar_subtarefas_modelo")) return [];
  const cl = [...(a.condicao?.all ?? []), ...(a.condicao?.any ?? [])];
  return cl
    .filter((c) => c.op === "contains" && (c.campo ?? "").startsWith("campo:") && (c.valor ?? "").trim())
    .map((c) => c.valor!.trim());
}

/** Os produtos que geram subtarefas neste quadro, sem repetir, em ordem alfabética. */
export function produtosDoQuadro(automacoes: readonly AutomacaoMin[]): string[] {
  const s = new Set<string>();
  for (const a of automacoes) for (const p of produtosDaAutomacao(a)) s.add(p);
  return [...s].sort((x, y) => x.localeCompare(y, "pt-BR", { numeric: true }));
}

/** Produto marcado em mais de uma linha → vale a primeira (a de cima), como no banco. */
export function produtosRepetidos(linhas: readonly { produtos: readonly string[] }[]): Set<string> {
  const vistos = new Set<string>();
  const rep = new Set<string>();
  for (const l of linhas) for (const p of l.produtos) (vistos.has(p) ? rep : vistos).add(p);
  return rep;
}

/** Automações de checklist que já têm responsável na própria ação (a exceção que vence a tabela). */
export function produtosComResponsavelProprio(automacoes: readonly AutomacaoMin[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of automacoes) {
    const acoes = a.acoes?.length ? a.acoes : a.acao?.tipo ? [a.acao] : [];
    const email = acoes.find((x) => x.tipo === "criar_subtarefas_modelo" && x.responsavel_email)?.responsavel_email;
    if (email) for (const p of produtosDaAutomacao(a)) m.set(p, email);
  }
  return m;
}
