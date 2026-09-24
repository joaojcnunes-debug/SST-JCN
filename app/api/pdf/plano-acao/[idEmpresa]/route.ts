import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import type { PlanoAcaoItemLocal } from "@/components/pdf/templates/PlanoAcaoTemplate";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { montarValoresEmpresa } from "@/lib/textos-padrao/variaveis";
import { montarSignatarioTecnico } from "@/lib/pdf/folha-assinatura-tecnico";
import { assinarCapitulos } from "@/lib/pdf/assinar-midia";
import { buscarAcoes } from "@/lib/busca/acoes";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Tabela usada em `pdfs_assinados` — o plano é assinado por empresa. */
const TABELA_ASSINATURA = "plano_acao";

const STATUS_LABEL: Record<string, string> = {
  Pendente: "Pendente",
  "Em Andamento": "Em Andamento",
  Concluida: "Concluída",
  Cancelada: "Cancelada",
};
const PRIORIDADE_LABEL: Record<string, string> = {
  Baixa: "Baixa",
  Media: "Média",
  Alta: "Alta",
  Critica: "Crítica",
};

/**
 * PDF do Plano de Ação 5W2H de UMA empresa.
 *
 * O recorte vem da tela (/acoes) pela query string — status, prioridade e busca
 * — pra que o documento seja exatamente a lista que o usuário está vendo. Sem
 * filtro nenhum, sai o plano inteiro da empresa.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ idEmpresa: string }> }) {
  const { idEmpresa } = await ctx.params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { data: rawEmp } = await supabase
      .from("empresas")
      .select("*")
      .eq("id_empresa", idEmpresa)
      .single();
    const empresa = (rawEmp as unknown as Empresa) ?? null;
    if (!empresa) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

    const status = req.nextUrl.searchParams.get("status") ?? "";
    const prioridade = req.nextUrl.searchParams.get("prioridade") ?? "";
    const busca = (req.nextUrl.searchParams.get("q") ?? "").trim();

    let q = supabase
      .from("acoes_5w2h")
      .select("*")
      .eq("id_empresa", idEmpresa)
      .order("when_prazo", { ascending: true, nullsFirst: false });
    if (status) q = q.eq("status", status);
    if (prioridade) q = q.eq("prioridade", prioridade);
    const { data: rawAcoes } = await q;

    // A busca da tela é por texto livre em três campos — o MESMO critério
    // (lib/busca/acoes.ts) roda aqui pra que o PDF não traga linhas que a tela
    // escondeu, nem esconda as "mais parecidas" que a tela mostrou.
    const linhas = buscarAcoes((rawAcoes ?? []) as Record<string, unknown>[], busca).itens;

    // Setores da empresa: a ação guarda o id, e o documento precisa do nome.
    const { data: rawSetores } = await supabase
      .from("setores")
      .select("id_setor, setor_ghe")
      .eq("id_empresa", idEmpresa);
    const setorPorId = new Map(
      ((rawSetores ?? []) as Record<string, unknown>[]).map((s) => [
        String(s.id_setor),
        (s.setor_ghe as string) ?? "",
      ]),
    );

    const acoes: PlanoAcaoItemLocal[] = linhas.map((a) => ({
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
      setor_nome: a.id_setor ? setorPorId.get(String(a.id_setor)) ?? null : null,
      vinculada_a_risco: !!a.id_risco,
    }));

    const filtrosAplicados: string[] = [];
    if (status) filtrosAplicados.push(`Status: ${STATUS_LABEL[status] ?? status}`);
    if (prioridade) filtrosAplicados.push(`Prioridade: ${PRIORIDADE_LABEL[prioridade] ?? prioridade}`);
    if (busca) filtrosAplicados.push(`Busca: "${busca}"`);

    const { data: rawCaps } = await supabase
      .from("textos_padrao")
      .select("*")
      .eq("modulo", "plano_acao")
      .order("ordem", { ascending: true });
    const capitulos = await assinarCapitulos(supabase, (rawCaps ?? []) as unknown as TextoPadraoCapitulo[]);

    // Quem responde pelo plano é quem está emitindo — o documento não tem
    // responsável técnico próprio como os laudos por inspeção.
    const { data: rawUsuario } = await supabase
      .from("usuarios")
      .select("nome")
      .eq("email", user.email)
      .single();
    const responsavelNome = (rawUsuario as { nome: string | null } | null)?.nome ?? user.email;

    const valores: Record<string, string> = {
      ...montarValoresEmpresa(empresa),
      responsavel: responsavelNome,
      carimbo: responsavelNome,
      usuario_logado: responsavelNome,
      tipo_relatorio: "Plano de Ação 5W2H",
      total_acoes: String(acoes.length),
    };

    const forcar = req.nextUrl.searchParams.get("assinado") === "1";
    const { signatario, dataHoraAssinatura } = await montarSignatarioTecnico(supabase, {
      tabela: TABELA_ASSINATURA,
      docId: idEmpresa,
      responsavelNome,
      forcarAssinado: forcar,
    });
    const signatarios: Signatario[] = [signatario];
    const folhaEmpresa = { razaoSocial: empresa.nome_empresa, cnpj: empresa.cnpj ?? "" };

    const shortId = String(idEmpresa).replace(/-/g, "").slice(0, 8);
    const identificadorDocumento = `PA-${new Date().getFullYear()}-${shortId}`;

    const [{ default: React }, { renderToStaticMarkup }, { default: PlanoAcaoTemplate }] =
      await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("@/components/pdf/templates/PlanoAcaoTemplate"),
      ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(PlanoAcaoTemplate, {
        empresa,
        acoes,
        filtrosAplicados,
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
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Plano de Ação</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;">
${bodyWithoutStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    // Folha DEITADA — a orientação vem do `@page` do template (só o CSS a
    // controla). `preferCssPageSize` fica explícito para não depender de o
    // `capaFullBleed` continuar ligando a flag por conta própria.
    // Margem vertical menor que a dos outros laudos: em paisagem a folha tem
    // 210mm de altura, e os 20mm de sempre comiam quase 20% dela.
    const pdfBuffer = await gerarPdf(fullHtml, {
      margens: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
      numeroPaginasAposSeletor: '[data-slug="sumario"]',
      preferCssPageSize: true,
      capaFullBleed: true,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="plano-acao-${shortId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf/plano-acao] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
