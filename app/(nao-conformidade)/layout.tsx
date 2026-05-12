"use client";

import { type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const sections: NavSection[] = [
  {
    label: "Não Conformidade",
    items: [
      {
        href: "/relatorio-nao-conformidade",
        label: "Visão geral",
        icon: AlertTriangle,
      },
    ],
  },
];

export default function NaoConformidadeLayout({
  children,
}: {
  children: ReactNode;
}) {
  useAuth();
  useRequireModule("nao_conformidade");

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Não Conformidade"
        subtitle="Chabra"
        logoHref="/relatorio-nao-conformidade"
        sections={sections}
      />
      <div className="md:pl-[220px]">
        <ModuleTopbar title="Relatório de Não Conformidade" />
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
