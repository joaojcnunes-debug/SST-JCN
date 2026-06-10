"use client";

import { Shield } from "lucide-react";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";

interface Props {
  /** Título do relatório (ex.: "Relatório de Conformidade NR-24"). */
  titulo: string;
  /** Linha secundária (ex.: nome da empresa, código, identificador). */
  subtitulo?: string | null;
  /** Linha terciária opcional (ex.: data por extenso). */
  terciario?: string | null;
}

/**
 * Cabeçalho fixo de relatórios para impressão. Mostra a logo da empresa
 * (cadastrada em /config) + nome à esquerda, e o título/subtítulo
 * do relatório à direita.
 *
 * Em tela: aparece também como um cabeçalho discreto acima do relatório.
 * Em print/PDF: vira o cabeçalho da primeira página (pode aparecer em todas
 * via `position: running()` no futuro, mas hoje só na primeira).
 *
 * Se `configs.logo_url` estiver vazio, mostra um fallback com ícone Shield.
 */
export default function RelatorioPrintHeader({
  titulo,
  subtitulo,
  terciario,
}: Props) {
  const { data: configs } = useConfiguracoes();
  const logoUrl = configs?.logo_url?.trim() || "";

  return (
    <header className="mb-4 flex items-center justify-between gap-3 border-b-2 border-verde-primary pb-3 print:mb-3 print:pb-2">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo JCN"
            className="h-14 w-auto max-w-[70px] object-contain print:h-16 print:max-w-[80px]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-md bg-verde-primary text-white print:size-14">
            <Shield className="size-6" />
          </div>
        )}
        <div className="leading-tight">
          <p className="text-sm font-bold text-gray-900 print:text-[13px]">
            JCN Consultoria — Segurança e Saúde do Trabalho
          </p>
          <p className="text-[10px] text-gray-500 print:text-[9px]">
            Documento técnico — uso interno e regulatório
          </p>
        </div>
      </div>

      <div className="text-right leading-tight">
        <p className="text-sm font-bold text-verde-primary print:text-[13px]">
          {titulo}
        </p>
        {subtitulo && (
          <p className="text-xs text-gray-700 print:text-[11px]">
            {subtitulo}
          </p>
        )}
        {terciario && (
          <p className="text-[10px] text-gray-500 print:text-[10px]">
            {terciario}
          </p>
        )}
      </div>
    </header>
  );
}
