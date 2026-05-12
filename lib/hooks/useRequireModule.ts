"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import type { ModuloPermitido } from "@/lib/supabase/types";
import { ROTULO_MODULO } from "@/lib/supabase/types";

/**
 * Garante que o usuário logado tem permissão de acessar o módulo informado.
 * Admins sempre passam. Demais perfis precisam ter o módulo em
 * `modulos_permitidos`. Se não tiver, redireciona pro hub /inicio.
 *
 * Deve ser usado dentro do layout do route group do módulo, depois de useAuth.
 */
export function useRequireModule(modulo: ModuloPermitido) {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);

  useEffect(() => {
    if (!user) return; // ainda carregando — useAuth cuida do "sem sessão"
    if (user.perfil === "Admin") return;
    const permitidos = user.modulos_permitidos ?? [];
    if (permitidos.includes(modulo)) return;

    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error(`Sem permissão para acessar ${ROTULO_MODULO[modulo]}`);
    }
    router.replace("/inicio");
  }, [user, modulo, router]);
}
