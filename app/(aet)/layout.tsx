"use client";

import { type ReactNode, useMemo } from "react";
import { BookOpen, ClipboardCheck, LayoutDashboard, List, Plus, Printer, Settings2, Sliders } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { usePathname } from "next/navigation";

export default function AetLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("aet");

  const pathname = usePathname();

  const match = pathname.match(/\/aet\/([^/]+)\//);
  const idRelatorio = match?.[1];

  const sections = useMemo<NavSection[]>(() => {
    const base: NavSection[] = [
      {
        label: "AET",
        items: [
          { href: "/aet/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/aet", label: "Laudos", icon: List },
          { href: "/aet/novo", label: "Novo Laudo", icon: Plus },
        ],
      },
      {
        label: "Configuração",
        items: [
          { href: "/aet/texto-padrao", label: "Texto Padrão", icon: BookOpen },
          { href: "/aet/owas-config", label: "Config. OWAS", icon: Sliders },
          { href: "/aet/perfis-owas", label: "Perfis OWAS", icon: Settings2 },
        ],
      },
    ];

    if (idRelatorio) {
      base.push({
        label: "Laudo Atual",
        items: [
          { href: `/aet/${idRelatorio}/setores`, label: "Setores / Riscos", icon: ClipboardCheck },
          { href: `/aet/${idRelatorio}/laudo`, label: "Laudo / Imprimir", icon: Printer },
        ],
      });
    }

    return base;
  }, [idRelatorio]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="AET"
        subtitle="Chabra"
        logoHref="/aet"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="AET – Análise Ergonômica do Trabalho" />
        <main className="px-4 py-6 md:px-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
