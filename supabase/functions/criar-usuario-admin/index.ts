// Edge Function — cria usuário no Supabase Auth usando service_role,
// sem substituir a sessão do admin que está chamando.
//
// DEPLOY:
//   supabase functions deploy criar-usuario-admin
//
// As variáveis SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
// são injetadas automaticamente pelo runtime — nenhum secrets set necessário.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  }

  // 1. Valida sessão do chamador via JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ ok: false, error: "Não autorizado" }, 401);
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: caller },
    error: authErr,
  } = await callerClient.auth.getUser();
  if (authErr || !caller?.email) {
    return jsonResponse({ ok: false, error: "Sessão inválida" }, 401);
  }

  // 2. Verifica que o chamador é Admin
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerRow } = await serviceClient
    .from("usuarios")
    .select("perfil")
    .eq("email", caller.email.toLowerCase())
    .single();
  if ((callerRow as { perfil?: string } | null)?.perfil !== "Admin") {
    return jsonResponse(
      { ok: false, error: "Apenas administradores podem criar usuários" },
      403
    );
  }

  // 3. Lê e valida body
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "JSON inválido" }, 400);
  }

  const { email, senha, id_usuario, nome, ...resto } = body as {
    email?: string;
    senha?: string;
    id_usuario?: string;
    nome?: string;
    [k: string]: unknown;
  };

  if (!email || !senha || !nome || !id_usuario) {
    return jsonResponse(
      { ok: false, error: "email, senha, nome e id_usuario são obrigatórios" },
      400
    );
  }
  if (typeof senha === "string" && senha.length < 6) {
    return jsonResponse(
      { ok: false, error: "A senha deve ter pelo menos 6 caracteres" },
      400
    );
  }

  const emailNorm = (email as string).trim().toLowerCase();

  // 4. Cria usuário no Auth via Admin API (não toca na sessão do chamador)
  const { data: authData, error: createErr } =
    await serviceClient.auth.admin.createUser({
      email: emailNorm,
      password: senha as string,
      email_confirm: true,
    });

  if (createErr) {
    const msg = createErr.message ?? "";
    if (
      msg.toLowerCase().includes("already registered") ||
      msg.toLowerCase().includes("already been registered")
    ) {
      return jsonResponse({ ok: false, error: "E-mail já cadastrado" }, 400);
    }
    return jsonResponse({ ok: false, error: msg }, 500);
  }

  // 5. Insere em public.usuarios
  const { error: insertErr } = await serviceClient.from("usuarios").insert({
    id_usuario,
    nome: (nome as string).trim(),
    email: emailNorm,
    ...resto,
  } as never);

  if (insertErr) {
    // Rollback: remove o auth user criado para não deixar órfão
    if (authData?.user?.id) {
      await serviceClient.auth.admin.deleteUser(authData.user.id);
    }
    return jsonResponse(
      {
        ok: false,
        error: `Usuário criado no Auth mas falhou ao salvar perfil: ${insertErr.message}`,
      },
      500
    );
  }

  return jsonResponse({ ok: true });
});
