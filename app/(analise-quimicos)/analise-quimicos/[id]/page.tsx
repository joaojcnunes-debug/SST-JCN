"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Trash2,
  FlaskConical,
  Loader2,
  FileText,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import {
  useAnaliseQuimico,
  useExcluirAnaliseQuimico,
} from "@/lib/hooks/useAnalisesQuimicos";
import ConclusaoRapidaCard from "@/components/quimicos/ConclusaoRapidaCard";
import RelatorioEstruturado from "@/components/quimicos/RelatorioEstruturado";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import TextosPadraoPrint from "@/components/textos-padrao/TextosPadraoPrint";
import { montarValoresEmpresa, formatarDataBR } from "@/lib/textos-padrao/variaveis";
import { useCanDelete } from "@/lib/hooks/useUsuario";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function AnaliseDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const canDelete = useCanDelete();
  const { data: analise, isLoading, error } = useAnaliseQuimico(id);
  const { data: empresa } = useEmpresa(analise?.id_empresa ?? null);
  const excluir = useExcluirAnaliseQuimico();
  const [confirmExcluirOpen, setConfirmExcluirOpen] = useState(false);

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
          <Link
            href="/analise-quimicos"
            className="text-red-700 underline hover:text-red-900"
          >
            Voltar à lista
          </Link>
        </div>
      </div>
    );
  }

  function handleExcluir() {
    if (!analise) return;
    setConfirmExcluirOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Cabeçalho de ação — escondido na impressão */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/analise-quimicos/historico"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao histórico
        </Link>
        <div className="flex items-center gap-2">
          <BotaoGerarPdf
            tabelaNome="analises_quimicos"
            docId={id}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
            registrarPdf={{
              modulo: "analises_quimicos",
              tipoDocumento: "Análise de Agente Químico",
              idRelatorio: id,
              empresaId: analise?.id_empresa ?? undefined,
              empresaNome: empresa?.nome_empresa ?? undefined,
              empresaCnpj: empresa?.cnpj ?? undefined,
              responsavelTecnico: analise?.usuario_nome ?? undefined,
            }}
          />
          {canDelete && (
            <button
              type="button"
              onClick={handleExcluir}
              disabled={excluir.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              title="Excluir análise"
            >
              <Trash2 className="size-4" /> Excluir
            </button>
          )}
        </div>
      </div>

      {/* Logo Chabra (print + tela) */}
      <RelatorioPrintHeader
        titulo="Análise de Agente Químico"
        subtitulo={analise.titulo}
        terciario={empresa?.nome_empresa ?? null}
      />

      {/* Cabeçalho do relatório (visível no print) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-center gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: "#0EA5E9" }}
          >
            <FlaskConical className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
              Análise de Químicos Chabra
            </p>
            <h1 className="truncate text-xl font-bold text-gray-900">
              {analise.titulo}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1">
                {analise.modo === "PDF" ? (
                  <FileText className="size-3" />
                ) : (
                  <Pencil className="size-3" />
                )}
                {analise.modo === "PDF"
                  ? `PDF: ${analise.fonte_arquivo ?? ""}`
                  : "Entrada Manual"}
              </span>
              {empresa && <span>Empresa: {empresa.nome_empresa}</span>}
              {analise.usuario_nome && (
                <span>Responsável: {analise.usuario_nome}</span>
              )}
              <span>
                {new Date(analise.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </div>

        {/* Dados do produto (resumo) */}
        {(analise.nome_quimico ||
          analise.numero_cas ||
          analise.formula_quimica ||
          analise.forma_fisica ||
          analise.concentracao) && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-xs md:grid-cols-3 lg:grid-cols-5">
            {analise.nome_quimico && (
              <div>
                <p className="text-[9px] font-bold uppercase text-gray-500">
                  Nome Químico
                </p>
                <p className="text-gray-900">{analise.nome_quimico}</p>
              </div>
            )}
            {analise.numero_cas && (
              <div>
                <p className="text-[9px] font-bold uppercase text-gray-500">CAS</p>
                <p className="text-gray-900">{analise.numero_cas}</p>
              </div>
            )}
            {analise.formula_quimica && (
              <div>
                <p className="text-[9px] font-bold uppercase text-gray-500">
                  Fórmula
                </p>
                <p className="text-gray-900">{analise.formula_quimica}</p>
              </div>
            )}
            {analise.forma_fisica && (
              <div>
                <p className="text-[9px] font-bold uppercase text-gray-500">
                  Forma Física
                </p>
                <p className="text-gray-900">{analise.forma_fisica}</p>
              </div>
            )}
            {analise.concentracao && (
              <div>
                <p className="text-[9px] font-bold uppercase text-gray-500">
                  Concentração
                </p>
                <p className="text-gray-900">{analise.concentracao}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conclusão rápida */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none print:p-2">
        <h2 className="mb-3 text-base font-bold text-verde-primary">
          Conclusão Rápida
        </h2>
        <ConclusaoRapidaCard conclusao={analise.conclusao_rapida} />
      </section>

      {/* Textos Padrão — capítulos cadastrados no /texto-padrao do módulo.
          Só aparecem no print, antes do relatório técnico estruturado. */}
      <TextosPadraoPrint
        modulo="analise_quimicos"
        valores={{
          ...montarValoresEmpresa(empresa ?? null),
          titulo: analise.titulo,
          nome_quimico: analise.nome_quimico ?? "",
          numero_cas: analise.numero_cas ?? "",
          responsavel: analise.usuario_nome ?? "",
          carimbo: analise.usuario_nome ?? "",
          importado: formatarDataBR(analise.created_at),
        }}
        posicao="antes"
      />

      {/* Relatório técnico estruturado (gerado pelo programa a partir dos
          campos da CONCLUSAO_RAPIDA) */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none print:p-2">
        <h2 className="mb-3 text-base font-bold text-verde-primary">
          Relatório Técnico Completo
        </h2>
        <RelatorioEstruturado analise={analise} empresa={empresa ?? null} />
      </section>

      {/* Textos Padrão — capítulos de encerramento após o relatório técnico */}
      <TextosPadraoPrint
        modulo="analise_quimicos"
        valores={{
          ...montarValoresEmpresa(empresa ?? null),
          titulo: analise.titulo,
          nome_quimico: analise.nome_quimico ?? "",
          numero_cas: analise.numero_cas ?? "",
          responsavel: analise.usuario_nome ?? "",
          carimbo: analise.usuario_nome ?? "",
          importado: formatarDataBR(analise.created_at),
        }}
        posicao="fim"
      />

      {/* Bloco de assinatura */}
      <AssinaturaRelatorio
        nomeResponsavel={analise.usuario_nome ?? undefined}
        dataRelatorio={formatarDataBR(analise.created_at) || undefined}
        tabelaNome="analises_quimicos"
        docId={id}
      />

      {/* Rodapé pra impressão */}
      <p className="text-center text-[9px] text-gray-500 print:mt-4">
        Análise gerada por IA · Chabra — Segurança e Saúde do Trabalho ·{" "}
        {new Date(analise.created_at).toLocaleString("pt-BR")} · Revisão técnica
        obrigatória antes de uso oficial.
      </p>

      <ConfirmDialog
        open={confirmExcluirOpen}
        title="Excluir análise"
        description={`Excluir a análise "${analise.titulo}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        loading={excluir.isPending}
        onCancel={() => setConfirmExcluirOpen(false)}
        onConfirm={() => {
          excluir.mutate(analise.id_analise, {
            onSuccess: () => {
              toast.success("Análise excluída");
              router.push("/analise-quimicos/historico");
            },
            onError: (e: Error) => toast.error(e.message),
          });
          setConfirmExcluirOpen(false);
        }}
      />

      <style jsx global>{`
        @media print {
          /* Padrão ABNT NBR 14724 — A4 com margens 3cm sup/esq, 2cm inf/dir */
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
