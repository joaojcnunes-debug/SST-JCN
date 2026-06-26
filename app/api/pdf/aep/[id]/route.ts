import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { AepRelatorioLocal, AepSetorLocal } from "@/components/pdf/templates/AepTemplate";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { montarValoresAep } from "@/lib/textos-padrao/variaveis-aep";
import { montarSignatarioTecnico } from "@/lib/pdf/folha-assinatura-tecnico";
import { assinarCapitulos } from "@/lib/pdf/assinar-midia";
import { aplicarAnexosNoPdf } from "@/lib/anexos/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Normalização inline (useAep.ts é "use client") ───────────────────────────

type RespostaChecklist = "sim" | "nao" | "nao_aplica";

function toResposta(v: unknown): RespostaChecklist {
  if (v === true || v === "sim") return "sim";
  if (v === "nao_aplica") return "nao_aplica";
  return "nao";
}

function normalizarChecklistFisica(raw: unknown) {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    postura: toResposta(c.postura),
    repetitividade: toResposta(c.repetitividade),
    levantamento_carga: toResposta(c.levantamento_carga),
    mobiliario: toResposta(c.mobiliario),
    esforco_fisico: toResposta(c.esforco_fisico),
    iluminacao: toResposta(c.iluminacao),
    ruido: toResposta(c.ruido),
    vibracao: toResposta(c.vibracao),
    desconforto_termico: toResposta(c.desconforto_termico),
  };
}

function normalizarChecklistCognitiva(raw: unknown) {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    atencao_continua: toResposta(c.atencao_continua),
    sobrecarga_mental: toResposta(c.sobrecarga_mental),
    pressao_psicologica: toResposta(c.pressao_psicologica),
    excesso_informacoes: toResposta(c.excesso_informacoes),
    ritmo_mental: toResposta(c.ritmo_mental),
  };
}

function normalizarChecklistOrganizacional(raw: unknown) {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    assedio: toResposta(c.assedio),
    falta_suporte: toResposta(c.falta_suporte),
    gestao_mudancas: toResposta(c.gestao_mudancas),
    clareza_papel: toResposta(c.clareza_papel),
    recompensas: toResposta(c.recompensas),
    baixo_controle: toResposta(c.baixo_controle),
    justica_organizacional: toResposta(c.justica_organizacional),
    eventos_traumaticos: toResposta(c.eventos_traumaticos),
    subcarga: toResposta(c.subcarga),
    sobrecarga: toResposta(c.sobrecarga),
    maus_relacionamentos: toResposta(c.maus_relacionamentos),
    comunicacao_dificil: toResposta(c.comunicacao_dificil),
    trabalho_remoto: toResposta(c.trabalho_remoto),
  };
}

function normalizarSetor(s: unknown): AepSetorLocal {
  const setor = (s ?? {}) as Record<string, unknown>;
  return {
    id: (setor.id as string) ?? crypto.randomUUID(),
    nome_setor: (setor.nome_setor as string) ?? "",
    unidade: (setor.unidade as string) ?? "",
    ghe: (setor.ghe as string) ?? "",
    cargo: (setor.cargo as string) ?? "",
    funcao: (setor.funcao as string) ?? "",
    jornada: (setor.jornada as string) ?? "",
    qtd_expostos: typeof setor.qtd_expostos === "number" ? setor.qtd_expostos : 0,
    descricao_atividade: (setor.descricao_atividade as string) ?? "",
    metodo_coleta: (setor.metodo_coleta as string) ?? "",
    trabalhadores_consultados: (setor.trabalhadores_consultados as string) ?? "",
    observacoes_checklist:
      (setor.observacoes_checklist as Record<string, string>) ?? {},
    cargos: Array.isArray(setor.cargos)
      ? (setor.cargos as AepSetorLocal["cargos"])
      : [],
    riscos: Array.isArray(setor.riscos) ? (setor.riscos as AepSetorLocal["riscos"]) : [],
    checklist_fisica: normalizarChecklistFisica(setor.checklist_fisica),
    checklist_cognitiva: normalizarChecklistCognitiva(setor.checklist_cognitiva),
    checklist_organizacional: normalizarChecklistOrganizacional(setor.checklist_organizacional),
    parecer_tecnico: (setor.parecer_tecnico as string) ?? "",
    recomendacoes: (setor.recomendacoes as string) ?? "",
    necessita_aet: Boolean(setor.necessita_aet),
  };
}

