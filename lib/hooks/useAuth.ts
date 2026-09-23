"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Usuario } from "@/lib/supabase/types";
import { usePresencaPing } from "@/lib/hooks/usePresencaPing";

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

  // Presença (v218): pinga enquanto a pessoa mexe. Se gate sozinho pelo perfil.
  usePresencaPing();

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
        .select("id_usuario, nome, email, cargo, perfil, ativo_sistema, empresas_vinculadas, unidades, modulos_permitidos, funcao, nivel, funcoes_painel(ve_presenca_auditoria), pode_criar, pode_editar, pode_excluir, pode_escrever_quimicos, concedido_por, concedido_em, created_at, assinatura_url, tipo_certificado, certificado_pfx_path, certificado_validade, certificado_titular, mostrar_assinatura_imagem, cpf, crp, crm, registro_mte")
        .eq("email", authUser.email)
        .single();

      if (!mounted) return;
      if (perfil) {
        // v231: o embed to-one de funcoes_painel chega como objeto (ou null), mas o
        // tipo do client nao conhece a FK e infere lista — normaliza aqui.
        const fp = (perfil as { funcoes_painel?: unknown }).funcoes_painel;
        const embed = (Array.isArray(fp) ? fp[0] : fp) as Usuario["funcoes_painel"] | undefined;
        setUser({ ...(perfil as object), funcoes_painel: embed ?? null } as Usuario);
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
