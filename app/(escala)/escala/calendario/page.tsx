"use client";

import CalendarioAnual from "@/components/escala/CalendarioAnual";

/**
 * Calendário anual (Fase 6) — a aba "Calendário" da planilha.
 *
 * O ano inteiro numa tela, com os feriados destacados. É o único lugar do
 * módulo onde se enxerga além do mês.
 */
export default function CalendarioPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Calendário Anual</h1>
        <p className="mt-1 text-sm text-gray-500">
          Os doze meses e os feriados do ano. Clique num mês para abrir a grade dele.
        </p>
      </header>

      <CalendarioAnual />
    </div>
  );
}
