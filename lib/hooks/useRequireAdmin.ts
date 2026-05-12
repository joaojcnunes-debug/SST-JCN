"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";

/**
 * Garante que o usuário logado é Admin. Se não for, redireciona pro hub /inicio.
 * Usado nas rotas administrativas (gestão de usuários, configurações) que não
 * estão amarradas a um módulo de quadro.
 */
export function useRequireAdmin() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);

  useEffect(() => {
    if (!user) return; // ainda carregando
    if (user.perfil === "Admin") return;

    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error("Apenas administradores podem acessar esta área");
    }
    router.replace("/inicio");
  }, [user, router]);
}
