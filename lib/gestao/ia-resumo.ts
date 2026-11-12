/**
 * Resumo dos comentários com IA (item 15 da comparação, v0.3.925). O servidor busca os comentários com o login da
 * pessoa (RLS) e monta a conversa aqui (no JCN, a Edge Function gestao-ia tem uma cópia destas duas funções). Funções puras — testadas
 * offline (sem import do Next).
 */

export interface ComentarioIa {
  autor: string | null;
  texto: string | null;
  created_at: string;
}

export interface ResumoIa {
  situacao: string;
  decisoes: string[];
  pendencias: string[];
  proximo_passo: string;
}

/** Mínimo de comentários para valer a pena resumir. */
export const MIN_COMENTARIOS_RESUMO = 3;

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * "10/11 14:03 · Ana: texto", do mais antigo ao mais novo. Passou do limite de caracteres: ficam os MAIS NOVOS (o que
 * importa para quem pega a tarefa agora) e uma linha avisa quantos antigos ficaram de fora.
 */
export function montarConversa(cs: ComentarioIa[], limite = 14_000): { texto: string; usados: number; total: number } {
  const ord = [...cs].filter((c) => (c.texto ?? "").trim()).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const linhas: string[] = [];
  let tam = 0;
  for (let i = ord.length - 1; i >= 0; i--) {
    const c = ord[i];
    const autor = !c.autor ? "Alguém" : c.autor === "automacao" ? "Automação" : c.autor;
    const linha = `${quando(c.created_at)} · ${autor}: ${(c.texto ?? "").replace(/\s+/g, " ").trim().slice(0, 2_000)}`;
    if (linhas.length > 0 && tam + linha.length + 1 > limite) break;
    linhas.unshift(linha);
    tam += linha.length + 1;
  }
  const fora = ord.length - linhas.length;
  if (fora > 0) linhas.unshift(fora === 1 ? "(1 comentário mais antigo não entrou no resumo)" : `(${fora} comentários mais antigos não entraram no resumo)`);
  return { texto: linhas.join("\n"), usados: ord.length - fora, total: ord.length };
}

const lista = (x: unknown, max: number) =>
  (Array.isArray(x) ? x : []).map((v) => String(v ?? "").trim()).filter(Boolean).slice(0, max);

/** Confere a resposta do modelo; sem situação nem itens = não serve. */
export function normalizarResumo(x: unknown): ResumoIa | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const r: ResumoIa = {
    situacao: String(o.situacao ?? "").trim(),
    decisoes: lista(o.decisoes, 6),
    pendencias: lista(o.pendencias, 6),
    proximo_passo: String(o.proximo_passo ?? "").trim(),
  };
  return r.situacao || r.decisoes.length || r.pendencias.length ? r : null;
}
