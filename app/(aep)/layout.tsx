"use client";

import { type ReactNode, useMemo } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Info,
  LayoutDashboard,
  List,
  Plus,
  Printer,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUserStore } from "@/lib/store";
import { usePathname } from "next/navigation";

export default function AepLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("aep");

  const user = useUserStore((s) => s.user);
  const isAdmin = user?.perfil === "Admin";
  const pathname = usePathname();

  const match = pathname.match(/\/aep\/([^/]+)\//);
  const idRelatorio = match?.[1];
  const isConfigPage = ["dashboard", "novo", "texto-padrao"].includes(idRelatorio ?? "");

  const sections = useMemo<NavSection[]>(() => {
    const base: NavSection[] = [
      {
        label: "AEP",
        items: [
          { href: "/aep/dashboard", label: "Dashboard",    icon: LayoutDashboard, variant: "dashboard" },
          { href: "/aep",           label: "Análises",     icon: List },
          { href: "/aep/novo",      label: "Nova Análise", icon: Plus, variant: "action" },
        ],
      },
      ...(isAdmin
        ? [
            {
              label: "Configuração",
              items: [
                { href: "/aep/texto-padrao", label: "Texto Padrão", icon: BookOpen, variant: "config" as const },
              ],
            },
          ]
        : []),
    ];

    if (idRelatorio && !isConfigPage) {
      base.push({
        label: "Análise Atual",
        items: [
          { href: `/aep/${idRelatorio}/setores`, label: "Setores / Triagem", icon: ClipboardCheck },
          { href: `/aep/${idRelatorio}/dados`,   label: "Dados / Conclusão", icon: Info },
          { href: `/aep/${idRelatorio}/laudo`,   label: "Laudo / Imprimir",  icon: Printer, variant: "report" as const },
        ],
      });
    }

    return base;
  }, [idRelatorio, isConfigPage, isAdmin]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="AEP"
        subtitle="Chabra"
        logoHref="/aep"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="AEP – Análise Ergonômica Preliminar" />
        <main className="px-4 py-6 md:px-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
