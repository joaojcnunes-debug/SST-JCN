"use client";

import { useState, useEffect, useCallback } from "react";
import { BadgeCheck, Download, ShieldCheck } from "lucide-react";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import toast from "react-hot-toast";

export default function AssinaturaRelatorio({
  nomeResponsavel,
  cargoResponsavel,
  dataRelatorio,
  tabelaNome,
  docId,
}: {
  nomeResponsavel?: string;
  cargoResponsavel?: string;
  dataRelatorio?: string;
  /** Tabela do documento (ex: "aet_relatorios"). Necessário para salvar/carregar PDF assinado. */
  tabelaNome?: string;
  /** ID do documento. Necessário para salvar/carregar PDF assinado. */
  docId?: string;
}) {
  const user = useUserStore((s) => s.user);
  const { data: configs } = useConfiguracoes();

  const nome = nomeResponsavel ?? user?.nome ?? "";

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const wordMatch = (a: string, b: string) => {
    const words = norm(a).split(" ").filter((w) => w.length > 2);
    return words.length > 0 && words.every((w) => norm(b).includes(w));
  };
  const nameMatches = (a: string, b: string) =>
    norm(a) === norm(b) ||
    norm(a).includes(norm(b)) ||
    norm(b).includes(norm(a)) ||
    wordMatch(a, b) ||
    wordMatch(b, a);

  const isLoggedUserResponsavel =
    !nomeResponsavel ||
    (!!user?.nome && nameMatches(nomeResponsavel, user.nome));

  const [sigData, setSigData] = useState<{
    assinatura_url?: string | null;
    tipo_certificado?: "A1" | "A3" | null;
    mostrar_assinatura_imagem?: boolean;
    cargo?: string | null;
    email?: string | null;
  } | null>(null);

  const [pdfAssinado, setPdfAssinado] = useState<{
    pdf_path: string;
    assinado_em: string;
    assinado_por: string;
  } | null>(null);

  // Carrega dados de assinatura do profissional
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (isLoggedUserResponsavel) {
      if (!user?.email) return;
      supabase
        .from("usuarios")
        .select("assinatura_url, tipo_certificado, mostrar_assinatura_imagem, cargo, email")
        .eq("email", user.email)
        .single()
        .then(({ data }) => setSigData(data ?? null));
    } else {
      const firstWord = (nomeResponsavel ?? "").trim().split(/\s+/)[0];
      supabase
        .from("usuarios")
        .select("assinatura_url, tipo_certificado, mostrar_assinatura_imagem, cargo, nome, email")
        .ilike("nome", `%${firstWord}%`)
        .limit(20)
        .then(({ data }) => {
          if (!data?.length) { setSigData(null); return; }
          type Row = { nome: string; email: string; assinatura_url: string | null; tipo_certificado: "A1" | "A3" | null; mostrar_assinatura_imagem: boolean; cargo: string | null };
          const match = (data as Row[]).find((u) => nameMatches(u.nome, nomeResponsavel!));
          if (match) {
            const { nome: _n, ...rest } = match;
            setSigData(rest);
          } else {
            setSigData(null);
          }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomeResponsavel, user?.email, user?.nome, isLoggedUserResponsavel]);

  // Carrega estado do PDF assinado (se tabelaNome + docId fornecidos)
  const carregarPdfAssinado = useCallback(() => {
    if (!tabelaNome || !docId) return;
    createSupabaseBrowserClient()
      .from("pdfs_assinados")
      .select("pdf_path, assinado_em, assinado_por")
      .eq("tabela", tabelaNome)
      .eq("doc_id", docId)
      .single()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any }) => setPdfAssinado(data ?? null));
  }, [tabelaNome, docId]);

  useEffect(() => { carregarPdfAssinado(); }, [carregarPdfAssinado]);

  // Recarrega estado quando BotaoGerarPdf assina via fluxo integrado
  useEffect(() => {
    if (!tabelaNome || !docId) return;
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ tabelaNome: string; docId: string }>;
      if (ev.detail.tabelaNome === tabelaNome && ev.detail.docId === docId) {
        carregarPdfAssinado();
      }
    };
    window.addEventListener("pdf:assinado", handler);
    return () => window.removeEventListener("pdf:assinado", handler);
  }, [tabelaNome, docId, carregarPdfAssinado]);

  async function handleBaixarPdf() {
    if (!pdfAssinado) return;
    const { data, error } = await createSupabaseBrowserClient()
      .storage
      .from("pdfs-assinados")
      .createSignedUrl(pdfAssinado.pdf_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar o link de download. Tente novamente.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const cargo = cargoResponsavel ?? sigData?.cargo ?? user?.cargo ?? "";
  const mostrarImagem = sigData?.mostrar_assinatura_imagem ?? true;
  const assinaturaUrl = mostrarImagem ? (sigData?.assinatura_url ?? null) : null;
  const certificado = sigData?.tipo_certificado ?? null;
  const assinaturaEmpresaUrl = configs?.assinatura_empresa_url ?? null;

  const hoje = new Date();
  const dataFormatada =
    dataRelatorio ??
    hoje.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const dataAssinatura = pdfAssinado
    ? new Date(pdfAssinado.assinado_em).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
      })
    : null;

  return (
    <>
      {/* ── Rubrica fixada em cada página impressa ── */}
      {assinaturaUrl && (
        <div className="rubrica-print-fixed print:block hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assinaturaUrl} alt="Rubrica" className="h-8 w-auto object-contain opacity-70" />
        </div>
      )}

      {/* ── Barra de ações: baixar + re-assinar (visível só após assinatura) ── */}
      {pdfAssinado && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <BadgeCheck className="size-3.5 shrink-0" />
            Assinado em {dataAssinatura}
          </div>
          <button
            type="button"
            onClick={handleBaixarPdf}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Download className="size-4" />
            Baixar PDF Assinado
          </button>
          <BotaoAssinarPdf
            defaultSignatoryEmail={sigData?.email ?? undefined}
            tabelaNome={tabelaNome}
            docId={docId}
            onAssinado={carregarPdfAssinado}
            reAssinatura
          />
        </div>
      )}

      {/* ── Bloco final de assinatura ── */}
      <div className="mt-8 border-t border-gray-200 pt-8 print:mt-12">
        <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-gray-400">
          Assinaturas
        </p>

        <div className="flex flex-col gap-8 sm:flex-row sm:justify-around sm:gap-6">
          {/* ── Técnico responsável ── */}
          <div className="flex flex-col items-center gap-2">
            {assinaturaUrl || certificado ? (
              <div className="w-72 overflow-hidden rounded border border-blue-300 bg-white shadow-sm">
                <div className="flex items-center gap-1.5 bg-blue-600 px-3 py-1.5">
                  {certificado === "A3" ? (
                    <ShieldCheck className="size-3 text-white" />
                  ) : (
                    <BadgeCheck className="size-3 text-white" />
                  )}
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-white">
                    Assinado digitalmente{certificado ? ` · Cert. ${certificado}` : ""}
                  </span>
                </div>
                <div className="flex items-stretch gap-0">
                  <div className="flex w-24 shrink-0 items-center justify-center border-r border-blue-100 bg-blue-50/40 p-2">
                    {assinaturaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assinaturaUrl} alt="Assinatura" className="max-h-14 max-w-[80px] object-contain" />
                    ) : certificado === "A3" ? (
                      <ShieldCheck className="size-10 text-purple-400" />
                    ) : (
                      <BadgeCheck className="size-10 text-blue-400" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-center gap-0.5 px-3 py-2">
                    <p className="text-[8px] font-medium uppercase tracking-wide text-blue-500">Assinado por:</p>
                    <p className="text-[11px] font-bold leading-tight text-gray-800">{nome}</p>
                    {cargo && <p className="text-[9px] text-gray-500">{cargo}</p>}
                    <p className="mt-1 text-[9px] text-gray-500">Data: {dataFormatada}</p>
                    {certificado && (
                      <p className="text-[9px] font-medium text-blue-600">ICP-Brasil · Certificado {certificado}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex w-72 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 py-6 print:hidden">
                <span className="text-xs italic text-gray-300">(sem assinatura cadastrada)</span>
              </div>
            )}
            <p className="mt-1 text-xs font-semibold text-gray-700">{nome}</p>
            {cargo && <p className="text-[11px] text-gray-400">{cargo}</p>}
          </div>

          {/* ── Assinatura da empresa ── */}
          <div className="flex flex-col items-center gap-2">
            {assinaturaEmpresaUrl ? (
              <div className="w-72 overflow-hidden rounded border border-gray-300 bg-white shadow-sm">
                <div className="flex items-center gap-1.5 bg-gray-600 px-3 py-1.5">
                  <BadgeCheck className="size-3 text-white" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-white">Empresa responsável</span>
                </div>
                <div className="flex items-stretch">
                  <div className="flex w-24 shrink-0 items-center justify-center border-r border-gray-100 bg-gray-50/60 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assinaturaEmpresaUrl} alt="Assinatura da empresa" className="max-h-14 max-w-[80px] object-contain" />
                  </div>
                  <div className="flex flex-1 flex-col justify-center gap-0.5 px-3 py-2">
                    <p className="text-[8px] font-medium uppercase tracking-wide text-gray-400">Carimbo / Assinatura</p>
                    <p className="text-[11px] font-bold leading-tight text-gray-800">Responsável pela Empresa</p>
                    <p className="mt-1 text-[9px] text-gray-500">Data: {dataFormatada}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex w-72 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 py-6 print:hidden">
                <span className="text-xs italic text-gray-300">(sem assinatura da empresa)</span>
              </div>
            )}
            <p className="mt-1 text-xs font-semibold text-gray-700">Responsável pela Empresa</p>
            <p className="text-[11px] text-gray-400">Carimbo / Assinatura</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .rubrica-print-fixed {
            position: fixed !important;
            bottom: 8mm !important;
            right: 8mm !important;
            display: block !important;
            z-index: 9999;
          }
        }
      `}</style>
    </>
  );
}
