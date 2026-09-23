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

/**
 * Sidebar recolhida ("minimizada"). Persiste em localStorage sob "sidebar-mini"
 * — o script de pré-hidratação em app/layout.tsx lê essa MESMA chave/forma
 * (`{ state: { mini } }`) e põe `data-sidebar="mini"` no <html> antes da 1ª
 * pintura (sem flash). Quem desenha o efeito é o CSS (globals.css), não o React:
 * a marcação da sidebar é idêntica nos dois estados, então não há divergência
 * de hidratação. Só vale em telas md+; no celular o menu continua sendo gaveta.
 */
interface SidebarMiniState {
  mini: boolean;
  setMini: (v: boolean) => void;
  toggle: () => void;
}

export const useSidebarMini = create<SidebarMiniState>()(
  persist(
    (set, get) => ({
      mini: false,
      setMini: (v) => set({ mini: v }),
      toggle: () => set({ mini: !get().mini }),
    }),
    {
      name: "sidebar-mini",
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
