"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
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

/**
 * Bloqueia páginas de criação/edição pra Visualizador.
 * Redireciona pra `redirectTo` (default: módulo anterior via histórico ou
 * /inicio). Mostra toast uma única vez.
 *
 * Use em pages como `/novo`, `/editar`, etc. Em páginas de detalhe que têm
 * estado misto (leitura + edição), prefira `useCanEdit()` direto e gate
 * os inputs/botões — não redirect.
 */
export function useRequireEdit(redirectTo: string = "/inicio") {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);

  useEffect(() => {
    if (!user) return; // ainda carregando — useAuth resolve o "sem sessão"
    if (user.perfil === "Admin" || user.perfil === "Tecnico") return;

    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error("Perfil Visualizador não pode editar.");
    }
    router.replace(redirectTo);
  }, [user, redirectTo, router]);
}
