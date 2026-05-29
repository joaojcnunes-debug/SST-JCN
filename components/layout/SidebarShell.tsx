"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Shield, Menu, X, Home } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Variante semântica do item — controla cor do ícone em estado inativo */
export type NavItemVariant =
  | "default"
  | "dashboard"
  | "action"
  | "config"
  | "report"
  | "back";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  variant?: NavItemVariant;
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

// Cor do ícone quando item está inativo (texto recebe hover do grupo)
const ICON_COLOR: Record<NavItemVariant, string> = {
  default: "text-white/45 group-hover:text-white/80",
  dashboard: "text-sky-400/75 group-hover:text-sky-300",
  action: "text-emerald-400/75 group-hover:text-emerald-300",
  config: "text-slate-400/75 group-hover:text-slate-300",
  report: "text-amber-400/75 group-hover:text-amber-300",
  back: "text-white/30 group-hover:text-white/55",
};

// Cor do texto quando item está inativo
const TEXT_COLOR: Record<NavItemVariant, string> = {
  default: "text-white/72",
  dashboard: "text-white/82",
  action: "text-white/82",
  config: "text-white/62",
  report: "text-white/78",
  back: "text-white/48",
};

function NavItemView({
  href,
  label,
  icon: Icon,
  variant = "default",
  pathname,
  setMobileOpen,
}: NavItem & { pathname: string; setMobileOpen: (v: boolean) => void }) {
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
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-[7px]",
        "text-sm font-medium transition-all duration-150",
        active
          ? "bg-white/[0.16] text-white shadow-sm"
          : cn(TEXT_COLOR[variant], "hover:bg-white/[0.09] hover:text-white hover:translate-x-0.5")
      )}
    >
      {active && (
        <span className="absolute left-0 top-[18%] h-[64%] w-[3px] rounded-r-full bg-verde-accent" />
      )}
      <Icon
        className={cn(
          "size-[15px] shrink-0 transition-colors duration-150",
          active ? "text-white" : ICON_COLOR[variant]
        )}
      />
      <span className="truncate leading-snug">{label}</span>
    </Link>
  );
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

  const Content = (
    <>
      {/* Área do logotipo / título do módulo */}
      <Link
        href={logoHref}
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-2.5 border-b border-white/[0.09] px-4 py-3.5 transition-colors hover:bg-white/[0.05]"
      >
        {configs?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={configs.logo_url}
            alt="Logo"
            className="h-8 w-auto max-w-[36px] rounded-md bg-white object-contain p-0.5 shadow"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-md bg-verde-primary text-white shadow">
            <Shield className="size-4" />
          </div>
        )}
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-bold tracking-tight text-white">{title}</p>
          <p className="text-[10px] tracking-wide text-white/48">{subtitle}</p>
        </div>
      </Link>

      {/* Seções de navegação */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {sections.map((section, idx) => (
          <div key={section.label} className={idx > 0 ? "mt-2.5" : ""}>
            {/* Separador visual entre seções */}
            {idx > 0 && <div className="mb-2 border-t border-white/[0.07]" />}
            <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/28">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItemView key={item.href} {...item} pathname={pathname} setMobileOpen={setMobileOpen} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé: Voltar, Início e Sair — visual mais discreto que o nav */}
      <div className="border-t border-white/[0.07] px-2 py-2 space-y-0.5">
        <button
          type="button"
          onClick={() => { setMobileOpen(false); router.back(); }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm font-medium text-white/50 transition-all duration-150 hover:bg-white/[0.09] hover:text-white/85"
        >
          <ArrowLeft className="size-[15px] text-white/30" />
          <span>Voltar</span>
        </button>
        <Link
          href="/inicio"
          onClick={() => setMobileOpen(false)}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm font-medium text-white/50 transition-all duration-150 hover:bg-white/[0.09] hover:text-white/85"
        >
          <Home className="size-[15px] text-white/30" />
          <span>Início</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm font-medium text-white/50 transition-all duration-150 hover:bg-white/[0.09] hover:text-white/85"
        >
          <LogOut className="size-[15px] text-white/30" />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Botão hamburguer (mobile) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 flex size-10 items-center justify-center rounded-md bg-verde-dark text-white shadow md:hidden print:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col bg-verde-dark md:flex print:hidden">
        {Content}
      </aside>

      {/* Sidebar mobile com overlay */}
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
