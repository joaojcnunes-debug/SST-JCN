"use client";

import { create } from "zustand";

/**
 * Estado transitório do editor do laudo (multi-máquina).
 *
 * O laudo passou a ser uma "capa" com N fichas de máquina. Esta store guarda
 * apenas qual ficha está aberta no editor — `null` = mostrando a lista de
 * fichas. O `id_apreciacao`/dados vêm da URL e do TanStack Query, não daqui.
 * Não persiste: é seleção de UI, reinicia a cada visita ao laudo.
 */
interface ApreciacaoEdicaoState {
  fichaAtivaId: string | null;
  setFichaAtiva: (id: string | null) => void;
  reset: () => void;
}

export const useApreciacaoEdicaoStore = create<ApreciacaoEdicaoState>((set) => ({
  fichaAtivaId: null,
  setFichaAtiva: (fichaAtivaId) => set({ fichaAtivaId }),
  reset: () => set({ fichaAtivaId: null }),
}));
