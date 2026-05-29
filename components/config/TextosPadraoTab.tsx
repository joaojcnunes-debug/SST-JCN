"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import TextoPadraoEditor from "@/components/textos-padrao/TextoPadraoEditor";
import type { ModuloTextoPadrao } from "@/lib/textos-padrao/types";
import { cn } from "@/lib/utils";

const MODULOS_GENERICOS: { key: ModuloTextoPadrao; label: string }[] = [
  { key: "sst",                label: "SST — Inspeções" },
  { key: "conformidade",       label: "Conformidade" },
  { key: "nao_conformidade",   label: "Não Conformidade" },
  { key: "analise_quimicos",   label: "Análise de Químicos" },
  { key: "apreciacao_maquinas",label: "Apreciação NR-12" },
];

const MODULOS_PROPRIOS = [
  { label: "DRPS — Psicossocial",              href: "/psicossocial/texto-padrao" },
  { label: "AEP — Análise Ergonômica Preliminar", href: "/aep/texto-padrao" },
  { label: "AET — Análise Ergonômica",         href: "/aet/texto-padrao" },
];

export default function TextosPadraoTab() {
  const [modulo, setModulo] = useState<ModuloTextoPadrao>("sst");

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Gerencie os capítulos padrão de cada módulo. Capítulos{" "}
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-700">
          SISTEMA
        </span>{" "}
        são gerados automaticamente; capítulos{" "}
        <span className="rounded bg-verde-light px-1.5 py-0.5 text-[11px] font-bold text-verde-primary">
          EDITÁVEL
        </span>{" "}
        contêm texto livre com variáveis substituíveis.
      </p>

      {/* Módulos com editor próprio — abre em nova aba */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-blue-600">
          Módulos com editor próprio
        </p>
        <div className="flex flex-wrap gap-2">
          {MODULOS_PROPRIOS.map((m) => (
            <a
              key={m.href}
              href={m.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              {m.label}
              <ExternalLink className="size-3.5" />
            </a>
          ))}
        </div>
      </div>

      {/* Seletor de módulo genérico */}
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-2">
        {MODULOS_GENERICOS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setModulo(m.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              modulo === m.key
                ? "bg-verde-primary text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Editor do módulo selecionado */}
      <TextoPadraoEditor modulo={modulo} />
    </div>
  );
}
