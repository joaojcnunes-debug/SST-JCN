"use client";

import React, { useMemo, useState, use } from "react";
import { BadgeCheck, Download, Loader2 } from "lucide-react";
import { usePdfAssinado, usePdfCongelado } from "@/lib/hooks/usePdfsGerados";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import StorageImg from "@/components/ui/StorageImg";
import AnexosManager from "@/components/anexos/AnexosManager";
import PainelCongelamentoPdf from "@/components/ui/PainelCongelamentoPdf";
import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import DrpsSumarioPrint from "@/components/drps/DrpsSumarioPrint";
import DrpsRelatorioExtrasPrint from "@/components/drps/DrpsRelatorioExtrasPrint";
import DrpsGestaoResumoPrint from "@/components/drps/DrpsGestaoResumoPrint";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import HtmlConteudoAssinado from "@/components/ui/HtmlConteudoAssinado";
import { useDrpsStore } from "@/lib/drps/store";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import {
  useDrpsProbabilidades,
  useDrpsRelatorio,
  useDrpsRespondentes,
} from "@/lib/hooks/useDrps";
import { useTextosPadrao } from "@/lib/hooks/useTextosPadrao";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  filtrarPorSetor,
  listarSetores,
} from "@/lib/drps/calculos";
import { montarValoresVariaveis, substituirVariaveis, substituirVariaveisTexto } from "@/lib/drps/variaveis";
import { detectRegistroTipo } from "@/lib/registro-profissional";
import { TOPICOS } from "@/lib/drps/topicos";
import {
  formatCNPJ,
  formatCPF,
  formatCEI,
  formatCAEPF,
  formatCNO,
} from "@/lib/utils";
import type { Empresa } from "@/lib/supabase/types";
import type {
  DrpsProbabilidade,
  DrpsRelatorio,
  TopicoComMatriz,
} from "@/lib/drps/types";

interface SetorRelatorio {
  setor: string;
  totalRespondentes: number;
  funcoes: string;
  topicos: TopicoComMatriz[];
}

function montarMapaProb(
  probabilidades: DrpsProbabilidade[],
  setor: string
): Record<number, 1 | 2 | 3> {
  const m: Record<number, 1 | 2 | 3> = {};
  for (let i = 0; i < TOPICOS.length; i++) m[i] = 1;
  for (const p of probabilidades) {
    if (p.setor === setor) m[p.topico_idx] = p.probabilidade as 1 | 2 | 3;
  }
  return m;
}

