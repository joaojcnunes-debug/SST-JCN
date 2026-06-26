import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import type { ConformidadeItemLocal } from "@/components/pdf/templates/ConformidadeTemplate";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { montarValoresEmpresa, formatarDataBR } from "@/lib/textos-padrao/variaveis";
import { montarSignatarioTecnico } from "@/lib/pdf/folha-assinatura-tecnico";
import { assinarMidiaPdf, assinarCapitulos } from "@/lib/pdf/assinar-midia";

import { aplicarAnexosNoPdf } from "@/lib/anexos/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { data: rawRel, error: relErr } = await supabase
      .from("relatorios_conformidade")
      .select("*")
      .eq("id_relatorio", id)
      .single();
    if (relErr || !rawRel) {
      return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
    }
    const rel = rawRel as Record<string, unknown>;

    const { data: rawItens } = await supabase
      .from("relatorios_conformidade_itens")
      .select("*")
      .eq("id_relatorio", id)
      .order("ordem", { ascending: true });
    const itens: ConformidadeItemLocal[] = ((rawItens ?? []) as Record<string, unknown>[]).map((i) => ({
      id_item: String(i.id_item),
      item_codigo: (i.item_codigo as string) ?? "",
      item_titulo: (i.item_titulo as string) ?? "",
      item_descricao: (i.item_descricao as string) ?? null,
      item_nr_origem: (i.item_nr_origem as string) ?? null,
      situacao: (i.situacao as string) ?? "PENDENTE",
      observacao: (i.observacao as string) ?? null,
      foto_urls: Array.isArray(i.foto_urls) ? (i.foto_urls as string[]) : [],
    }));

    // Fotos → URLs assinadas p/ o Puppeteer (fallback p/ original em falha).
    await Promise.all(
      itens.map(async (it) => {
        it.foto_urls = await assinarMidiaPdf(supabase, it.foto_urls, "fotos");
      }),
    );

    const { data: rawCaps } = await supabase
      .from("textos_padrao")
      .select("*")
      .eq("modulo", "conformidade")
      .order("ordem", { ascending: true });
    const capitulos = await assinarCapitulos(supabase, (rawCaps ?? []) as unknown as TextoPadraoCapitulo[]);

    let empresa: Empresa | null = null;
    if (rel.id_empresa) {
      const { data: rawEmp } = await supabase
        .from("empresas").select("*").eq("id_empresa", rel.id_empresa as string).single();
      empresa = (rawEmp as unknown as Empresa) ?? null;
    }

    const valores: Record<string, string> = {
      ...montarValoresEmpresa(empresa),
      responsavel: (rel.responsavel as string) ?? "",
      responsavel_empresa: (rel.responsavel_empresa as string) ?? "",
      cidade: (rel.cidade as string) ?? "",
      nr_codigo: (rel.nr_codigo as string) ?? "",
      nr_titulo: (rel.nr_titulo as string) ?? "",
      setor: (rel.setor as string) ?? "",
      data_inspecao: formatarDataBR(rel.data_inspecao as string | null),
      carimbo: (rel.responsavel as string) ?? "",
      importado: formatarDataBR(rel.created_at as string | null),
    };

    const { data: rawUsuario } = await supabase
      .from("usuarios").select("nome").eq("email", user.email).single();
    const perfilLogado = rawUsuario as { nome: string | null } | null;

    valores.usuario_logado = perfilLogado?.nome ?? user.email ?? "";
    valores.tipo_relatorio = "Relatório de Conformidade";

    const { signatario, dataHoraAssinatura } = await montarSignatarioTecnico(supabase, {
      tabela: "relatorios_conformidade",
      docId: id,
      responsavelNome: rel.responsavel as string | null,
    });
    const signatarios: Signatario[] = [signatario];

    const folhaEmpresa = empresa
      ? { razaoSocial: empresa.nome_empresa, cnpj: empresa.cnpj ?? "" }
      : null;

    const shortId = id.replace(/-/g, "").slice(0, 8);
    const identificadorDocumento = `CONF-${new Date().getFullYear()}-${shortId}`;

    const [{ default: React }, { renderToStaticMarkup }, { default: ConformidadeTemplate }] =
      await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("@/components/pdf/templates/ConformidadeTemplate"),
      ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(ConformidadeTemplate, {
        relatorio: {
          nr_codigo: (rel.nr_codigo as string) ?? null,
          nr_titulo: (rel.nr_titulo as string) ?? null,
          setor: (rel.setor as string) ?? null,
          responsavel: (rel.responsavel as string) ?? null,
          responsavel_empresa: (rel.responsavel_empresa as string) ?? null,
          cidade: (rel.cidade as string) ?? null,
          data_inspecao: (rel.data_inspecao as string) ?? null,
          observacoes_gerais: (rel.observacoes_gerais as string) ?? null,
        },
        empresa,
        itens,
        capitulos,
        valores,
        signatarios,
        folhaEmpresa,
        dataHoraAssinatura,
        identificadorDocumento,
      }),
    );

    const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const headStyle = styleMatch ? styleMatch[1] : "";
    const bodyWithoutStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Laudo Conformidade</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;">
${bodyWithoutStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdfBuffer = await gerarPdf(fullHtml, {
      margens: { top: "20mm", bottom: "20mm", left: "18mm", right: "15mm" },
      // Numeração só após o sumário (capa/identificação/sumário ficam sem número).
      numeroPaginasAposSeletor: '[data-slug="sumario"]',
      capaFullBleed: true,
    });

    const pdfFinal = await aplicarAnexosNoPdf(supabase, "conformidade", id, pdfBuffer);

    return new NextResponse(pdfFinal, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="laudo-conformidade-${shortId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/conformidade] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
