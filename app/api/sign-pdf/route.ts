import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PDFDocument } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { P12Signer } from "@signpdf/signer-p12";
import signpdf from "@signpdf/signpdf";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const forge: any = require("node-forge");
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
      { error: "Falha ao carregar certificado do servidor. Tente novamente." },
      { status: 500 }
    );
  }

  const p12Buffer = Buffer.from(await certBlob.arrayBuffer());

  // Valida a senha do .pfx antecipadamente via node-forge
  // Evita que um erro de senha seja mascarado como erro de PDF
  try {
    const p12Asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(p12Buffer.toString("binary"))
    );
    forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
  } catch (pfxErr) {
    const pfxMsg = (pfxErr instanceof Error ? pfxErr.message : String(pfxErr)).toLowerCase();
    if (
      pfxMsg.includes("mac") ||
      pfxMsg.includes("invalid password") ||
      pfxMsg.includes("verify") ||
      pfxMsg.includes("password")
    ) {
      return NextResponse.json(
        {
          error:
            "Senha incorreta. Informe a senha definida ao exportar o certificado A1 (.pfx) junto à Autoridade Certificadora.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error:
          "Certificado inválido ou corrompido. Faça o upload do arquivo .pfx novamente no seu perfil.",
      },
      { status: 400 }
    );
  }

  try {
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    // Carrega o PDF gerado pelo cliente
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    } catch {
      return NextResponse.json(
        { error: "Falha ao processar o PDF. Recarregue a página e tente novamente." },
        { status: 400 }
      );
    }

    // signatureLength: 65536 (64 KB) — cobre certificados ICP-Brasil com cadeia completa
    // Raiz AC + AC Política + AC Emissora + leaf cert + OCSP pode chegar a ~50 KB
    pdflibAddPlaceholder({
      pdfDoc,
      reason: "Assinatura digital ICP-Brasil A1",
      name: usuario.nome ?? usuario.email ?? "",
      location: "Brasil",
      contactInfo: usuario.email ?? "",
      signatureLength: 65536,
    });

    const pdfComPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

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
    const msgL = msg.toLowerCase();
    if (msgL.includes("byterange") || msgL.includes("signature length") || msgL.includes("exceeds")) {
      return NextResponse.json(
        { error: "Espaço de assinatura excedido. Entre em contato com o suporte." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: `Erro ao assinar: ${msg}` }, { status: 400 });
  }
}
