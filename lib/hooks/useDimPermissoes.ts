"use client";

import { useUserStore } from "@/lib/store";
import { permissoesDim, type PermissoesDim } from "@/lib/dimensionamento/permissoes";

/** Papel do usuário logado no Dimensionamento — ver lib/dimensionamento/permissoes.ts. */
export function useDimPermissoes(): PermissoesDim {
  const user = useUserStore((s) => s.user);
  return permissoesDim(user);
}
