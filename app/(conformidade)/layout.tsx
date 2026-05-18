"use client";

import { type ReactNode } from "react";
import { CheckCircle2, Plus, ListChecks } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const sections: NavSection[] = [
  {
    label: "Conformidade",
    items: [
      {
        href: "/relatorio-conformidade",
        label: "Visão geral",
        icon: CheckCircle2,
      },
      {
        href: "/relatorio-conformidade/novo",
        label: "Novo relatório",
        icon: Plus,
      },
      {
        href: "/relatorio-conformidade/historico",
        label: "Histórico",
        icon: ListChecks,
      },
    ],
  },
];

export default function ConformidadeLayout({
  children,
}: {
  children: ReactNode;
}) {
  useAuth();
  useRequireModule("conformidade");

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Conformidade"
        subtitle="Chabra"
        logoHref="/relatorio-conformidade"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="Relatório de Conformidade" />
        <main className="px-4 py-6 md:px-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
