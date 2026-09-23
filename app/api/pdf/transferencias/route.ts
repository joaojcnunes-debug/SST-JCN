import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { TransferenciaPdf } from "@/components/pdf/templates/TransferenciasTemplate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Nenhuma transferência selecionada" }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("transferencias")
      .select("*")
      .in("id_transferencia", ids)
      .order("data_hora", { ascending: false });
    if (error) throw error;

    const transferencias = (data ?? []) as TransferenciaPdf[];
    if (transferencias.length === 0) {
      return NextResponse.json({ error: "Transferências não encontradas" }, { status: 404 });
    }

    const agora = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const geradoEm = `${p(agora.getDate())}/${p(agora.getMonth() + 1)}/${agora.getFullYear()} ${p(agora.getHours())}:${p(agora.getMinutes())}`;

    const [{ default: React }, { renderToStaticMarkup }, { default: TransferenciasTemplate }] =
      await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("@/components/pdf/templates/TransferenciasTemplate"),
      ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(TransferenciasTemplate, { transferencias, geradoEm }),
    );

    const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const headStyle = styleMatch ? styleMatch[1] : "";
    const bodyWithoutStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Registro de Transferências</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;">
${bodyWithoutStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdfBuffer = await gerarPdf(fullHtml, {
      margens: { top: "18mm", bottom: "16mm", left: "15mm", right: "15mm" },
      numeroPaginas: true,
    });

    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="transferencias-${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/transferencias] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
