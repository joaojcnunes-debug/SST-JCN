import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/client";
import { temServiceRole } from "../service-role";

export const dynamic = "force-dynamic";

/**
 * Exclusão de usuário (admin). VERSÃO DO JCN — ver a nota em
 * `../credenciais/route.ts`.
 *
 * Remove a identidade no Auth E o perfil em public.usuarios. Deixar só um dos
 * dois produz os dois defeitos clássicos: identidade órfã que loga e não é
 * ninguém, ou perfil fantasma que aparece na lista e não entra.
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
      { ok: false, error: "Apenas administradores podem excluir usuários" },
      { status: 403 }
    );
  }

  let body: { id_usuario?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const { id_usuario, email } = body;
  if (!email) {
    return NextResponse.json({ ok: false, error: "email é obrigatório" }, { status: 400 });
  }
  if (email.toLowerCase() === caller.email.toLowerCase()) {
    return NextResponse.json(
      { ok: false, error: "Não é possível excluir o próprio usuário" },
      { status: 400 }
    );
  }

  // Sem a chave de service role: a função do banco apaga o perfil e a
  // identidade juntos, e só roda para Admin ativo (e nunca a si mesmo).
  if (!temServiceRole()) {
    const { error } = await supabase.rpc("excluir_usuario_admin" as never, {
      p_email: email.toLowerCase(),
    } as never);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const service = createSupabaseServiceClient({
    email: caller.email,
    origem: "usuarios/excluir",
  });

  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  const target = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (target) {
    const { error: delErr } = await service.auth.admin.deleteUser(target.id);
    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }
  }

  const q = service.from("usuarios").delete();
  const { error: profErr } = id_usuario
    ? await q.eq("id_usuario", id_usuario)
    : await q.eq("email", email.toLowerCase());
  if (profErr) {
    return NextResponse.json(
      { ok: false, error: `Identidade removida, mas falhou ao apagar o perfil: ${profErr.message}` },
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
