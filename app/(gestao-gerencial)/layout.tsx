"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { Building2 } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

// Módulo interno gated por ModuloPermitido "gestao_gerencial" (Fase 2). Fase 1: só a
// navegação de unidades; as escalas entram nas próximas fases.
const sections: NavSection[] = [
  {
    label: "Gestão Gerencial",
    items: [
      { href: "/gestao-gerencial", label: "Unidades", icon: Building2 },
    ],
  },
];

export default function GestaoGerencialLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("gestao_gerencial");
  const pathname = usePathname();
  const titulo = pathname.startsWith("/gestao-gerencial/") ? "Escalas e Substituições" : "Gestão Gerencial";

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Gestão Gerencial"
        subtitle="JCN Consultoria"
        logoHref="/gestao-gerencial"
        sections={sections}
      />
      <div className="md:pl-[220px]">
        <ModuleTopbar title={titulo} />
        <main className="px-4 py-6 md:px-6" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
