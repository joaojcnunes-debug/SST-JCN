"use client";

import PainelValidacao from "@/components/escala/PainelValidacao";

/**
 * Conferência do mês (Fase 6) — o bloco "VALIDAÇÃO AUTOMÁTICA DAS REGRAS" que
 * na planilha ficava embaixo do padrão semanal.
 *
 * Tela própria, e não um pedaço da grade, porque a grade já é longa e porque
 * aqui cabe o detalhe que importa: QUAIS dias furaram cada regra.
 */
export default function ConferenciaPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Conferência</h1>
        <p className="mt-1 text-sm text-gray-500">
          O que as regras dizem sobre o mês. Feriado não conta como dia útil.
        </p>
      </header>

      <PainelValidacao />
    </div>
  );
}
