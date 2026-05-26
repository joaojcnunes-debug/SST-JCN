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

  // Quando nomeResponsavel é diferente do usuário logado, busca os dados
  // de assinatura da pessoa indicada como responsável.
  const isOtherUser = !!nomeResponsavel && nomeResponsavel !== user?.nome;
  const [responsavelSig, setResponsavelSig] = useState<{
    assinatura_url?: string | null;
    tipo_certificado?: "A1" | "A3" | null;
  } | null>(null);

  useEffect(() => {
    if (!isOtherUser || !nomeResponsavel) {
      setResponsavelSig(null);
      return;
    }
    createSupabaseBrowserClient()
      .from("usuarios")
      .select("assinatura_url, tipo_certificado")
      .ilike("nome", nomeResponsavel)
      .limit(1)
      .then(({ data }) => setResponsavelSig(data?.[0] ?? null));
  }, [isOtherUser, nomeResponsavel]);

  const assinaturaUrl = isOtherUser
    ? (responsavelSig?.assinatura_url ?? null)
    : (user?.assinatura_url ?? null);
  const certificado = isOtherUser
    ? (responsavelSig?.tipo_certificado ?? null)
    : (user?.tipo_certificado ?? null);

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

        <div className="flex flex-col gap-10 sm:flex-row sm:justify-around">
          {/* Técnico responsável */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-20 w-56 items-end justify-center border-b border-gray-400 pb-1">
              {assinaturaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={assinaturaUrl}
                  alt="Assinatura do responsável"
                  className="max-h-16 max-w-[200px] object-contain"
                />
              ) : certificado === "A1" ? (
                /* Selo visual para assinatura digital A1 — sem imagem mas com cert. */
                <div className="mb-1 flex flex-col items-center gap-0.5 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-center">
                  <BadgeCheck className="size-6 text-blue-600" />
                  <span className="text-[10px] font-semibold text-blue-700 leading-tight">
                    Assinatura Digital
                  </span>
                  <span className="text-[9px] text-blue-500 leading-tight">
                    Certificado A1 · ICP-Brasil
                  </span>
                </div>
              ) : certificado === "A3" ? (
                <div className="mb-1 flex flex-col items-center gap-0.5 rounded-md border border-purple-200 bg-purple-50 px-4 py-2 text-center">
                  <ShieldCheck className="size-6 text-purple-600" />
                  <span className="text-[10px] font-semibold text-purple-700 leading-tight">
                    Assinatura Digital
                  </span>
                  <span className="text-[9px] text-purple-500 leading-tight">
                    Certificado A3 · ICP-Brasil
                  </span>
                </div>
              ) : (
                <span className="text-xs italic text-gray-300">
                  (sem assinatura cadastrada)
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-800">{nome}</p>
            {cargo && (
              <p className="text-xs text-gray-500">{cargo}</p>
            )}
            {certificado && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                Certificado {certificado}
              </span>
            )}
            <p className="text-xs text-gray-400">{dataFormatada}</p>
          </div>

          {/* Assinatura da empresa */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-20 w-56 items-end justify-center border-b border-gray-400 pb-1">
              {assinaturaEmpresaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={assinaturaEmpresaUrl}
                  alt="Assinatura da empresa"
                  className="max-h-16 max-w-[200px] object-contain"
                />
              ) : (
                <span className="text-xs italic text-gray-300">
                  (sem assinatura da empresa)
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-800">
              Responsável pela Empresa
            </p>
            <p className="text-xs text-gray-500">Carimbo / Assinatura</p>
            <p className="text-xs text-gray-400">{dataFormatada}</p>
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
