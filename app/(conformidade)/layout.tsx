"use client";

import { type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";

const sections: NavSection[] = [
  {
    label: "Conformidade",
    items: [
      {
        href: "/relatorio-conformidade",
        label: "Visão geral",
        icon: CheckCircle2,
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

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Conformidade"
        subtitle="Chabra"
        logoHref="/relatorio-conformidade"
        sections={sections}
      />
      <div className="md:pl-[220px]">
        <ModuleTopbar title="Relatório de Conformidade" />
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
