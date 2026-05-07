"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  PlusCircle,
  Users,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

const PRINCIPAL = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/inspecoes", label: "Inspeções", icon: ClipboardList },
];

const ACOES = [{ href: "/inspecoes/nova", label: "Nova Inspeção", icon: PlusCircle }];

const ADMIN = [
  { href: "/usuarios", label: "Usuários", icon: Users },
  { href: "/config", label: "Configurações", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const { data: configs } = useConfiguracoes();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.perfil === "Admin";

  async function handleLogout() {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // segue mesmo se a rede falhar
    }
    logout();
    toast.success("Sessão encerrada");
    router.replace("/login");
  }

  const NavItem = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
  }) => {
    const active =
      pathname === href ||
      (href !== "/dashboard" && pathname.startsWith(href + "/")) ||
      (href === "/inspecoes" && pathname.startsWith("/inspecoes") && !pathname.startsWith("/inspecoes/nova"));
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-white/15 text-white border-l-4 border-verde-accent pl-2"
            : "text-white/80 hover:bg-white/10 hover:text-white border-l-4 border-transparent pl-2"
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span>{label}</span>
      </Link>
    );
  };

  const SectionLabel = ({ children }: { children: string }) => (
    <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/50">
      {children}
    </p>
  );

  const Content = (
    <>
      <Link
        href="/dashboard"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-2 px-4 py-4 hover:bg-white/5 transition-colors"
      >
        {configs?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={configs.logo_url}
            alt="Logo"
            className="h-9 w-auto max-w-[40px] rounded-md bg-white object-contain p-0.5 shadow"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-md bg-verde-primary text-white shadow">
            <Shield className="size-5" />
          </div>
        )}
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">Painel SST</p>
          <p className="text-[11px] text-white/60">Chabra</p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2">
        <SectionLabel>Principal</SectionLabel>
        {PRINCIPAL.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
        <SectionLabel>Ações</SectionLabel>
        {ACOES.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
        {isAdmin && (
          <>
            <SectionLabel>Admin</SectionLabel>
            {ADMIN.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Botão mobile */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 flex size-10 items-center justify-center rounded-md bg-verde-dark text-white shadow md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col bg-verde-dark md:flex">
        {Content}
      </aside>

      {/* Sidebar mobile (drawer) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute inset-y-0 left-0 flex w-[240px] flex-col bg-verde-dark shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-2 rounded p-1 text-white/70 hover:bg-white/10"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            {Content}
          </aside>
        </div>
      )}
    </>
  );
}
