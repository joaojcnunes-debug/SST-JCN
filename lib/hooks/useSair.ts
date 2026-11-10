"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";

/** Sair do painel — o mesmo do menu lateral dos módulos (SidebarShell): avisa o login para não entrar sozinho de novo,
 *  limpa a credencial guardada no aplicativo de desktop e encerra a sessão. */
export function useSair() {
  const router = useRouter();
  const logout = useUserStore((s) => s.logout);
  return async function sair() {
    sessionStorage.setItem("intentional-logout", "1");
    const api = (window as Window & { electronAPI?: { clearCredentials?: () => Promise<void> } }).electronAPI;
    await api?.clearCredentials?.();
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch {
      // segue mesmo se a rede falhar
    }
    logout();
    toast.success("Sessão encerrada");
    router.replace("/login");
  };
}
