"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Usuario } from "./supabase/types";

/**
 * "Unidade ativa" — contexto global de escopo por unidade. Ao escolher uma
 * unidade na Visão Geral, os módulos passam a operar só nas empresas dela.
 * Persiste em localStorage (sobrevive entre sessões/dias). Limpa no logout
 * para não vazar entre usuários da mesma máquina. Vazia = global (como antes).
 */
interface UnidadeAtivaState {
  id: string | null;
  nome: string | null;
  setUnidade: (id: string, nome: string) => void;
  limpar: () => void;
}

export const useUnidadeAtiva = create<UnidadeAtivaState>()(
  persist(
    (set) => ({
      id: null,
      nome: null,
      setUnidade: (id, nome) => set({ id, nome }),
      limpar: () => set({ id: null, nome: null }),
    }),
    {
      name: "unidade-ativa",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

interface UserState {
  user: Usuario | null;
  setUser: (u: Usuario | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()((set) => ({
  user: null,
  setUser: (u) => set({ user: u }),
  logout: () => {
    // Sai da unidade ativa junto do logout (evita vazar escopo p/ o próximo login).
    useUnidadeAtiva.getState().limpar();
    set({ user: null });
  },
}));
