import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * Exclusão de usuário (admin). VERSÃO DO JCN — ver a nota em
 * `../credenciais/route.ts`.
 *
 * Remove a identidade no Auth E o perfil em public.usuarios. Deixar só um dos
 * dois produz os dois defeitos clássicos: identidade órfã que loga e não é
 * ninguém, ou perfil fantasma que aparece na lista e não entra.
 */
export async function POST(req: NextRequest) {
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
