import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/client";
import { statusDaConta } from "@/lib/gestao/google/conta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Situação da conta Google DO PRÓPRIO usuário (cartão "Google Agenda" do Meu Espaço). Sessão
 * obrigatória (401 sem). Só consulta o e-mail da sessão — ninguém consulta a conta de outro (a RPC
 * gestao_google_status fica fechada ao service_role pelo mesmo motivo, v209). Nunca devolve token.
 */
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const sb = createSupabaseServiceClient({ email: user.email, origem: "google-agenda/status" });
  return NextResponse.json(await statusDaConta(sb, user.email));
}
