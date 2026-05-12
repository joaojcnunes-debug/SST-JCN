"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Shield, Menu, X, Home } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

interface Props {
  title: string;
  subtitle?: string;
  logoHref?: string;
  sections: NavSection[];
}

export default function SidebarShell({
  title,
  subtitle = "Chabra",
  logoHref = "/inicio",
  sections,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useUserStore((s) => s.logout);
  const { data: configs } = useConfiguracoes();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // ignora falha de rede
    }
    logout();
    toast.success("Sessão encerrada");
    router.replace("/login");
  }

  const NavItemView = ({ href, label, icon: Icon }: NavItem) => {
    const active =
      pathname === href ||
      (href !== "/dashboard" && pathname.startsWith(href + "/")) ||
      (href === "/inspecoes" &&
        pathname.startsWith("/inspecoes") &&
        !pathname.startsWith("/inspecoes/nova"));
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
        href={logoHref}
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
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-[11px] text-white/60">{subtitle}</p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2">
        {sections.map((section) => (
          <div key={section.label}>
            <SectionLabel>{section.label}</SectionLabel>
            {section.items.map((item) => (
              <NavItemView key={item.href} {...item} />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-1">
        <Link
          href="/inicio"
          onClick={() => setMobileOpen(false)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Home className="size-4" /> Início
        </Link>
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
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 flex size-10 items-center justify-center rounded-md bg-verde-dark text-white shadow md:hidden print:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </button>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col bg-verde-dark md:flex print:hidden">
        {Content}
      </aside>

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
