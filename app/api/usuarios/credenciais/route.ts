import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * Troca de e-mail e/ou senha de um usuário (admin).
 *
 * VERSÃO DO JCN. A do painel-sst ficou de fora da equalização de propósito:
 * ela fala com um GoTrue self-hosted por `lib/supabase/auth-admin`, que aqui
 * não existe. O resultado era um 404 em `/api/usuarios/credenciais` e a tela
 * mostrando "Falha ao atualizar credenciais" sem dizer por quê.
 *
 * Aqui o Auth é o do Supabase gerenciado, e o client de service role já traz
 * `auth.admin` — o mesmo client serve para a Admin API e para escrever o
 * perfil em public.usuarios.
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
      { ok: false, error: "Apenas administradores podem alterar credenciais" },
      { status: 403 }
    );
  }

  let body: { id_usuario?: string; email_atual?: string; email_novo?: string; nova_senha?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const { id_usuario, email_atual, email_novo, nova_senha } = body;
  if (!email_atual) {
    return NextResponse.json({ ok: false, error: "email_atual é obrigatório" }, { status: 400 });
  }
  if (nova_senha && nova_senha.length < 6) {
    return NextResponse.json(
      { ok: false, error: "A nova senha deve ter ao menos 6 caracteres" },
      { status: 400 }
    );
  }

  const service = createSupabaseServiceClient({
    email: caller.email,
    origem: "usuarios/credenciais",
  });

  // A Admin API do Supabase não busca por e-mail; lista e casa aqui.
  const { data: list, error: listErr } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    return NextResponse.json({ ok: false, error: listErr.message }, { status: 500 });
  }
  const target = list.users.find((u) => u.email?.toLowerCase() === email_atual.toLowerCase());
  if (!target) {
    return NextResponse.json({ ok: false, error: "Usuário não encontrado no Auth" }, { status: 404 });
  }

  const attrs: { password?: string; email?: string; email_confirm?: boolean } = {};
  if (nova_senha) attrs.password = nova_senha;
  if (email_novo && email_novo.toLowerCase() !== email_atual.toLowerCase()) {
    attrs.email = email_novo.toLowerCase();
    // Sem isto o Supabase manda e-mail de confirmação e a troca fica pendente —
    // quem já está na tela de administração não deveria depender disso.
    attrs.email_confirm = true;
  }
  if (Object.keys(attrs).length > 0) {
    const { error: upErr } = await service.auth.admin.updateUserById(target.id, attrs);
    if (upErr) {
      const m = (upErr.message ?? "").toLowerCase();
      if (m.includes("already") && m.includes("registered")) {
        return NextResponse.json({ ok: false, error: "E-mail já cadastrado" }, { status: 400 });
      }
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }
  }

  // Espelha o e-mail no perfil. Sem isto o login passa e o app não acha a conta.
  if (attrs.email && id_usuario) {
    await service
      .from("usuarios")
      .update({ email: attrs.email } as never)
      .eq("id_usuario", id_usuario);
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
