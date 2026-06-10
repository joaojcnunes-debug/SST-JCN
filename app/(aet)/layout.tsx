"use client";

import { type ReactNode, useMemo } from "react";
import {
  BookOpen,
  Brain,
  ClipboardCheck,
  LayoutDashboard,
  List,
  Plus,
  Printer,
  Settings2,
  Sliders,
  Users,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUserStore } from "@/lib/store";
import { usePathname } from "next/navigation";

export default function AetLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("aet");

  const user = useUserStore((s) => s.user);
  const isAdmin = user?.perfil === "Admin";
  const pathname = usePathname();

  const match = pathname.match(/\/aet\/([^/]+)\//);
  const idRelatorio = match?.[1];
  const isConfigPage = ["dashboard", "novo", "texto-padrao", "owas-config", "perfis-owas", "13fatores-config"].includes(idRelatorio ?? "");

  const sections = useMemo<NavSection[]>(() => {
    const base: NavSection[] = [
      {
        label: "AET",
        items: [
          { href: "/aet/dashboard", label: "Dashboard", icon: LayoutDashboard, variant: "dashboard" },
          { href: "/aet", label: "Laudos", icon: List },
          { href: "/aet/novo", label: "Novo Laudo", icon: Plus, variant: "action" },
        ],
      },
      ...(isAdmin
        ? [
            {
              label: "Configuração",
              items: [
                { href: "/aet/texto-padrao",      label: "Texto Padrão",       icon: BookOpen,  variant: "config" as const },
                { href: "/aet/owas-config",       label: "Config. OWAS",       icon: Sliders,   variant: "config" as const },
                { href: "/aet/perfis-owas",       label: "Perfis OWAS",        icon: Users,     variant: "config" as const },
                { href: "/aet/13fatores-config",  label: "Config. 13 Fatores", icon: Brain,     variant: "config" as const },
              ],
            },
          ]
        : []),
    ];

    if (idRelatorio && !isConfigPage) {
      base.push({
        label: "Laudo Atual",
        items: [
          { href: `/aet/${idRelatorio}/setores`,      label: "Setores / Riscos",  icon: ClipboardCheck },
          { href: `/aet/${idRelatorio}/laudo`,        label: "Laudo / Imprimir",  icon: Printer, variant: "report" as const },
        ],
      });
    }

    return base;
  }, [idRelatorio, isConfigPage, isAdmin]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="AET"
        subtitle="JCN"
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
