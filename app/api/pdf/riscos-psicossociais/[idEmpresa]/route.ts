import { NextRequest, NextResponse } from "next/server";
import { carregarRiscosPsicossociais } from "@/lib/riscos-psicossociais/carregar";
import { LOGO_JCN_DATA_URI } from "@/lib/pdf/logo-jcn";
import { abrirSessao, agoraBrasilia, lerEmpresa, responderPdf } from "@/lib/pdf/psicossocial-empresa";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PDF da página Painel SST › Riscos Psicossociais › empresa (2026-10-09):
 * cadastro + resultado final de cada risco por setor, de cada DRPS/Questionário
 * concluído. A conta é a mesma da tela (`carregarRiscosPsicossociais`), refeita
 * aqui no servidor.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ idEmpresa: string }> }) {
  const idEmpresa = decodeURIComponent((await ctx.params).idEmpresa);
  const sessao = await abrirSessao();
  if ("recusa" in sessao) return sessao.recusa;
  const { supabase } = sessao;

  try {
    const [empresa, riscos] = await Promise.all([
      lerEmpresa(supabase, idEmpresa),
      carregarRiscosPsicossociais(supabase, idEmpresa),
    ]);
    if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

    const [{ default: React }, { renderToStaticMarkup }, { RiscosPsicossociaisEmpresaTemplate }] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@/components/pdf/templates/PsicossocialEmpresaTemplate"),
    ]);
    const bodyHtml = renderToStaticMarkup(
      React.createElement(RiscosPsicossociaisEmpresaTemplate, {
        empresa,
        avaliacoes: riscos[0]?.avaliacoes ?? [],
        geradoEm: agoraBrasilia(),
        // Documento do sistema da JCN: a marca é a nossa (mesma escolha do termo de patrimônio).
        logoUrl: LOGO_JCN_DATA_URI,
      })
    );
    return await responderPdf(bodyHtml, `Riscos Psicossociais — ${empresa.nome}`, "riscos-psicossociais", empresa.nome);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao gerar o PDF" }, { status: 500 });
  }
}
