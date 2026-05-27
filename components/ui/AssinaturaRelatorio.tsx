"use client";

import { useState, useEffect } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";

/**
 * Componente de assinatura para relatórios.
 *
 * Renderiza dois elementos:
 * 1. RubricaPrint — imagem pequena fixada no canto inferior-direito de CADA
 *    página impressa (via CSS @media print + position:fixed). Só aparece na
 *    impressão, nunca na tela.
 * 2. BlocoAssinatura — seção visível no final do documento com a assinatura
 *    completa do técnico responsável e a assinatura da empresa, lado a lado.
 *
 * Uso: basta soltar <AssinaturaRelatorio /> no final de qualquer página de
 * relatório. O componente busca os dados do usuário logado (store) e das
 * configurações globais (empresa).
 */
export default function AssinaturaRelatorio({
  nomeResponsavel,
  cargoResponsavel,
  dataRelatorio,
}: {
  /** Nome do responsável técnico (sobrescreve o nome do usuário logado). */
  nomeResponsavel?: string;
  /** Cargo do responsável (sobrescreve o cargo do usuário logado). */
  cargoResponsavel?: string;
  /** Data do relatório formatada (ex: "26/05/2026"). Padrão: hoje. */
  dataRelatorio?: string;
}) {
  const user = useUserStore((s) => s.user);
  const { data: configs } = useConfiguracoes();

  const nome = nomeResponsavel ?? user?.nome ?? "";
  const cargo = cargoResponsavel ?? user?.cargo ?? "";

  const [sigData, setSigData] = useState<{
    assinatura_url?: string | null;
    tipo_certificado?: "A1" | "A3" | null;
  } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Normaliza string para comparação: trim + lowercase + espaços simples
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

    // Considera "mesmo usuário" se o nome do responsável contém ou está contido
    // no nome do usuário logado (cobre nomes abreviados, com/sem sobrenome extra
    // e espaços extras que diferem do campo usuarios.nome).
    const isSameUser =
      !nomeResponsavel ||
      (!!user?.nome &&
        (norm(nomeResponsavel) === norm(user.nome) ||
          norm(nomeResponsavel).includes(norm(user.nome)) ||
          norm(user.nome).includes(norm(nomeResponsavel))));

    if (isSameUser) {
      if (!user?.email) return;
      // Busca por e-mail: confiável independente de variações no nome
      supabase
        .from("usuarios")
        .select("assinatura_url, tipo_certificado")
        .eq("email", user.email)
        .single()
        .then(({ data }) => setSigData(data ?? null));
    } else {
      // Responsável diferente do usuário logado — busca por nome (case-insensitive)
      supabase
        .from("usuarios")
        .select("assinatura_url, tipo_certificado")
        .ilike("nome", (nomeResponsavel ?? "").trim())
        .limit(1)
        .then(({ data }) => setSigData(data?.[0] ?? null));
    }
  }, [nomeResponsavel, user?.email, user?.nome]);

  const assinaturaUrl = sigData?.assinatura_url ?? null;
  const certificado = sigData?.tipo_certificado ?? null;
  const assinaturaEmpresaUrl = configs?.assinatura_empresa_url ?? null;

  const hoje = new Date();
  const dataFormatada =
    dataRelatorio ??
    hoje.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  return (
    <>
      {/* ── Rubrica fixada em cada página impressa ── */}
      {assinaturaUrl && (
        <div className="rubrica-print-fixed print:block hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assinaturaUrl}
            alt="Rubrica"
            className="h-8 w-auto object-contain opacity-70"
          />
        </div>
      )}

      {/* ── Botão assinar com A1 (tela apenas) ── */}
      <div className="mt-4 flex justify-end print:hidden">
        <BotaoAssinarPdf />
      </div>

      {/* ── Bloco final de assinatura ── */}
      <div className="mt-8 border-t border-gray-200 pt-8 print:mt-12">
        <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-gray-400">
          Assinaturas
        </p>

        <div className="flex flex-col gap-8 sm:flex-row sm:justify-around sm:gap-6">
          {/* ── Técnico responsável — selo estilo Adobe ── */}
          <div className="flex flex-col items-center gap-2">
            {assinaturaUrl || certificado ? (
              <div className="w-72 overflow-hidden rounded border border-blue-300 bg-white shadow-sm">
                {/* Barra de cabeçalho */}
                <div className="flex items-center gap-1.5 bg-blue-600 px-3 py-1.5">
                  {certificado === "A3" ? (
                    <ShieldCheck className="size-3 text-white" />
                  ) : (
                    <BadgeCheck className="size-3 text-white" />
                  )}
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-white">
                    Assinado digitalmente
                    {certificado ? ` · Cert. ${certificado}` : ""}
                  </span>
                </div>
                {/* Corpo: imagem + metadados */}
                <div className="flex items-stretch gap-0">
                  {/* Imagem de assinatura */}
                  <div className="flex w-24 shrink-0 items-center justify-center border-r border-blue-100 bg-blue-50/40 p-2">
                    {assinaturaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={assinaturaUrl}
                        alt="Assinatura"
                        className="max-h-14 max-w-[80px] object-contain"
                      />
                    ) : certificado === "A3" ? (
                      <ShieldCheck className="size-10 text-purple-400" />
                    ) : (
                      <BadgeCheck className="size-10 text-blue-400" />
                    )}
                  </div>
                  {/* Metadados */}
                  <div className="flex flex-1 flex-col justify-center gap-0.5 px-3 py-2">
                    <p className="text-[8px] font-medium uppercase tracking-wide text-blue-500">
                      Assinado por:
                    </p>
                    <p className="text-[11px] font-bold leading-tight text-gray-800">
                      {nome}
                    </p>
                    {cargo && (
                      <p className="text-[9px] text-gray-500">{cargo}</p>
                    )}
                    <p className="mt-1 text-[9px] text-gray-500">
                      Data: {dataFormatada}
                    </p>
                    {certificado && (
                      <p className="text-[9px] font-medium text-blue-600">
                        ICP-Brasil · Certificado {certificado}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Estado vazio — campo de assinatura sem dados */
              <div className="flex w-72 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 py-6">
                <span className="text-xs italic text-gray-300">
                  (sem assinatura cadastrada)
                </span>
              </div>
            )}
            <p className="mt-1 text-xs font-semibold text-gray-700">{nome}</p>
            {cargo && <p className="text-[11px] text-gray-400">{cargo}</p>}
          </div>

          {/* ── Assinatura da empresa — mesmo estilo ── */}
          <div className="flex flex-col items-center gap-2">
            {assinaturaEmpresaUrl ? (
              <div className="w-72 overflow-hidden rounded border border-gray-300 bg-white shadow-sm">
                <div className="flex items-center gap-1.5 bg-gray-600 px-3 py-1.5">
                  <BadgeCheck className="size-3 text-white" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-white">
                    Empresa responsável
                  </span>
                </div>
                <div className="flex items-stretch">
                  <div className="flex w-24 shrink-0 items-center justify-center border-r border-gray-100 bg-gray-50/60 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assinaturaEmpresaUrl}
                      alt="Assinatura da empresa"
                      className="max-h-14 max-w-[80px] object-contain"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-center gap-0.5 px-3 py-2">
                    <p className="text-[8px] font-medium uppercase tracking-wide text-gray-400">
                      Carimbo / Assinatura
                    </p>
                    <p className="text-[11px] font-bold leading-tight text-gray-800">
                      Responsável pela Empresa
                    </p>
                    <p className="mt-1 text-[9px] text-gray-500">
                      Data: {dataFormatada}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex w-72 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 py-6">
                <span className="text-xs italic text-gray-300">
                  (sem assinatura da empresa)
                </span>
              </div>
            )}
            <p className="mt-1 text-xs font-semibold text-gray-700">
              Responsável pela Empresa
            </p>
            <p className="text-[11px] text-gray-400">Carimbo / Assinatura</p>
          </div>
        </div>
      </div>

      {/* CSS global para rubrica em cada página impressa */}
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
