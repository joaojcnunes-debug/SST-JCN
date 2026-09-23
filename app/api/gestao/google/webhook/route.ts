import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/client";
import { tokenConfere } from "@/lib/gestao/google/helpers";
import { puxarInboundConta } from "@/lib/gestao/google/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Push do Google Calendar (events.watch → notification channel). F3.B.
 *
 * O Google chama server-to-server (NÃO tem cookie de sessão), então a autenticação é pelo header
 * `X-Goog-Channel-Token` — o segredo que geramos ao registrar o watch — comparado em TEMPO CONSTANTE
 * contra o `channel_token` gravado na conta identificada por `X-Goog-Channel-Id`. Sem/!=token → 401.
 * A rota está sob o Bypass do CF Access em /api/gestao/* (o Google não passa por login).
 *
 * Efeito: dispara o mesmo pull inbound do /sync PARA A CONTA do canal. Resposta SEMPRE 200 vazio após
 * autenticar (nunca ecoa dado da agenda/tarefa). Idempotente: o Google reentrega; puxar duas vezes é
 * no-op (anti-loop por etag + GUC).
 */
function vazio(status: number): NextResponse {
  return new NextResponse(null, { status });
}

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("x-goog-channel-id");
  const channelToken = req.headers.get("x-goog-channel-token");
  if (!channelId || !channelToken) return vazio(401);

  const sb = createSupabaseServiceClient();
  const { data: contaRow } = await sb
    .from("gestao_google_contas")
    .select("usuario_email,calendar_id,sync_token,channel_token")
    .eq("channel_id", channelId)
    .eq("ativo", true)
    .maybeSingle();
  const conta = contaRow as {
    usuario_email: string;
    calendar_id: string | null;
    sync_token: string | null;
    channel_token: string | null;
  } | null;

  // Conta ausente OU token divergente → 401 (comparação em tempo constante; não revela existência).
  if (!conta || !tokenConfere(conta.channel_token, channelToken)) return vazio(401);

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const encKey = process.env.GESTAO_GOOGLE_ENC_KEY;
  if (clientId && clientSecret && encKey) {
    try {
      await puxarInboundConta(sb, conta, { clientId, clientSecret, encKey });
    } catch {
      // best-effort: o Google reentrega. Nunca loga segredo/dado.
    }
  }

  // 200 vazio SEMPRE após autenticar — o corpo nunca carrega dado.
  return vazio(200);
}
