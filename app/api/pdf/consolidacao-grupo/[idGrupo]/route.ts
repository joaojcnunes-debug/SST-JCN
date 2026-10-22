import { NextRequest, NextResponse } from "next/server";
import { LOGO_JCN_DATA_URI } from "@/lib/pdf/logo-jcn";
import { abrirSessao, agoraBrasilia } from "@/lib/pdf/psicossocial-empresa";
import { carregarConsolidacao, carregarRegistro, type GlossarioItem } from "@/lib/psico-consolidacao/consolidacao-grupo";
import type { ResultadoMotor } from "@/lib/psico-consolidacao/motor";
import { fmtData, formatCNPJ } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Relatório ao cliente da Consolidação Psicossocial de Grupo (fase 6, 19/10/2026).
 * Relê tudo no servidor com o client de quem pede (RLS) e roda o MESMO motor da
 * tela. A tela manda só o que o técnico escolheu: `docs` (ids dos documentos, vírgula;
 * vazio = os padrão) e `trivial=0` (AEP Trivial/Baixo fora do perfil).
 * Com `execucao=PCX-…` (fase 7), sai a versão REGISTRADA, da foto gravada — sem recalcular.
 */
interface Base {
  grupo: { nome: string };
  membros: Array<{ id_empresa: string; cnpj: string | null }>;
  resultado: ResultadoMotor;
  docs: Array<{ idEmpresa: string; origem: string; data: string | null }>;
  nomeEmpresa: (id: string) => string;
  nomeCurto: (id: string) => string;
  glossario: GlossarioItem[];
  registro?: { id: string; em: string };
}

/** "19/10/2026, 15:02" de um instante gravado. */
function dataHoraBrasilia(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ idGrupo: string }> }) {
  const idGrupo = decodeURIComponent((await ctx.params).idGrupo);
  const sessao = await abrirSessao();
  if ("recusa" in sessao) return sessao.recusa;

  try {
    const q = req.nextUrl.searchParams;
    const idExecucao = q.get("execucao");
    let base: Base | null = null;
    if (idExecucao) {
      const reg = await carregarRegistro(sessao.supabase, idGrupo, idExecucao);
      if (reg) {
        base = {
          ...reg,
          docs: reg.fontes.map((f) => ({ idEmpresa: f.id_empresa, origem: f.origem, data: f.data })),
          registro: { id: idExecucao, em: dataHoraBrasilia(reg.criadoEm) },
        };
      }
    } else {
      const x = await carregarConsolidacao(sessao.supabase, idGrupo, {
        documentos: (q.get("docs") ?? "").split(",").filter(Boolean),
        incluirTrivialBaixo: q.get("trivial") !== "0",
      });
      if (x) base = { ...x, docs: x.fontes.documentos.filter((d) => x.usados.has(d.id)) };
    }
    if (!base) {
      return NextResponse.json({ error: idExecucao ? "Registro não encontrado" : "Grupo não encontrado" }, { status: 404 });
    }
    if (base.resultado.setores.length === 0) {
      return NextResponse.json({ error: "Nenhum documento concluído neste grupo" }, { status: 422 });
    }
    const c = base;

    const comLinha = new Set(c.resultado.setores.flatMap((s) => s.empresas));
    const empresas = c.membros
      .filter((m) => comLinha.has(m.id_empresa))
      .map((m) => ({
        idEmpresa: m.id_empresa,
        nome: c.nomeEmpresa(m.id_empresa),
        cnpj: m.cnpj ? formatCNPJ(m.cnpj) : null,
        documentos: c.docs
          .filter((d) => d.idEmpresa === m.id_empresa)
          .map((d) => `${d.origem === "QPS" ? "Questionário" : d.origem}${d.data ? ` de ${fmtData(d.data)}` : ""}`)
          .join("; "),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const [{ default: React }, { renderToStaticMarkup }, { ConsolidacaoGrupoTemplate }] = await Promise.all([
      import("react"),
      import("react-dom/server"),
      import("@/components/pdf/templates/ConsolidacaoGrupoTemplate"),
    ]);
    const bodyHtml = renderToStaticMarkup(
      React.createElement(ConsolidacaoGrupoTemplate, {
        grupo: c.grupo.nome,
        geradoEm: agoraBrasilia(),
        logoUrl: LOGO_JCN_DATA_URI,
        empresas,
        r: c.resultado,
        nomeEmpresa: c.nomeEmpresa,
        nomeCurto: c.nomeCurto,
        glossario: c.glossario,
        registro: c.registro,
      }),
    );

    const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const titulo = `Consolidação Psicossocial — ${c.grupo.nome}`.replace(/[<>&]/g, "");
    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>${titulo}</title>
<style>${styleMatch ? styleMatch[1] : ""}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Calibri,Arial,Helvetica,sans-serif;color:#111827;">
${bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "")}
</body></html>`;

    const { gerarPdf } = await import("@/lib/pdf/gerar-pdf");
    const pdf = await gerarPdf(fullHtml, {
      margens: { top: "10mm", bottom: "14mm", left: "10mm", right: "10mm" },
      preferCssPageSize: true,
      numeroPaginas: true,
    });
    const arquivo = `consolidacao-psicossocial-${idExecucao ? `${idExecucao.toLowerCase()}-` : ""}${c.grupo.nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${arquivo}"` },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao gerar o PDF" }, { status: 500 });
  }
}
