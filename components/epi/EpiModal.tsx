"use client";

import { X } from "lucide-react";
import { type ReactNode } from "react";

export default function EpiModal({
  titulo,
  onClose,
  children,
  larguraMax = "max-w-lg",
}: {
  titulo: string;
  onClose: () => void;
  children: ReactNode;
  /** Classe Tailwind de largura máxima (ex.: "max-w-2xl"). Padrão "max-w-lg". */
  larguraMax?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full ${larguraMax} overflow-auto rounded-xl bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30";
export const labelCls =
  "mb-1 block text-xs font-medium text-gray-600";
