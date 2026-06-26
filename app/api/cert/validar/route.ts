import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const forge: any = require("node-forge");
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/client";
import type { Usuario } from "@/lib/supabase/types";

/**
 * Lê o .pfx do bucket (via service_role), valida a senha e extrai a validade
 * (notAfter) e o titular (CN) do certificado A1, gravando em usuarios. A senha
 * NUNCA é persistida. Não assina nada — é só verificação.
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

  let password: string | null = null;
  let signatoryEmail: string | null = null;
  try {
    const body = await req.json();
    password = (body.password as string | null) || null;
    signatoryEmail = (body.signatoryEmail as string | null) || null;
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "Senha do certificado é obrigatória" }, { status: 400 });
  }

  // SEC: só Admin pode verificar o certificado de outro profissional
  if (signatoryEmail && signatoryEmail !== user.email) {
    const { data: rawPerfil } = await supabase
      .from("usuarios")
      .select("perfil")
      .eq("email", user.email)
      .single();
    if ((rawPerfil as { perfil: string } | null)?.perfil !== "Admin") {
      return NextResponse.json(
        { error: "Sem permissão para verificar o certificado de outro profissional." },
        { status: 403 }
      );
    }
  }

  const emailAlvo = signatoryEmail || user.email;
  const { data: rawUsuario } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", emailAlvo)
    .single();
  const usuario = rawUsuario as Usuario | null;
  if (!usuario?.certificado_pfx_path) {
    return NextResponse.json(
      { error: "Nenhum certificado A1 cadastrado para este profissional." },
      { status: 400 }
    );
  }

  const serviceClient = createSupabaseServiceClient();
  const { data: certBlob, error: certError } = await serviceClient.storage
    .from("certificados")
    .download(usuario.certificado_pfx_path);
  if (certError || !certBlob) {
    return NextResponse.json(
      { error: "Falha ao carregar o certificado do servidor." },
      { status: 500 }
    );
  }

  const p12Buffer = Buffer.from(await certBlob.arrayBuffer());
  try {
    const p12Asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(p12Buffer.toString("binary"))
    );
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const bags = certBags[forge.pki.oids.certBag] ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leafBag = bags.find((b: any) => b.cert) ?? bags[0];
    if (!leafBag?.cert) {
      return NextResponse.json({ error: "Certificado inválido (sem cert folha)." }, { status: 400 });
    }
    const cert = leafBag.cert;
    const notAfter: Date = cert.validity.notAfter;
    const notBefore: Date = cert.validity.notBefore;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cnField = cert.subject.getField?.("CN") as { value?: string } | undefined;
    const titular = cnField?.value ?? null;

    // Grava validade + titular (service_role; a senha não é salva)
    await serviceClient
      .from("usuarios")
      .update({
        certificado_validade: notAfter.toISOString(),
        certificado_titular: titular,
      } as never)
      .eq("id_usuario", usuario.id_usuario);

    return NextResponse.json({
      ok: true,
      validade: notAfter.toISOString(),
      notBefore: notBefore.toISOString(),
      titular,
      vencido: new Date() > notAfter,
    });
  } catch (pfxErr) {
    const msg = (pfxErr instanceof Error ? pfxErr.message : String(pfxErr)).toLowerCase();
    if (
      msg.includes("mac") ||
      msg.includes("invalid password") ||
      msg.includes("verify") ||
      msg.includes("password")
    ) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Certificado inválido ou corrompido." },
      { status: 400 }
    );
  }
}
