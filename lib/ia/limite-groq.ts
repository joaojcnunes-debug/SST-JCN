/**
 * Limite de uso do Groq (HTTP 429) dito em português para quem clicou.
 *
 * O plano gratuito aceita poucas chamadas por minuto para a empresa inteira.
 * Medido num 429 real em 28/09/2026: o qwen3.8-27b (visão) tem teto de 7.000
 * tokens de entrada/min e uma análise de 3 fotos pede ~6.200 — cabe UMA por
 * minuto. Quando duas pessoas usam a IA ao mesmo tempo, o Groq recusa com 429
 * (cabeçalho retry-after: 53; mensagem "try again in 52.5s") — e até 28/09 a tela
 * mostrava "Erro ao gerar com IA" ou o JSON cru em inglês. A pessoa achava que
 * tinha quebrado, quando bastava esperar uns segundos.
 *
 * O `codigo` é o que `mensagemErro` (lib/errors.ts) reconhece como mensagem já
 * escrita para o usuário — sem ele a tela troca o texto pelo genérico.
 *
 * Sem import do Next de propósito: a rota monta o NextResponse, e isto fica
 * testável pelo `node --test`.
 */

export const CODIGO_LIMITE_IA = "limite_ia";

/** Espera padrão quando o Groq não diz quanto (nunca vi acontecer; é rede de segurança). */
const ESPERA_PADRAO_S = 10;

/**
 * Segundos até poder tentar de novo, arredondados para cima (mínimo 1).
 * Ordem: cabeçalho `retry-after` numérico; depois o "Please try again in …"
 * da mensagem do Groq, que vem como "7.5s", "450ms" ou "1m2.5s".
 */
export function segundosParaTentar(retryAfter: string | null, corpo: string): number {
  const cab = retryAfter != null ? Number(retryAfter.trim()) : NaN;
  if (Number.isFinite(cab) && cab > 0) return Math.max(1, Math.ceil(cab));

  const m = /try again in\s+(?:(\d+(?:\.\d+)?)m(?!s))?\s*(?:(\d+(?:\.\d+)?)(ms|s))?/i.exec(corpo);
  if (m && (m[1] || m[2])) {
    const min = m[1] ? Number(m[1]) : 0;
    const val = m[2] ? Number(m[2]) : 0;
    const seg = min * 60 + (m[3] === "ms" ? val / 1000 : val);
    if (seg > 0) return Math.max(1, Math.ceil(seg));
  }
  return ESPERA_PADRAO_S;
}

export function mensagemLimiteIa(segundos: number): string {
  return `Limite de uso da IA atingido. Tente de novo em ${segundos} ${segundos === 1 ? "segundo" : "segundos"}.`;
}

export interface CorpoLimiteIa {
  error: string;
  codigo: typeof CODIGO_LIMITE_IA;
  tentar_em: number;
}

/**
 * Se o Groq respondeu 429, devolve o corpo que a rota manda (com status 429);
 * senão `null` e a rota segue o tratamento de erro de sempre. A linha no log
 * serve para contar quantas vezes o limite é batido — o dado que falta para a
 * decisão do plano pago.
 */
export async function limiteIa(res: Response, rota: string): Promise<CorpoLimiteIa | null> {
  if (res.status !== 429) return null;
  const corpo = await res.text().catch(() => "");
  const s = segundosParaTentar(res.headers.get("retry-after"), corpo);
  console.warn(`[ia] 429 limite do Groq rota=${rota} tentar_em=${s}s`);
  return { error: mensagemLimiteIa(s), codigo: CODIGO_LIMITE_IA, tentar_em: s };
}

/**
 * JCN: a IA roda em edge functions do Supabase, que tentam vários modelos e, quando todos
 * falham, respondem 502 com `{ error: "Groq falhou em todos os modelos — modelo: 429 {...}" }`.
 * Lê essa resposta (já em texto) e, se o motivo foi o limite do Groq, devolve o erro no
 * formato que `mensagemErro` mostra ("Tente de novo em N segundos"). Senão, null.
 */
export function erroLimiteIaDaFuncao(status: number, texto: string): (Error & { code: string }) | null {
  const erro = (msg: string) => Object.assign(new Error(msg), { name: "LimiteIa", code: CODIGO_LIMITE_IA });
  let corpo: { codigo?: string; error?: string } | null = null;
  try { corpo = JSON.parse(texto); } catch { /* texto cru */ }
  if (corpo?.codigo === CODIGO_LIMITE_IA && corpo.error) {
    return erro(corpo.error);
  }
  const msg = typeof corpo?.error === "string" ? corpo.error : texto;
  const foiLimite = status === 429 || /:\s*429\b/.test(msg) || /rate.?limit/i.test(msg);
  if (!foiLimite) return null;
  return erro(mensagemLimiteIa(segundosParaTentar(null, msg)));
}
