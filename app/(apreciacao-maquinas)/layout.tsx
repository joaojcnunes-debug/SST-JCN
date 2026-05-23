"use client";

import { type ReactNode } from "react";
import { Cog, FileText, List } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const sections: NavSection[] = [
  {
    label: "Apreciação de Máquinas",
    items: [
      { href: "/apreciacao-maquinas", label: "Visão geral", icon: Cog },
      {
        href: "/apreciacao-maquinas/relacao-maquinas",
        label: "Relação de Máquinas",
        icon: List,
      },
      {
        href: "/apreciacao-maquinas/texto-padrao",
        label: "Texto Padrão",
        icon: FileText,
      },
    ],
  },
];

export default function ApreciacaoMaquinasLayout({
  children,
}: {
  children: ReactNode;
}) {
  useAuth();
  useRequireModule("apreciacao_maquinas");

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Apreciação"
        subtitle="Chabra"
        logoHref="/apreciacao-maquinas"
        sections={sections}
      />
      <div className="md:pl-[220px]">
        <ModuleTopbar title="Apreciação de Máquinas" />
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
