"use client";

import Relatorios from "@/components/escala/Relatorios";

/**
 * Relatórios (Fase 7) — a aba "Resumo Anual" da planilha, com saída em PDF e
 * XLSX.
 */
export default function RelatoriosPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="mt-1 text-sm text-gray-500">
          Quanto cada supervisor esteve em cada unidade, no ano ou no mês.
        </p>
      </header>

      <Relatorios />
    </div>
  );
}
