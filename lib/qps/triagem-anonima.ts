/**
 * Triagem anônima da AEP por QR Code (Fase 3, 2026-10-06; v273).
 *
 * Construída DENTRO do QPS: o questionário é o tipo QPS "Triagem anônima AEP
 * (13 fatores)" (uma afirmação por fator, Anexo D), com IDs fixos na v273 —
 * o texto das perguntas pode ser editado na tela Tipos do QPS; o vínculo
 * pergunta → fator é por categoria (`descricao` = chave do fator).
 *
 * Anonimato:
 *   • sem IP, user-agent nem horário (o banco grava só a data);
 *   • respostas append-only, gravadas só pela rota do servidor;
 *   • resultado só com ≥ 5 respostas no setor (k-anonimato), pela função
 *     `qps_resultado_coleta`; comentários só para a equipe, nunca no laudo.
 * Triagem COMPLEMENTAR: não substitui o DRPS.
 *
 * Módulo PURO: usado pela rota pública, pela tela da AEP e pelos testes.
 */

export const ID_TIPO_TRIAGEM = "a3e70000-0000-4000-8000-000000000000";

/** Categoria fixa (v273) → chave do fator. */
export const FATOR_POR_CATEGORIA: Record<string, string> = {
  "a3e70000-0000-4000-8000-000000000101": "assedio",
  "a3e70000-0000-4000-8000-000000000102": "falta_suporte",
  "a3e70000-0000-4000-8000-000000000103": "gestao_mudancas",
  "a3e70000-0000-4000-8000-000000000104": "clareza_papel",
  "a3e70000-0000-4000-8000-000000000105": "recompensas",
  "a3e70000-0000-4000-8000-000000000106": "baixo_controle",
  "a3e70000-0000-4000-8000-000000000107": "justica_organizacional",
  "a3e70000-0000-4000-8000-000000000108": "eventos_traumaticos",
  "a3e70000-0000-4000-8000-000000000109": "subcarga",
  "a3e70000-0000-4000-8000-000000000110": "sobrecarga",
  "a3e70000-0000-4000-8000-000000000111": "maus_relacionamentos",
  "a3e70000-0000-4000-8000-000000000112": "comunicacao_dificil",
  "a3e70000-0000-4000-8000-000000000113": "trabalho_remoto",
};

export const ESCALA = ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"] as const;

/** k-anonimato: resultado só aparece a partir de 5 respostas no setor. */
export const K_MINIMO = 5;
/** % de "Frequentemente/Sempre" a partir do qual o fator é sugerido (decisão: 30%). */
export const LIMIAR_PADRAO = 0.3;
/** Validade padrão do link, em dias (decisão: 15). */
export const VALIDADE_PADRAO_DIAS = 15;
/** Comentário livre: teto de caracteres. */
export const MAX_COMENTARIO = 1000;

export const AVISO_COMPLEMENTAR =
  "Questionário anônimo: triagem complementar, que não substitui o DRPS/Questionário Psicossocial.";

/** Token do link: 32 bytes aleatórios (256 bits) em hex. */
export function gerarToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export const tokenValido = (t: unknown): t is string => typeof t === "string" && /^[0-9a-f]{64}$/.test(t);

/** Coleta aceita resposta? (ativa, dentro da validade, abaixo do teto) */
export function situacaoColeta(
  c: { ativo: boolean; expira_em: string; max_respostas?: number | null },
  hojeISO: string,
  totalRespostas = 0,
): "aberta" | "encerrada" | "expirada" | "cheia" {
  if (!c.ativo) return "encerrada";
  if (hojeISO.slice(0, 10) > c.expira_em.slice(0, 10)) return "expirada";
  if (c.max_respostas && totalRespostas >= c.max_respostas) return "cheia";
  return "aberta";
}

/**
 * Valida o envio público: só as perguntas permitidas, cada uma 1–5; exige
 * todas respondidas. Comentário aparado e limitado. Devolve erro em texto.
 */
export function validarEnvio(
  body: unknown,
  idsPermitidos: readonly string[],
): { ok: true; respostas: Record<string, number>; comentario: string | null } | { ok: false; erro: string } {
  if (typeof body !== "object" || body === null) return { ok: false, erro: "Envio inválido." };
  const r = (body as { respostas?: unknown }).respostas;
  if (typeof r !== "object" || r === null) return { ok: false, erro: "Envio inválido." };
  const respostas: Record<string, number> = {};
  for (const id of idsPermitidos) {
    const v = (r as Record<string, unknown>)[id];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
      return { ok: false, erro: "Responda todas as afirmações." };
    }
    respostas[id] = v;
  }
  const c = (body as { comentario?: unknown }).comentario;
  const comentario = typeof c === "string" && c.trim() ? c.trim().slice(0, MAX_COMENTARIO) : null;
  return { ok: true, respostas, comentario };
}

export interface ResultadoColeta {
  total: number;
  suficiente: boolean;
  perguntas?: { id_pergunta: string; n: number; freq: number }[];
}

/**
 * Por fator: % de "Frequentemente/Sempre" e se passa do limiar. Só com
 * resultado suficiente (k ≥ 5); `fatorDaPergunta` vem do tipo QPS.
 */
export function percentuaisPorFator(
  res: ResultadoColeta | null | undefined,
  fatorDaPergunta: Record<string, string>,
  limiar = LIMIAR_PADRAO,
): { fator: string; pct: number; sugerido: boolean; n: number }[] {
  if (!res?.suficiente || !res.perguntas) return [];
  const acc = new Map<string, { n: number; freq: number }>();
  for (const p of res.perguntas) {
    const f = fatorDaPergunta[p.id_pergunta];
    if (!f) continue;
    const a = acc.get(f) ?? { n: 0, freq: 0 };
    a.n += p.n;
    a.freq += p.freq;
    acc.set(f, a);
  }
  return [...acc.entries()].map(([fator, a]) => {
    const pct = a.n > 0 ? a.freq / a.n : 0;
    return { fator, pct, sugerido: pct >= limiar, n: a.n };
  });
}
