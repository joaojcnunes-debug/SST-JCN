import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/client";
import { STATE_COOKIE, validarState } from "@/lib/gestao/google/helpers";
import { registrarWatch } from "@/lib/gestao/google/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retorno do consent do Google (F3.A). Valida o `state` (anti-CSRF), identifica o usuário pelo
 * cookie de sessão, troca `code`→tokens no endpoint FIXO do Google (server-side, client_secret do
 * env) e grava o refresh_token CIFRADO via RPC gestao_google_salvar_conta(email, token, ENC_KEY).
 * O token NUNCA é logado nem devolvido na resposta. Redireciona de volta pra Gestão com flag.
 * validarState/STATE_COOKIE vivem em @/lib/gestao/google/helpers (route.ts não exporta não-handler).
 */
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function voltarPraGestao(origin: string, flag: string): NextResponse {
  const res = NextResponse.redirect(`${origin}/gestao?google=${flag}`, 302);
  // Consome o cookie de state (uso único).
  res.cookies.set(STATE_COOKIE, "", { path: "/api/gestao/google", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const queryState = url.searchParams.get("state");

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(STATE_COOKIE)?.value;

  if (!validarState(cookieState, queryState)) {
    return voltarPraGestao(origin, "erro_state");
  }
  if (!code) {
    return voltarPraGestao(origin, "erro_code");
  }

  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const encKey = process.env.GESTAO_GOOGLE_ENC_KEY;
  if (!clientId || !clientSecret || !redirectUri || !encKey) {
    return NextResponse.json({ error: "OAuth do Google não configurado." }, { status: 500 });
  }

  // Troca code→tokens no endpoint FIXO do Google (sem SSRF: URL constante).
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    // Não logar corpo (pode conter token/erro sensível).
    return voltarPraGestao(origin, "erro_troca");
  }
  const tok = (await tokenRes.json()) as { refresh_token?: string };
  const refreshToken = tok.refresh_token;
  if (!refreshToken) {
    // Sem refresh_token (consent sem offline/prompt) → pedir reconsentimento.
    return voltarPraGestao(origin, "sem_refresh");
  }

  // Grava CIFRADO via RPC (ENC_KEY por parâmetro; nunca persiste em coluna/GUC/log).
  const svc = createSupabaseServiceClient({ email: user.email, origem: "google-agenda/conectar" });
  const { error } = await svc.rpc("gestao_google_salvar_conta", {
    p_email: user.email,
    p_refresh_token: refreshToken,
    p_enc_key: encKey,
  } as never);
  if (error) {
    return voltarPraGestao(origin, "erro_gravar");
  }

  // Watch best-effort (F3.B): registra o canal push logo após conectar. Se o Google recusar
  // (domínio não verificado etc.), segue SÓ com polling — não bloqueia a conexão nem loga segredo.
  try {
    await registrarWatch(
      svc,
      { usuario_email: user.email, calendar_id: null },
      { clientId, clientSecret, encKey, appOrigin: origin }
    );
  } catch {
    // neutro: polling cobre o inbound sem o watch
  }

  return voltarPraGestao(origin, "conectado");
}
