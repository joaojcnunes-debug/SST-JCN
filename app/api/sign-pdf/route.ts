import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PDFDocument } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { P12Signer } from "@signpdf/signer-p12";
import signpdf from "@signpdf/signpdf";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { Usuario } from "@/lib/supabase/types";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data: rawUsuario } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", user.email)
    .single();

  const usuario = rawUsuario as Usuario | null;

  if (!usuario?.certificado_pfx_path) {
    return NextResponse.json(
      { error: "Certificado A1 não cadastrado. Solicite ao administrador." },
      { status: 400 }
    );
  }

  let pdfFile: File | null = null;
  let password: string | null = null;

  try {
    const formData = await req.formData();
    pdfFile = formData.get("pdf") as File | null;
    password = formData.get("password") as string | null;
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  if (!pdfFile || !password) {
    return NextResponse.json(
      { error: "PDF e senha são obrigatórios" },
      { status: 400 }
    );
  }

  if (pdfFile.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "PDF muito grande (máx. 50 MB)" }, { status: 400 });
  }

  // Baixa o certificado .pfx do bucket privado
  const { data: certBlob, error: certError } = await supabase.storage
    .from("certificados")
    .download(usuario.certificado_pfx_path);

  if (certError || !certBlob) {
    return NextResponse.json(
      { error: "Falha ao carregar certificado do servidor" },
      { status: 500 }
    );
  }

  try {
    const p12Buffer = Buffer.from(await certBlob.arrayBuffer());
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    // Carrega o PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

    // Adiciona o placeholder de assinatura (modifica pdfDoc in-place)
    pdflibAddPlaceholder({
      pdfDoc,
      reason: "Assinatura digital ICP-Brasil A1",
      name: usuario.nome ?? usuario.email ?? "",
      location: "Brasil",
      contactInfo: usuario.email ?? "",
    });

    // Serializa o PDF com o placeholder
    const pdfComPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

    // Assina com o certificado A1
    const signer = new P12Signer(p12Buffer, { passphrase: password });
    const pdfAssinado = await signpdf.sign(pdfComPlaceholder, signer);

    return new NextResponse(new Uint8Array(pdfAssinado), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="relatorio-assinado.pdf"',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isSenhaErrada =
      msg.toLowerCase().includes("password") ||
      msg.toLowerCase().includes("mac verify") ||
      msg.toLowerCase().includes("passphrase");
    return NextResponse.json(
      {
        error: isSenhaErrada
          ? "Senha do certificado incorreta"
          : `Erro ao assinar: ${msg}`,
      },
      { status: 400 }
    );
  }
}
