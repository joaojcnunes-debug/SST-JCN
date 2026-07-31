import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import type {
  ApreciacaoItemLocal,
  ApreciacaoAcaoLocal,
  ApreciacaoRiscoLocal,
  ApreciacaoFichaLocal,
} from "@/components/pdf/templates/ApreciacaoTemplate";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { montarValoresEmpresa, formatarDataBR } from "@/lib/textos-padrao/variaveis";
import { montarSignatarioTecnico } from "@/lib/pdf/folha-assinatura-tecnico";
import { detectRegistroTipo, getRegistroValue } from "@/lib/registro-profissional";
import { assinarMidiaPdf, assinarCapitulos } from "@/lib/pdf/assinar-midia";

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

    // Fichas de máquina (multi-máquina), ordenadas.
    const { data: rawFichas } = await supabase
      .from("apreciacao_fichas_maquina")
      .select("*")
      .eq("id_apreciacao", id)
      .order("numero_ordem", { ascending: true });
    const fichasRaw = (rawFichas ?? []) as Record<string, unknown>[];

    // Itens (checklist) de todas as fichas.
    const { data: rawItens } = await supabase
      .from("apreciacoes_maquinas_itens")
      .select("*")
      .eq("id_apreciacao", id)
      .order("ordem", { ascending: true });
    const itensComFicha = ((rawItens ?? []) as Record<string, unknown>[]).map((i) => ({
      id_ficha: (i.id_ficha as string) ?? null,
      item: {
        id_item: String(i.id_item),
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
      } as ApreciacaoItemLocal,
    }));

    // Fotos → URLs assinadas p/ o Puppeteer (fallback p/ original em falha).
    await Promise.all(
      itensComFicha.map(async (x) => {
        x.item.foto_urls = await assinarMidiaPdf(supabase, x.item.foto_urls, "fotos");
      }),
    );

    // Riscos HRN de todas as fichas.
    const { data: rawRiscos } = await supabase
      .from("apreciacao_riscos_hrn")
      .select("*")
      .eq("id_apreciacao", id)
      .order("ordem", { ascending: true });
    const riscosComFicha = ((rawRiscos ?? []) as Record<string, unknown>[]).map((r) => ({
      id_ficha: (r.id_ficha as string) ?? null,
      risco: {
        tipo_perigo: (r.tipo_perigo as string) ?? "",
        origem: (r.origem as string) ?? null,
        potenciais_consequencias: (r.potenciais_consequencias as string) ?? null,
        pod: (r.pod as string) ?? null,
        fep: (r.fep as string) ?? null,
        gpd: (r.gpd as string) ?? null,
        classificacao_risco: (r.classificacao_risco as string) ?? null,
        pod_residual: (r.pod_residual as string) ?? null,
        fep_residual: (r.fep_residual as string) ?? null,
        gpd_residual: (r.gpd_residual as string) ?? null,
        classificacao_residual: (r.classificacao_residual as string) ?? null,
        nivel_acoes: (r.nivel_acoes as string) ?? null,
        medidas_preventivas: (r.medidas_preventivas as string) ?? null,
        itens_nr12: Array.isArray(r.itens_nr12) ? (r.itens_nr12 as string[]) : null,
        categoria_seguranca: (r.categoria_seguranca as string) ?? null,
      } as ApreciacaoRiscoLocal,
    }));

    const todosItens = itensComFicha.map((x) => x.item);

    // Monta as fichas (identificação + itens + riscos por máquina).
    const fichas: ApreciacaoFichaLocal[] = fichasRaw.map((fr) => {
      const idf = fr.id_ficha as string;
      return {
        nome:
          (fr.equipamento as string) ||
          (fr.maquina_descricao as string) ||
          `Máquina ${(fr.numero_ordem as number) ?? ""}`,
        numero_ordem: (fr.numero_ordem as number) ?? 1,
        setor: (fr.setor as string) ?? null,
        tipo: (fr.tipo as string) ?? null,
        modelo: (fr.modelo as string) ?? null,
        fabricante: (fr.fabricante as string) ?? null,
        serie: (fr.serie as string) ?? null,
        ano: (fr.ano as string) ?? null,
        capacidade: (fr.capacidade as string) ?? null,
        componentes_maquina: Array.isArray(fr.componentes_maquina) ? (fr.componentes_maquina as string[]) : null,
        limite_uso: (fr.limite_uso as string) ?? null,
        limite_espaco: (fr.limite_espaco as string) ?? null,
        limite_tempo: (fr.limite_tempo as string) ?? null,
        limite_produtividade: (fr.limite_produtividade as string) ?? null,
        npe: (fr.npe as string) ?? null,
        sistemas_atual: Array.isArray(fr.sistemas_atual) ? (fr.sistemas_atual as string[]) : null,
        sistemas_necessario: Array.isArray(fr.sistemas_necessario) ? (fr.sistemas_necessario as string[]) : null,
        constatacoes_inspecao: (fr.constatacoes_inspecao as string) ?? null,
        parecer_tecnico: (fr.parecer_tecnico as string) ?? null,
        operadores: Array.isArray(fr.operadores)
          ? (fr.operadores as { nome: string; cargo: string }[])
          : null,
        foto_urls: Array.isArray(fr.foto_urls) ? (fr.foto_urls as string[]) : [],
        prioridade_manual: !!fr.prioridade_manual,
        itens: itensComFicha.filter((x) => x.id_ficha === idf).map((x) => x.item),
        riscos: riscosComFicha.filter((x) => x.id_ficha === idf).map((x) => x.risco),
      } as ApreciacaoFichaLocal;
    });

    // Assina as fotos das fichas (registro fotográfico da máquina) p/ o Puppeteer.
    await Promise.all(
      fichas.map(async (f) => {
        f.foto_urls = await assinarMidiaPdf(supabase, f.foto_urls, "fotos");
      }),
    );

    // Mapa id_item → "codigo — titulo" para a coluna Origem do plano de ação.
    const itemLabel = new Map<string, string>();
    todosItens.forEach((i) => itemLabel.set(i.id_item, `${i.item_codigo} — ${i.item_titulo}`));

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

    // Nome exibido: 1 máquina → o nome dela; várias → contagem.
    const maquinaNome =
      fichas.length === 1
        ? fichas[0].nome
        : fichas.length > 1
          ? `${fichas.length} máquinas`
          : ((ap.maquina_descricao as string) ?? "Máquina");

    const valores: Record<string, string> = {
      ...montarValoresEmpresa(empresa),
      titulo: (ap.titulo as string) ?? "",
      maquina_nome: maquinaNome,
      setor: (ap.setor as string) ?? "",
      responsavel: (ap.responsavel as string) ?? "",
      responsavel_empresa: (ap.responsavel_empresa as string) ?? "",
      cidade: (ap.cidade as string) ?? "",
      data_apreciacao: formatarDataBR(ap.data_apreciacao as string | null),
      total_itens: String(todosItens.length),
      total_nao_conforme: String(todosItens.filter((i) => i.situacao === "NAO_CONFORME").length),
      risco_residual: (ap.risco_residual as string) ?? "",
      carimbo: (ap.responsavel as string) ?? "",
      importado: formatarDataBR(ap.created_at as string | null),
    };

    const { data: rawUsuario } = await supabase
      .from("usuarios").select("nome").eq("email", user.email).single();
    const perfilLogado = rawUsuario as { nome: string | null } | null;

    valores.usuario_logado = perfilLogado?.nome ?? user.email ?? "";
    valores.tipo_relatorio = "Apreciação de Risco — Máquinas (NR-12)";

    // Responsável Técnico (assinante): busca o usuário pelo nome p/ registro + ART.
    let responsavelTecnico: {
      nome: string;
      cargo: string | null;
      registroLabel: string;
      registro: string | null;
      art: string | null;
    } | null = null;
    if (ap.responsavel) {
      const { data: usrs } = await supabase
        .from("usuarios")
        .select("nome, cargo, crea, art, crp, crm, registro_mte")
        .eq("ativo_sistema", true);
      const normn = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
      const alvo = normn(ap.responsavel as string);
      const u = ((usrs ?? []) as Record<string, unknown>[]).find((x) => {
        const n = normn(String(x.nome ?? ""));
        return n && (n === alvo || alvo.includes(n) || n.includes(alvo));
      });
      if (u) {
        const reg = detectRegistroTipo(u.cargo as string | null);
        responsavelTecnico = {
          nome: String(u.nome),
          cargo: (u.cargo as string) ?? null,
          registroLabel: reg.label,
          registro: getRegistroValue(u as never) || null,
          art: (u.art as string) ?? null,
        };
      }
    }

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
          notificacao_sit: (ap.notificacao_sit as string) ?? null,
          risco_residual: (ap.risco_residual as string) ?? null,
          observacoes_gerais: (ap.observacoes_gerais as string) ?? null,
          conclusao_tecnica: (ap.conclusao_tecnica as string) ?? null,
          recomendacoes: (ap.recomendacoes as string) ?? null,
        },
        maquinaNome,
        empresa,
        fichas,
        acoes,
        capitulos,
        valores,
        signatarios,
        folhaEmpresa,
        dataHoraAssinatura,
        identificadorDocumento,
        responsavelTecnico,
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
