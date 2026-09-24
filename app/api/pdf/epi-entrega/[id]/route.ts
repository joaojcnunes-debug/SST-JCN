import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    // entrega (RLS aplica)
    const { data: entrega, error: eErr } = await supabase
      .from("epi_entregas").select("*").eq("id", id).single();
    if (eErr || !entrega) return NextResponse.json({ error: "Entrega não encontrada" }, { status: 404 });
    const ent = entrega as Record<string, unknown>;

    const [{ data: itens }, { data: colab }, { data: empresa }, { data: logoRow }, { data: assin }] = await Promise.all([
      supabase.from("epi_entregas_itens").select("*").eq("id_entrega", id),
      supabase.from("epi_colaboradores").select("*").eq("id", ent.id_colaborador as string).maybeSingle(),
      supabase.from("empresas").select("nome_empresa, cnpj").eq("id_empresa", ent.empresa_id as string).maybeSingle(),
      supabase.from("configuracoes").select("valor").eq("chave", "logo_url").maybeSingle(),
      supabase.from("epi_entrega_assinaturas").select("id, assinante_nome, assinatura_png, assinado_em, metodo").eq("id_entrega", id).order("assinado_em", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const c = (colab ?? {}) as Record<string, unknown>;
    const emp = (empresa ?? {}) as Record<string, unknown>;
    const shortId = String(id).replace(/-/g, "").slice(0, 8).toUpperCase();
    const identificador = `EPI-${new Date().getFullYear()}-${shortId}`;

    const [{ default: React }, { renderToStaticMarkup }, { default: Template }] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@/components/pdf/templates/EpiFichaEntregaTemplate"),
    ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(Template, {
        empresa: { nome: (emp.nome_empresa as string) ?? "—", cnpj: (emp.cnpj as string) ?? null },
        colaborador: {
          nome: (c.nome as string) ?? "—", cpf: (c.cpf as string) ?? null,
          matricula: (c.matricula as string) ?? null, cargo: (c.cargo as string) ?? null, setor: (c.setor as string) ?? null,
        },
        entrega: {
          data_entrega: (ent.data_entrega as string) ?? "",
          responsavel_entrega: (ent.responsavel_entrega as string) ?? null,
          observacao: (ent.observacao as string) ?? null,
        },
        itens: (itens ?? []).map((it) => {
          const r = it as Record<string, unknown>;
          return { nome_epi: (r.nome_epi as string) ?? null, ca_numero: (r.ca_numero as string) ?? null, quantidade: Number(r.quantidade) || 0 };
        }),
        logoUrl: (logoRow as { valor?: string } | null)?.valor ?? null,
        identificador,
        assinatura: assin
          ? {
              nome: (assin as Record<string, unknown>).assinante_nome as string ?? null,
              assinatura_png: (assin as Record<string, unknown>).assinatura_png as string ?? null,
              assinado_em: (assin as Record<string, unknown>).assinado_em as string ?? null,
              metodo: (assin as Record<string, unknown>).metodo as string ?? null,
              codigo: (assin as Record<string, unknown>).id
                ? String((assin as Record<string, unknown>).id).replace(/-/g, "").slice(0, 12).toUpperCase()
                : null,
            }
          : null,
      }),
    );

    const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const headStyle = styleMatch ? styleMatch[1] : "";
    const bodyWithoutStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");
    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Ficha de Entrega de EPI</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Calibri,Arial,Helvetica,sans-serif;color:#111827;">
${bodyWithoutStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdfBuffer = await gerarPdf(fullHtml, {
      margens: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="ficha-epi-${shortId}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao gerar PDF" }, { status: 500 });
  }
}
