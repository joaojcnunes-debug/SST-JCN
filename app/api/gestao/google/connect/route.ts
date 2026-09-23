import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import { STATE_COOKIE, montarUrlConsent } from "@/lib/gestao/google/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Início do OAuth por usuário (F3.A — Google Agenda outbound). Sob o Bypass do CF Access em
 * /api/gestao/*. Identifica o usuário pelo cookie de sessão (401 sem sessão), gera um `state`
 * anti-CSRF (cookie httpOnly curto) e redireciona (302) pro consent do Google.
 * Escopo ÚNICO calendar.events; access_type=offline + prompt=consent garantem refresh_token.
 * Nenhum segredo aqui: só CLIENT_ID e REDIRECT_URI (ambos não-sensíveis). O client_secret vive
 * só no callback (server-side). Os helpers montarUrlConsent/STATE_COOKIE vivem em @/lib/gestao/
 * google/helpers — route.ts não pode exportar não-handler (next build rejeita).
 */
export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "OAuth do Google não configurado." }, { status: 500 });
  }

  const state = randomBytes(24).toString("base64url");
  const url = montarUrlConsent({ clientId, redirectUri, state });

  const res = NextResponse.redirect(url, 302);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/gestao/google",
    maxAge: 600, // 10 min — só p/ o round-trip do consent
  });
  return res;
}
