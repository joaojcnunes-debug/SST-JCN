"use client";

import { useState, useEffect } from "react";
import { BadgeCheck, Download, ShieldCheck } from "lucide-react";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePdfAssinado } from "@/lib/hooks/usePdfsGerados";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import StorageImg from "@/components/ui/StorageImg";
import toast from "react-hot-toast";

export default function AssinaturaRelatorio({
  nomeResponsavel,
  cargoResponsavel,
  dataRelatorio,
  tabelaNome,
  docId,
  hideAcoes = false,
  seloSoQuandoAssinado = true,
  numero,
}: {
  nomeResponsavel?: string;
  cargoResponsavel?: string;
  dataRelatorio?: string;
  /** Tabela do documento (ex: "aet_relatorios"). Necessário para salvar/carregar PDF assinado. */
  tabelaNome?: string;
  /** ID do documento. Necessário para salvar/carregar PDF assinado. */
  docId?: string;
  /** Quando true, oculta a barra de ações (baixar + re-assinar) — usada quando a toolbar da página já exibe esses botões. */
  hideAcoes?: boolean;
  /** Quando true (PADRÃO), o selo "Assinado digitalmente" só aparece se o
   *  documento estiver de fato assinado; caso contrário mostra uma linha de
   *  assinatura em branco (para assinatura manual). Mantém a folha de tela
   *  coerente com o PDF (que só carimba o selo após assinatura real).
   *  Passe `false` apenas se quiser o selo antecipado quando o responsável tem
   *  certificado cadastrado. */
  seloSoQuandoAssinado?: boolean;
  /** Número do capítulo no Sumário (prefixa o título "Folha de Assinaturas"). */
  numero?: number;
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
    registro_mte?: string | null;
    crp?: string | null;
  } | null>(null);

  const { pdfAssinado, recarregar } = usePdfAssinado(tabelaNome, docId);

  // Carrega dados de assinatura do profissional
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (isLoggedUserResponsavel) {
      if (!user?.email) return;
      supabase
        .from("usuarios")
        .select("assinatura_url, tipo_certificado, mostrar_assinatura_imagem, cargo, email, registro_mte, crp")
        .eq("email", user.email)
        .single()
        .then(({ data }) => setSigData(data ?? null));
    } else {
      const firstWord = (nomeResponsavel ?? "").trim().split(/\s+/)[0];
      supabase
        .from("usuarios")
        .select("assinatura_url, tipo_certificado, mostrar_assinatura_imagem, cargo, nome, email, registro_mte, crp")
        .ilike("nome", `%${firstWord}%`)
        .limit(20)
        .then(({ data }) => {
          if (!data?.length) { setSigData(null); return; }
          type Row = { nome: string; email: string; assinatura_url: string | null; tipo_certificado: "A1" | "A3" | null; mostrar_assinatura_imagem: boolean; cargo: string | null; registro_mte: string | null; crp: string | null };
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

  async function handleBaixarPdf() {
    if (!pdfAssinado) return;
    const { data, error } = await createSupabaseBrowserClient()
      .storage
      .from("pdfs-assinados")
      .download(pdfAssinado.pdf_path);
    if (error || !data) {
      toast.error("Não foi possível baixar o PDF. Tente novamente.");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-assinado.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const cargo = cargoResponsavel ?? sigData?.cargo ?? user?.cargo ?? "";
  const mostrarImagem = sigData?.mostrar_assinatura_imagem ?? true;
  const assinaturaUrl = mostrarImagem ? (sigData?.assinatura_url ?? null) : null;
  const certificado = sigData?.tipo_certificado ?? null;
  const assinaturaEmpresaUrl = configs?.assinatura_empresa_url ?? null;

  // Registro profissional (Reg. MTE para técnicos, CRP para psicólogos).
  const registro = sigData?.registro_mte
    ? `Reg. MTE ${sigData.registro_mte}`
    : sigData?.crp
      ? `CRP ${sigData.crp}`
      : null;
  // Assinatura por IMAGEM (carimbo da imagem cadastrada) → mostra só a imagem,
  // sem o quadro "Assinado digitalmente".
  const assinaturaPorImagem =
    !!pdfAssinado && pdfAssinado.tipo_assinatura === "imagem" && !!assinaturaUrl;

  const hoje = new Date();
  const dataFormatada =
    dataRelatorio ??
    hoje.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const dataAssinatura = pdfAssinado
    ? new Date(pdfAssinado.assinado_em).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
      })
    : null;

  // Mostra o selo "Assinado digitalmente"? Quando seloSoQuandoAssinado está
  // ligado, só após assinatura de fato; senão, comportamento padrão (sempre).
  const mostrarSelo = !seloSoQuandoAssinado || !!pdfAssinado;

  return (
    <>
      {/* ── Rubrica fixada em cada página impressa ── */}
      {assinaturaUrl && (
        <div className="rubrica-print-fixed print:block hidden">
          <StorageImg stored={assinaturaUrl} alt="Rubrica" className="h-8 w-auto object-contain opacity-70" />
        </div>
      )}

      {/* ── Barra de ações: baixar + re-assinar (visível só após assinatura, quando não hideAcoes) ── */}
      {!hideAcoes && pdfAssinado && (
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
            defaultSignatoryName={nomeResponsavel ?? undefined}
            tabelaNome={tabelaNome}
            docId={docId}
            onAssinado={recarregar}
            reAssinatura
          />
        </div>
      )}

      {/* ── Bloco final de assinatura — nova página no print quando não há espaço ── */}
      <div className="assinatura-bloco-final mt-8 border-t border-gray-200 pt-8 print:mt-12">
        {numero ? (
          <h2 className="mb-4 border-b-2 border-emerald-700 pb-1 text-sm font-bold uppercase text-emerald-900">
            {numero}. Folha de Assinaturas
          </h2>
        ) : (
          <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-gray-400">
            Folha de Assinaturas
          </p>
        )}

        <div className="flex flex-col gap-8 sm:flex-row sm:justify-around sm:gap-6">
          {/* ── Técnico responsável ── */}
          <div className="flex flex-col items-center gap-2">
            {!mostrarSelo ? (
              <div className="flex h-24 w-72 flex-col items-center justify-end pb-1">
                <div className="w-full border-t border-gray-400" />
                <p className="mt-1 text-[10px] italic text-gray-400">
                  Assinatura do responsável técnico
                </p>
              </div>
            ) : assinaturaPorImagem ? (
              <div className="flex h-32 w-72 items-end justify-center pb-1">
                <StorageImg
                  stored={assinaturaUrl!}
                  alt="Assinatura"
                  className="max-h-28 max-w-[280px] object-contain"
                />
              </div>
            ) : assinaturaUrl || certificado ? (
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
                      <StorageImg stored={assinaturaUrl} alt="Assinatura" className="max-h-14 max-w-[80px] object-contain" />
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
            {registro && <p className="text-[11px] text-gray-400">{registro}</p>}
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
