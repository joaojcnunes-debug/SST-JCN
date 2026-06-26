"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Download, Loader2 } from "lucide-react";
import { usePdfAssinado, usePdfCongelado } from "@/lib/hooks/usePdfsGerados";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import AnexosManager from "@/components/anexos/AnexosManager";
import PainelCongelamentoPdf from "@/components/ui/PainelCongelamentoPdf";
import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import TextosPadraoPrint from "@/components/textos-padrao/TextosPadraoPrint";
import { useTextosPadrao } from "@/lib/hooks/useTextosPadrao";
import { montarValoresEmpresa, formatarDataBR, substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
import { useAnaliseQuimico } from "@/lib/hooks/useAnalisesQuimicos";
import ConclusaoRapidaCard from "@/components/quimicos/ConclusaoRapidaCard";
import RelatorioEstruturado from "@/components/quimicos/RelatorioEstruturado";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import { baixarPdfAssinado } from "@/lib/pdf/baixar-assinado";

export default function LaudoAnaliseQuimicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: analise, isLoading, error } = useAnaliseQuimico(id);
  const { data: empresa } = useEmpresa(analise?.id_empresa ?? null);

  const { pdfAssinado, recarregar } = usePdfAssinado("analises_quimicos", id);
  const { data: pdfCongelado } = usePdfCongelado("analises_quimicos", id);
  const baseCongeladaUrl = pdfCongelado?.pdf_url ?? undefined;
  const [baixando, setBaixando] = useState(false);

  async function handleBaixarPdf() {
    if (!pdfAssinado) return;
    setBaixando(true);
    try {
      await baixarPdfAssinado(pdfAssinado.pdf_path, "relatorio-assinado.pdf");
    } catch { toast.error("Erro ao baixar o PDF."); }
    finally { setBaixando(false); }
  }

  const { data: capitulosQ = [] } = useTextosPadrao("analise_quimicos");

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        <Loader2 className="size-5 animate-spin" /> Carregando análise...
      </div>
    );
  }

  if (error || !analise) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Análise não encontrada ou erro ao carregar.
        <div className="mt-2">
          <Link href="/analise-quimicos/historico" className="text-red-700 underline hover:text-red-900">
            Voltar ao histórico
          </Link>
        </div>
      </div>
    );
  }

  const valoresTextosPadrao: Record<string, string> = {
    ...montarValoresEmpresa(empresa ?? null),
    titulo: analise.titulo,
    nome_quimico: analise.nome_quimico ?? "",
    numero_cas: analise.numero_cas ?? "",
    responsavel: analise.usuario_nome ?? "",
    carimbo: analise.usuario_nome ?? "",
    importado: formatarDataBR(analise.created_at),
  };

  // Corpo da análise (seção do sistema "quimicos_analise"): relatório técnico
  // estruturado gerado automaticamente.
  const analiseBodyScreenNode = (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none print:p-2">
      <h2 className="mb-3 text-base font-bold text-verde-primary">Relatório Técnico Completo</h2>
      <RelatorioEstruturado analise={analise} empresa={empresa ?? null} />
    </section>
  );

  // Blocos ordenados (mesma regra do corpoScreen) p/ montar o sumário.
  const blocosQ = [...capitulosQ]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const tituloPorSlugQ: Record<string, string> = {};
  for (const c of capitulosQ) if (c.slug_fixo) tituloPorSlugQ[c.slug_fixo] = c.titulo;

  // Só entra no Sumário/numeração quem vira seção numerada (mesmo predicado do PDF).
  // A assinatura é hardcoded no fim — não há capítulo de assinatura.
  const renderizaNumeradoQ = (c: (typeof capitulosQ)[number]): boolean => {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "quimicos_analise":      return true;
      case "quimicos_assinatura":   return true;
      default:                      return false; // sumario
    }
  };

  const numPorSlugQ: Record<string, number> = {};
  const numPorIdQ: Record<string, number> = {};
  {
    let n = 0;
    for (const c of blocosQ) {
      if (!renderizaNumeradoQ(c)) continue;
      n += 1;
      if (c.tipo === "fixo" && c.slug_fixo) numPorSlugQ[c.slug_fixo] = n;
      numPorIdQ[c.id_capitulo] = n;
    }
  }
  const numLabelQ = (num: number | undefined, txt: string) => (num ? `${num}. ${txt}` : txt);

  const sumarioTitulos = blocosQ
    .filter((c) => renderizaNumeradoQ(c))
    .map((c) =>
      c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valoresTextosPadrao),
    )
    .filter((t) => t && t.trim());

  const temAssinaturaFixoQ = capitulosQ.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "quimicos_assinatura" && c.ativo !== false,
  );
  const assinaturaScreenNode = (
    <AssinaturaRelatorio
      nomeResponsavel={analise.usuario_nome ?? undefined}
      dataRelatorio={formatarDataBR(analise.created_at) || undefined}
      tabelaNome="analises_quimicos"
      docId={id}
      hideAcoes
      numero={numPorSlugQ["quimicos_assinatura"]}
    />
  );

  function renderSecaoQScreen(slug: string): React.ReactNode {
    switch (slug) {
      case "quimicos_assinatura":   return assinaturaScreenNode;
      case "identificacao_empresa":
        return (
          <div className="mb-6 break-inside-avoid">
            <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
              {numLabelQ(numPorSlugQ["identificacao_empresa"], "Identificação da Empresa")}
            </h2>
            <EmpresaInfoPanel empresa={empresa ?? null} />
          </div>
        );
      case "sumario":
        return (
          <div className="mb-6 break-inside-avoid">
            <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
              Sumário
            </h2>
            <ol className="space-y-1">
              {sumarioTitulos.map((t, i) => (
                <li key={i} className="flex items-baseline gap-2 border-b border-dotted border-gray-300 py-0.5 text-xs text-gray-700">
                  <span className="min-w-5 font-bold text-emerald-800">{i + 1}.</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      case "quimicos_analise":
        return (
          <div className="mb-6">
            <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
              {numLabelQ(numPorSlugQ["quimicos_analise"], tituloPorSlugQ["quimicos_analise"] ?? "Análise Técnica")}
            </h2>
            {analiseBodyScreenNode}
          </div>
        );
      default:
        return null;
    }
  }

  const temFixosQ = capitulosQ.some((c) => c.tipo === "fixo");
  const corpoScreen = temFixosQ ? (
    blocosQ.map((c) =>
      c.tipo === "fixo" ? (
        <React.Fragment key={c.id_capitulo}>{renderSecaoQScreen(c.slug_fixo ?? "")}</React.Fragment>
      ) : (
        <TextosPadraoPrint key={c.id_capitulo} modulo="analise_quimicos" capituloId={c.id_capitulo} valores={valoresTextosPadrao} numero={numPorIdQ[c.id_capitulo]} />
      ),
    )
  ) : (
    <>
      <TextosPadraoPrint modulo="analise_quimicos" valores={valoresTextosPadrao} posicao="inicio" />
      {analiseBodyScreenNode}
      <TextosPadraoPrint modulo="analise_quimicos" valores={valoresTextosPadrao} posicao="fim" />
    </>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Toolbar — não imprime */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/analise-quimicos/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Editar análise
        </Link>
      </div>

      {/* Botões PDF — sticky, não imprime */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur print:hidden">
        {pdfAssinado ? (
          <>
            <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <BadgeCheck className="size-3.5 shrink-0" />
              Assinado em {new Date(pdfAssinado.assinado_em).toLocaleDateString("pt-BR")}
            </div>
            <button type="button" onClick={handleBaixarPdf} disabled={baixando}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Baixar PDF Assinado
            </button>
            <BotaoAssinarPdf reAssinatura={true} defaultSignatoryName={analise.usuario_nome ?? undefined} apiPdfUrl={`/api/pdf/analise-quimicos/${id}`} baseCongeladaUrl={baseCongeladaUrl} tabelaNome="analises_quimicos" docId={id} onAssinado={recarregar} />
          </>
        ) : (
          <BotaoAssinarPdf apiPdfUrl={`/api/pdf/analise-quimicos/${id}`} baseCongeladaUrl={baseCongeladaUrl} tabelaNome="analises_quimicos" docId={id} onAssinado={recarregar} />
        )}
        <BotaoGerarPdf
          apiPdfUrl={`/api/pdf/analise-quimicos/${id}`}
          tabelaNome="analises_quimicos"
          docId={id}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          registrarPdf={{
            modulo: "analises_quimicos",
            tipoDocumento: "Análise de Agente Químico",
            idRelatorio: id,
            empresaId: analise.id_empresa ?? undefined,
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: analise.usuario_nome ?? undefined,
          }}
        />
      </div>

      <div className="px-4 pt-3">
        <PainelCongelamentoPdf
          modulo="analises_quimicos"
          idReferencia={id}
          apiPdfUrl={`/api/pdf/analise-quimicos/${id}`}
          opts={{
            tipoDocumento: "Análise de Agente Químico",
            empresaId: analise.id_empresa ?? undefined,
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: analise.usuario_nome ?? undefined,
          }}
        />
      </div>

      <div className="px-4 pt-3">
        <AnexosManager modulo="analise_quimicos" idReferencia={id} />
      </div>

      <div className="px-4 pt-3 print:hidden">
        <EmpresaInfoPanel empresa={empresa ?? null} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" />
      </div>

      {/* Logo JCN Consultoria */}
      <RelatorioPrintHeader
        titulo="Análise de Agente Químico"
        subtitulo={analise.titulo}
        terciario={empresa?.nome_empresa ?? null}
      />

      {/* Conclusão rápida */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none print:p-2">
        <h2 className="mb-3 text-base font-bold text-verde-primary">Conclusão Rápida</h2>
        <ConclusaoRapidaCard conclusao={analise.conclusao_rapida} />
      </section>

      {/* Corpo do laudo — ordem unificada (sistema + editáveis) ou layout legado */}
      {corpoScreen}

      {/* Assinatura — só no fim quando não há capítulo "quimicos_assinatura" ativo. */}
      {!temAssinaturaFixoQ && assinaturaScreenNode}

      {/* Rodapé */}
      <p className="text-center text-[9px] text-gray-500 print:mt-4">
        Análise gerada por IA · JCN Consultoria — Segurança e Saúde do Trabalho ·{" "}
        {new Date(analise.created_at).toLocaleString("pt-BR")} · Revisão técnica obrigatória antes de uso oficial.
      </p>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 3cm 2cm 2cm 3cm;
          }
          body { font-size: 12pt; line-height: 1.5; }
        }
      `}</style>
    </div>
  );
}
