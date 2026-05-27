"use client";

import { type ReactNode, useMemo } from "react";
import {
  ArrowLeft,
  FlaskConical,
  Plus,
  History,
  Database,
  FileEdit,
} from "lucide-react";
import SidebarShell, {
  type NavSection,
  type NavItem,
} from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUserStore } from "@/lib/store";

export default function AnaliseQuimicosLayout({
  children,
}: {
  children: ReactNode;
}) {
  useAuth();
  useRequireModule("analise_quimicos");
  const user = useUserStore((s) => s.user);

  const sections = useMemo<NavSection[]>(() => {
    const items: NavItem[] = [
      { href: "/inicio", label: "Painel SST", icon: ArrowLeft, variant: "back" as const },
      { href: "/analise-quimicos", label: "Visão geral", icon: FlaskConical },
      { href: "/analise-quimicos/nova", label: "Nova análise", icon: Plus },
      { href: "/analise-quimicos/historico", label: "Histórico", icon: History },
    ];
    // Base de referência: só Admin vê e edita.
    if (user?.perfil === "Admin") {
      items.push({
        href: "/analise-quimicos/base",
        label: "Base de referência",
        icon: Database,
      });
    }
    return [
      { label: "Análise de Químicos", items },
      {
        label: "Configuração",
        items: [
          {
            href: "/analise-quimicos/texto-padrao",
            label: "Texto Padrão",
            icon: FileEdit,
          },
        ],
      },
    ];
  }, [user?.perfil]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Análise de Químicos"
        subtitle="Chabra"
        logoHref="/analise-quimicos"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="Análise de Químicos Chabra" />
        <main className="px-4 py-6 md:px-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
