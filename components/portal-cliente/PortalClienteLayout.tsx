"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  AlertTriangle,
  ListChecks,
  MessageSquarePlus,
  User,
  LogOut,
  Menu,
  X,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/store";
import { usePortalEmpresa } from "@/lib/hooks/usePortalCliente";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/portal-cliente/inicio",            label: "Início",             icon: LayoutDashboard },
  { href: "/portal-cliente/documentos",         label: "Documentos",         icon: FileText },
  { href: "/portal-cliente/pendencias",         label: "Pendências",         icon: ClipboardList },
  { href: "/portal-cliente/nao-conformidades",  label: "Não Conformidades",  icon: AlertTriangle },
  { href: "/portal-cliente/plano-acao",         label: "Plano de Ação",      icon: ListChecks },
  { href: "/portal-cliente/solicitacoes",       label: "Solicitações",       icon: MessageSquarePlus },
  { href: "/portal-cliente/perfil",             label: "Meu Perfil",         icon: User },
];

export default function PortalClienteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const { data: empresa } = usePortalEmpresa();
  const { data: configs } = useConfiguracoes();

  async function handleLogout() {
    sessionStorage.setItem("intentional-logout", "1");
    const api = (window as Window & { electronAPI?: { clearCredentials?: () => Promise<void> } }).electronAPI;
    await api?.clearCredentials?.();
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch {
      // segue mesmo se rede falhar
    }
    logout();
    toast.success("Sessão encerrada");
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Overlay mobile */}
      {menuAberto && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#0ea5e9] transition-transform lg:static lg:translate-x-0",
          menuAberto ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / Empresa */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          {configs?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={configs.logo_url}
              alt="Logo"
              className="h-9 w-auto max-w-[38px] rounded-md bg-white object-contain p-0.5 shadow"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-md bg-white/15">
              <Shield className="size-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Portal do Cliente</p>
            <p className="truncate text-[11px] text-white/60">
              {empresa?.nome_empresa ?? "Carregando…"}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const ativo = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuAberto(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Usuário + Sair */}
        <div className="border-t border-white/10 px-4 py-4">
          <p className="mb-1 truncate text-sm font-semibold text-white">{user?.nome}</p>
          <p className="mb-3 truncate text-xs text-white/60">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="flex items-center gap-3 border-b bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          >
            {menuAberto ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <span className="text-sm font-semibold text-gray-700">Portal do Cliente</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
