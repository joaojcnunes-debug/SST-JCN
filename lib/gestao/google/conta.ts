// Etapa 1 do botão "Google Agenda": situação da conta e desconexão. Vive em lib/ (NÃO em
// route.ts) porque o `next build` do App Router rejeita export de não-handler em route.ts.
// Importado por status/route.ts e disconnect/route.ts.
//
// Segurança (mesmas regras da F3.A/F3.B):
//   • Endpoints do Google FIXOS (constantes abaixo) — sem SSRF.
//   • refresh_token só é decifrado no banco (RPC gestao_google_ler_token); nunca é logado nem devolvido.
//   • A conta só sai por RPC (gestao_google_remover_conta, v292): o service_role não escreve direto.

import { createSupabaseServiceClient } from "@/lib/supabase/client";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars";

type Svc = ReturnType<typeof createSupabaseServiceClient>;

export interface StatusGoogle {
  /** O ambiente tem o OAuth do Google configurado (sem isso o botão Conectar não funciona). */
  configurado: boolean;
  conectado: boolean;
  /** ISO de quando conectou; null se não conectado. */
  desde: string | null;
  /** Quantas tarefas desta pessoa já estão na agenda dela. */
  eventos: number;
  /**
   * Conectada, mas o Google recusa a autorização (invalid_grant: a pessoa tirou o acesso na conta
   * Google, o token expirou ou foi revogado). Nada sincroniza até conectar de novo.
   */
  expirada: boolean;
}

/**
 * Confere com o Google se a autorização guardada ainda vale. Só devolve true quando o Google
 * RESPONDE invalid_grant — falha de rede ou outro erro não marca como expirada (seria alarme falso).
 */
async function autorizacaoRecusada(sb: Svc, email: string): Promise<boolean> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const encKey = process.env.GESTAO_GOOGLE_ENC_KEY;
  if (!clientId || !clientSecret || !encKey) return false;
  const { data: refreshToken } = await sb.rpc("gestao_google_ler_token", { p_email: email, p_enc_key: encKey } as never);
  if (typeof refreshToken !== "string" || !refreshToken) return true;
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return false;
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return j.error === "invalid_grant";
  } catch {
    return false;
  }
}

export function googleConfigurado(): boolean {
  return !!(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REDIRECT_URI &&
    process.env.GESTAO_GOOGLE_ENC_KEY
  );
}

export async function statusDaConta(sb: Svc, email: string): Promise<StatusGoogle> {
  const { data: conta } = await sb
    .from("gestao_google_contas")
    .select("ativo,created_at")
    .eq("usuario_email", email)
    .maybeSingle();
  const c = conta as { ativo: boolean; created_at: string } | null;
  let eventos = 0;
  if (c?.ativo) {
    const { count } = await sb
      .from("gestao_google_eventos")
      .select("id_tarefa", { count: "exact", head: true })
      .eq("usuario_email", email);
    eventos = count ?? 0;
  }
  const expirada = !!c?.ativo && (await autorizacaoRecusada(sb, email));
  return { configurado: googleConfigurado(), conectado: !!c?.ativo, desde: c?.ativo ? c.created_at : null, eventos, expirada };
}

async function obterAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string };
  return j.access_token ?? null;
}

export interface ResultadoDesconexao {
  /** Eventos apagados da agenda do Google. */
  removidos: number;
  /** Eventos que não deu para apagar no Google (ficam na agenda da pessoa; o painel esquece deles). */
  falhas: number;
}

/**
 * Desconecta a conta Google do usuário:
 *  1. apaga da agenda dele os eventos criados pelo painel (best-effort; 404/410 = já não existia) —
 *     os que a própria pessoa criou na agenda e viraram tarefa (origem 'google', v301) ficam lá;
 *  2. revoga a autorização no Google (best-effort — o app some de "Apps com acesso à conta");
 *  3. limpa o mapa tarefa↔evento e apaga a conta (RPC v292).
 * Os passos 1 e 2 dependem do OAuth configurado; sem ele, só o 3 roda (a conta sai do painel mesmo
 * assim). O passo 3 roda SEMPRE, mesmo que o Google falhe — desconectar nunca fica "preso".
 */
export async function desconectarConta(sb: Svc, email: string): Promise<ResultadoDesconexao> {
  let removidos = 0;
  let falhas = 0;

  const { data: mapa } = await sb.from("gestao_google_eventos").select("event_id,origem").eq("usuario_email", email);
  const eventos = ((mapa ?? []) as { event_id: string; origem?: string }[])
    .filter((m) => m.origem !== "google")
    .map((m) => m.event_id);

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const encKey = process.env.GESTAO_GOOGLE_ENC_KEY;

  if (clientId && clientSecret && encKey) {
    const { data: conta } = await sb.from("gestao_google_contas").select("calendar_id").eq("usuario_email", email).maybeSingle();
    const calendarId = (conta as { calendar_id: string | null } | null)?.calendar_id || "primary";
    const { data: refreshToken } = await sb.rpc("gestao_google_ler_token", { p_email: email, p_enc_key: encKey } as never);
    if (typeof refreshToken === "string" && refreshToken) {
      const accessToken = await obterAccessToken(refreshToken, clientId, clientSecret).catch(() => null);
      if (accessToken) {
        const encCal = encodeURIComponent(calendarId);
        for (const eventId of eventos) {
          try {
            const r = await fetch(`${CAL_BASE}/${encCal}/events/${encodeURIComponent(eventId)}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (r.ok || r.status === 404 || r.status === 410) removidos++;
            else falhas++;
          } catch {
            falhas++;
          }
        }
      } else {
        falhas += eventos.length;
      }
      // Revoga o refresh_token (o app sai da lista de acessos da conta Google). Best-effort.
      await fetch(GOOGLE_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
      }).catch(() => {});
    } else {
      falhas += eventos.length;
    }
  } else {
    falhas += eventos.length;
  }

  // v301: solta o mapa; convidados das tarefas que nasceram na agenda dela viram responsáveis comuns.
  await sb.rpc("gestao_google_soltar_eventos", { p_email: email } as never);
  const { error } = await sb.rpc("gestao_google_remover_conta", { p_email: email } as never);
  if (error) throw new Error("remover_conta");
  return { removidos, falhas };
}
