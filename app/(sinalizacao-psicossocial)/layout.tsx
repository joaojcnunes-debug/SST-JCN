"use client";

import { type ReactNode } from "react";
import { Brain, Home } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const SECTIONS: NavSection[] = [
  {
    label: "Sinalização Psicossocial",
    items: [
      { href: "/sinalizacao-psicossocial", label: "Painel de Alertas", icon: Brain },
    ],
  },
  {
    label: "Navegação",
    items: [
      { href: "/inicio", label: "Início", icon: Home },
    ],
  },
];

export default function SinalizacaoPsicossocialLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule(["aep", "psicossocial"]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Sinalização"
        subtitle="Psicossocial"
        logoHref="/sinalizacao-psicossocial"
        sections={SECTIONS}
        backHref="/inicio"
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="Sinalização de Fatores Psicossociais" />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
