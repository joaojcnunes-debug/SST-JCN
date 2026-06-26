"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Sincroniza o usuário a partir da sessão Supabase. Se não logado,
 * manda para /login. Carrega o perfil completo da tabela usuarios.
 * Clientes são redirecionados para o portal se tentarem acessar rotas internas.
 * Usado pelos layouts dos route groups protegidos.
 */
export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const setUser = useUserStore((s) => s.setUser);

  useEffect(() => {
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser || !authUser.email) {
        router.replace("/login");
        return;
      }

      const { data: perfil } = await supabase
        .from("usuarios")
        .select("id_usuario, nome, email, cargo, perfil, ativo_sistema, empresas_vinculadas, modulos_permitidos, pode_criar, pode_editar, pode_excluir, created_at, assinatura_url, tipo_certificado, certificado_pfx_path, mostrar_assinatura_imagem, crp, crm, registro_mte")
        .eq("email", authUser.email)
        .single();

      if (!mounted) return;
      if (perfil) {
        setUser(perfil);
        // Clientes não têm acesso a rotas internas — apenas ao portal
        if (
          (perfil as { perfil?: string }).perfil === "Cliente" &&
          !pathname.startsWith("/portal-cliente")
        ) {
          router.replace("/portal-cliente/inicio");
          return;
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
