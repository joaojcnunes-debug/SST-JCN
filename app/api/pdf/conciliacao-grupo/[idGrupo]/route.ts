import { NextRequest, NextResponse } from "next/server";
import { LOGO_JCN_DATA_URI } from "@/lib/pdf/logo-jcn";
import { abrirSessao, agoraBrasilia, responderPdf } from "@/lib/pdf/psicossocial-empresa";
import type { FechamentoGrupo } from "@/lib/psico-consolidacao/carregar-conciliacao";
import { rotuloEmpresa } from "@/lib/psico-consolidacao/conciliacao-grupo";
import type { AcaoConciliacaoPdf } from "@/components/pdf/templates/ConciliacaoTemplate";
import { formatCNPJ } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PDF de uma Conciliação por GRUPO fechada (v0.3.285, banco v354): `?fechamento=PGF-…`.
 * Sai da foto gravada em psico_conciliacao_grupo_fechamentos, relida no servidor com o client de quem pede
 * (RLS: só quem enxerga todas as empresas do grupo). O mesmo fechamento dá sempre o mesmo PDF; só a situação
 * das ações é a de hoje. Mesmo modelo do PDF da empresa (ConciliacaoTemplate), com a parte do grupo.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ idGrupo: string }> }) {
  const idGrupo = decodeURIComponent((await ctx.params).idGrupo);
  const idFechamento = req.nextUrl.searchParams.get("fechamento");
  if (!idFechamento) return NextResponse.json({ error: "Informe o fechamento" }, { status: 400 });
  const sessao = await abrirSessao();
  if ("recusa" in sessao) return sessao.recusa;
  const sb = sessao.supabase;

  try {
    const { data: bruto, error } = await sb
      .from("psico_conciliacao_grupo_fechamentos")
      .select("*")
      .eq("id_fechamento", idFechamento)
      .eq("id_grupo", idGrupo)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const f = bruto as FechamentoGrupo | null;
    if (!f) return NextResponse.json({ error: "Conciliação fechada não encontrada" }, { status: 404 });
    // O PDF da comparação: a foto de um lado só não tem o que comparar (igual ao da empresa).
    if (f.resumo?.fonte_unica) return NextResponse.json({ error: "Fechamento sem comparação não tem PDF" }, { status: 400 });

    const idsAcoes = new Set<string>();
    for (const i of f.itens ?? []) for (const id of i.id_acoes ?? (i.id_acao ? [i.id_acao] : [])) idsAcoes.add(id);
    const [{ data: usuario }, acoes] = await Promise.all([
      sb.from("usuarios").select("nome").eq("email", f.fechado_por).maybeSingle(),
      lerAcoes(sb, [...idsAcoes]),
    ]);

    const rotulos = new Map((f.empresas ?? []).map((e) => [e.id_empresa, rotuloEmpresa({ nome: e.nome, cnpj: e.cnpj })]));
    const [{ default: React }, { renderToStaticMarkup }, { ConciliacaoTemplate }] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@/components/pdf/templates/ConciliacaoTemplate"),
    ]);
    const ordem = ["AEP", "DRPS", "QPS"];
    const html = renderToStaticMarkup(
      React.createElement(ConciliacaoTemplate, {
        empresa: {
          nome: f.nome_grupo,
          razaoSocial: null,
          nomeFantasia: null,
          cnpj: null,
          cnae: null,
          grauRisco: null,
          telefone: null,
          email: null,
          endereco: null,
        },
        grupo: {
          nome: f.nome_grupo,
          empresas: (f.empresas ?? []).map((e) => ({
            nome: e.nome,
            cnpj: e.cnpj ? formatCNPJ(e.cnpj) : null,
            rotulo: rotulos.get(e.id_empresa) ?? e.nome,
          })),
        },
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
          documentos: [...(f.documentos ?? [])]
            .sort((a, b) => ordem.indexOf(a.origem) - ordem.indexOf(b.origem))
            .map((d) => ({ origem: d.origem, titulo: d.titulo, data: d.data, empresa: rotulos.get(d.id_empresa) ?? d.id_empresa })),
          regua: f.regua ?? {},
          totais: f.resumo?.totais ?? {},
          questionarios: f.resumo?.questionarios,
          pareceres: f.resumo?.pareceres ?? null,
          itens: f.itens ?? [],
        },
        acoes,
      }),
    );
    return await responderPdf(html, `Conciliação por grupo — ${f.nome_grupo}`, `conciliacao-grupo-${f.id_fechamento.toLowerCase()}`, f.nome_grupo);
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
