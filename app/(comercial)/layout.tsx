"use client";

// Módulo Comercial (2026-10-05): oportunidades de venda que as AEPs entregues
// indicaram (AET, DRPS/Questionário). Precisa do módulo "comercial" na conta;
// os dados vêm da RPC `comercial_dados`, que confere a mesma permissão.

import { type ReactNode } from "react";
import { Grid3x3, Handshake, Home } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const SECTIONS: NavSection[] = [
  {
    label: "Comercial",
    items: [
      { href: "/comercial", label: "Oportunidades", icon: Handshake },
      { href: "/comercial-matriz-aiha", label: "Matriz AIHA", icon: Grid3x3 },
    ],
  },
  {
    label: "Navegação",
    items: [{ href: "/inicio", label: "Início", icon: Home }],
  },
];

export default function ComercialLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("comercial");

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Comercial"
        subtitle="Oportunidades"
        logoHref="/comercial"
        sections={SECTIONS}
        backHref="/modulos"
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
