// API route privilegiada — cria usuários via Supabase Admin API.
//
// Por que existe: signUp() do client dispara e-mail de confirmação SMTP
// (rate limit 2 emails/hora no free tier). Aqui usamos service_role +
// admin.createUser({ email_confirm: true }) que NÃO envia e-mail e ainda
// marca o usuário como confirmado.
//
// Segurança:
//   - SUPABASE_SERVICE_ROLE_KEY nunca chega ao client (é só env do servidor)
//   - O caller precisa ser Admin ativo (verificado via cookie de sessão)
//   - Em caso de erro no INSERT, faz rollback do auth.admin.createUser

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

interface CreateBody {
  nome: string;
  email: string;
  senha: string;
  cargo: string | null;
  perfil: "Admin" | "Tecnico" | "Visualizador";
  ativo_sistema: boolean;
  empresas_vinculadas: string[];
}

function gerarId(prefixo: string): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${prefixo}-${hex}`;
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Servidor sem credenciais Supabase" },
      { status: 500 }
    );
  }
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor. Adicione no .env.local (dev) ou nas Environment Variables do Vercel (prod) e refaça o deploy.",
      },
      { status: 500 }
    );
  }

  // 1) Autenticação: confere se há sessão Supabase nos cookies
  const cookieStore = await cookies();
  const userClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // No-op em route handler — não precisamos persistir cookies aqui
      },
    },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // 2) Autorização: caller precisa ser Admin ativo
  const { data: callerRow } = await userClient
    .from("usuarios")
    .select("perfil, ativo_sistema")
    .eq("email", user.email)
    .single();

  const caller = callerRow as
    | { perfil?: string; ativo_sistema?: boolean }
    | null;

  if (caller?.perfil !== "Admin" || caller.ativo_sistema === false) {
    return NextResponse.json(
      { error: "Apenas administradores ativos podem criar usuários" },
      { status: 403 }
    );
  }

  // 3) Parse e valida o body
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    nome,
    email,
    senha,
    cargo,
    perfil,
    ativo_sistema,
    empresas_vinculadas,
  } = body;

  if (!nome?.trim() || !email?.trim() || !senha) {
    return NextResponse.json(
      { error: "Nome, e-mail e senha são obrigatórios" },
      { status: 400 }
    );
  }
  if (senha.length < 6) {
    return NextResponse.json(
      { error: "Senha deve ter ao menos 6 caracteres" },
      { status: 400 }
    );
  }
  if (!["Admin", "Tecnico", "Visualizador"].includes(perfil)) {
    return NextResponse.json(
      { error: "Perfil inválido" },
      { status: 400 }
    );
  }

  // 4) Cria no Auth via Admin API (sem disparo de e-mail)
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const emailNorm = email.trim().toLowerCase();

  const { data: created, error: errAuth } = await admin.auth.admin.createUser({
    email: emailNorm,
    password: senha,
    email_confirm: true, // marca confirmado, sem SMTP
  });

  if (errAuth) {
    return NextResponse.json({ error: errAuth.message }, { status: 400 });
  }

  // 5) Insere na tabela public.usuarios — rollback se falhar
  const idUsuario = gerarId("USR");

  const { error: errDb } = await admin.from("usuarios").insert({
    id_usuario: idUsuario,
    nome: nome.trim(),
    email: emailNorm,
    cargo: cargo?.trim() || null,
    perfil,
    ativo_sistema,
    empresas_vinculadas:
      perfil === "Tecnico" ? empresas_vinculadas ?? [] : [],
  } as never);

  if (errDb) {
    if (created.user?.id) {
      await admin.auth.admin.deleteUser(created.user.id);
    }
    return NextResponse.json({ error: errDb.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id_usuario: idUsuario });
}