export default function PsicossocialLaudoPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const setor = useDrpsStore((s) => s.setor);
  const { data: relatorio } = useDrpsRelatorio(idRelatorio);
  const { data: empresa } = useEmpresa(relatorio?.id_empresa);
  const { data: respondentes = [] } = useDrpsRespondentes(idRelatorio);
  const { data: probabilidades = [] } = useDrpsProbabilidades(idRelatorio);
  const valoresVars = useMemo(() => {
    const base = montarValoresVariaveis(empresa, relatorio ?? null);
    const timestamps = respondentes
      .map((r) => r.data_carimbo)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime())
      .filter((n) => !Number.isNaN(n));
    const inicio = timestamps.length > 0
      ? new Date(Math.min(...timestamps)).toLocaleDateString("pt-BR")
      : "";
    const fim = timestamps.length > 0
      ? new Date(Math.max(...timestamps)).toLocaleDateString("pt-BR")
      : "";
    return { ...base, data_carimbo_inicio: inicio, data_carimbo_fim: fim };
  }, [empresa, relatorio, respondentes]);

  const setoresParaRelatorio = useMemo<string[]>(() => {
    if (setor === "Todos") return listarSetores(respondentes);
    return [setor];
  }, [setor, respondentes]);

  const relatoriosPorSetor = useMemo<SetorRelatorio[]>(() => {
    return setoresParaRelatorio.map((s) => {
      const filtrados = filtrarPorSetor(respondentes, s);
      const topicos = calcularResumoCompleto(filtrados);
      const mapaProb = montarMapaProb(probabilidades, s);
      const topicosComMatriz = aplicarMatriz(topicos, mapaProb);
      const cargosSet = new Set<string>();
      for (const r of filtrados) {
        if (r.cargo && r.cargo.trim()) cargosSet.add(r.cargo.trim());
      }
      const funcoes = Array.from(cargosSet)
        .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
        .join(", ");
      return { setor: s, totalRespondentes: filtrados.length, funcoes, topicos: topicosComMatriz };
    });
  }, [setoresParaRelatorio, respondentes, probabilidades]);

  const { pdfAssinado, recarregar } = usePdfAssinado("drps_relatorios_analise", idRelatorio);
  const { data: pdfCongelado } = usePdfCongelado("drps", idRelatorio);
  const baseCongeladaUrl = pdfCongelado?.pdf_url ?? undefined;
  const { data: capitulosDrps = [] } = useTextosPadrao("psicossocial");
  const [baixando, setBaixando] = useState(false);

  async function handleBaixarPdf() {
    if (!pdfAssinado) return;
    setBaixando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // URL assinada (token único a cada clique) + no-store: ignora o cache do
      // CDN/navegador. O caminho é o mesmo a cada (re)assinatura, e o CDN servia
      // a versão antiga do mesmo path — daí o PDF baixado vir defasado.
      const { data: signed, error } = await supabase.storage
        .from("pdfs-assinados")
        .createSignedUrl(pdfAssinado.pdf_path, 120);
      if (error || !signed?.signedUrl) { toast.error("Não foi possível baixar o PDF."); return; }
      const res = await fetch(`${signed.signedUrl}&t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) { toast.error("Não foi possível baixar o PDF."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "relatorio-drps-assinado.pdf"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { toast.error("Erro ao baixar o PDF."); }
    finally { setBaixando(false); }
  }

  const podeImprimir = !!relatorio && respondentes.length > 0 && setoresParaRelatorio.length > 0;

  // Ordenação unificada do laudo DRPS (igual AEP): se houver seções do sistema
  // (tipo fixo) em drps_texto_padrao, o corpo é montado por `ordem` (editáveis +
  // seções intercalados). Sem fixos, mantém o layout posicional legado.
  const temFixos = capitulosDrps.some((c) => c.tipo === "fixo");
  // Se "Assinatura Técnica" estiver ativo, a folha é renderizada na posição dele;
  // senão, cai no fim (fallback) — espelha o template PDF.
  const temAssinaturaFixo = capitulosDrps.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "drps_assinatura" && c.ativo !== false,
  );
  const ordenados = [...capitulosDrps]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  // Só entram no Sumário/numeração os capítulos que renderizam seção numerada
  // no corpo (evita fantasmas/lacunas). Sumário e assinatura não numeram.
  const renderizaNumerado = (c: TextoPadraoCapitulo): boolean => {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "drps_caracterizacao":   return relatoriosPorSetor.length > 0;
      case "drps_analise_setor":    return relatoriosPorSetor.length > 0;
      case "drps_conclusao":        return !!relatorio?.conclusao_geral;
      case "drps_plano_medidas":    return true; // DrpsGestaoResumoPrint sempre renderiza
      case "drps_revisao":          return true; // DrpsRelatorioExtrasPrint renderiza
      case "drps_assinatura":       return true; // folha de assinaturas é capítulo numerado
      default:                      return false; // sumario
    }
  };

  // Numeração dos capítulos para casar com o Sumário (mesma ordem/predicado).
  const numPorSlug: Record<string, number> = {};
  const numPorId: Record<string, number> = {};
  {
    let nSeq = 0;
    for (const c of ordenados) {
      if (!renderizaNumerado(c)) continue;
      nSeq += 1;
      if (c.tipo === "fixo" && c.slug_fixo) numPorSlug[c.slug_fixo] = nSeq;
      numPorId[c.id_capitulo] = nSeq;
    }
  }
  const numLabel = (num: number | undefined, txt: string) => (num ? `${num}. ${txt}` : txt);

  const sumarioScreenNode = (
    <DrpsSumarioPrint
      setores={relatoriosPorSetor.map((r) => r.setor)}
      valores={valoresVars}
      temConclusaoGeral={!!relatorio?.conclusao_geral}
      temMedidas={true}
      temMonitoramento={true}
      temRevisao={true}
    />
  );

  const setoresScreenNode = relatoriosPorSetor.map((r, idx) => (
    <BlocoSetorLaudo
      key={r.setor}
      relatorio={r}
      drpsRel={relatorio ?? null}
      empresa={empresa ?? null}
      indice={idx + 1}
      total={relatoriosPorSetor.length}
      ehConsolidado={setor === "Todos"}
    />
  ));

  // Conclusão Geral vem do RichTextEditor (HTML) — renderiza como HTML; antes
  // saía como texto puro, mostrando as tags <p style="..."> literalmente.
  const conclusaoScreenNode = relatorio?.conclusao_geral ? (
    <section className="drps-conclusao-geral-print">
      <style>{`
        .drps-conclusao-geral-print { page-break-before: always; font-family: 'Times New Roman', Times, serif; }
        .drps-conclusao-geral-print h2 { font-size: 16pt; font-weight: 700; color: #1e4d28; border-bottom: 2px solid #0ea5e9; padding-bottom: 6px; margin: 0 0 14pt 0; text-transform: uppercase; letter-spacing: 0.05em; }
        .drps-conclusao-geral-print p { font-size: 12pt; line-height: 1.6; text-align: justify; color: #1f2937; margin: 0 0 12pt 0; text-indent: 1.25cm; }
        .drps-conclusao-geral-print ul, .drps-conclusao-geral-print ol { margin: 0 0 12pt 1.5em; font-size: 12pt; line-height: 1.6; }
      `}</style>
      <h2>{numLabel(numPorSlug["drps_conclusao"], "Conclusão Geral")}</h2>
      <HtmlConteudoAssinado html={relatorio.conclusao_geral} />
    </section>
  ) : null;

  // Caracterização dos Trabalhadores — distribuição quantitativa por setor/função.
  const totalTrabalhadoresScreen = relatoriosPorSetor.reduce(
    (s, r) => s + r.totalRespondentes,
    0,
  );
  const caracterizacaoScreenNode = relatoriosPorSetor.length > 0 ? (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
        {numLabel(numPorSlug["drps_caracterizacao"], "Caracterização dos Trabalhadores")}
      </h2>
      <p className="mb-2 text-xs text-gray-600">
        Distribuição quantitativa dos trabalhadores avaliados por setor e função,
        conforme os respondentes do Diagnóstico de Riscos Psicossociais.
      </p>
      <table className="drps-tabela text-xs">
        <thead>
          <tr>
            <th className="drps-label" style={{ width: "32%", textAlign: "left" }}>Setor</th>
            <th className="drps-label" style={{ textAlign: "left" }}>Funções</th>
            <th className="drps-label" style={{ width: "16%", textAlign: "center" }}>Trabalhadores</th>
          </tr>
        </thead>
        <tbody>
          {relatoriosPorSetor.map((r) => (
            <tr key={r.setor}>
              <td>{r.setor}</td>
              <td>{r.funcoes || "—"}</td>
              <td style={{ textAlign: "center" }}>{r.totalRespondentes}</td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 700 }}>Total</td>
            <td />
            <td style={{ textAlign: "center", fontWeight: 700 }}>{totalTrabalhadoresScreen}</td>
          </tr>
        </tbody>
      </table>
    </section>
  ) : null;

  // Títulos do sumário — só capítulos que viram seção numerada (mesmo predicado).
  const sumarioTitulos = ordenados
    .filter((c) => renderizaNumerado(c))
    .map((c) =>
      c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valoresVars),
    )
    .filter((t) => t && t.trim());

  const identificacaoScreenNode = (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
        {numLabel(numPorSlug["identificacao_empresa"], "Identificação da Empresa")}
      </h2>
      <EmpresaInfoPanel empresa={empresa ?? null} />
    </section>
  );

  const sumarioListaScreenNode = sumarioTitulos.length > 0 ? (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
        Sumário
      </h2>
      <ol className="space-y-1 text-xs text-gray-700">
        {sumarioTitulos.map((t, i) => (
          <li key={i} className="flex gap-2 border-b border-dotted border-gray-300 py-0.5">
            <span className="min-w-5 font-bold text-emerald-700">{i + 1}.</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </section>
  ) : null;

  const assinaturaScreenNode = (
    <AssinaturaRelatorio
      nomeResponsavel={relatorio?.responsavel_tecnico ?? undefined}
      tabelaNome="drps_relatorios_analise"
      docId={idRelatorio}
      hideAcoes
      numero={numPorSlug["drps_assinatura"]}
    />
  );

  function renderSecaoScreen(slug: string): React.ReactNode {
    switch (slug) {
      case "identificacao_empresa": return identificacaoScreenNode;
      case "sumario":               return sumarioListaScreenNode;
      case "drps_caracterizacao": return caracterizacaoScreenNode;
      case "drps_analise_setor": return (
        <>
          <section className="mb-3 break-inside-avoid">
            <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
              {numLabel(numPorSlug["drps_analise_setor"], "Análise por Setor")}
            </h2>
          </section>
          {setoresScreenNode}
        </>
      );
      case "drps_conclusao":     return conclusaoScreenNode;
      case "drps_plano_medidas": return <DrpsGestaoResumoPrint idRelatorio={idRelatorio} numero={numPorSlug["drps_plano_medidas"]} />;
      case "drps_revisao":       return <DrpsRelatorioExtrasPrint idRelatorio={idRelatorio} numero={numPorSlug["drps_revisao"]} />;
      case "drps_assinatura":    return assinaturaScreenNode;
      default:                   return null;
    }
  }

  function renderEditavelScreen(c: TextoPadraoCapitulo): React.ReactNode {
    if (c.bg_imagem_url) {
      return (
        <div style={{ position: "relative", width: "100%", marginBottom: 16, breakAfter: "page" }}>
          <StorageImg stored={c.bg_imagem_url} alt="" className="block h-auto w-full" />
          {(c.caixas_texto ?? []).map((cx) => (
            <div
              key={cx.id}
              style={{
                position: "absolute",
                left: `${cx.x}%`,
                top: `${cx.y}%`,
                width: `${cx.w ?? 40}%`,
                fontSize: cx.fontSize ?? 16,
                fontWeight: cx.bold ? 700 : 400,
                color: cx.color ?? "#ffffff",
                textAlign: cx.align ?? "left",
                whiteSpace: "pre-wrap",
                lineHeight: 1.3,
              }}
            >
              {substituirVariaveisTexto(cx.conteudo, valoresVars)}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="mb-6 break-inside-avoid">
        <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
          {numLabel(numPorId[c.id_capitulo], substituirVariaveisTexto(c.titulo, valoresVars))}
        </h2>
        <HtmlConteudoAssinado
          className="prose prose-sm max-w-none text-xs leading-relaxed text-gray-700 [&_p]:mb-2 [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1"
          html={substituirVariaveis(c.conteudo, valoresVars)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{`
        .drps-print-container {
          font-family: var(--font-sans), Inter, system-ui, sans-serif;
          color: #111827;
          font-size: 11px;
          line-height: 1.55;
        }
        @media print {
          @page { size: A4; margin: 1.4cm 1.2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          .drps-print-container { padding: 0 !important; box-shadow: none !important; border: none !important; }
          .drps-capitulos { break-after: page; }
          .drps-capitulo--capa { break-before: page; break-after: page; }
          .drps-capitulo--capa:first-child { break-before: auto; }
          .drps-setor-bloco { break-before: page; }
          .drps-setor-bloco:first-child { break-before: auto; }
          .drps-tabela tr, .drps-tabela td, .drps-tabela th { break-inside: avoid; }
          .drps-capitulo-conteudo p,
          .drps-capitulo-conteudo li { break-inside: avoid; page-break-inside: avoid; }
          .drps-capitulos-apos-setores { break-before: page; }
        }
        .drps-tabela { border-collapse: collapse; width: 100%; font-size: 11px; }
        .drps-tabela td, .drps-tabela th { border: 1px solid #cbd5e1; padding: 7px 10px; vertical-align: top; }
        .drps-label { background: #f0f9f4; font-weight: 600; color: #1e4d28; font-size: 10.5px; letter-spacing: 0.02em; width: 30%; }
        .drps-header-section { background: #d4edda; color: #1e4d28; font-weight: 700; text-align: center; font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 8px 10px; }
        .drps-title { background: linear-gradient(180deg, #0ea5e9 0%, #00563f 100%); color: white; font-weight: 700; font-size: 13px; text-align: center; letter-spacing: 0.08em; text-transform: uppercase; padding: 10px 12px; }
        .drps-capitulo { margin-bottom: 22px; }
        .drps-setor-bloco { margin-bottom: 24px; }
        .drps-setor-bloco .drps-tabela + .drps-tabela { margin-top: 0; }
        .drps-capitulo--capa { position: relative; min-height: calc(297mm - 2.8cm); margin: -1.5rem -1.5rem 0 -1.5rem; overflow: hidden; color: inherit; }
        .drps-capitulo-bg-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; z-index: 0; }
        .drps-capitulo--capa .drps-capitulo-titulo { display: none; }
        .drps-capitulo--capa .drps-capitulo-conteudo, .drps-capitulo--capa .drps-caixa-texto { position: relative; z-index: 1; }
        @media print {
          .drps-capitulo--capa { margin: 0; padding: 0; height: calc(297mm - 2.8cm - 1mm); min-height: calc(297mm - 2.8cm - 1mm); max-height: calc(297mm - 2.8cm - 1mm); }
          .drps-capitulo--capa .drps-capitulo-conteudo { padding: 1.2cm; }
        }
        .drps-capitulo-titulo { font-size: 14px; font-weight: 700; color: #1e4d28; border-bottom: 2px solid #0ea5e9; padding-bottom: 4px; margin-bottom: 8px; }
        .drps-capitulo-conteudo { font-size: 11px; color: #1f2937; line-height: 1.55; }
        .drps-capitulo-conteudo p { margin: 0 0 8px 0; }
        .drps-capitulo-conteudo h1 { font-size: 16px; font-weight: 700; color: #1e4d28; margin: 12px 0 6px; }
        .drps-capitulo-conteudo h2 { font-size: 14px; font-weight: 700; color: #1e4d28; margin: 10px 0 6px; }
        .drps-capitulo-conteudo h3 { font-size: 12px; font-weight: 700; color: #1e4d28; margin: 8px 0 4px; }
        .drps-capitulo-conteudo ul, .drps-capitulo-conteudo ol { margin: 0 0 8px 20px; padding: 0; }
        .drps-capitulo-conteudo li { margin: 2px 0; }
        .drps-capitulo-conteudo a { color: #0ea5e9; text-decoration: underline; }
        .drps-capitulo-conteudo img { max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0; }
        .drps-capitulo-conteudo table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 10px; }
        .drps-capitulo-conteudo th, .drps-capitulo-conteudo td { border: 1px solid #999; padding: 5px 7px; vertical-align: top; }
        .drps-capitulo-conteudo th { background: #d4edda; color: #1e4d28; font-weight: 700; text-align: left; }
      `}</style>

      {/* ── Cabeçalho da página ─────────────────────────────────── */}
      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-gray-900">Laudo DRPS</h1>
        <p className="text-sm text-gray-600">
          {empresa?.nome_empresa ?? "Carregando..."}
          {relatorio && (
            <span className="ml-2 text-xs text-gray-400">Rev. {relatorio.revisao}</span>
          )}
        </p>
      </div>

      {/* ── Filtro de setor ─────────────────────────────────────── */}
      <div className="print:hidden">
        <DrpsFiltro idRelatorio={idRelatorio} />
      </div>

      {/* ── Barra de ações ──────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur print:hidden">
        {pdfAssinado ? (
          <>
            <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <BadgeCheck className="size-3.5 shrink-0" />
              Assinado em {new Date(pdfAssinado.assinado_em).toLocaleDateString("pt-BR")}
            </div>
            <button
              type="button"
              onClick={handleBaixarPdf}
              disabled={baixando}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Baixar PDF Assinado
            </button>
            <BotaoAssinarPdf reAssinatura={true} defaultSignatoryName={relatorio?.responsavel_tecnico ?? undefined} apiPdfUrl={`/api/pdf/drps/${idRelatorio}`} baseCongeladaUrl={baseCongeladaUrl} tabelaNome="drps_relatorios_analise" docId={idRelatorio} onAssinado={recarregar} />
          </>
        ) : (
          <BotaoAssinarPdf
            defaultSignatoryName={relatorio?.responsavel_tecnico ?? undefined}
            apiPdfUrl={`/api/pdf/drps/${idRelatorio}`}
            baseCongeladaUrl={baseCongeladaUrl}
            tabelaNome="drps_relatorios_analise"
            docId={idRelatorio}
            onAssinado={recarregar}
          />
        )}
        <BotaoGerarPdf
          apiPdfUrl={`/api/pdf/drps/${idRelatorio}`}
          tabelaNome="drps_relatorios_analise"
          docId={idRelatorio}
          disabled={!podeImprimir}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
          registrarPdf={{
            modulo: "drps",
            tipoDocumento: "Diagnóstico de Riscos Psicossociais",
            idRelatorio,
            empresaId: relatorio?.id_empresa ?? undefined,
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: relatorio?.responsavel_tecnico ?? undefined,
          }}
        />
      </div>

      <div className="pt-3 print:hidden">
        <PainelCongelamentoPdf
          modulo="drps"
          idReferencia={idRelatorio}
          apiPdfUrl={`/api/pdf/drps/${idRelatorio}`}
          opts={{
            tipoDocumento: "Diagnóstico de Riscos Psicossociais",
            empresaId: relatorio?.id_empresa ?? undefined,
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: relatorio?.responsavel_tecnico ?? undefined,
          }}
        />
      </div>

      <div className="pt-3 print:hidden">
        <EmpresaInfoPanel empresa={empresa ?? null} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" />
      </div>

      <div className="pt-3 print:hidden">
        <AnexosManager modulo="psicossocial" idReferencia={idRelatorio} />
      </div>

      {respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
          Nenhum respondente importado — não é possível gerar o laudo.
        </div>
      ) : (
        <div className="drps-print-container rounded border border-gray-300 bg-white p-6 shadow-sm">
          {temFixos ? (
            <>
              {ordenados.map((c) =>
                c.tipo === "fixo" ? (
                  <React.Fragment key={c.id_capitulo}>
                    {renderSecaoScreen(c.slug_fixo ?? "")}
                  </React.Fragment>
                ) : (
                  <React.Fragment key={c.id_capitulo}>{renderEditavelScreen(c)}</React.Fragment>
                ),
              )}
            </>
          ) : (
            <>
              {sumarioScreenNode}
              {setoresScreenNode}
              {conclusaoScreenNode}
              <DrpsGestaoResumoPrint idRelatorio={idRelatorio} />
              <DrpsRelatorioExtrasPrint idRelatorio={idRelatorio} />
            </>
          )}

          {/* Fallback: sem capítulo de assinatura ativo, renderiza a folha no fim. */}
          {!temAssinaturaFixo && assinaturaScreenNode}

          <p className="mt-6 text-center text-[9px] text-gray-500 print:hidden">
            Documento gerado pelo SST JCN Consultoria em{" "}
            {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
      )}
    </div>
  );
}

function BlocoSetorLaudo({
  relatorio,
  drpsRel,
  empresa,
  indice,
  total,
  ehConsolidado,
}: {
  relatorio: SetorRelatorio;
  drpsRel: DrpsRelatorio | null;
  empresa: Empresa | null;
  indice: number;
  total: number;
  ehConsolidado: boolean;
}) {
  const identificadores: { label: string; valor: string }[] = [];
  if (empresa?.cnpj) identificadores.push({ label: "CNPJ", valor: formatCNPJ(empresa.cnpj) });
  if (empresa?.cpf)  identificadores.push({ label: "CPF",  valor: formatCPF(empresa.cpf) });
  if (empresa?.cei)  identificadores.push({ label: "CEI",  valor: formatCEI(empresa.cei) });
  if (empresa?.caepf) identificadores.push({ label: "CAEPF", valor: formatCAEPF(empresa.caepf) });
  if (empresa?.cno)  identificadores.push({ label: "CNO",  valor: formatCNO(empresa.cno) });
  if (identificadores.length === 0) identificadores.push({ label: "CNPJ", valor: "—" });

  const cargoResponsavel = null; // não armazenado no DB; label padrão = "Registro"

  return (
    <section className="drps-setor-bloco mb-4">
      <table className="drps-tabela mb-0">
        <tbody>
          <tr>
            <td className="drps-title" colSpan={4}>
              <div className="flex items-center justify-center gap-3">
                <span>DRPS — Diagnóstico de Riscos Psicossociais</span>
                {drpsRel && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide">
                    Rev. {drpsRel.revisao}
                  </span>
                )}
                {ehConsolidado && (
                  <span className="text-[10px] font-normal opacity-80">{indice}/{total}</span>
                )}
              </div>
            </td>
          </tr>
          <tr>
            <td className="drps-label" style={{ width: "30%" }}>
              Responsável Técnico pela Avaliação (Psicólogo)
            </td>
            <td>{drpsRel?.responsavel_tecnico ?? ""}</td>
            <td className="drps-label" style={{ width: "10%" }}>
              {detectRegistroTipo(cargoResponsavel).label}
            </td>
            <td style={{ width: "20%" }}>{drpsRel?.crp ?? ""}</td>
          </tr>
          <tr><td className="drps-header-section" colSpan={4}>IDENTIFICAÇÃO</td></tr>
          <tr>
            <td className="drps-label">{identificadores[0].label}</td>
            <td>{identificadores[0].valor}</td>
            <td className="drps-label">Data da Elaboração</td>
            <td>
              {drpsRel?.data_elaboracao
                ? new Date(drpsRel.data_elaboracao + "T00:00:00").toLocaleDateString("pt-BR")
                : ""}
            </td>
          </tr>
          {identificadores.slice(1).map((ident) => (
            <tr key={ident.label}>
              <td className="drps-label">{ident.label}</td>
              <td colSpan={3}>{ident.valor}</td>
            </tr>
          ))}
          <tr>
            <td className="drps-label">Empresa</td>
            <td colSpan={3}>{empresa?.nome_empresa ?? "—"}</td>
          </tr>
          <tr>
            <td className="drps-label">Setor</td>
            <td colSpan={3}>{relatorio.setor}</td>
          </tr>
          <tr>
            <td className="drps-label">Funções</td>
            <td colSpan={3}>{relatorio.funcoes || "—"}</td>
          </tr>
          <tr>
            <td className="drps-label">Quantidade de Trabalhadores na Função</td>
            <td colSpan={3}>{relatorio.totalRespondentes}</td>
          </tr>
          <tr><td className="drps-header-section" colSpan={4}>Classificação de Risco Psicossocial</td></tr>
          <tr>
            <td colSpan={4} className="text-center text-[11px] font-semibold uppercase tracking-wider" style={{ background: "#f0f9f4", color: "#1e4d28" }}>
              Quantitativo e Qualitativo
            </td>
          </tr>
        </tbody>
      </table>

      <table className="drps-tabela mt-0">
        <thead>
          <tr>
            <th className="drps-label" style={{ width: "30%", textAlign: "left" }}>Fatores de Risco</th>
            <th className="drps-label" style={{ width: "35%", textAlign: "left" }}>Fontes Geradoras do Risco</th>
            <th className="drps-label" style={{ width: "11%" }}>Gravidade<br /><span className="text-[9px] font-normal italic">(Severidade)</span></th>
            <th className="drps-label" style={{ width: "12%" }}>Probabilidade<br /><span className="text-[9px] font-normal italic">de Ocorrência</span></th>
            <th className="drps-label" style={{ width: "12%" }}>Matriz de Risco</th>
          </tr>
        </thead>
        <tbody>
          {relatorio.topicos.map((t) => (
            <tr key={t.idx}>
              <td className="text-[11px] text-gray-900">{t.nome.replace(/^Tópico \d+ - /, "")}</td>
              <td className="text-[10px] text-gray-700">{t.fonteGeradora}</td>
              <td className="text-center">
                <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: t.classificacaoGravidade.cor }}>
                  {t.classificacaoGravidade.texto}
                </span>
              </td>
              <td className="text-center text-[10px] text-gray-700">{t.classificacaoProbabilidade}</td>
              <td className="text-center">
                <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: t.corMatriz }}>
                  {t.matriz}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 text-[9px] text-gray-500">
        {relatorio.totalRespondentes} respondente(s) · {relatorio.topicos.length} tópico(s)
      </div>

      <table className="drps-tabela mt-2">
        <tbody>
          <tr><td className="drps-header-section">Possíveis Agravos à Saúde Mental</td></tr>
          <tr>
            <td className="align-top whitespace-pre-wrap text-[11px]">
              {drpsRel?.agravos_por_setor?.[relatorio.setor] ?? ""}
            </td>
          </tr>
          <tr><td className="drps-header-section">Medidas de controle recomendadas (medidas que a empresa deve adotar)</td></tr>
          <tr>
            <td className="align-top whitespace-pre-wrap text-[11px]">
              {drpsRel?.medidas_por_setor?.[relatorio.setor] ?? ""}
            </td>
          </tr>
        </tbody>
      </table>

      {(() => {
        const conclusao = drpsRel?.conclusoes_por_setor?.[relatorio.setor] ?? "";
        return (
          <table className="drps-tabela mt-2">
            <tbody>
              <tr><td className="drps-header-section">Conclusão</td></tr>
              <tr>
                <td className="align-top">
                  <HtmlConteudoAssinado
                    className="tiptap-conteudo prose prose-sm max-w-none text-[11px] leading-relaxed text-gray-900"
                    style={{ minHeight: 70 }}
                    html={conclusao || "<em style=\"color:#9ca3af\">(Conclusão não preenchida)</em>"}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        );
      })()}
    </section>
  );
}
