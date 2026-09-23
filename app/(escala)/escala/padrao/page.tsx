"use client";

import PadraoSemanal from "@/components/escala/PadraoSemanal";

/**
 * Padrão semanal (Fase 4) — a segunda tela do módulo.
 *
 * Corresponde à aba "Padrão Semanal" da planilha. A aba "Por Supervisor" dela
 * não vira tela: é a mesma informação girada, e esta grade já se lê nos dois
 * sentidos (a linha é o supervisor, a coluna é o dia).
 *
 * A validação das 6 regras, que na planilha mora logo abaixo desta grade, é a
 * Fase 6 — separada de propósito: alocar e conferir são perguntas diferentes, e
 * a conferência precisa da grade mensal (F5) para valer de verdade.
 */
export default function PadraoSemanalPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Padrão Semanal</h1>
        <p className="mt-1 text-sm text-gray-500">
          O que se repete toda semana. A grade mensal nasce daqui.
        </p>
      </header>

      <PadraoSemanal />
    </div>
  );
}
