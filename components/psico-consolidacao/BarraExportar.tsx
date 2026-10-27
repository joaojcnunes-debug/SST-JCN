"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2, Presentation } from "lucide-react";
import toast from "react-hot-toast";
import type { DadosPlanilha } from "@/lib/psico-consolidacao/exportar-xlsx";
import { baixarApresentacao } from "./baixar-apresentacao";

type Qual = "analise" | "confronto" | "harmonizacao";

const NOMES: Record<Qual, string> = { analise: "Análise", confronto: "Confronto", harmonizacao: "Harmonização" };

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Saídas da consolidação (fase 6): as três planilhas (montadas aqui, com o que a tela
 * calculou) e o relatório ao cliente em PDF (gerado no servidor, com os mesmos
 * documentos escolhidos e o mesmo parâmetro da AEP). Exporta o grupo INTEIRO — os
 * filtros da tela não se aplicam aos arquivos.
 */
export default function BarraExportar({
  idGrupo,
  dados,
  documentosEscolhidos,
  incluirTrivial,
  nomeCurto,
  rotulo = "Exportar o grupo inteiro:",
}: {
  /** Sem grupo (consolidação por empresa): o relatório ao cliente em PDF, que é do grupo, não aparece. */
  idGrupo?: string;
  rotulo?: string;
  dados: DadosPlanilha;
  /** Nome curto de cada fator (cabeçalho das tabelas da apresentação). */
  nomeCurto: (id: string) => string;
  /** null = os documentos padrão (o servidor escolhe igual). */
  documentosEscolhidos: string[] | null;
  incluirTrivial: boolean;
}) {
  const [gerando, setGerando] = useState<Qual | "pptx" | null>(null);

  const excel = async (q: Qual) => {
    setGerando(q);
    try {
      const mod = await import("@/lib/psico-consolidacao/exportar-xlsx");
      const fn = q === "analise" ? mod.planilhaAnalise : q === "confronto" ? mod.planilhaConfronto : mod.planilhaHarmonizacao;
      mod.baixarXlsx(await fn(dados), `consolidacao-${q}-${slug(dados.grupo)}.xlsx`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a planilha.");
    } finally {
      setGerando(null);
    }
  };

  const apresentacao = async () => {
    setGerando("pptx");
    try {
      await baixarApresentacao({ grupo: dados.grupo, r: dados.r, nomeEmpresa: dados.nomeEmpresa, nomeFator: dados.nomeFator, nomeCurto });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a apresentação.");
    } finally {
      setGerando(null);
    }
  };

  const pdf = () => {
    if (!idGrupo) return;
    const q = new URLSearchParams();
    if (documentosEscolhidos) q.set("docs", documentosEscolhidos.join(","));
    if (!incluirTrivial) q.set("trivial", "0");
    window.open(`/api/pdf/consolidacao-grupo/${encodeURIComponent(idGrupo)}${q.size ? `?${q}` : ""}`, "_blank", "noopener");
  };

  const botao =
    "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-gray-500">{rotulo}</span>
      {(Object.keys(NOMES) as Qual[]).map((q) => (
        <button key={q} type="button" disabled={!!gerando} onClick={() => excel(q)} className={botao}>
          {gerando === q ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5 text-green-700" />}
          Excel — {NOMES[q]}
        </button>
      ))}
      <button type="button" disabled={!!gerando} onClick={apresentacao} className={botao}>
        {gerando === "pptx" ? <Loader2 className="size-3.5 animate-spin" /> : <Presentation className="size-3.5 text-orange-600" />}
        Apresentação (PowerPoint)
      </button>
      {idGrupo && (
        <button type="button" onClick={pdf} className={`${botao} border-verde-primary text-verde-primary`}>
          <FileDown className="size-3.5" /> Relatório ao cliente (PDF)
        </button>
      )}
    </div>
  );
}
