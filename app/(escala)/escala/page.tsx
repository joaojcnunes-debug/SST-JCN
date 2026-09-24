"use client";

import GradeMensal from "@/components/escala/GradeMensal";

/**
 * Grade mensal (Fase 5) — a casa do módulo.
 *
 * Até a v0.3.555 esta rota só redirecionava para a Configuração, porque a grade
 * não existia. Agora ela ocupa o endereço que sempre foi dela: `/escala` é o que
 * as pessoas linkam, e a grade é o que elas vêm ver.
 *
 * Corresponde às doze abas Jan…Dez da planilha, resolvidas em uma tela que troca
 * de mês.
 */
export default function EscalaHome() {
  return (
    <div className="mx-auto max-w-[90rem] space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Grade Mensal</h1>
        <p className="mt-1 text-sm text-gray-500">
          O mês dia a dia. Nasce do padrão semanal, e o que for mexido à mão fica.
        </p>
      </header>

      <GradeMensal />
    </div>
  );
}
