import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { Empresa } from "@/lib/supabase/types";
import type { EpiColaborador, EpiEntrega, EpiEntregaItem } from "@/lib/epi/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    // A RLS garante que o usuário só lê entregas da(s) sua(s) empresa(s).
    const { data: rawEntrega, error } = await supabase
      .from("epi_entregas")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !rawEntrega) {
      return NextResponse.json({ error: "Entrega não encontrada" }, { status: 404 });
    }
    const entrega = rawEntrega as unknown as EpiEntrega;

    const { data: rawItens } = await supabase
      .from("epi_entregas_itens")
      .select("*")
      .eq("id_entrega", id)
      .order("criado_em", { ascending: true });
    const itens = (rawItens ?? []) as unknown as EpiEntregaItem[];

    let colaborador: EpiColaborador | null = null;
    if (entrega.id_colaborador) {
      const { data: rawColab } = await supabase
        .from("epi_colaboradores")
        .select("*")
        .eq("id", entrega.id_colaborador)
        .single();
      colaborador = (rawColab as unknown as EpiColaborador) ?? null;
    }

    let empresa: Empresa | null = null;
    if (entrega.empresa_id) {
      const { data: rawEmp } = await supabase
        .from("empresas")
        .select("*")
        .eq("id_empresa", entrega.empresa_id)
        .single();
      empresa = (rawEmp as unknown as Empresa) ?? null;
    }

    // Logo da empresa (configuracoes.chave='logo_url'); degrada se ausente.
    let logoUrl: string | null = null;
    const { data: rawLogo } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "logo_url")
      .maybeSingle();
    const valorLogo = (rawLogo as unknown as { valor?: unknown } | null)?.valor;
    if (typeof valorLogo === "string" && valorLogo.trim()) logoUrl = valorLogo;

    const shortId = String(id).replace(/-/g, "").slice(0, 8).toUpperCase();
    const identificador = `ENT-${new Date().getFullYear()}-${shortId}`;

    const [{ default: React }, { renderToStaticMarkup }, { default: Template }] =
      await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("@/components/pdf/templates/EpiFichaEntregaTemplate"),
      ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(Template, {
        entrega,
        itens,
        colaborador,
        empresa,
        logoUrl,
        identificador,
      }),
    );

    const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const headStyle = styleMatch ? styleMatch[1] : "";
    const bodyWithoutStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Ficha de Entrega de EPI</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;">
${bodyWithoutStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdfBuffer = await gerarPdf(fullHtml, {
      margens: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="ficha-entrega-epi-${shortId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/epi-entrega] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
