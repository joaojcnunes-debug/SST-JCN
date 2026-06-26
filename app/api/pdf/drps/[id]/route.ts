import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import type {
  DrpsMonitoramento,
  DrpsPlanoMedidas,
  DrpsProbabilidade,
  DrpsRelatorio,
  DrpsRespondente,
  DrpsRevisao,
} from "@/lib/drps/types";
import { montarValoresVariaveis } from "@/lib/drps/variaveis";
import { montarSignatarioTecnico } from "@/lib/pdf/folha-assinatura-tecnico";
import { assinarCapitulos, assinarImagensHtml } from "@/lib/pdf/assinar-midia";

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
      .from("drps_relatorios")
      .select("*")
      .eq("id_relatorio", id)
      .single();
    if (relErr || !rawRel) {
      return NextResponse.json({ error: "Relatório DRPS não encontrado" }, { status: 404 });
    }
    const rel = rawRel as unknown as DrpsRelatorio;

    const anoMedidas = new Date().getFullYear();

    const [
      { data: rawResp },
      { data: rawProb },
      { data: rawPlano },
      { data: rawMon },
      { data: rawRev },
      { data: rawCaps },
      { data: rawPlanoAcao },
    ] = await Promise.all([
      supabase.from("drps_respondentes").select("*").eq("id_relatorio", id),
      supabase.from("drps_probabilidades").select("*").eq("id_relatorio", id),
      supabase.from("drps_plano_medidas").select("*").eq("id_relatorio", id).eq("ano", anoMedidas).maybeSingle(),
      supabase.from("drps_monitoramento").select("*").eq("id_relatorio", id),
      supabase.from("drps_revisao").select("*").eq("id_relatorio", id).maybeSingle(),
      supabase.from("textos_padrao").select("*").eq("modulo", "psicossocial").order("ordem", { ascending: true }),
      supabase.from("drps_plano_acao_5w2h").select("*").eq("id_relatorio", id).order("ordem", { ascending: true }).order("created_at", { ascending: true }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planoAcao = ((rawPlanoAcao ?? []) as any[]).map((l) => ({
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

    const respondentes = (rawResp ?? []) as unknown as DrpsRespondente[];
    const probabilidades = (rawProb ?? []) as unknown as DrpsProbabilidade[];
    const planoMedidas = (rawPlano as unknown as DrpsPlanoMedidas) ?? null;
    const monitoramentos = (rawMon ?? []) as unknown as DrpsMonitoramento[];
    const revisao = (rawRev as unknown as DrpsRevisao) ?? null;
    const capitulos = await assinarCapitulos(supabase, (rawCaps ?? []) as unknown as TextoPadraoCapitulo[]);

    if (respondentes.length === 0) {
      return NextResponse.json({ error: "Nenhum respondente importado — não é possível gerar o laudo." }, { status: 400 });
    }

    let empresa: Empresa | null = null;
    if (rel.id_empresa) {
      const { data: rawEmp } = await supabase
        .from("empresas").select("*").eq("id_empresa", rel.id_empresa).single();
      empresa = (rawEmp as unknown as Empresa) ?? null;
    }

    // Variáveis dos textos padrão (inclui período de coleta a partir dos carimbos).
    const base = montarValoresVariaveis(empresa, rel);
    const timestamps = respondentes
      .map((r) => r.data_carimbo)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime())
      .filter((n) => !Number.isNaN(n));
    const valores: Record<string, string> = {
      ...base,
      data_carimbo_inicio: timestamps.length > 0 ? new Date(Math.min(...timestamps)).toLocaleDateString("pt-BR") : "",
      data_carimbo_fim: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toLocaleDateString("pt-BR") : "",
    };

    const { data: rawUsuario } = await supabase
      .from("usuarios").select("nome").eq("email", user.email).single();
    const perfilLogado = rawUsuario as { nome: string | null } | null;

    valores.usuario_logado = perfilLogado?.nome ?? rel.responsavel_tecnico ?? user.email ?? "";
    valores.tipo_relatorio = "DRPS — Diagnóstico de Riscos Psicossociais";

    // ?assinado=1 → ao gerar o PDF que será assinado, já renderiza o selo digital
    // (o registro em pdfs_assinados só existe DEPOIS da assinatura). Enviado pelo
    // BotaoAssinarPdf na hora de assinar; o "Gerar Laudo" normal não envia.
    const forcarAssinado = new URL(req.url).searchParams.get("assinado") === "1";

    const { signatario, dataHoraAssinatura } = await montarSignatarioTecnico(supabase, {
      tabela: "drps_relatorios_analise",
      docId: String(id),
      responsavelNome: rel.responsavel_tecnico as string | null,
      cargo: "Psicólogo(a)",
      registroProfissional: rel.crp ? `CRP ${rel.crp}` : null,
      forcarAssinado,
    });
    const signatarios: Signatario[] = [signatario];

    const folhaEmpresa = empresa
      ? { razaoSocial: empresa.nome_empresa, cnpj: empresa.cnpj ?? "" }
      : null;

    // Assina as imagens inline (<img>) gravadas no HTML das conclusões (rich text).
    const conclusaoGeralAssinada = await assinarImagensHtml(supabase, rel.conclusao_geral);
    const conclusoesPorSetorAssinadas = rel.conclusoes_por_setor
      ? Object.fromEntries(
          await Promise.all(
            Object.entries(rel.conclusoes_por_setor as Record<string, string>).map(
              async ([setor, html]) => [setor, await assinarImagensHtml(supabase, html)] as const,
            ),
          ),
        )
      : rel.conclusoes_por_setor;

    const shortId = String(id).replace(/-/g, "").slice(0, 8);
    const identificadorDocumento = `DRPS-${new Date().getFullYear()}-${shortId}`;

    const [{ default: React }, { renderToStaticMarkup }, { default: DrpsTemplate }] =
      await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("@/components/pdf/templates/DrpsTemplate"),
      ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(DrpsTemplate, {
        relatorio: {
          revisao: rel.revisao,
          responsavel_tecnico: rel.responsavel_tecnico,
          crp: rel.crp,
          data_elaboracao: rel.data_elaboracao,
          agravos_por_setor: rel.agravos_por_setor,
          medidas_por_setor: rel.medidas_por_setor,
          conclusoes_por_setor: conclusoesPorSetorAssinadas,
          conclusao_geral: conclusaoGeralAssinada,
        },
        empresa,
        respondentes,
        probabilidades,
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
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Laudo DRPS</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Inter,Arial,Helvetica,sans-serif;color:#111827;">
${bodyWithoutStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdfBuffer = await gerarPdf(fullHtml, {
      margens: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
      // Numeração só após o sumário (capa/identificação/sumário ficam sem número).
      numeroPaginasAposSeletor: '[data-slug="sumario"]',
      // Honra @page do CSS p/ capítulos em paisagem (drps_conclusao/assinatura).
      preferCssPageSize: true,
      capaFullBleed: true,
    });

    const pdfFinal = await aplicarAnexosNoPdf(supabase, "psicossocial", id, pdfBuffer);

    return new NextResponse(pdfFinal, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="laudo-drps-${shortId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/drps] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
