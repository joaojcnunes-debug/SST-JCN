"use client";

import React, { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Download, Loader2, AlertTriangle } from "lucide-react";
import { usePdfAssinado, usePdfCongelado } from "@/lib/hooks/usePdfsGerados";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import AnexosManager from "@/components/anexos/AnexosManager";
import PainelCongelamentoPdf from "@/components/ui/PainelCongelamentoPdf";
import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useMaquina } from "@/lib/hooks/useInventarioMaquinas";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import TextosPadraoPrint from "@/components/textos-padrao/TextosPadraoPrint";
import { useTextosPadrao } from "@/lib/hooks/useTextosPadrao";
import { montarValoresEmpresa, formatarDataBR, substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
import { useApreciacaoMaquina } from "@/lib/hooks/useApreciacoesMaquinas";
import ItemApreciacaoCard from "@/components/apreciacao-maquinas/ItemApreciacaoCard";
import PlanoAcaoTable from "@/components/apreciacao-maquinas/PlanoAcaoTable";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import { baixarPdfAssinado } from "@/lib/pdf/baixar-assinado";
import {
  CATEGORIAS_NR12_LABELS,
  CATEGORIAS_NR12_ORDEM,
  type CategoriaNR12,
} from "@/lib/apreciacao-maquinas/catalogo-nr12";
import type { ApreciacaoMaquinaItem } from "@/lib/supabase/types";

export default function LaudoApreciacaoMaquinasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useApreciacaoMaquina(id);
  const { data: empresas = [] } = useEmpresas();
  const { data: maquinaVinculada } = useMaquina(data?.apreciacao.id_maquina ?? null);

  const apreciacao = data?.apreciacao;
  const itens = data?.itens ?? [];

  const { pdfAssinado, recarregar } = usePdfAssinado("apreciacoes_maquinas", id);
  const { data: pdfCongelado } = usePdfCongelado("apreciacao_maquinas", id);
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

  const empresa = useMemo(() => {
    if (!apreciacao) return null;
    return empresas.find((e) => e.id_empresa === apreciacao.id_empresa) ?? null;
  }, [empresas, apreciacao]);

  const empresaNome = empresa?.nome_empresa ?? "—";

  const maquinaNome =
    maquinaVinculada?.nome ?? apreciacao?.maquina_descricao ?? "Máquina";

  const itensPorCategoria = useMemo(() => {
    const grupos: Record<string, ApreciacaoMaquinaItem[]> = {};
    itens.forEach((i) => {
      const cat = i.item_categoria;
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(i);
    });
    return CATEGORIAS_NR12_ORDEM.map((cat) => ({
      categoria: cat as CategoriaNR12,
      label: CATEGORIAS_NR12_LABELS[cat as CategoriaNR12],
      itens: grupos[cat] ?? [],
    })).filter((g) => g.itens.length > 0);
  }, [itens]);

  const valoresTextosPadrao = useMemo((): Record<string, string> => {
    if (!apreciacao) return {};
    return {
      ...montarValoresEmpresa(empresa),
      titulo: apreciacao.titulo ?? "",
      maquina_nome: maquinaNome,
      setor: apreciacao.setor ?? "",
      responsavel: apreciacao.responsavel ?? "",
      responsavel_empresa: apreciacao.responsavel_empresa ?? "",
      cidade: apreciacao.cidade ?? "",
      data_apreciacao: formatarDataBR(apreciacao.data_apreciacao),
      data_atual: new Date().toLocaleDateString("pt-BR"),
      total_itens: String(itens.length),
      total_nao_conforme: String(itens.filter((i) => i.situacao === "NAO_CONFORME").length),
      risco_residual: apreciacao.risco_residual ?? "",
      carimbo: apreciacao.responsavel ?? "",
      importado: formatarDataBR(apreciacao.created_at),
    };
  }, [apreciacao, empresa, maquinaNome, itens]);

  const { data: capitulosAp = [] } = useTextosPadrao("apreciacao_maquinas");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error || !apreciacao) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href="/apreciacao-maquinas"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="size-4" />
          Apreciação não encontrada.
        </div>
      </div>
    );
  }

  // Título cadastrado de cada seção fixa (p/ cabeçalho numerado no corpo).
  const tituloPorSlugAp: Record<string, string> = {};
  for (const c of capitulosAp) if (c.slug_fixo) tituloPorSlugAp[c.slug_fixo] = c.titulo;

  // Conclusão Técnica só renderiza quando há parecer/recomendações.
  const temConclusaoAp = !!(apreciacao.conclusao_tecnica || apreciacao.recomendacoes);

  // Só entra no Sumário/numeração quem vira seção numerada (mesmo predicado do PDF).
  const renderizaNumeradoAp = (c: (typeof capitulosAp)[number]): boolean => {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "apreciacao_checklist":  return true;
      case "apreciacao_risco":      return temConclusaoAp;
      case "apreciacao_plano":      return true;
      case "apreciacao_assinatura": return true;
      default:                      return false; // sumario, apreciacao_identificacao
    }
  };

  const blocosAp = [...capitulosAp]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const numPorSlugAp: Record<string, number> = {};
  const numPorIdAp: Record<string, number> = {};
  {
    let n = 0;
    for (const c of blocosAp) {
      if (!renderizaNumeradoAp(c)) continue;
      n += 1;
      if (c.tipo === "fixo" && c.slug_fixo) numPorSlugAp[c.slug_fixo] = n;
      numPorIdAp[c.id_capitulo] = n;
    }
  }
  const numLabelAp = (num: number | undefined, txt: string) => (num ? `${num}. ${txt}` : txt);

  const temAssinaturaFixoAp = capitulosAp.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "apreciacao_assinatura" && c.ativo !== false,
  );

  const assinaturaScreenNode = (
    <div className="print:break-inside-avoid">
      <AssinaturaRelatorio
        nomeResponsavel={apreciacao.responsavel ?? undefined}
        dataRelatorio={formatarDataBR(apreciacao.data_apreciacao) || undefined}
        tabelaNome="apreciacoes_maquinas"
        docId={id}
        hideAcoes
        numero={numPorSlugAp["apreciacao_assinatura"]}
      />
    </div>
  );

  // Seções do sistema (reusadas nos dois modos de render).
  const checklistScreenNode = (
    <section className="space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
        {numLabelAp(numPorSlugAp["apreciacao_checklist"], tituloPorSlugAp["apreciacao_checklist"] ?? "Checklist NR-12")}
      </h2>
      {itensPorCategoria.map((grupo) => (
        <div key={grupo.categoria} className="space-y-2 print:break-inside-avoid">
          <h3 className="rounded-md bg-orange-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-700 print:bg-transparent print:border-b print:border-orange-300 print:rounded-none print:text-orange-900">
            {grupo.label} <span className="text-orange-500/70">({grupo.itens.length})</span>
          </h3>
          <div className="space-y-2">
            {grupo.itens.map((it) => (
              <ItemApreciacaoCard key={it.id_item} item={it} disabled={true} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );

  const conclusaoScreenNode = temConclusaoAp ? (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:border print:border-gray-300 print:shadow-none print:p-3 print:break-inside-avoid">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-700">
        {numLabelAp(numPorSlugAp["apreciacao_risco"], tituloPorSlugAp["apreciacao_risco"] ?? "Conclusão Técnica")}
      </h2>
      {apreciacao.conclusao_tecnica && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Parecer técnico</p>
          <p className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap">{apreciacao.conclusao_tecnica}</p>
        </div>
      )}
      {apreciacao.recomendacoes && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Recomendações finais</p>
          <p className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap">{apreciacao.recomendacoes}</p>
        </div>
      )}
    </section>
  ) : null;

  const planoScreenNode = (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:border print:border-gray-300 print:shadow-none print:p-3 print:break-inside-avoid">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-700">
        {numLabelAp(numPorSlugAp["apreciacao_plano"], tituloPorSlugAp["apreciacao_plano"] ?? "Plano de Ação")}
      </h2>
      <PlanoAcaoTable idApreciacao={apreciacao.id_apreciacao} apreciacao={apreciacao} itens={itens} readOnly={true} />
    </section>
  );

  // Títulos do sumário — só capítulos que viram seção numerada (mesmo predicado do PDF).
  const sumarioTitulos = blocosAp
    .filter((c) => renderizaNumeradoAp(c))
    .map((c) =>
      c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valoresTextosPadrao),
    )
    .filter((t) => t && t.trim());

  const identificacaoEmpresaScreenNode = (
    <div className="mb-6 break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
        {numLabelAp(numPorSlugAp["identificacao_empresa"], "Identificação da Empresa")}
      </h2>
      <EmpresaInfoPanel empresa={empresa ?? null} />
    </div>
  );

  const sumarioScreenNode = (
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

  function renderSecaoApScreen(slug: string): React.ReactNode {
    switch (slug) {
      case "identificacao_empresa": return identificacaoEmpresaScreenNode;
      case "sumario":               return sumarioScreenNode;
      case "apreciacao_checklist":  return checklistScreenNode;
      case "apreciacao_risco":      return conclusaoScreenNode;
      case "apreciacao_plano":      return planoScreenNode;
      case "apreciacao_assinatura": return assinaturaScreenNode;
      default:                      return null; // apreciacao_identificacao (dados no cabeçalho)
    }
  }

  const temFixosAp = capitulosAp.some((c) => c.tipo === "fixo");
  const corpoScreen = temFixosAp ? (
    blocosAp.map((c) =>
      c.tipo === "fixo" ? (
        <div key={c.id_capitulo} data-slug={c.slug_fixo ?? undefined}>
          {renderSecaoApScreen(c.slug_fixo ?? "")}
        </div>
      ) : (
        <TextosPadraoPrint key={c.id_capitulo} modulo="apreciacao_maquinas" capituloId={c.id_capitulo} valores={valoresTextosPadrao} numero={numPorIdAp[c.id_capitulo]} />
      ),
    )
  ) : (
    <>
      <TextosPadraoPrint modulo="apreciacao_maquinas" valores={valoresTextosPadrao} posicao="inicio" />
      {checklistScreenNode}
      {conclusaoScreenNode}
      {planoScreenNode}
      <TextosPadraoPrint modulo="apreciacao_maquinas" valores={valoresTextosPadrao} posicao="fim" />
    </>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-3">
      {/* CSS de impressão */}
      <style>{`
        @media print {
          @page { size: A4; margin: 3cm 2cm 2cm 3cm; }
          body { font-size: 12pt; line-height: 1.5; }
        }
      `}</style>

      {/* Toolbar — não imprime */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/apreciacao-maquinas/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Editar apreciação
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
            <BotaoAssinarPdf reAssinatura={true} defaultSignatoryName={apreciacao.responsavel ?? undefined} apiPdfUrl={`/api/pdf/apreciacao/${id}`} baseCongeladaUrl={baseCongeladaUrl} tabelaNome="apreciacoes_maquinas" docId={id} onAssinado={recarregar} />
          </>
        ) : (
          <BotaoAssinarPdf defaultSignatoryName={apreciacao.responsavel ?? undefined} apiPdfUrl={`/api/pdf/apreciacao/${id}`} baseCongeladaUrl={baseCongeladaUrl} tabelaNome="apreciacoes_maquinas" docId={id} onAssinado={recarregar} />
        )}
        <BotaoGerarPdf
          apiPdfUrl={`/api/pdf/apreciacao/${id}`}
          tabelaNome="apreciacoes_maquinas"
          docId={id}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          registrarPdf={{
            modulo: "apreciacao_maquinas",
            tipoDocumento: "Apreciação de Máquinas NR-12",
            idRelatorio: id,
            empresaId: apreciacao.id_empresa ?? undefined,
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: apreciacao.responsavel ?? undefined,
          }}
        />
      </div>

      <div className="px-4 pt-3">
        <PainelCongelamentoPdf
          modulo="apreciacao_maquinas"
          idReferencia={id}
          apiPdfUrl={`/api/pdf/apreciacao/${id}`}
          opts={{
            tipoDocumento: "Apreciação de Máquinas NR-12",
            empresaId: apreciacao.id_empresa ?? undefined,
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: apreciacao.responsavel ?? undefined,
          }}
        />
      </div>

      <div className="px-4 pt-3 print:hidden">
        <EmpresaInfoPanel empresa={empresa ?? null} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" />
      </div>

      <div className="px-4 pt-3">
        <AnexosManager modulo="apreciacao_maquinas" idReferencia={id} />
      </div>

      {/* Logo JCN Consultoria */}
      <RelatorioPrintHeader
        titulo={`Apreciação NR-12 — ${maquinaNome}`}
        subtitulo={empresaNome}
        terciario={
          apreciacao.data_apreciacao
            ? new Date(apreciacao.data_apreciacao + "T00:00").toLocaleDateString("pt-BR")
            : null
        }
      />

      {/* Observações gerais (mesma posição do PDF: antes do corpo). */}
      {apreciacao.observacoes_gerais && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:border print:border-gray-300 print:shadow-none print:p-3 print:break-inside-avoid">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Observações Gerais</p>
          <p className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap">{apreciacao.observacoes_gerais}</p>
        </section>
      )}

      {/* Corpo do laudo — ordem unificada (sistema + editáveis) ou layout legado.
          (Cabeçalho do topo removido — o laudo começa pela capa, como no NC.) */}
      {corpoScreen}

      {/* Assinatura — só no fim quando não há capítulo "apreciacao_assinatura" ativo. */}
      {!temAssinaturaFixoAp && assinaturaScreenNode}
    </div>
  );
}
