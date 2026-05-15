"use client";

import { type ReactNode } from "react";
import { FlaskConical, Plus, History, Database } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const sections: NavSection[] = [
  {
    label: "Análise de Químicos",
    items: [
      { href: "/analise-quimicos", label: "Visão geral", icon: FlaskConical },
      { href: "/analise-quimicos/nova", label: "Nova análise", icon: Plus },
      { href: "/analise-quimicos/historico", label: "Histórico", icon: History },
      { href: "/analise-quimicos/base", label: "Base de referência", icon: Database },
    ],
  },
];

export default function AnaliseQuimicosLayout({
  children,
}: {
  children: ReactNode;
}) {
  useAuth();
  useRequireModule("analise_quimicos");

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
