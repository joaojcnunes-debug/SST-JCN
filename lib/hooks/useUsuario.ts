"use client";

import { useUserStore } from "@/lib/store";

export function useCurrentUser() {
  return useUserStore((s) => s.user);
}

export function useIsAdmin() {
  const user = useUserStore((s) => s.user);
  return user?.perfil === "Admin";
}

export function useCanEdit() {
  const user = useUserStore((s) => s.user);
  return user?.perfil === "Admin" || user?.perfil === "Tecnico";
}
