import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import type {
  Empresa,
  QpsAplicacao,
  QpsCategoria,
  QpsMonitoramento,
  QpsPergunta,
  QpsPlanoMedidas,
  QpsProbabilidade,
  QpsRespondente,
  QpsRevisao,
  QpsTipo,
} from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { QPS_LAUDO_TABELA, montarLaudoQps, type PlanoAcaoLinhaLaudo } from "@/lib/qps/laudo";
import { montarValoresVariaveisQps } from "@/lib/qps/variaveis";
import { INSTRUMENTO_QAP } from "@/lib/qps/gestao";
import { montarSignatarioTecnico } from "@/lib/pdf/folha-assinatura-tecnico";
import { assinarCapitulos, assinarImagensHtml } from "@/lib/pdf/assinar-midia";
import { aplicarAnexosNoPdf } from "@/lib/anexos/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Laudo da QAP em PDF (v226) — espelho de /api/pdf/drps/[id]: mesma
 * infra (Puppeteer, textos padrão por capítulo, assinatura A1, anexos), com o
 * dado montado por `montarLaudoQps` (a mesma função da prévia da tela Laudo).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { data: rawAp, error: apErr } = await supabase
      .from("qps_aplicacoes")
      .select("*")
      .eq("id_aplicacao", id)
      .single();
    if (apErr || !rawAp) {
      return NextResponse.json({ error: "Aplicação do questionário não encontrada" }, { status: 404 });
    }
    const ap = rawAp as unknown as QpsAplicacao;
    const anoMedidas = new Date().getFullYear();

    const { data: rawCats } = await supabase
      .from("qps_categorias").select("*").eq("id_tipo", ap.id_tipo).order("ordem");
    const categorias = (rawCats ?? []) as unknown as QpsCategoria[];
    const idsCategorias = categorias.map((c) => c.id_categoria);

    const [
      { data: rawTipo },
      { data: rawPergs },
      { data: rawResp },
      { data: rawProb },
      { data: rawPlano },
      { data: rawMon },
      { data: rawRev },
      { data: rawCaps },
      { data: rawPlanoAcao },
    ] = await Promise.all([
      supabase.from("qps_tipos").select("*").eq("id_tipo", ap.id_tipo).maybeSingle(),
      // Mesmo caminho do hook useQpsAllPerguntas: perguntas ativas das categorias do tipo.
      idsCategorias.length > 0
        ? supabase.from("qps_perguntas").select("*").in("id_categoria", idsCategorias).eq("ativo", true).order("ordem")
        : Promise.resolve({ data: [] as unknown[] }),
      supabase.from("qps_respondentes").select("*").eq("id_aplicacao", id),
      supabase.from("qps_probabilidades").select("*").eq("id_aplicacao", id),
      supabase.from("qps_plano_medidas").select("*").eq("id_aplicacao", id).eq("ano", anoMedidas).maybeSingle(),
      supabase.from("qps_monitoramento").select("*").eq("id_aplicacao", id),
      supabase.from("qps_revisao").select("*").eq("id_aplicacao", id).maybeSingle(),
      supabase.from("textos_padrao").select("*").eq("modulo", "qps").order("ordem", { ascending: true }),
      supabase.from("qps_plano_acao_5w2h").select("*").eq("id_aplicacao", id).order("ordem", { ascending: true }).order("created_at", { ascending: true }),
    ]);

    const respondentes = (rawResp ?? []) as unknown as QpsRespondente[];
    if (respondentes.length === 0) {
      return NextResponse.json({ error: "Nenhum respondente importado — não é possível gerar o laudo." }, { status: 400 });
    }

    const tipo = (rawTipo as unknown as QpsTipo | null) ?? null;
    const perguntas = (rawPergs ?? []) as unknown as QpsPergunta[];
    const probabilidades = (rawProb ?? []) as unknown as QpsProbabilidade[];
    const planoMedidas = (rawPlano as unknown as QpsPlanoMedidas | null) ?? null;
    const monitoramentos = (rawMon ?? []) as unknown as QpsMonitoramento[];
    const revisao = (rawRev as unknown as QpsRevisao | null) ?? null;
    const capitulos = await assinarCapitulos(supabase, (rawCaps ?? []) as unknown as TextoPadraoCapitulo[]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planoAcao: PlanoAcaoLinhaLaudo[] = ((rawPlanoAcao ?? []) as any[]).map((l) => ({
      ordem: l.ordem ?? 0,
      acao: l.acao ?? null,
      justificativa: l.justificativa ?? null,
      onde: l.onde ?? null,
      prazo: l.prazo ?? null,
      responsavel: l.responsavel ?? null,
      como: l.como ?? null,
      quanto_custa: l.quanto_custa ?? null,
      status: l.status ?? "PENDENTE",
    }));

    let empresa: Empresa | null = null;
    if (ap.id_empresa) {
      const { data: rawEmp } = await supabase.from("empresas").select("*").eq("id_empresa", ap.id_empresa).single();
      empresa = (rawEmp as unknown as Empresa) ?? null;
    }

    // CRP em branco na aplicação → o do cadastro do profissional com esse nome.
    let crp = (ap.crp ?? "").trim();
    if (!crp && ap.responsavel) {
      const { data: prof } = await supabase
        .from("usuarios")
        .select("crp")
        .ilike("nome", ap.responsavel.trim())
        .limit(1)
        .maybeSingle();
      crp = ((prof as { crp: string | null } | null)?.crp ?? "").trim();
    }
    const apComCrp: QpsAplicacao = { ...ap, crp: crp || null };

    // Imagens inline (<img>) das conclusões (rich text) precisam de URL assinada no Puppeteer.
    const conclusoesAssinadas = ap.conclusoes_por_setor
      ? Object.fromEntries(
          await Promise.all(
            Object.entries(ap.conclusoes_por_setor).map(
              async ([setor, html]) => [setor, await assinarImagensHtml(supabase, html)] as const,
            ),
          ),
        )
      : ap.conclusoes_por_setor;

    const laudo = montarLaudoQps({
      aplicacao: { ...apComCrp, conclusoes_por_setor: conclusoesAssinadas ?? null },
      tipo,
      categorias,
      perguntas,
      respondentes,
      probabilidades,
    });

    const { data: rawUsuario } = await supabase.from("usuarios").select("nome").eq("email", user.email).single();
    const perfilLogado = rawUsuario as { nome: string | null } | null;

    const valores = montarValoresVariaveisQps({
      empresa,
      aplicacao: apComCrp,
      tipoNome: tipo?.nome ?? null,
      totalRespondentes: respondentes.length,
      extras: {
        usuario_logado: perfilLogado?.nome ?? ap.responsavel ?? user.email ?? "",
        tipo_relatorio: `${INSTRUMENTO_QAP.sigla} — ${INSTRUMENTO_QAP.nome}`,
        formacao_responsavel: "Psicólogo(a)",
      },
    });

    const forcarAssinado = new URL(req.url).searchParams.get("assinado") === "1";
    const { signatario, dataHoraAssinatura } = await montarSignatarioTecnico(supabase, {
      tabela: QPS_LAUDO_TABELA,
      docId: String(id),
      responsavelNome: ap.responsavel,
      cargo: "Psicólogo(a)",
      registroProfissional: crp ? `CRP ${crp}` : null,
      forcarAssinado,
    });
    const signatarios: Signatario[] = [signatario];
    const folhaEmpresa = empresa ? { razaoSocial: empresa.nome_empresa, cnpj: empresa.cnpj ?? "" } : null;

    const shortId = String(id).replace(/-/g, "").slice(0, 8);
    const identificadorDocumento = `${INSTRUMENTO_QAP.sigla}-${new Date().getFullYear()}-${shortId}`;

    const [{ default: React }, { renderToStaticMarkup }, { default: QpsTemplate }] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@/components/pdf/templates/QpsTemplate"),
    ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(QpsTemplate, {
        laudo,
        empresa,
        planoMedidas,
        monitoramentos,
        revisao,
        anoMedidas,
        capitulos,
        valores,
        signatarios,
        folhaEmpresa,
        dataHoraAssinatura,
        identificadorDocumento,
        planoAcao,
      }),
    );

    const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const headStyle = styleMatch ? styleMatch[1] : "";
    const bodyWithoutStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Laudo ${INSTRUMENTO_QAP.sigla}</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Inter,Arial,Helvetica,sans-serif;color:#111827;">
${bodyWithoutStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdfBuffer = await gerarPdf(fullHtml, {
      margens: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
      numeroPaginasAposSeletor: '[data-slug="sumario"]',
      preferCssPageSize: true,
      capaFullBleed: true,
    });

    const pdfFinal = await aplicarAnexosNoPdf(supabase, "qps", id, pdfBuffer);

    return new NextResponse(pdfFinal, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="laudo-qap-${shortId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/qps] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
