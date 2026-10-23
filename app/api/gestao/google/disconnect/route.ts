import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/client";
import { desconectarConta } from "@/lib/gestao/google/conta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Desconecta a conta Google DO PRÓPRIO usuário: apaga da agenda dele os eventos criados pelo painel,
 * revoga a autorização e remove a conta (ver desconectarConta). POST (muda estado) + sessão
 * obrigatória. O e-mail vem SÓ da sessão — não há parâmetro para desconectar outra pessoa.
 */
export async function POST() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const sb = createSupabaseServiceClient({ email: user.email, origem: "google-agenda/desconectar" });
  try {
    const r = await desconectarConta(sb, user.email);
    return NextResponse.json({ ok: true, ...r });
  } catch {
    // Mensagem neutra: o erro pode carregar dado da conta.
    return NextResponse.json({ error: "Não foi possível desconectar. Tente de novo." }, { status: 500 });
  }
}
