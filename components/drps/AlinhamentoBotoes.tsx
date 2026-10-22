"use client";

import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alinhamento } from "@/lib/drps/types";

const BOTOES: { valor: Alinhamento; titulo: string; Icone: typeof AlignLeft }[] = [
  { valor: "left", titulo: "Alinhar à esquerda", Icone: AlignLeft },
  { valor: "center", titulo: "Centralizar", Icone: AlignCenter },
  { valor: "right", titulo: "Alinhar à direita", Icone: AlignRight },
  { valor: "justify", titulo: "Justificar", Icone: AlignJustify },
];

/**
 * Os 4 botões de alinhar do Word (os mesmos da barra da Conclusão), para os
 * quadros de Agravos e Medidas — que são listas de seleção, sem editor de texto.
 * O alinhamento vale para o quadro inteiro no laudo, no PDF e na impressão.
 */
export default function AlinhamentoBotoes({
  valor,
  onChange,
  disabled,
}: {
  valor: Alinhamento;
  onChange: (v: Alinhamento) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Alinhamento do texto no laudo"
      className="inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 px-1 py-0.5"
    >
      {BOTOES.map(({ valor: v, titulo, Icone }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          title={`${titulo} (no laudo)`}
          disabled={disabled}
          onClick={() => {
            if (v !== valor) onChange(v);
          }}
          className={cn(
            "rounded p-1.5 text-gray-700 hover:bg-gray-200 disabled:opacity-30",
            valor === v && "bg-verde-light text-verde-primary"
          )}
        >
          <Icone className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
