"use client";

import { useState } from "react";
import TextoPadraoEditor from "@/components/textos-padrao/TextoPadraoEditor";
import type { ModuloTextoPadrao } from "@/lib/textos-padrao/types";
import { cn } from "@/lib/utils";

const MODULOS_GENERICOS: { key: ModuloTextoPadrao; label: string }[] = [
  { key: "sst",                label: "SST — Inspeções" },
  { key: "conformidade",       label: "Conformidade" },
  { key: "nao_conformidade",   label: "Não Conformidade" },
  { key: "analise_quimicos",   label: "Análise de Químicos" },
  { key: "apreciacao_maquinas",label: "Apreciação NR-12" },
  { key: "aep",                label: "AEP — Ergonômico Preliminar" },
  { key: "aet",                label: "AET — Ergonômico" },
  { key: "psicossocial",       label: "DRPS — Psicossocial" },
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

      {/* Seletor de módulo */}
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
