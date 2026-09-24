/**
 * Distinguir "a rede caiu" de "o servidor disse não".
 *
 * Mora num módulo próprio, e não dentro da fila, por causa de um CICLO: a fila
 * importa `atualizarKmVeiculo` de `useFrotaVeiculos`, e `useFrotaVeiculos`
 * precisa desta função para decidir se cai no cache local. Um importando o outro
 * fecharia o laço e deixaria uma das duas indefinida na inicialização.
 *
 * A distinção em si é a regra mais importante de todo o offline: chamar queda de
 * rede de "recusado" faz o técnico achar que perdeu o trabalho; chamar recusa do
 * banco de "sem rede" faz o aparelho tentar para sempre um envio que nunca vai
 * passar.
 */

export function ehErroDeRede(e: unknown): boolean {
  // `fetch` sem rede lança TypeError — é o sinal mais confiável que existe.
  if (e instanceof TypeError) return true;
  const m = String((e as Error)?.message ?? "").toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") || // Safari/iOS
    m.includes("network request failed")
  );
}

/**
 * Violação de unicidade/PK: a tentativa anterior já tinha gravado. É SUCESSO.
 *
 * Vale para todo o offline porque o id nasce no cliente em todo o painel
 * (`gerarId`) — o reenvio de algo que chegou bate na chave primária em vez de
 * duplicar. Estava dentro de `fila.ts` até a inspeção offline precisar da mesma
 * regra; duas cópias divergiriam no primeiro código de erro novo.
 */
export function ehDuplicidade(e: unknown): boolean {
  const codigo = (e as { code?: string })?.code;
  if (codigo === "23505") return true;
  return /duplicate key|já existe|already exists/i.test(String((e as Error)?.message ?? ""));
}

export type EstadoConexao = "OK" | "SEM_REDE" | "REAUTENTICAR";

/**
 * O Cloudflare Access está na frente de TODO o domínio (verificado em
 * 14/08/2026: `/api/health` devolve 302 para messages-chabra.cloudflareaccess.com
 * sem sessão). Quando ele derruba a sessão, o PostgREST não responde JSON —
 * responde a página de login, de outra origem. Sem esta sonda, o erro chegaria
 * como "JSON inválido" e o registro seria marcado como recusado pelo banco, que
 * é exatamente a mentira que não podemos contar.
 */
export async function checarConexao(): Promise<EstadoConexao> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "SEM_REDE";
  try {
    const r = await fetch("/api/health", { credentials: "same-origin", cache: "no-store" });
    if (r.redirected) return "REAUTENTICAR";
    if (new URL(r.url).origin !== window.location.origin) return "REAUTENTICAR";
    const tipo = r.headers.get("content-type") ?? "";
    if (!r.ok || tipo.includes("text/html")) return "REAUTENTICAR";
    return "OK";
  } catch {
    // Não deu nem para falar com o servidor — é rede, não autenticação.
    return "SEM_REDE";
  }
}
