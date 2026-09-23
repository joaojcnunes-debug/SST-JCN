import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import { intervaloDoMes, rotuloMes } from "@/lib/escala/datas";
import {
  porMes,
  porSituacao,
  porUnidadeESupervisor,
  rotuloSupervisor,
  supervisoresDoRelatorio,
} from "@/lib/escala/relatorios";
import type { EscalaDia, EscalaSupervisor, EscalaUnidadeConfig, UnidadeDaEscala } from "@/lib/escala/tipos";
import type { Unidade } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PDF do resumo da escala (Fase 7).
 *
 * `?ano=2026` gera o ano inteiro; com `&mes=3` gera só março.
 *
 * A conta é refeita AQUI, no servidor, e não recebida da tela: um relatório que
 * confia em números vindos do navegador é um relatório que pode ser alterado
 * por quem o pede. Ler de novo custa uma consulta e vale a confiança — e de
 * quebra o PDF respeita a RLS de quem está pedindo.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const ano = Number(req.nextUrl.searchParams.get("ano"));
  const mesBruto = req.nextUrl.searchParams.get("mes");
  const mes = mesBruto ? Number(mesBruto) : null;

  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return NextResponse.json({ error: "Ano inválido" }, { status: 400 });
  }
  if (mes !== null && (!Number.isInteger(mes) || mes < 1 || mes > 12)) {
    return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
  }

  try {
    const { inicio, fim } =
      mes !== null
        ? intervaloDoMes(ano, mes)
        : { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };

    const [sups, unis, cfgs, dias, logoRow] = await Promise.all([
      // Todos, nao so os ativos: quem saiu no meio do ano trabalhou, e o PDF
      // e historico. O corte de quem nao tem dia no periodo e feito abaixo.
      supabase.from("escala_supervisores").select("*").order("ordem"),
      supabase.from("unidades").select("*").order("nome"),
      supabase.from("escala_unidade_config").select("*"),
      supabase.from("escala_dias").select("*").gte("data", inicio).lte("data", fim),
      supabase.from("configuracoes").select("valor").eq("chave", "logo_url").maybeSingle(),
    ]);

    for (const r of [sups, unis, cfgs, dias]) {
      if (r.error) throw new Error(r.error.message);
    }

    const todosSupervisores = (sups.data ?? []) as unknown as EscalaSupervisor[];
    const configs = new Map(
      ((cfgs.data ?? []) as unknown as EscalaUnidadeConfig[]).map((c) => [c.id_unidade, c])
    );
    const unidades: UnidadeDaEscala[] = ((unis.data ?? []) as unknown as Unidade[])
      .map((u) => {
        const c = configs.get(u.id_unidade);
        return {
          id_unidade: u.id_unidade,
          nome: u.nome,
          cor_hex: c?.cor_hex ?? "#0ea5e9",
          ordem: c?.ordem ?? 0,
          municipio: c?.municipio ?? null,
          ativo: c?.ativo ?? true,
          configurada: !!c,
        };
      })
      .filter((u) => u.ativo)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));

    const linhas = (dias.data ?? []) as unknown as EscalaDia[];
    const supervisores = supervisoresDoRelatorio(todosSupervisores, linhas);
    const entrada = { supervisores, unidades, dias: linhas };

    const matrizUnidades = porUnidadeESupervisor(entrada);
    const matrizMeses = porMes({ ...entrada, ano });
    const situacoes = porSituacao(entrada);

    const periodo = mes !== null ? rotuloMes(ano, mes) : String(ano);
    const ids = supervisores.map((s) => s.id_supervisor);

    const tabelas = [
      {
        titulo: "Dias por unidade",
        nota: "Um dia em mais de uma unidade conta em cada uma delas.",
        primeiraColuna: "Unidade",
        linhas: matrizUnidades.linhas.map((l) => ({
          rotulo: l.rotulo,
          valores: ids.map((id) => l.porSupervisor[id] ?? 0),
          total: l.total,
        })),
        totais: ids.map((id) => matrizUnidades.totalPorSupervisor[id] ?? 0),
        totalGeral: matrizUnidades.totalGeral,
      },
    ];

    // A tabela por mês só faz sentido no relatório do ANO — num mês só ela
    // seria uma linha preenchida e onze zeradas.
    if (mes === null) {
      tabelas.push({
        titulo: "Dias com escala definida, por mês",
        nota: "Conta o dia uma vez, com unidade ou situação — menos o feriado, que a planilha também não contava.",
        primeiraColuna: "Mês",
        linhas: matrizMeses.linhas.map((l) => ({
          rotulo: l.rotulo,
          valores: ids.map((id) => l.porSupervisor[id] ?? 0),
          total: l.total,
        })),
        totais: ids.map((id) => matrizMeses.totalPorSupervisor[id] ?? 0),
        totalGeral: matrizMeses.totalGeral,
      });
    }

    const [{ default: React }, { renderToStaticMarkup }, { default: Template }] =
      await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("@/components/pdf/templates/EscalaResumoTemplate"),
      ]);

    const bodyHtml = renderToStaticMarkup(
      React.createElement(Template, {
        periodo,
        supervisores: supervisores.map(rotuloSupervisor),
        tabelas,
        situacoes: situacoes.map((s) => ({ situacao: s.situacao, dias: s.dias })),
        geradoEm: new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        logoUrl: (logoRow.data as { valor?: string } | null)?.valor ?? null,
      })
    );

    const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const headStyle = styleMatch ? styleMatch[1] : "";
    const semStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");
    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Escala de Supervisores — ${periodo}</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Calibri,Arial,Helvetica,sans-serif;color:#111827;">
${semStyle}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdf = await gerarPdf(fullHtml, {
      margens: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });

    const nomeArquivo = `escala-supervisores-${mes !== null ? `${ano}-${String(mes).padStart(2, "0")}` : ano}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nomeArquivo}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao gerar o PDF" },
      { status: 500 }
    );
  }
}
