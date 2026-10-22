import { NextRequest, NextResponse } from "next/server";
import { buscarAepsEntregues, buscarSituacaoQuestionario } from "@/lib/aep/sinalizacao-dados";
import { leituraQuestionario, montarSinalizacao } from "@/lib/aep/sinalizacao";
import { LOGO_JCN_DATA_URI } from "@/lib/pdf/logo-jcn";
import { abrirSessao, agoraBrasilia, lerEmpresa, responderPdf } from "@/lib/pdf/psicossocial-empresa";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PDF da página Painel SST › AEP › empresa (2026-10-09): cadastro + fatores
 * psicossociais por setor das AEPs entregues, na matriz AIHA. Mesmas funções
 * da tela (`buscarAepsEntregues` + `montarSinalizacao`), refeitas no servidor.
 * A "Confiança" da evidência fica fora: na tela ela é marcada como uso interno.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ idEmpresa: string }> }) {
  const idEmpresa = decodeURIComponent((await ctx.params).idEmpresa);
  const sessao = await abrirSessao();
  if ("recusa" in sessao) return sessao.recusa;
  const { supabase } = sessao;

  try {
    const [empresa, relatorios, situacao] = await Promise.all([
      lerEmpresa(supabase, idEmpresa, true),
      buscarAepsEntregues(supabase, { idEmpresa }),
      buscarSituacaoQuestionario(supabase, [idEmpresa]),
    ]);
    if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

    const sinal = montarSinalizacao(relatorios)[0] ?? null;
    const avaliacoes = (sinal?.avaliacoes ?? []).map((a) => ({
      ...a,
      questionario: leituraQuestionario(a.precisaQuestionario, situacao[idEmpresa], a.data),
    }));

    const [{ default: React }, { renderToStaticMarkup }, { AepPsicossocialEmpresaTemplate }] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@/components/pdf/templates/PsicossocialEmpresaTemplate"),
    ]);
    const bodyHtml = renderToStaticMarkup(
      React.createElement(AepPsicossocialEmpresaTemplate, {
        empresa,
        avaliacoes,
        geradoEm: agoraBrasilia(),
        // Documento do sistema da JCN: a marca é a nossa (mesma escolha do termo de patrimônio).
        logoUrl: LOGO_JCN_DATA_URI,
      })
    );
    return await responderPdf(bodyHtml, `AEP — Fatores Psicossociais — ${empresa.nome}`, "aep-psicossocial", empresa.nome);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao gerar o PDF" }, { status: 500 });
  }
}
