import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * Criação de usuário (admin). VERSÃO DO JCN — ver a nota em
 * `../credenciais/route.ts` sobre por que a do painel não serve aqui.
 *
 * Duas coisas que a ordem garante:
 *  - a identidade nasce por `auth.admin.createUser`, e não por `signUp()` no
 *    cliente, senão a sessão do admin que está criando seria substituída pela
 *    do recém-criado;
 *  - se o INSERT do perfil falhar, a identidade recém-criada é removida. Sem
 *    esse desfazer sobra alguém que faz login e não existe em public.usuarios —
 *    entra e não é ninguém.
 */
/**
 * Toda falha inesperada sai como { ok, error } em JSON. Sem isto, uma excecao
 * (a mais provavel: SUPABASE_SERVICE_ROLE_KEY ausente, que faz
 * createSupabaseServiceClient lancar) viraria 500 com corpo de erro do Next,
 * sem o campo `error` — e a tela cairia no texto generico do catch, que nao
 * diz nada a quem esta tentando resolver.
 */
function erroJson(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ ok: false, error: msg }, { status: 500 });
}

async function handler(req: NextRequest) {
  const supabase = createSupabaseServerClient(await cookies());

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller?.email) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }
  const { data: callerRow } = await supabase
    .from("usuarios")
    .select("perfil")
    .eq("email", caller.email.toLowerCase())
    .single();
  if ((callerRow as { perfil?: string } | null)?.perfil !== "Admin") {
    return NextResponse.json(
      { ok: false, error: "Apenas administradores podem criar usuários" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const { email, senha, id_usuario, nome, ...resto } = body as {
    email?: string;
    senha?: string;
    id_usuario?: string;
    nome?: string;
    [k: string]: unknown;
  };
  if (!email || !senha || !nome || !id_usuario) {
    return NextResponse.json(
      { ok: false, error: "email, senha, nome e id_usuario são obrigatórios" },
      { status: 400 }
    );
  }
  if (typeof senha === "string" && senha.length < 6) {
    return NextResponse.json(
      { ok: false, error: "A senha deve ter pelo menos 6 caracteres" },
      { status: 400 }
    );
  }
  const emailNorm = (email as string).trim().toLowerCase();

  const service = createSupabaseServiceClient({
    email: caller.email,
    origem: "usuarios/criar",
  });

  const { data: authData, error: createErr } = await service.auth.admin.createUser({
    email: emailNorm,
    password: senha as string,
    email_confirm: true,
  });
  if (createErr) {
    const msg = (createErr.message ?? "").toLowerCase();
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      return NextResponse.json({ ok: false, error: "E-mail já cadastrado" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: createErr.message }, { status: 500 });
  }

  const { error: insertErr } = await service.from("usuarios").insert({
    id_usuario,
    nome: (nome as string).trim(),
    email: emailNorm,
    ...resto,
  } as never);

  if (insertErr) {
    if (authData?.user?.id) {
      await service.auth.admin.deleteUser(authData.user.id);
    }
    return NextResponse.json(
      {
        ok: false,
        error: `Usuário criado no Auth mas falhou ao salvar perfil: ${insertErr.message}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    return await handler(req);
  } catch (e) {
    return erroJson(e);
  }
}
