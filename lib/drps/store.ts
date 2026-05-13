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
}

export const useDrpsStore = create<DrpsState>()(
  persist(
    (set) => ({
      setor: "Todos",
      setSetor: (setor) => set({ setor }),
    }),
    { name: "drps-filtro" }
  )
);
