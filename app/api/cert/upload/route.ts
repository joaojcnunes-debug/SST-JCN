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

  const service = createSupabaseServiceClient({ email: user.email, origem: "cert/upload" });

  // O arquivo anterior NÃO sai aqui (0.3.229): apagar antes do Salvar deixava a conta
  // apontando para um arquivo inexistente se a pessoa cancelasse. A tela chama o DELETE
  // abaixo depois de gravar o caminho novo.
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

/**
 * Apaga um .pfx antigo do bucket `certificados` depois que a conta já foi salva com outro
 * caminho (ou sem certificado). Só Admin; e só se nenhuma conta ainda apontar para o arquivo.
 */
export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { data: rawPerfil } = await supabase
    .from("usuarios")
    .select("perfil")
    .eq("email", user.email)
    .single();
  if ((rawPerfil as { perfil: string } | null)?.perfil !== "Admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { path?: unknown } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  if (!/^pfx_[\w.-]+\.pfx$/.test(path)) {
    return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
  }

  const service = createSupabaseServiceClient({ email: user.email, origem: "cert/upload" });
  const { count } = await service
    .from("usuarios")
    .select("id_usuario", { count: "exact", head: true })
    .eq("certificado_pfx_path", path);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: true, mantido: true });
  }
  await service.storage.from("certificados").remove([path]);
  return NextResponse.json({ ok: true });
}
