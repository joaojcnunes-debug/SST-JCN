import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import { PERGUNTAS_DEFAULT } from "@/lib/aet/perguntas-default";
import type { AetAcao, Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { montarValoresAet } from "@/lib/textos-padrao/variaveis-aet";
import { montarSignatarioTecnico } from "@/lib/pdf/folha-assinatura-tecnico";
import { formatarRegistro } from "@/lib/registro-profissional";
import { assinarCapitulos, assinarUmaMidiaPdf, assinarImagensHtml, assinarMidiaPdf } from "@/lib/pdf/assinar-midia";
import { otimizarFotosPdf } from "@/lib/pdf/otimizar-imagem";
import type {
  AetOwasCfg, AetFatorConfigLike, AetFatorPerguntaLike,
  AetQpsRespostaLike, AetFatorPsiLike, AetQpsMetaLike,
} from "@/components/pdf/templates/AetTemplate";

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
      .from("aet_relatorios")
      .select("*, empresas(nome_empresa, cnpj)")
      .eq("id_relatorio", id)
      .single();
    if (relErr || !rawRel) {
      return NextResponse.json({ error: "Relatório AET não encontrado" }, { status: 404 });
    }
    const rel = rawRel as Record<string, unknown>;

    // Empresa completa para a seção "Identificação da Empresa".
    let empresa: Empresa | null = null;
    if (rel.id_empresa) {
      const { data: rawEmp } = await supabase
        .from("empresas").select("*").eq("id_empresa", rel.id_empresa as string).single();
      empresa = (rawEmp as unknown as Empresa) ?? null;
    }

    const { data: rawCaps } = await supabase
      .from("textos_padrao")
      .select("*")
      .eq("modulo", "aet")
      .order("ordem", { ascending: true });
    const capitulos = await assinarCapitulos(supabase, (rawCaps ?? []) as unknown as TextoPadraoCapitulo[]);

    // OWAS config (aet_owas_categorias) — resolve imagem: custom (fotos) → assinada;
    // default (/owas/x.svg, relativo) → absoluta (Puppeteer não tem origem).
    // Origem INTERNA (nao a publica): o Chromium roda no container e o CF Access
    // bloquearia server-to-server no hostname publico (SVG viraria HTML de login).
    // Na Vercel não há AUTH_INTERNAL_URL: o próprio site serve /owas/*.svg
    // (o middleware não intercepta .svg), então a origem da requisição basta.
    const origin = process.env.AUTH_INTERNAL_URL ?? new URL(req.url).origin;
    const { data: rawOwas } = await supabase
      .from("aet_owas_categorias").select("*").order("ordem", { ascending: true });
    const owasConfig: AetOwasCfg[] = await Promise.all(
      ((rawOwas ?? []) as Record<string, unknown>[]).map(async (c) => {
        const slug = String(c.slug ?? "");
        const imagemUrl = (c.imagem_url as string | null) ?? null;
        const imagem = imagemUrl
          ? await assinarUmaMidiaPdf(supabase, imagemUrl, "fotos")
          : `${origin}/owas/${slug}.svg`;
        return {
          id: String(c.id ?? slug),
          slug,
          titulo: (c.titulo as string) ?? "",
          opcoes: Array.isArray(c.opcoes) ? (c.opcoes as { value: number; label: string }[]) : [],
          imagem,
        };
      }),
    );

    // Checklist ergonômico (labels custom; vazio → template usa o padrão interno).
    const { data: rawChecklist } = await supabase
      .from("aet_checklist_perguntas").select("slug, secao, label, oculta");
    const checklistPerguntas = ((rawChecklist ?? []) as { slug: string; secao: string | null; label: string; oculta?: boolean | null }[]);

    // 13 fatores + QPS (por relatório). Configs são globais; respostas/psi/meta por id.
    const [{ data: rawFCfg }, { data: rawFPerg }, { data: rawQResp }, { data: rawFPsi }, { data: rawQMeta }] =
      await Promise.all([
        supabase.from("aet_13fatores_config").select("codigo, nome").order("codigo", { ascending: true }),
        supabase.from("aet_13fatores_perguntas").select("codigo_fator, ordem, logica"),
        supabase.from("aet_laudo_qps_respostas").select("id_setor, codigo_fator, pergunta_ordem, resposta").eq("id_relatorio", id),
        supabase.from("aet_laudo_fatores_psi").select("id_setor, codigo_fator, avaliado, zona, media, observacao, pergunta_critica").eq("id_relatorio", id),
        supabase.from("aet_laudo_qps_meta").select("*").eq("id_relatorio", id).maybeSingle(),
      ]);
    const fatoresConfig = (rawFCfg ?? []) as unknown as AetFatorConfigLike[];
    // Fallback igual ao da tela (useAet13FatoresPerguntas): tabela vazia → perguntas padrão.
    // Sem isto, o calcMediaSetor do template não acha a `logica` e usa a nota CRUA (sem inversão),
    // fazendo a seção 10 (por setor) divergir da seção 11. Ver lib/aet/perguntas-default.ts.
    const fatoresPerguntas = ((rawFPerg && rawFPerg.length > 0)
      ? rawFPerg
      : PERGUNTAS_DEFAULT) as unknown as AetFatorPerguntaLike[];
    const qpsRespostas = (rawQResp ?? []) as unknown as AetQpsRespostaLike[];
    const fatoresPsi = (rawFPsi ?? []) as unknown as AetFatorPsiLike[];
    const qpsMeta = (rawQMeta ?? null) as unknown as AetQpsMetaLike | null;

    // Plano de Ação 5W2H (aet_acoes, v207) — entra no laudo como capítulo
    // fixo `aet_plano_acao`, só quando há pelo menos uma ação.
    const { data: rawAcoes } = await supabase
      .from("aet_acoes")
      .select("*")
      .eq("id_relatorio", id)
      .order("ordem", { ascending: true });
    const acoes = (rawAcoes ?? []) as unknown as AetAcao[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valoresVars = montarValoresAet(rel as any);

    const { data: rawUsuario } = await supabase
      .from("usuarios").select("nome").eq("email", user.email).single();
    const perfilLogado = rawUsuario as { nome: string | null } | null;
    valoresVars.usuario_logado = perfilLogado?.nome ?? (rel.responsavel_elaboracao as string) ?? user.email ?? "";
    valoresVars.tipo_relatorio = "AET — Análise Ergonômica do Trabalho";

    const { signatario, dataHoraAssinatura } = await montarSignatarioTecnico(supabase, {
      tabela: "aet_relatorios",
      docId: String(id),
      responsavelNome: rel.responsavel_elaboracao as string | null,
      cargo: (rel.titulo_profissional as string) ?? null,
      // Prefixo pelo cargo: médico sai "CRM", não "Reg." (ver formatarRegistro).
      registroProfissional: formatarRegistro(
        rel.titulo_profissional as string | null,
        rel.registro_profissional as string | null,
      ),
    });
    const signatarios: Signatario[] = [signatario];

    const empresasJoin = rel.empresas as { nome_empresa: string; cnpj: string | null } | null;
    const folhaEmpresa = empresasJoin
      ? { razaoSocial: empresasJoin.nome_empresa, cnpj: empresasJoin.cnpj ?? "" }
      : null;

    const shortId = String(id).replace(/-/g, "").slice(0, 8);
    const identificadorDocumento = `AET-${new Date().getFullYear()}-${shortId}`;

    const [{ default: React }, { renderToStaticMarkup }, { default: AetTemplate }] =
      await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("@/components/pdf/templates/AetTemplate"),
      ]);

    // Assina as imagens inline (<img>) gravadas no HTML rich-text de cada setor
    // (parecer técnico, recomendações e demais condições). Os três campos usam
    // o mesmo editor, então os três podem ter imagem colada — sem assinar, o
    // <img> aponta para um path do bucket privado e sai quebrado no PDF.
    const assinarSeTexto = async (v: unknown) =>
      typeof v === "string" ? await assinarImagensHtml(supabase, v) : v;
    const setoresAssinados = await Promise.all(
      ((rel.setores as Array<Record<string, unknown>>) ?? []).map(async (s) => ({
        ...s,
        parecer_tecnico: await assinarSeTexto(s.parecer_tecnico),
        recomendacoes: await assinarSeTexto(s.recomendacoes),
        demais_condicoes: await assinarSeTexto(s.demais_condicoes),
        // Registros fotográficos do setor. Hoje o bucket `fotos` é público e a
        // URL gravada já baixaria; assinar é o que mantém o PDF funcionando
        // quando ele for privatizado — e o helper devolve o valor original em
        // qualquer falha, então não há como piorar o que já funciona.
        //
        // E encolhidas antes de entrar no PDF: elas saem do celular em tamanho
        // cheio para serem impressas em 176×99. Sem isto o laudo da NOVAPARECIDA
        // sai com 11,7 MB contra 2,7 MB — as 38 fotos viram 3/4 do arquivo.
        // Mesma receita já em produção na apreciação (ver otimizar-imagem.ts);
        // se o otimizador falhar, cada foto volta com a URL original.
        fotos: Array.isArray(s.fotos)
          ? await otimizarFotosPdf(await assinarMidiaPdf(supabase, s.fotos as string[], "fotos"))
          : s.fotos,
      })),
    );

    const bodyHtml = renderToStaticMarkup(
      React.createElement(AetTemplate, {
        relatorio: {
          setores: setoresAssinados as unknown as Array<{ id: string }>,
          consideracoes_finais: (rel.consideracoes_finais as string) ?? null,
        },
        empresa,
        capitulos,
        owasConfig,
        checklistPerguntas,
        fatoresConfig,
        fatoresPerguntas,
        qpsRespostas,
        fatoresPsi,
        qpsMeta,
        acoes,
        valoresVars,
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
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Laudo AET</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111827;">
${bodyWithoutStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdfBuffer = await gerarPdf(fullHtml, {
      margens: { top: "25mm", bottom: "25mm", left: "30mm", right: "20mm" },
      // Numeração só após o sumário (capa/identificação/sumário ficam sem número).
      numeroPaginasAposSeletor: '[data-slug="sumario"]',
      capaFullBleed: true,
    });

    // AET não usa anexos (não há AnexosManager no módulo).
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="laudo-aet-${shortId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/aet] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
