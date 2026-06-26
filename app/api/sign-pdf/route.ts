import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const forge: any = require("node-forge");
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/client";
import type { Usuario } from "@/lib/supabase/types";
import { assinarPdfPades } from "@/lib/pdf/assinar-pdf-pades";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Lê o FormData antes de qualquer outra operação
  let pdfFile: File | null = null;
  let password: string | null = null;
  let signatoryEmail: string | null = null;
  let tabelaNome: string | null = null;
  let docId: string | null = null;

  try {
    const formData = await req.formData();
    pdfFile = formData.get("pdf") as File | null;
    password = formData.get("password") as string | null;
    signatoryEmail = (formData.get("signatoryEmail") as string | null) || null;
    tabelaNome = (formData.get("tabelaNome") as string | null) || null;
    docId = (formData.get("docId") as string | null) || null;
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  if (!pdfFile || !password) {
    return NextResponse.json(
      { error: "PDF e senha são obrigatórios" },
      { status: 400 }
    );
  }

  // SEC-02: apenas Admin pode assinar em nome de outro profissional
  if (signatoryEmail && signatoryEmail !== user.email) {
    const { data: rawPerfil } = await supabase
      .from("usuarios")
      .select("perfil")
      .eq("email", user.email)
      .single();
    const perfilLogado = rawPerfil as { perfil: string } | null;
    if (perfilLogado?.perfil !== "Admin") {
      return NextResponse.json(
        { error: "Sem permissão para assinar em nome de outro profissional." },
        { status: 403 }
      );
    }
  }

  // Carrega o perfil do signatário: usa o email solicitado (se informado) ou o usuário logado
  const emailSignatario = signatoryEmail || user.email;
  const { data: rawUsuario } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", emailSignatario)
    .single();

  const usuario = rawUsuario as Usuario | null;

  if (!usuario?.certificado_pfx_path) {
    return NextResponse.json(
      { error: "Certificado A1 não cadastrado para o profissional selecionado." },
      { status: 400 }
    );
  }

  if (pdfFile.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "PDF muito grande (máx. 50 MB)" }, { status: 400 });
  }

  // Baixa o certificado .pfx do bucket privado via SERVICE_ROLE (o bucket é
  // travado para acesso direto do cliente; só o servidor, após validar
  // auth + permissão acima, pode ler o .pfx).
  const serviceClient = createSupabaseServiceClient();
  const { data: certBlob, error: certError } = await serviceClient.storage
    .from("certificados")
    .download(usuario.certificado_pfx_path);

  if (certError || !certBlob) {
    return NextResponse.json(
      { error: "Falha ao carregar certificado do servidor. Tente novamente." },
      { status: 500 }
    );
  }

  const p12Buffer = Buffer.from(await certBlob.arrayBuffer());

  // Valida senha e expiração do .pfx via node-forge antes de tentar assinar.
  // Evita gerar PDF com assinatura inválida sem avisar o usuário.
  try {
    const p12Asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(p12Buffer.toString("binary"))
    );
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

    // Extrai o certificado folha (leaf) e verifica validade temporal
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const bags = certBags[forge.pki.oids.certBag] ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leafBag = bags.find((b: any) => b.cert) ?? bags[0];
    if (leafBag?.cert) {
      const cert = leafBag.cert;
      const now = new Date();
      const notAfter: Date = cert.validity.notAfter;
      const notBefore: Date = cert.validity.notBefore;

      if (now > notAfter) {
        const venceu = notAfter.toLocaleDateString("pt-BR");
        return NextResponse.json(
          {
            error: `Certificado A1 vencido em ${venceu}. Renove junto à Autoridade Certificadora que emitiu o certificado e faça o upload do novo arquivo .pfx no seu perfil.`,
          },
          { status: 400 }
        );
      }

      if (now < notBefore) {
        const inicio = notBefore.toLocaleDateString("pt-BR");
        return NextResponse.json(
          {
            error: `Certificado A1 ainda não está ativo (válido a partir de ${inicio}). Verifique o arquivo .pfx.`,
          },
          { status: 400 }
        );
      }
    }
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

    let pdfAssinado: Buffer;
    try {
      const assinarOpts = {
        pfxBuffer: p12Buffer,
        passphrase: password,
        signatoryName: usuario.nome ?? usuario.email ?? "",
        signatoryEmail: usuario.email ?? "",
        reason: "Assinatura digital ICP-Brasil A1",
        location: "Brasil",
      };
      // Todos os documentos usam o signer PAdES ICP-Brasil (conformidade ITI,
      // validado no validar.iti.gov.br). O signer antigo (assinar-pdf.ts) fica
      // como referência/rollback, mas não é mais chamado.
      pdfAssinado = await assinarPdfPades(pdfBuffer, assinarOpts);
    } catch {
      return NextResponse.json(
        { error: "Falha ao processar o PDF. Recarregue a página e tente novamente." },
        { status: 400 }
      );
    }

    // Se tabelaNome + docId fornecidos: salva no Storage e registra no banco
    if (tabelaNome && docId) {
      const pdfPath = `${tabelaNome}/${docId}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("pdfs-assinados")
        .upload(pdfPath, new Uint8Array(pdfAssinado), {
          contentType: "application/pdf",
          // Sem cache: o mesmo path é sobrescrito a cada (re)assinatura; com o
          // padrão (3600s) o navegador/CDN reentregava o PDF antigo após re-assinar.
          cacheControl: "0",
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: "PDF assinado mas falha ao salvar no servidor. Tente novamente." },
          { status: 500 }
        );
      }

      const { error: upsertError } = await supabase
        .from("pdfs_assinados")
        .upsert(
          {
            tabela: tabelaNome,
            doc_id: docId,
            pdf_path: pdfPath,
            assinado_em: new Date().toISOString(),
            assinado_por: emailSignatario,
          } as never,
          { onConflict: "tabela,doc_id" }
        );

      if (upsertError) {
        return NextResponse.json(
          { error: "PDF assinado e salvo, mas falha ao registrar no histórico. Entre em contato com o suporte." },
          { status: 500 }
        );
      }

      // E3: trilha de auditoria (fire-and-forget — nunca bloqueia a assinatura)
      try {
        await supabase.from("document_audit_logs").insert({
          modulo: tabelaNome,
          id_referencia: docId,
          acao: "assinou_pdf",
          descricao: "PDF assinado com certificado A1 ICP-Brasil",
          usuario_email: emailSignatario,
        } as never);
      } catch { /* ignora falha de auditoria */ }

      return NextResponse.json({ success: true });
    }

    // Legado: retorna PDF binário para download direto
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