function normalizarRelatorio(data: unknown): AepRelatorioLocal {
  const rel = data as Record<string, unknown>;
  return {
    ...rel,
    endereco_empresa: (rel.endereco_empresa as string | null) ?? null,
    setores: Array.isArray(rel.setores) ? rel.setores.map(normalizarSetor) : [],
  } as AepRelatorioLocal;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Busca o relatório com join de empresa
  const { data: rawRel, error: relError } = await supabase
    .from("aep_relatorios")
    .select("*, empresas(nome_empresa, cnpj)")
    .eq("id_relatorio", id)
    .single();

  if (relError || !rawRel) {
    return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  }

  const rel = normalizarRelatorio(rawRel);

  // Empresa COMPLETA para a seção de sistema "Identificação da Empresa".
  // O join acima só traz nome/cnpj (capa); aqui buscamos todos os campos.
  const idEmpresa = (rawRel as Record<string, unknown>).id_empresa as string | null | undefined;
  let empresaCompleta: Empresa | null = null;
  if (idEmpresa) {
    const { data: rawEmp } = await supabase
      .from("empresas")
      .select("*")
      .eq("id_empresa", idEmpresa)
      .single();
    empresaCompleta = (rawEmp as unknown as Empresa) ?? null;
  }

  // Busca capítulos editáveis (textos_padrao modulo=aep, ativos, ordenados)
  const { data: caps, error: capsError } = await supabase
    .from("textos_padrao")
    .select("*")
    .eq("modulo", "aep")
    .order("ordem", { ascending: true });

  if (capsError) console.error("[pdf/aep] textos_padrao error:", capsError);
  console.log("[pdf/aep] capitulos count:", caps?.length ?? 0);

  const capitulos = await assinarCapitulos(supabase, (caps ?? []) as TextoPadraoCapitulo[]);

  // Variáveis dinâmicas para substituição nos textos padrão
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valoresVars = montarValoresAep(rel as any);

  // usuario_logado ainda é usado em variáveis de texto do template.
  const { data: rawUsuario } = await supabase
    .from("usuarios")
    .select("nome")
    .eq("email", user.email)
    .single();
  const perfilLogado = rawUsuario as { nome: string | null } | null;

  valoresVars.usuario_logado = perfilLogado?.nome ?? rel.responsavel_elaboracao ?? user.email ?? "";

  // Folha de assinaturas: técnico = responsável do documento; selo só quando
  // assinado de fato, senão linha manual. Ver montarSignatarioTecnico.
  const { signatario, dataHoraAssinatura } = await montarSignatarioTecnico(supabase, {
    tabela: "aep_relatorios",
    docId: id,
    responsavelNome: rel.responsavel_elaboracao as string | null,
    cargo: rel.titulo_profissional ?? null,
    registroProfissional: rel.registro_profissional
      ? `Reg. ${rel.registro_profissional}`
      : null,
  });
  const signatarios: Signatario[] = [signatario];

  // Empresa para o campo de assinatura física
  const folhaEmpresa =
    rel.empresas
      ? {
          razaoSocial: rel.empresas.nome_empresa,
          cnpj: rel.empresas.cnpj ?? "",
        }
      : null;

  const shortId = id.replace(/-/g, "").slice(0, 8);
  const identificadorDocumento = `AEP-${new Date().getFullYear()}-${shortId}`;

  // Dynamic imports — Next.js 15 bloqueia react-dom/server em import estático no App Router
  const [{ default: React }, { renderToStaticMarkup }, { default: AepTemplate }] =
    await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@/components/pdf/templates/AepTemplate"),
    ]);

  // Renderiza o template React → HTML
  const bodyHtml = renderToStaticMarkup(
    React.createElement(AepTemplate, {
      relatorio: rel,
      empresa: empresaCompleta,
      capitulos,
      valoresVars,
      signatarios,
      folhaEmpresa,
      dataHoraAssinatura,
      identificadorDocumento,
    }),
  );

  // Move <style> do bodyHtml para o <head> para que @page seja processado corretamente
  const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const headStyle = styleMatch ? styleMatch[1] : '';
  const bodyWithoutStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, '');

  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Laudo AEP</title>
  <style>${headStyle}</style>
</head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;">
${bodyWithoutStyle}
</body>
</html>`;

  // Gera o PDF — margens ABNT via Puppeteer (sem @page margin no CSS para evitar conflito sparticuz)
  const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
  const pdfBuffer = await gerarPdf(fullHtml, {
    margens: { top: "25mm", bottom: "25mm", left: "30mm", right: "20mm" },
    // Numeração só após o sumário (capa/identificação/sumário ficam sem número).
    numeroPaginasAposSeletor: '[data-slug="sumario"]',
    // Capa full-bleed (@page capa margin:0); ativa preferCSSPageSize, então os
    // capítulos em paisagem (@page textopadrao-paisagem) passam a ser honrados.
    capaFullBleed: true,
  });

  const pdfFinal = await aplicarAnexosNoPdf(supabase, "aep", id, pdfBuffer);

  return new NextResponse(pdfFinal, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="laudo-aep-${shortId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
  } catch (err) {
    console.error("[pdf/aep] Erro ao gerar PDF:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno ao gerar PDF" },
      { status: 500 },
    );
  }
}
