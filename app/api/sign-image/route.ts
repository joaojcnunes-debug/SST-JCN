import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Assinatura ELETRÔNICA POR IMAGEM (carimbo da imagem de assinatura cadastrada
 * no perfil do profissional). Diferente da A1, NÃO aplica assinatura
 * criptográfica — apenas registra a assinatura e salva o PDF com a imagem
 * carimbada na folha de assinaturas.
 *
 * Dois modos:
 *  - JSON  { signatoryEmail, tabelaNome, docId, apiPdfUrl? }
 *      Registra a assinatura (pdfs_assinados.tipo_assinatura='imagem'). Se
 *      `apiPdfUrl` for informado (laudos com rota Puppeteer), regenera o PDF
 *      server-side — já com a imagem na folha — e salva no Storage. Caso
 *      contrário responde { needsClientSave: true } para o cliente capturar a
 *      tela e enviar no modo FormData.
 *  - FormData { pdf, tabelaNome, docId }
 *      Salva o PDF capturado pelo cliente (laudos por captura de tela). O
 *      registro já deve ter sido criado pela chamada JSON anterior.
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

  const contentType = req.headers.get("content-type") ?? "";

  // ── Modo FormData: salvar PDF capturado no cliente ──────────────────────────
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const pdfFile = form.get("pdf") as File | null;
    const tabelaNome = (form.get("tabelaNome") as string | null) || null;
    const docId = (form.get("docId") as string | null) || null;

    if (!pdfFile || !tabelaNome || !docId) {
      return NextResponse.json(
        { error: "PDF, tabela e documento são obrigatórios" },
        { status: 400 },
      );
    }
    if (pdfFile.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "PDF muito grande (máx. 50 MB)" }, { status: 400 });
    }

    const bytes = new Uint8Array(await pdfFile.arrayBuffer());
    const erro = await salvarPdf(supabase, tabelaNome, docId, bytes);
    if (erro) return NextResponse.json({ error: erro }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── Modo JSON: registrar assinatura (+ regenerar se houver apiPdfUrl) ────────
  let body: {
    signatoryEmail?: string;
    tabelaNome?: string;
    docId?: string;
    apiPdfUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const tabelaNome = body.tabelaNome || null;
  const docId = body.docId || null;
  const signatoryEmail = body.signatoryEmail || user.email;

  if (!tabelaNome || !docId) {
    return NextResponse.json(
      { error: "Tabela e documento são obrigatórios" },
      { status: 400 },
    );
  }

  // SEC: apenas Admin pode assinar em nome de outro profissional.
  if (signatoryEmail !== user.email) {
    const { data: rawPerfil } = await supabase
      .from("usuarios").select("perfil").eq("email", user.email).single();
    const perfilLogado = rawPerfil as { perfil: string } | null;
    if (perfilLogado?.perfil !== "Admin") {
      return NextResponse.json(
        { error: "Sem permissão para assinar em nome de outro profissional." },
        { status: 403 },
      );
    }
  }

  // O profissional precisa ter imagem de assinatura cadastrada.
  const { data: rawSigner } = await supabase
    .from("usuarios").select("nome, assinatura_url").eq("email", signatoryEmail).single();
  const signer = rawSigner as { nome: string | null; assinatura_url: string | null } | null;
  if (!signer?.assinatura_url) {
    return NextResponse.json(
      { error: "O profissional selecionado não tem imagem de assinatura cadastrada no perfil." },
      { status: 400 },
    );
  }

  // Registra a assinatura por imagem (uma OU outra — sobrescreve A1 anterior).
  const { error: upsertError } = await supabase
    .from("pdfs_assinados")
    .upsert(
      {
        tabela: tabelaNome,
        doc_id: docId,
        pdf_path: `${tabelaNome}/${docId}.pdf`,
        assinado_em: new Date().toISOString(),
        assinado_por: signatoryEmail,
        tipo_assinatura: "imagem",
      } as never,
      { onConflict: "tabela,doc_id" },
    );
  if (upsertError) {
    return NextResponse.json(
      { error: "Falha ao registrar a assinatura. Tente novamente." },
      { status: 500 },
    );
  }

  // Auditoria (fire-and-forget).
  try {
    await supabase.from("document_audit_logs").insert({
      modulo: tabelaNome,
      id_referencia: docId,
      acao: "assinou_pdf_imagem",
      descricao: "PDF assinado eletronicamente por imagem de assinatura",
      usuario_email: signatoryEmail,
    } as never);
  } catch { /* ignora */ }

  // Se há rota de geração (Puppeteer), regenera server-side já com a imagem.
  if (body.apiPdfUrl) {
    try {
      const origin = req.nextUrl.origin;
      const url = body.apiPdfUrl.startsWith("http")
        ? body.apiPdfUrl
        : `${origin}${body.apiPdfUrl}`;
      const res = await fetch(url, {
        headers: { cookie: req.headers.get("cookie") ?? "" },
      });
      if (!res.ok) throw new Error("Falha ao gerar o PDF");
      const bytes = new Uint8Array(await res.arrayBuffer());
      const erro = await salvarPdf(supabase, tabelaNome, docId, bytes);
      if (erro) {
        return NextResponse.json(
          { error: "Assinatura registrada, mas falha ao salvar o PDF." },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json(
        { error: "Assinatura registrada, mas falha ao gerar o PDF. Tente novamente." },
        { status: 500 },
      );
    }
  }

  // Sem rota de geração → o cliente captura a tela e envia (modo FormData).
  return NextResponse.json({ success: true, needsClientSave: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function salvarPdf(supabase: any, tabelaNome: string, docId: string, bytes: Uint8Array): Promise<string | null> {
  const pdfPath = `${tabelaNome}/${docId}.pdf`;
  const { error } = await supabase.storage
    .from("pdfs-assinados")
    .upload(pdfPath, bytes, { contentType: "application/pdf", upsert: true });
  return error ? "Falha ao salvar o PDF no servidor." : null;
}
