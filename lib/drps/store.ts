"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DrpsState {
  idEmpresa: string | null;
  setor: string;
  setIdEmpresa: (id: string | null) => void;
  setSetor: (s: string) => void;
}

/**
 * Estado compartilhado pelo módulo Psicossocial: empresa atual e setor
 * filtrado (padrão "Todos"). Persiste em localStorage pra não perder a
 * seleção quando o usuário navega entre as abas.
 */
export const useDrpsStore = create<DrpsState>()(
  persist(
    (set) => ({
      idEmpresa: null,
      setor: "Todos",
      setIdEmpresa: (id) =>
        set((s) =>
          s.idEmpresa === id ? s : { idEmpresa: id, setor: "Todos" }
        ),
      setSetor: (setor) => set({ setor }),
    }),
    { name: "drps-filtro" }
  )
);
