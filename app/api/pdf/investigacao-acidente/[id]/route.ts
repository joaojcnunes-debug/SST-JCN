import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readFileSync } from "fs";
import { join } from "path";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import type { Empresa, InvestigacaoAcidente, MidiaArquivo, InvestigacaoAcao } from "@/lib/supabase/types";
import { montarSignatarioTecnico } from "@/lib/pdf/folha-assinatura-tecnico";
import type { AnexoParaMerge } from "@/lib/pdf/anexar";

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
    const { data: rawInv, error } = await supabase
      .from("investigacoes_acidente")
      .select("*")
      .eq("id_investigacao", id)
      .single();
    if (error || !rawInv) {
      return NextResponse.json({ error: "Investigação não encontrada" }, { status: 404 });
    }
    const inv = rawInv as unknown as InvestigacaoAcidente;

    let empresa: Empresa | null = null;
    if (inv.id_empresa) {
      const { data: rawEmp } = await supabase
        .from("empresas").select("*").eq("id_empresa", inv.id_empresa).single();
      empresa = (rawEmp as unknown as Empresa) ?? null;
    }

    // Plano de ação 5W2H (tabela investigacao_acoes) — entra no laudo.
    const { data: rawAcoes } = await supabase
      .from("investigacao_acoes")
      .select("*")
      .eq("id_investigacao", id)
      .order("ordem", { ascending: true });
    const acoes = (rawAcoes ?? []) as unknown as InvestigacaoAcao[];

    // assinado=1 (vindo do BotaoAssinarPdf) → renderiza o selo digital no PDF
    // que será assinado (o registro em pdfs_assinados só nasce após assinar).
    const forcar = req.nextUrl.searchParams.get("assinado") === "1";
    const { signatario, dataHoraAssinatura } = await montarSignatarioTecnico(supabase, {
      tabela: "investigacoes_acidente",
      docId: id,
      responsavelNome: inv.responsavel_tecnico,
      forcarAssinado: forcar,
    });
    const signatarios: Signatario[] = [signatario];
    const folhaEmpresa = empresa
      ? { razaoSocial: empresa.nome_empresa, cnpj: empresa.cnpj ?? "" }
      : null;

    const shortId = String(id).replace(/-/g, "").slice(0, 8);
    const identificadorDocumento = `INV-${new Date().getFullYear()}-${shortId}`;

    // Silhuetas embutidas em base64 (Puppeteer não resolve caminho relativo).
    const lerSilhueta = (arquivo: string): string | undefined => {
      try {
        const b64 = readFileSync(join(process.cwd(), "public", arquivo)).toString("base64");
        return `data:image/png;base64,${b64}`;
      } catch {
        return undefined;
      }
    };
    const silhuetaFrente = lerSilhueta("silhueta-frente.png");
    const silhuetaCostas = lerSilhueta("silhueta-costas.png");

    // Mídia (croqui/mapa/fotos — Item 7): embutida como páginas de anexo no fim do
    // laudo (URL assinada por path; degrada graciosamente se o storage falhar).
    const gruposMidia: { nome: string; itens: MidiaArquivo[] }[] = [
      { nome: "Croqui / planta do setor", itens: inv.croqui ?? [] },
      { nome: "Mapa de riscos", itens: inv.mapa_riscos ?? [] },
      { nome: "Foto anterior ao acidente", itens: inv.fotos_anteriores ?? [] },
      { nome: "Foto do momento do acidente", itens: inv.fotos_momento ?? [] },
      { nome: "Foto atual", itens: inv.fotos_atuais ?? [] },
      { nome: "Relatório fotográfico pós-acidente", itens: inv.fotos_pos ?? [] },
    ];
    const anexosMidia: AnexoParaMerge[] = [];
    for (const g of gruposMidia) {
      for (let i = 0; i < g.itens.length; i++) {
        const m = g.itens[i];
        if (!m || (!m.path && !m.url)) continue;
        let url = m.url;
        if (m.path) {
          const { data: signed } = await supabase.storage.from("fotos").createSignedUrl(m.path, 600);
          if (signed?.signedUrl) url = signed.signedUrl;
        }
        const png = (m.path ?? url).toLowerCase().includes(".png");
        anexosMidia.push({
          nome: `${g.nome}${g.itens.length > 1 ? ` ${i + 1}` : ""}`,
          url,
          tipo: "imagem",
          mime: png ? "image/png" : "image/jpeg",
        });
      }
    }

    const [{ default: React }, { renderToStaticMarkup }, { default: Template }] =
      await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("@/components/pdf/templates/InvestigacaoAcidenteTemplate"),
      ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(Template, {
        inv,
        empresa,
        signatarios,
        folhaEmpresa,
        dataHoraAssinatura,
        identificadorDocumento,
        acoes,
        silhuetaFrente,
        silhuetaCostas,
      }),
    );

    const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const headStyle = styleMatch ? styleMatch[1] : "";
    const bodyWithoutStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Investigação de Acidente</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;">
${bodyWithoutStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdfBuffer = await gerarPdf(fullHtml, {
      margens: { top: "18mm", bottom: "18mm", left: "16mm", right: "15mm" },
      numeroPaginas: true,
    });

    // Anexa croqui/mapa/fotos ao fim do laudo (vetorial). Sem mídia, devolve igual.
    const { mesclarAnexos } = await import("@/lib/pdf/anexar");
    const pdfFinal = await mesclarAnexos(pdfBuffer, anexosMidia);

    return new NextResponse(new Uint8Array(pdfFinal), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="investigacao-acidente-${shortId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/investigacao-acidente] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
