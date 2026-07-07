"use client";

import { type ReactNode } from "react";
import { Boxes, HelpCircle } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const sections: NavSection[] = [
  {
    label: "Inventário",
    items: [
      { href: "/inventario-maquinas", label: "Visão geral", icon: Boxes },
      { href: "/inventario-maquinas/ajuda", label: "Ajuda", icon: HelpCircle },
    ],
  },
];

export default function InventarioMaquinasLayout({
  children,
}: {
  children: ReactNode;
}) {
  useAuth();
  useRequireModule("inventario_maquinas");

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Inventário"
        subtitle="JCN Consultoria"
        logoHref="/inventario-maquinas"
        sections={sections}
      />
      <div className="md:pl-[220px]">
        <ModuleTopbar title="Inventário de Máquinas e Equipamentos" />
        <main className="px-4 py-6 md:px-6" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
