"use client";

/**
 * Estado de navegação da Escala de Supervisores.
 *
 * Só o que é PREFERÊNCIA de quem está olhando: mês aberto e filtro de supervisor.
 * Nada de dado do servidor aqui — isso é TanStack Query. Guardar escala no
 * Zustand criaria uma segunda cópia que envelhece em silêncio.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface EscalaState {
  /** Ano e mês (1..12) abertos na grade. */
  ano: number;
  mes: number;
  irPara: (ano: number, mes: number) => void;
  mesAnterior: () => void;
  proximoMes: () => void;
  /** Volta para o mês corrente — o default de quem abre a tela. */
  irParaHoje: () => void;

  /** `null` = todos. Filtra a grade por um supervisor. */
  supervisorFiltrado: string | null;
  setSupervisorFiltrado: (id: string | null) => void;

  /** Esconde inativos nas listas de cadastro. Default: esconde. */
  mostrarInativos: boolean;
  setMostrarInativos: (v: boolean) => void;
}

function mesCorrente(): { ano: number; mes: number } {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

export const useEscalaStore = create<EscalaState>()(
  persist(
    (set) => ({
      ...mesCorrente(),
      irPara: (ano, mes) => set({ ano, mes }),
      mesAnterior: () =>
        set((s) => (s.mes === 1 ? { ano: s.ano - 1, mes: 12 } : { ano: s.ano, mes: s.mes - 1 })),
      proximoMes: () =>
        set((s) => (s.mes === 12 ? { ano: s.ano + 1, mes: 1 } : { ano: s.ano, mes: s.mes + 1 })),
      irParaHoje: () => set(mesCorrente()),

      supervisorFiltrado: null,
      setSupervisorFiltrado: (supervisorFiltrado) => set({ supervisorFiltrado }),

      mostrarInativos: false,
      setMostrarInativos: (mostrarInativos) => set({ mostrarInativos }),
    }),
    {
      name: "escala-supervisores",
      // O mês NÃO persiste: quem volta ao painel semanas depois quer o mês de
      // hoje, não o que estava aberto. Mesma decisão que os dashboards tomaram
      // em 27/08, depois da queixa de "números enormes" (era acumulado de 3 meses).
      partialize: (s) => ({
        supervisorFiltrado: s.supervisorFiltrado,
        mostrarInativos: s.mostrarInativos,
      }),
    }
  )
);
