import { NextRequest, NextResponse } from "next/server";
import { LOGO_JCN_DATA_URI } from "@/lib/pdf/logo-jcn";
import { abrirSessao, agoraBrasilia, lerEmpresa, responderPdf } from "@/lib/pdf/psicossocial-empresa";
import type { FechamentoConciliacao } from "@/lib/psico-consolidacao/carregar-conciliacao";
import type { AcaoConciliacaoPdf } from "@/components/pdf/templates/ConciliacaoTemplate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PDF de uma Conciliação DRPS/QPS × AEP fechada (v0.3.178): `?fechamento=PCF-…`.
 * Sai da foto gravada (v310), relida no servidor com o client de quem pede (RLS) —
 * o mesmo fechamento dá sempre o mesmo PDF. Só a situação das ações é a de hoje.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ idEmpresa: string }> }) {
  const idEmpresa = decodeURIComponent((await ctx.params).idEmpresa);
  const idFechamento = req.nextUrl.searchParams.get("fechamento");
  if (!idFechamento) return NextResponse.json({ error: "Informe o fechamento" }, { status: 400 });
  const sessao = await abrirSessao();
  if ("recusa" in sessao) return sessao.recusa;
  const sb = sessao.supabase;

  try {
    const { data: bruto, error } = await sb
      .from("psico_conciliacao_fechamentos")
      .select("*")
      .eq("id_fechamento", idFechamento)
      .eq("id_empresa", idEmpresa)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const f = bruto as FechamentoConciliacao | null;
    const empresa = f ? await lerEmpresa(sb, idEmpresa) : null;
    if (!f || !empresa) return NextResponse.json({ error: "Conciliação fechada não encontrada" }, { status: 404 });

    const [{ data: usuario }, acoes] = await Promise.all([
      sb.from("usuarios").select("nome").eq("email", f.fechado_por).maybeSingle(),
      lerAcoes(sb, [...new Set((f.itens ?? []).map((i) => i.id_acao).filter((x): x is string => !!x))]),
    ]);

    const [{ default: React }, { renderToStaticMarkup }, { ConciliacaoTemplate }] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@/components/pdf/templates/ConciliacaoTemplate"),
    ]);
    const ordem = ["AEP", "DRPS", "QPS"];
    const html = renderToStaticMarkup(
      React.createElement(ConciliacaoTemplate, {
        empresa,
        logoUrl: LOGO_JCN_DATA_URI,
        geradoEm: agoraBrasilia(),
        fechamento: {
          id: f.id_fechamento,
          em: new Date(f.fechado_em).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          por: (usuario as { nome?: string | null } | null)?.nome || f.fechado_por,
          observacao: f.observacao,
          documentos: Object.entries(f.documentos ?? {})
            .sort(([a], [b]) => ordem.indexOf(a) - ordem.indexOf(b))
            .map(([origem, d]) => ({ origem, titulo: d.titulo, data: d.data })),
          regua: f.regua ?? {},
          totais: f.resumo?.totais ?? {},
          pareceres: f.resumo?.pareceres ?? null,
          itens: f.itens ?? [],
        },
        acoes,
      }),
    );
    return await responderPdf(html, `Conciliação DRPS/QPS × AEP — ${empresa.nome}`, `conciliacao-${f.id_fechamento.toLowerCase()}`, empresa.nome);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao gerar o PDF" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lerAcoes(sb: any, ids: string[]): Promise<Record<string, AcaoConciliacaoPdf>> {
  const out: Record<string, AcaoConciliacaoPdf> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await sb
      .from("acoes_5w2h")
      .select("id_acao, what_acao, who_responsavel, when_prazo, status")
      .in("id_acao", ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const a of (data ?? []) as AcaoConciliacaoPdf[]) out[a.id_acao] = a;
  }
  return out;
}
