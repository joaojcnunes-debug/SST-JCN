import { NextRequest, NextResponse } from "next/server";
import { abrirSessao } from "@/lib/pdf/psicossocial-empresa";
import { LOGO_JCN_DATA_URI } from "@/lib/pdf/logo-jcn";
import { MARCAS } from "@/lib/orcamentos/marcas";
import { ROTULO_MODELO, rotuloNumero, type Orcamento } from "@/lib/orcamentos/modelo";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PDF de um orçamento do Comercial (0.3.339, banco v375). Relido no servidor com o client de quem pede (a RLS
 * comercial_pode_usar decide); o PDF sai no padrão visual da marca escolhida. A4, páginas montadas no template.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await ctx.params).id);
  const sessao = await abrirSessao();
  if ("recusa" in sessao) return sessao.recusa;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = sessao.supabase as any;

  try {
    const { data, error } = await sb.from("comercial_orcamentos").select("*").eq("id_orcamento", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
    const o = { ...(data as Orcamento), total: Number((data as Orcamento).total) };
    const marca = MARCAS[o.marca] ?? MARCAS.jcn;
    const logo = o.marca === "jcn" ? LOGO_JCN_DATA_URI : null;

    const [{ default: React }, { renderToStaticMarkup }, { OrcamentoTemplate, estiloOrcamento }] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@/components/pdf/templates/OrcamentoTemplate"),
    ]);
    const corpo = renderToStaticMarkup(React.createElement(OrcamentoTemplate, { o, marca, logo }));
    const titulo = `Orçamento ${rotuloNumero(o)} — ${o.cliente_nome}`.replace(/[<>&]/g, "");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><title>${titulo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${estiloOrcamento(marca)}</style></head><body>${corpo}</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdf = await gerarPdf(html, { margens: { top: "0", bottom: "0", left: "0", right: "0" } });
    const nome = `Orcamento-${String(o.numero).padStart(4, "0")}${o.versao > 1 ? `-v${o.versao}` : ""}-${ROTULO_MODELO[o.modelo]}-${o.cliente_nome}`
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}.pdf"` },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao gerar o PDF" }, { status: 500 });
  }
}
