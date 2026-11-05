"use client";

// Módulo Comercial (2026-10-05): oportunidades de venda que as AEPs entregues
// indicaram (AET, DRPS/Questionário). Precisa do módulo "comercial" na conta;
// os dados vêm da RPC `comercial_dados`, que confere a mesma permissão.

import { type ReactNode } from "react";
import { Grid3x3, Handshake, Home, ListChecks } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { usePodeLiberarServicos } from "@/lib/hooks/useComercial";

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
  const podeLiberar = usePodeLiberarServicos();
  // "Liberar serviços" só aparece para quem pode decidir (0.3.233).
  const sections: NavSection[] = SECTIONS.map((s) =>
    s.label === "Comercial" && podeLiberar
      ? {
          ...s,
          items: [s.items[0], { href: "/comercial-liberar", label: "Liberar serviços", icon: ListChecks }, ...s.items.slice(1)],
        }
      : s,
  );

  return (
    <div className="casca min-h-screen">
      <SidebarShell
        title="Comercial"
        subtitle="Oportunidades"
        logoHref="/comercial"
        sections={sections}
        backHref="/modulos"
      />
      <div className="casca-folha md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
