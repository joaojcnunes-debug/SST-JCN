"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import type { ModuloPermitido } from "@/lib/supabase/types";
import { ROTULO_MODULO } from "@/lib/supabase/types";

/**
 * Garante que o usuário logado tem permissão de acessar o módulo informado.
 * Aceita um módulo único ou um array — neste caso, basta ter qualquer um deles.
 * Todos os perfis (inclusive Admin) precisam ter o módulo em
 * `modulos_permitidos`. Se não tiver, redireciona pro hub /inicio.
 *
 * Funções administrativas (gestão de usuários, configurações) vivem em
 * route groups separados e checam apenas `isAdmin`, sem amarrar a módulo.
 */
export function useRequireModule(modulo: ModuloPermitido | ModuloPermitido[]) {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);

  useEffect(() => {
    if (!user) return; // ainda carregando — useAuth cuida do "sem sessão"
    const permitidos = user.modulos_permitidos ?? [];
    const modulos = Array.isArray(modulo) ? modulo : [modulo];
    if (modulos.some((m) => permitidos.includes(m))) return;

    if (!avisouRef.current) {
      avisouRef.current = true;
      const rotulo = modulos.map((m) => ROTULO_MODULO[m]).join(" ou ");
      toast.error(`Sem permissão para acessar ${rotulo}`);
    }
    router.replace("/inicio");
  }, [user, modulo, router]);
}
