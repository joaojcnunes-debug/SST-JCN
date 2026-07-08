import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/client";

export const runtime = "nodejs";

/**
 * Recebe o .pfx/.p12 do técnico e grava no bucket PRIVADO `certificados` usando o
 * service_role (o servidor tem acesso; a credencial do navegador só escreve em `fotos`,
 * por isso o upload direto do cliente dava 403 no self-host). O arquivo nunca fica público.
 * Só Admin pode enviar. Devolve o caminho salvo (gravado depois em usuarios.certificado_pfx_path).
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // SEC: só Admin envia certificado (a tela de usuários é administrativa).
  const { data: rawPerfil } = await supabase
    .from("usuarios")
    .select("perfil")
    .eq("email", user.email)
    .single();
  if ((rawPerfil as { perfil: string } | null)?.perfil !== "Admin") {
    return NextResponse.json({ error: "Sem permissão para enviar certificado." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const file = form.get("file");
  const oldPath = (form.get("oldPath") as string | null) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 5 MB." }, { status: 400 });
  }
  const nome = file.name.toLowerCase();
  if (!nome.endsWith(".pfx") && !nome.endsWith(".p12")) {
    return NextResponse.json({ error: "Envie um arquivo .pfx ou .p12." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();

  // Remove o certificado anterior, se houver (também no servidor — o cliente daria 403).
  if (oldPath) {
    await service.storage.from("certificados").remove([oldPath]);
  }

  const path = `pfx_${Date.now()}_${Math.random().toString(36).slice(2)}.pfx`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await service.storage
    .from("certificados")
    .upload(path, buffer, { contentType: "application/x-pkcs12", upsert: false });
  if (error) {
    return NextResponse.json(
      { error: "Falha ao salvar o certificado no servidor." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, path });
}
