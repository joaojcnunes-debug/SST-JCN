import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import type {
  ApreciacaoItemLocal,
  ApreciacaoAcaoLocal,
  RiscoFichaLocal,
  FichaMaquinaLocal,
  FichaPdfLocal,
} from "@/components/pdf/templates/ApreciacaoTemplate";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { montarValoresEmpresa, formatarDataBR } from "@/lib/textos-padrao/variaveis";
import { montarSignatarioTecnico } from "@/lib/pdf/folha-assinatura-tecnico";
import { assinarMidiaPdf, assinarCapitulos } from "@/lib/pdf/assinar-midia";
import { otimizarFotosPdf } from "@/lib/pdf/otimizar-imagem";

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
    const { data: rawAp, error: apErr } = await supabase
      .from("apreciacoes_maquinas")
      .select("*")
      .eq("id_apreciacao", id)
      .single();
    if (apErr || !rawAp) {
      return NextResponse.json({ error: "Apreciação não encontrada" }, { status: 404 });
    }
    const ap = rawAp as Record<string, unknown>;

    const { data: rawItens } = await supabase
      .from("apreciacoes_maquinas_itens")
      .select("*")
      .eq("id_apreciacao", id)
      .order("ordem", { ascending: true });
    const rawItensArr = (rawItens ?? []) as Record<string, unknown>[];
    const itens: ApreciacaoItemLocal[] = rawItensArr.map((i) => ({
      id_item: String(i.id_item),
      id_ficha: (i.id_ficha as string) ?? null,
      item_codigo: (i.item_codigo as string) ?? "",
      item_categoria: (i.item_categoria as string) ?? "",
      item_titulo: (i.item_titulo as string) ?? "",
      item_descricao: (i.item_descricao as string) ?? null,
      item_origem: (i.item_origem as string) ?? null,
      situacao: (i.situacao as string) ?? "PENDENTE",
      observacao: (i.observacao as string) ?? null,
      recomendacao: (i.recomendacao as string) ?? null,
      probabilidade: (i.probabilidade as string) ?? null,
      severidade: (i.severidade as string) ?? null,
      nivel_risco_calculado: (i.nivel_risco_calculado as string) ?? null,
      foto_urls: Array.isArray(i.foto_urls) ? (i.foto_urls as string[]) : [],
      foto_legendas: Array.isArray(i.foto_legendas) ? (i.foto_legendas as string[]) : [],
    }));

    // Fotos → URLs assinadas p/ o Puppeteer (fallback p/ original em falha) e
    // depois reduzidas (1536px de câmera para um espaço de 120px no papel).
    await Promise.all(
      itens.map(async (it) => {
        it.foto_urls = await otimizarFotosPdf(
          await assinarMidiaPdf(supabase, it.foto_urls, "fotos"),
        );
      }),
    );

    // Mapa id_item → "codigo — titulo" para a coluna Origem do plano de ação.
    const itemLabel = new Map<string, string>();
    itens.forEach((i) => itemLabel.set(i.id_item, `${i.item_codigo} — ${i.item_titulo}`));

    const { data: rawAcoes } = await supabase
      .from("apreciacao_acoes")
      .select("*")
      .eq("id_apreciacao", id)
      .order("ordem", { ascending: true });
    const acoes: ApreciacaoAcaoLocal[] = ((rawAcoes ?? []) as Record<string, unknown>[]).map((a) => ({
      id_acao: String(a.id_acao),
      what_acao: (a.what_acao as string) ?? "",
      why_justificativa: (a.why_justificativa as string) ?? null,
      where_local: (a.where_local as string) ?? null,
      when_prazo: (a.when_prazo as string) ?? null,
      who_responsavel: (a.who_responsavel as string) ?? null,
      how_metodo: (a.how_metodo as string) ?? null,
      how_much_custo: (a.how_much_custo as string) ?? null,
      status: (a.status as string) ?? "Pendente",
      prioridade: (a.prioridade as string) ?? "Media",
      origem_label: a.id_item ? itemLabel.get(String(a.id_item)) ?? null : null,
    }));

    const { data: rawCaps } = await supabase
      .from("textos_padrao")
      .select("*")
      .eq("modulo", "apreciacao_maquinas")
      .order("ordem", { ascending: true });
    const capitulos = await assinarCapitulos(supabase, (rawCaps ?? []) as unknown as TextoPadraoCapitulo[]);

    let empresa: Empresa | null = null;
    if (ap.id_empresa) {
      const { data: rawEmp } = await supabase
        .from("empresas").select("*").eq("id_empresa", ap.id_empresa as string).single();
      empresa = (rawEmp as unknown as Empresa) ?? null;
    }

    // Linhas de risco da ficha (seção 4). Ficaram anos sem ser consultadas aqui
    // — por isso a tabela estava vazia: ninguém preenchia o que não era impresso.
    const { data: rawRiscos } = await supabase
      .from("apreciacao_riscos_hrn")
      .select("*")
      .eq("id_apreciacao", id)
      .order("ordem", { ascending: true });
    const riscos: RiscoFichaLocal[] = ((rawRiscos ?? []) as Record<string, unknown>[]).map((r) => ({
      id_risco: String(r.id_risco),
      id_ficha: (r.id_ficha as string) ?? null,
      tipo_perigo: (r.tipo_perigo as string) ?? "",
      origem: (r.origem as string) ?? null,
      potenciais_consequencias: (r.potenciais_consequencias as string) ?? null,
      item_nr12: (r.item_nr12 as string) ?? null,
      itens_nr12: Array.isArray(r.itens_nr12) ? (r.itens_nr12 as string[]) : null,
      categoria_seguranca: (r.categoria_seguranca as string) ?? null,
      pod: (r.pod as string) ?? null,
      fep: (r.fep as string) ?? null,
      gpd: (r.gpd as string) ?? null,
      classificacao_risco: (r.classificacao_risco as string) ?? null,
      medidas_engenharia: (r.medidas_engenharia as string) ?? null,
      medidas_administrativas: (r.medidas_administrativas as string) ?? null,
      medidas_preventivas: (r.medidas_preventivas as string) ?? null,
      pod_residual: (r.pod_residual as string) ?? null,
      fep_residual: (r.fep_residual as string) ?? null,
      gpd_residual: (r.gpd_residual as string) ?? null,
      classificacao_residual: (r.classificacao_residual as string) ?? null,
    }));

    // ── Máquinas do laudo (v148) — cada uma com seus riscos e fotos ─────────
    const { data: rawFichas } = await supabase
      .from("apreciacao_fichas_maquina")
      .select("*")
      .eq("id_apreciacao", id)
      .order("numero_ordem", { ascending: true });

    const fichas: FichaPdfLocal[] = await Promise.all(
      ((rawFichas ?? []) as Record<string, unknown>[]).map(async (f) => {
        const urls = Array.isArray(f.foto_urls) ? (f.foto_urls as string[]) : [];
        return {
          id_ficha: String(f.id_ficha),
          numero_ordem: Number(f.numero_ordem ?? 0),
          nome:
            (f.maquina_descricao as string)
            ?? (f.equipamento as string)
            ?? "Máquina",
          tipo: (f.tipo as string) ?? null,
          modelo: (f.modelo as string) ?? null,
          fabricante: (f.fabricante as string) ?? null,
          serie: (f.serie as string) ?? null,
          ano: (f.ano as string) ?? null,
          capacidade: (f.capacidade as string) ?? null,
          setor: (f.setor as string) ?? null,
          operadores: Array.isArray(f.operadores)
            ? (f.operadores as { nome: string; cargo: string }[])
            : null,
          constatacoes_inspecao: (f.constatacoes_inspecao as string) ?? null,
          parecer_tecnico: (f.parecer_tecnico as string) ?? null,
          // Máx. 3 no PDF: a ficha tem que caber numa página.
          fotos: await otimizarFotosPdf(
            (await assinarMidiaPdf(supabase, urls.slice(0, 3), "fotos")).filter(Boolean),
          ),
          riscos: riscos.filter((r) => r.id_ficha === String(f.id_ficha)),
        };
      }),
    );

    // Nome e bloco "Inventário" da ficha: vínculo no inventário ou descrição livre.
    let maquinaNome = (ap.maquina_descricao as string) ?? "Máquina";
    let maquina: FichaMaquinaLocal | null = null;
    let fotosMaquina: string[] = [];
    if (ap.id_maquina) {
      const { data: rawMaq } = await supabase
        .from("inventario_maquinas")
        .select(
          "nome, tipo, marca, modelo, numero_serie, ano_fabricacao, capacidade_operacional, setor, operadores, foto_url, id_maquina_inspecao",
        )
        .eq("id_maquina", ap.id_maquina as string)
        .single();
      const maq = rawMaq as Record<string, unknown> | null;
      if (maq) {
        if (maq.nome) maquinaNome = String(maq.nome);
        if (maq.foto_url) fotosMaquina = [String(maq.foto_url)];
        // Sem foto no cadastro: usa o registro fotográfico da inspeção de origem
        // (as máquinas importadas de inspeção vieram todas com foto).
        if (!fotosMaquina.length && maq.id_maquina_inspecao) {
          const { data: rawInsp } = await supabase
            .from("inspecao_maquinas")
            .select("foto_urls")
            .eq("id_maquina_inspecao", maq.id_maquina_inspecao as string)
            .single();
          const arr = (rawInsp as { foto_urls?: string[] } | null)?.foto_urls;
          if (Array.isArray(arr)) fotosMaquina = arr.slice(0, 3);
        }
        maquina = {
          tipo: (maq.tipo as string) ?? null,
          marca: (maq.marca as string) ?? null,
          modelo: (maq.modelo as string) ?? null,
          numero_serie: (maq.numero_serie as string) ?? null,
          ano_fabricacao: maq.ano_fabricacao ? String(maq.ano_fabricacao) : null,
          capacidade: (maq.capacidade_operacional as string) ?? null,
          setor: (maq.setor as string) ?? (ap.setor as string) ?? null,
          operadores: (maq.operadores as string) ?? null,
          fotos: [],
        };
      }
    }
    if (maquina) {
      maquina.fotos = await otimizarFotosPdf(
        (await assinarMidiaPdf(supabase, fotosMaquina, "fotos")).filter(Boolean),
      );
    }

    const valores: Record<string, string> = {
      ...montarValoresEmpresa(empresa),
      titulo: (ap.titulo as string) ?? "",
      maquina_nome: maquinaNome,
      setor: (ap.setor as string) ?? "",
      responsavel: (ap.responsavel as string) ?? "",
      responsavel_empresa: (ap.responsavel_empresa as string) ?? "",
      cidade: (ap.cidade as string) ?? "",
      data_apreciacao: formatarDataBR(ap.data_apreciacao as string | null),
      total_itens: String(itens.length),
      total_nao_conforme: String(itens.filter((i) => i.situacao === "NAO_CONFORME").length),
      risco_residual: (ap.risco_residual as string) ?? "",
      carimbo: (ap.responsavel as string) ?? "",
      importado: formatarDataBR(ap.created_at as string | null),
    };

    const { data: rawUsuario } = await supabase
      .from("usuarios").select("nome").eq("email", user.email).single();
    const perfilLogado = rawUsuario as { nome: string | null } | null;

    valores.usuario_logado = perfilLogado?.nome ?? user.email ?? "";
    valores.tipo_relatorio = "Apreciação de Risco — Máquinas (NR-12)";

    const { signatario, dataHoraAssinatura } = await montarSignatarioTecnico(supabase, {
      tabela: "apreciacoes_maquinas",
      docId: String(id),
      responsavelNome: ap.responsavel as string | null,
    });
    const signatarios: Signatario[] = [signatario];

    const folhaEmpresa = empresa
      ? { razaoSocial: empresa.nome_empresa, cnpj: empresa.cnpj ?? "" }
      : null;

    const shortId = String(id).replace(/-/g, "").slice(0, 8);
    const identificadorDocumento = `APR-${new Date().getFullYear()}-${shortId}`;

    const [{ default: React }, { renderToStaticMarkup }, { default: ApreciacaoTemplate }] =
      await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("@/components/pdf/templates/ApreciacaoTemplate"),
      ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(ApreciacaoTemplate, {
        apreciacao: {
          titulo: (ap.titulo as string) ?? null,
          setor: (ap.setor as string) ?? null,
          cidade: (ap.cidade as string) ?? null,
          responsavel: (ap.responsavel as string) ?? null,
          responsavel_empresa: (ap.responsavel_empresa as string) ?? null,
          data_apreciacao: (ap.data_apreciacao as string) ?? null,
          risco_residual: (ap.risco_residual as string) ?? null,
          observacoes_gerais: (ap.observacoes_gerais as string) ?? null,
          conclusao_tecnica: (ap.conclusao_tecnica as string) ?? null,
          recomendacoes: (ap.recomendacoes as string) ?? null,
          constatacoes_inspecao: (ap.constatacoes_inspecao as string) ?? null,
        },
        maquinaNome,
        empresa,
        itens,
        acoes,
        riscos,
        maquina,
        fichas,
        notificacaoSit: (ap.notificacao_sit as string) ?? null,
        incluirChecklist: Boolean(ap.incluir_checklist_pdf),
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
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Apreciação NR-12</title>
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

    const pdfFinal = await aplicarAnexosNoPdf(supabase, "apreciacao_maquinas", id, pdfBuffer);

    return new NextResponse(pdfFinal, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="apreciacao-nr12-${shortId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/apreciacao] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
