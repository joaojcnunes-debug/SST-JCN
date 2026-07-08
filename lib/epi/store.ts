"use client";

import { create } from "zustand";

/**
 * Empresa selecionada no módulo interno de EPI (a equipe escolhe qual empresa
 * gerenciar). No Portal do Cliente a empresa é implícita (empresas_vinculadas[0]),
 * então este store não é usado lá.
 */
interface EpiStore {
  empresaId: string | null;
  setEmpresa: (id: string | null) => void;
}

export const useEpiStore = create<EpiStore>((set) => ({
  empresaId: null,
  setEmpresa: (id) => set({ empresaId: id }),
}));
