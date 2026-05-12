"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, Construction } from "lucide-react";

export default function RelatorioNaoConformidadePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-16 text-center">
      <div
        className="flex size-20 items-center justify-center rounded-2xl text-white shadow-md"
        style={{ backgroundColor: "#DC2626" }}
      >
        <AlertTriangle className="size-10" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-gray-900">
        Relatório de Não Conformidade
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Consolidado dos itens em não conformidade e ações pendentes.
      </p>

      <div className="mt-8 flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-900">
        <Construction className="size-5 shrink-0" />
        <p>
          Em construção. Em breve esta área trará o relatório de não
          conformidades, agrupado por severidade e prazo de tratativa.
        </p>
      </div>

      <Link
        href="/inicio"
        className="mt-8 inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
      >
        <ArrowLeft className="size-4" /> Voltar ao início
      </Link>
    </div>
  );
}
