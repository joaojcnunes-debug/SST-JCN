"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DrpsState {
  /**
   * Setor filtrado atualmente nas telas do relatório DRPS.
   * Default "Todos" = não filtra. Persiste em localStorage pra preservar
   * entre trocas de aba dentro do mesmo relatório.
   *
   * O id_relatorio e o id_empresa vêm da URL/dados — não são guardados aqui.
   */
  setor: string;
  setSetor: (s: string) => void;
  /**
   * Unidade de trabalho filtrada (v138). Default "Todas" = não filtra.
   * Só tem efeito nos relatórios cujo formulário pergunta a unidade; nos
   * demais o filtro nem aparece e isto fica em "Todas".
   */
  unidade: string;
  setUnidade: (u: string) => void;
}

export const useDrpsStore = create<DrpsState>()(
  persist(
    (set) => ({
      setor: "Todos",
      setSetor: (setor) => set({ setor }),
      unidade: "Todas",
      // Trocar de unidade zera o setor: a lista de setores é dependente da
      // unidade, e um setor da unidade anterior pode não existir na nova
      // (COZINHA existe em 8 unidades da A.C.F., ESTOQUE em 7).
      setUnidade: (unidade) => set({ unidade, setor: "Todos" }),
    }),
    { name: "drps-filtro" }
  )
);
