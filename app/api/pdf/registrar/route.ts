import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Registra no histórico um PDF recém-gerado pelo navegador: sobe o arquivo para
 * o bucket privado `pdfs-gerados` e grava a linha em `pdfs_gerados` com o status
 * padrão (`gerado`).
 *
 * Por que server-side: `pdfs-gerados` é PRIVADO e a credencial que vai no bundle
 * do browser tem escopo `fotos`/`anexos` — o upload direto do cliente devolve
 * AccessDenied do MinIO. É o mesmo motivo (e o mesmo caminho) de
 * /api/pdf/congelar, que grava no mesmo bucket.
 *
 * Histórico: até o cutover de 2026-06-26 o hook `useRegistrarPdf` subia direto
 * do navegador e funcionava, porque o storage de então era o Supabase. Depois do
 * cutover o upload passou a falhar em 100% das vezes — e ninguém viu, porque o
 * `onError` do hook é deliberadamente silencioso para não bloquear o download do
 * usuário. Medido em 2026-08-27: a tabela tem 267 linhas `gerado`, a última de
 * 2026-06-26, enquanto `congelado` (que já era server-side) seguiu gravando até
 * agosto.
 */

// Teto por chamada. Mesmo valor de /api/pdf/congelar, que recebe o mesmo tipo de
// arquivo pelo mesmo caminho.
const MAX_PDF_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const pdf = form.get("pdf") as File | null;
  const modulo = (form.get("modulo") as string | null)?.trim() || null;
  const str = (k: string) => {
    const v = (form.get(k) as string | null)?.trim();
    return v ? v : null;
  };

  if (!pdf || !modulo) {
    return NextResponse.json({ error: "PDF e módulo são obrigatórios" }, { status: 400 });
  }
  if (pdf.size === 0) {
    return NextResponse.json({ error: "PDF vazio" }, { status: 400 });
  }
  if (pdf.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF muito grande (máx. 50 MB)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await pdf.arrayBuffer());
    const hash = createHash("sha256").update(buffer).digest("hex");

    // Mesmo formato de nome que o hook usava antes de virar rota, para o
    // historico anterior e o novo continuarem legiveis do mesmo jeito.
    const nomeArquivo = `${modulo}-${Date.now()}-${hash.slice(0, 8)}.pdf`;
    const storagePath = `${modulo}/${nomeArquivo}`;

    const { error: upErr } = await supabase.storage
      .from("pdfs-gerados")
      .upload(storagePath, new Uint8Array(buffer), {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false,
      });
    if (upErr) {
      return NextResponse.json(
        { error: "Falha ao salvar o PDF gerado no servidor." },
        { status: 500 }
      );
    }

    // usuario_email vem da SESSAO, nao do corpo: o chamador (BotaoGerarPdf) nunca
    // preencheu esse campo, entao as 267 linhas antigas tem null ali. Com a rota,
    // quem gerou passa a ficar registrado.
    const { data, error: insErr } = await supabase
      .from("pdfs_gerados")
      .insert({
        modulo,
        tipo_documento: str("tipoDocumento"),
        id_relatorio: str("idRelatorio"),
        empresa_id: str("empresaId"),
        empresa_nome: str("empresaNome"),
        empresa_cnpj: str("empresaCnpj"),
        setor: str("setor"),
        responsavel_tecnico: str("responsavelTecnico"),
        usuario_email: user.email,
        pdf_storage_path: storagePath,
        pdf_url: null,
        hash_sha256: hash,
      } as never)
      .select("id")
      .single();
    if (insErr || !data) {
      return NextResponse.json(
        { error: "PDF salvo, mas falha ao registrar no histórico." },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[pdf/registrar] Erro:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao registrar" },
      { status: 500 }
    );
  }
}
