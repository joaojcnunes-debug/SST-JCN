"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Download, Loader2, AlertCircle } from "lucide-react";
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
import { useRelatorioConformidade } from "@/lib/hooks/useRelatoriosConformidade";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import StorageImg from "@/components/ui/StorageImg";
import { baixarPdfAssinado } from "@/lib/pdf/baixar-assinado";
import type { RelatorioConformidadeItem } from "@/lib/supabase/types";

export default function LaudoConformidadePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useRelatorioConformidade(id);
  const { data: empresa } = useEmpresa(data?.relatorio.id_empresa ?? null);

  const { pdfAssinado, recarregar } = usePdfAssinado("relatorios_conformidade", id);
  const { data: pdfCongelado } = usePdfCongelado("conformidade", id);
  const baseCongeladaUrl = pdfCongelado?.pdf_url ?? undefined;
  const [baixando, setBaixando] = useState(false);

  const { data: capitulosConf = [] } = useTextosPadrao("conformidade");

  async function handleBaixarPdf() {
    if (!pdfAssinado) return;
    setBaixando(true);
    try {
      await baixarPdfAssinado(pdfAssinado.pdf_path, "relatorio-assinado.pdf");
    } catch { toast.error("Erro ao baixar o PDF."); }
    finally { setBaixando(false); }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        <Loader2 className="size-5 animate-spin" /> Carregando...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <AlertCircle className="mx-auto size-10 text-red-500" />
        <p className="mt-3 text-sm text-gray-700">Relatório não encontrado.</p>
        <Link href="/relatorio-conformidade" className="mt-4 inline-block text-sm text-teal-700 hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  const { relatorio, itens } = data;

  const valoresTextosPadrao: Record<string, string> = {
    ...montarValoresEmpresa(empresa),
    responsavel: relatorio.responsavel ?? "",
    responsavel_empresa: relatorio.responsavel_empresa ?? "",
    cidade: relatorio.cidade ?? "",
    nr_codigo: relatorio.nr_codigo,
    nr_titulo: relatorio.nr_titulo,
    setor: relatorio.setor ?? "",
    data_inspecao: formatarDataBR(relatorio.data_inspecao),
    carimbo: relatorio.responsavel ?? "",
    importado: formatarDataBR(relatorio.created_at),
  };

  // Resumo
  const total = itens.length;
  const conformes = itens.filter((i) => i.situacao === "CONFORME").length;
  const naoAplicaveis = itens.filter((i) => i.situacao === "NAO_APLICAVEL").length;
  const pendentes = itens.filter((i) => i.situacao === "PENDENTE").length;
  const avaliados = conformes + naoAplicaveis;
  const pct = total > 0 ? Math.round((avaliados / total) * 100) : 0;

  // Blocos ordenados (mesma regra do corpoScreen) p/ montar o sumário.
  const blocosConf = [...capitulosConf]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const tituloPorSlugConf: Record<string, string> = {};
  for (const c of capitulosConf) if (c.slug_fixo) tituloPorSlugConf[c.slug_fixo] = c.titulo;

  // Só entra no Sumário/numeração quem vira seção numerada (mesmo predicado do PDF).
  const renderizaNumeradoConf = (c: (typeof capitulosConf)[number]): boolean => {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa":   return true;
      case "conformidade_resultado":  return true;
      case "conformidade_itens":      return true;
      case "conformidade_assinatura": return true;
      default:                        return false; // sumario
    }
  };

  const numPorSlugConf: Record<string, number> = {};
  const numPorIdConf: Record<string, number> = {};
  {
    let n = 0;
    for (const c of blocosConf) {
      if (!renderizaNumeradoConf(c)) continue;
      n += 1;
      if (c.tipo === "fixo" && c.slug_fixo) numPorSlugConf[c.slug_fixo] = n;
      numPorIdConf[c.id_capitulo] = n;
    }
  }
  const numLabelConf = (num: number | undefined, txt: string) => (num ? `${num}. ${txt}` : txt);

  const sumarioTitulos = blocosConf
    .filter((c) => renderizaNumeradoConf(c))
    .map((c) =>
      c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valoresTextosPadrao),
    )
    .filter((t) => t && t.trim());

  const temAssinaturaFixoConf = capitulosConf.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "conformidade_assinatura" && c.ativo !== false,
  );

  const assinaturaScreenNode = (
    <AssinaturaRelatorio
      nomeResponsavel={relatorio.responsavel ?? undefined}
      dataRelatorio={formatarDataBR(relatorio.data_inspecao) || undefined}
      tabelaNome="relatorios_conformidade"
      docId={id}
      hideAcoes
      numero={numPorSlugConf["conformidade_assinatura"]}
    />
  );

  function renderSecaoConfScreen(slug: string): React.ReactNode {
    switch (slug) {
      case "identificacao_empresa":
        return (
          <div className="mb-6 break-inside-avoid">
            <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
              {numLabelConf(numPorSlugConf["identificacao_empresa"], "Identificação da Empresa")}
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
      case "conformidade_resultado":
        return (
          <div className="mb-6 break-inside-avoid">
            <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
              {numLabelConf(numPorSlugConf["conformidade_resultado"], tituloPorSlugConf["conformidade_resultado"] ?? "Resultado da Avaliação")}
            </h2>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
              <ResumoCard label="Conformes" valor={conformes} cor="emerald" total={total} />
              <ResumoCard label="Não aplicáveis" valor={naoAplicaveis} cor="gray" total={total} />
              <ResumoCard label="Pendentes" valor={pendentes} cor="amber" total={total} />
              <ResumoCard label="Avaliação" valor={`${pct}%`} cor="teal" />
            </section>
          </div>
        );
      case "conformidade_itens":
        return (
          <div className="mb-6">
            <section className="mb-6 space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 print:text-base">
                {numLabelConf(numPorSlugConf["conformidade_itens"], tituloPorSlugConf["conformidade_itens"] ?? "Itens do Checklist")} ({itens.length})
              </h2>
              <div className="space-y-2">
                {itens.map((item) => (
                  <ItemRowReadOnly key={item.id_item} item={item} />
                ))}
              </div>
            </section>
            {relatorio.observacoes_gerais && (
              <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none print:p-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Observações Gerais</p>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{relatorio.observacoes_gerais}</p>
              </section>
            )}
          </div>
        );
      case "conformidade_assinatura":
        return assinaturaScreenNode;
      default:
        return null;
    }
  }

  const temFixosConf = capitulosConf.some((c) => c.tipo === "fixo");
  const corpoScreen = temFixosConf ? (
    blocosConf.map((c) =>
      c.tipo === "fixo" ? (
        <React.Fragment key={c.id_capitulo}>{renderSecaoConfScreen(c.slug_fixo ?? "")}</React.Fragment>
      ) : (
        <TextosPadraoPrint key={c.id_capitulo} modulo="conformidade" capituloId={c.id_capitulo} valores={valoresTextosPadrao} numero={numPorIdConf[c.id_capitulo]} />
      ),
    )
  ) : (
    <>
      <TextosPadraoPrint modulo="conformidade" valores={valoresTextosPadrao} posicao="inicio" />
      <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
        <ResumoCard label="Conformes" valor={conformes} cor="emerald" total={total} />
        <ResumoCard label="Não aplicáveis" valor={naoAplicaveis} cor="gray" total={total} />
        <ResumoCard label="Pendentes" valor={pendentes} cor="amber" total={total} />
        <ResumoCard label="Avaliação" valor={`${pct}%`} cor="teal" />
      </section>
      <section className="mb-6 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 print:text-base">
          Itens do Checklist ({itens.length})
        </h2>
        <div className="space-y-2">
          {itens.map((item) => (
            <ItemRowReadOnly key={item.id_item} item={item} />
          ))}
        </div>
      </section>
      {relatorio.observacoes_gerais && (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none print:p-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Observações Gerais</p>
          <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{relatorio.observacoes_gerais}</p>
        </section>
      )}
      <TextosPadraoPrint modulo="conformidade" valores={valoresTextosPadrao} posicao="fim" />
    </>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 print:max-w-none print:space-y-2">
      {/* Toolbar — não imprime */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/relatorio-conformidade/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Editar relatório
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
            <BotaoAssinarPdf reAssinatura={true} defaultSignatoryName={relatorio.responsavel ?? undefined} tabelaNome="relatorios_conformidade" docId={id} onAssinado={recarregar} apiPdfUrl={`/api/pdf/conformidade/${id}`} baseCongeladaUrl={baseCongeladaUrl} />
          </>
        ) : (
          <BotaoAssinarPdf defaultSignatoryName={relatorio.responsavel ?? undefined} tabelaNome="relatorios_conformidade" docId={id} onAssinado={recarregar} apiPdfUrl={`/api/pdf/conformidade/${id}`} baseCongeladaUrl={baseCongeladaUrl} />
        )}
        <BotaoGerarPdf
          tabelaNome="relatorios_conformidade"
          docId={id}
          apiPdfUrl={`/api/pdf/conformidade/${id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          registrarPdf={{
            modulo: "conformidade",
            tipoDocumento: "Relatório de Conformidade",
            idRelatorio: id,
            empresaId: relatorio.id_empresa ?? undefined,
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: relatorio.responsavel ?? undefined,
          }}
        />
      </div>

      <div className="px-4 pt-3">
        <PainelCongelamentoPdf
          modulo="conformidade"
          idReferencia={id}
          apiPdfUrl={`/api/pdf/conformidade/${id}`}
          opts={{
            tipoDocumento: "Relatório de Conformidade",
            empresaId: relatorio.id_empresa ?? undefined,
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: relatorio.responsavel ?? undefined,
            setor: relatorio.setor ?? undefined,
          }}
        />
      </div>

      <div className="px-4 pt-3">
        <AnexosManager modulo="conformidade" idReferencia={id} />
      </div>

      <div className="px-4 pt-3 print:hidden">
        <EmpresaInfoPanel empresa={empresa ?? null} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" />
      </div>

      {/* Logo JCN Consultoria */}
      <RelatorioPrintHeader
        titulo={`Relatório de Conformidade — ${relatorio.nr_codigo}`}
        subtitulo={empresa?.nome_empresa ?? null}
        terciario={
          relatorio.data_inspecao
            ? new Date(relatorio.data_inspecao + "T00:00").toLocaleDateString("pt-BR")
            : null
        }
      />

      {/* Corpo do laudo — blocos na ordem definida em Texto Padrão (texto
          editável + seções do sistema). Mesma ordem/numeração do PDF gerado. */}
      {corpoScreen}

      {/* Assinatura — só no fim quando não há capítulo "conformidade_assinatura" ativo. */}
      {!temAssinaturaFixoConf && assinaturaScreenNode}

      {/* Rodapé */}
      <p className="text-center text-[9px] text-gray-500 print:mt-4">
        Relatório de Conformidade gerado por JCN Consultoria — Segurança e Saúde do Trabalho ·{" "}
        {relatorio.finalizado_em
          ? `Finalizado em ${new Date(relatorio.finalizado_em).toLocaleString("pt-BR")}`
          : `Criado em ${new Date(relatorio.created_at).toLocaleString("pt-BR")}`}
        {relatorio.usuario_nome ? ` · ${relatorio.usuario_nome}` : ""}
      </p>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 3cm 2cm 2cm 3cm;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function ResumoCard({
  label,
  valor,
  cor,
  total,
}: {
  label: string;
  valor: string | number;
  cor: "emerald" | "gray" | "amber" | "teal";
  total?: number;
}) {
  const cores = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    gray: "border-gray-200 bg-gray-50 text-gray-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    teal: "border-teal-200 bg-teal-50 text-teal-900",
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${cores[cor]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-2xl font-bold">{valor}</p>
      {total != null && typeof valor === "number" && (
        <p className="text-[10px] opacity-70">de {total}</p>
      )}
    </div>
  );
}

function ItemRowReadOnly({ item }: { item: RelatorioConformidadeItem }) {
  const corBorda =
    item.situacao === "CONFORME"
      ? "border-emerald-300 bg-emerald-50/40"
      : item.situacao === "NAO_APLICAVEL"
      ? "border-gray-300 bg-gray-50/40"
      : "border-amber-200 bg-amber-50/30";

  const ehLivre = item.item_nr_origem === "LIVRE";
  const ehCrossRef = !!item.item_nr_origem && item.item_nr_origem !== "LIVRE";
  const fotoUrls = item.foto_urls ?? [];

  return (
    <div className={`rounded-lg border p-3 print:break-inside-avoid ${corBorda}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-block min-w-[3rem] rounded px-1.5 py-0.5 text-center font-mono text-[11px] font-bold ${
            ehLivre
              ? "bg-purple-100 text-purple-800"
              : ehCrossRef
              ? "bg-sky-100 text-sky-800"
              : "bg-teal-100 text-teal-800"
          }`}
        >
          {item.item_codigo}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-gray-900">{item.item_titulo}</p>
            {ehLivre && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-700">
                Livre
              </span>
            )}
            {ehCrossRef && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-700">
                {item.item_nr_origem}
              </span>
            )}
          </div>
          {item.item_descricao && (
            <p className="mt-0.5 text-xs text-gray-600">{item.item_descricao}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            item.situacao === "CONFORME"
              ? "bg-emerald-100 text-emerald-700"
              : item.situacao === "NAO_APLICAVEL"
              ? "bg-gray-100 text-gray-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {item.situacao === "CONFORME"
            ? "CONFORME"
            : item.situacao === "NAO_APLICAVEL"
            ? "N/A"
            : "PENDENTE"}
        </span>
      </div>

      {/* Fotos */}
      {fotoUrls.length > 0 && (
        <div className="mt-3 flex justify-center">
          <div className={fotoUrls.length === 1 ? "flex justify-center" : "grid grid-cols-2 gap-3 print:gap-2"}>
            {fotoUrls.map((url, idx) => (
              <StorageImg
                key={`${url}-${idx}`}
                stored={url}
                alt={`Foto do item ${item.item_codigo}`}
                className="h-36 w-44 object-cover rounded-md border border-gray-300 sm:h-40 sm:w-52 print:h-40 print:w-48"
              />
            ))}
          </div>
        </div>
      )}

      {/* Observação */}
      {item.observacao && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Observação</p>
          <p className="mt-0.5 text-xs text-gray-900 whitespace-pre-wrap">{item.observacao}</p>
        </div>
      )}
    </div>
  );
}
