import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import type { Empresa, ConclusaoRapidaQuimico, CondicoesUsoQuimico } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { montarValoresEmpresa, formatarDataBR } from "@/lib/textos-padrao/variaveis";
import { montarSignatarioTecnico } from "@/lib/pdf/folha-assinatura-tecnico";
import { assinarCapitulos } from "@/lib/pdf/assinar-midia";

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
    const { data: rawAna, error: anaErr } = await supabase
      .from("analises_quimicos")
      .select("*")
      .eq("id_analise", id)
      .single();
    if (anaErr || !rawAna) {
      return NextResponse.json({ error: "Análise não encontrada" }, { status: 404 });
    }
    const ana = rawAna as Record<string, unknown>;

    const { data: rawCaps } = await supabase
      .from("textos_padrao")
      .select("*")
      .eq("modulo", "analise_quimicos")
      .order("ordem", { ascending: true });
    const capitulos = await assinarCapitulos(supabase, (rawCaps ?? []) as unknown as TextoPadraoCapitulo[]);

    let empresa: Empresa | null = null;
    if (ana.id_empresa) {
      const { data: rawEmp } = await supabase
        .from("empresas").select("*").eq("id_empresa", ana.id_empresa as string).single();
      empresa = (rawEmp as unknown as Empresa) ?? null;
    }

    const valores: Record<string, string> = {
      ...montarValoresEmpresa(empresa),
      titulo: (ana.titulo as string) ?? "",
      nome_quimico: (ana.nome_quimico as string) ?? "",
      numero_cas: (ana.numero_cas as string) ?? "",
      responsavel: (ana.usuario_nome as string) ?? "",
      carimbo: (ana.usuario_nome as string) ?? "",
      importado: formatarDataBR(ana.created_at as string | null),
    };

    const { data: rawUsuario } = await supabase
      .from("usuarios").select("nome").eq("email", user.email).single();
    const perfilLogado = rawUsuario as { nome: string | null } | null;

    valores.usuario_logado = perfilLogado?.nome ?? user.email ?? "";
    valores.tipo_relatorio = "Análise de Risco Químico";

    const { signatario, dataHoraAssinatura } = await montarSignatarioTecnico(supabase, {
      tabela: "analises_quimicos",
      docId: String(id),
      responsavelNome: ana.usuario_nome as string | null,
    });
    const signatarios: Signatario[] = [signatario];

    const folhaEmpresa = empresa
      ? { razaoSocial: empresa.nome_empresa, cnpj: empresa.cnpj ?? "" }
      : null;

    const shortId = String(id).replace(/-/g, "").slice(0, 8);
    const identificadorDocumento = `ANQ-${new Date().getFullYear()}-${shortId}`;

    const [{ default: React }, { renderToStaticMarkup }, { default: AnaliseQuimicosTemplate }] =
      await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("@/components/pdf/templates/AnaliseQuimicosTemplate"),
      ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(AnaliseQuimicosTemplate, {
        analise: {
          titulo: (ana.titulo as string) ?? "Análise de Agente Químico",
          nome_quimico: (ana.nome_quimico as string) ?? null,
          numero_cas: (ana.numero_cas as string) ?? null,
          formula_quimica: (ana.formula_quimica as string) ?? null,
          forma_fisica: (ana.forma_fisica as string) ?? null,
          concentracao: (ana.concentracao as string) ?? null,
          modo: (ana.modo as string) ?? "Manual",
          fonte_arquivo: (ana.fonte_arquivo as string) ?? null,
          condicoes_uso: (ana.condicoes_uso as CondicoesUsoQuimico) ?? null,
          conclusao_rapida: (ana.conclusao_rapida as ConclusaoRapidaQuimico) ?? null,
          usuario_nome: (ana.usuario_nome as string) ?? null,
        },
        empresa,
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
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Análise de Agente Químico</title>
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

    const pdfFinal = await aplicarAnexosNoPdf(supabase, "analise_quimicos", id, pdfBuffer);

    return new NextResponse(pdfFinal, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="analise-quimico-${shortId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/analise-quimicos] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
