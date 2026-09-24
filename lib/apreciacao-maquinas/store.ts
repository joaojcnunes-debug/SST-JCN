import { create } from "zustand";

/**
 * Máquina (ficha) selecionada no editor do laudo. Fica fora do React Query
 * porque é estado de navegação, não dado do servidor: o editor mostra as seções
 * (identificação, checklist, HRN, fotos) da ficha ativa.
 */
interface ApreciacaoMaquinasStore {
  fichaAtivaId: string | null;
  setFichaAtiva: (id: string | null) => void;
}

export const useApreciacaoMaquinasStore = create<ApreciacaoMaquinasStore>((set) => ({
  fichaAtivaId: null,
  setFichaAtiva: (id) => set({ fichaAtivaId: id }),
}));
