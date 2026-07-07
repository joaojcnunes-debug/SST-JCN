"use client";

import { type ReactNode } from "react";
import { Siren, Plus } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const SECTIONS: NavSection[] = [
  {
    label: "Investigação de Acidente",
    items: [
      { href: "/investigacao-acidente", label: "Investigações", icon: Siren },
      { href: "/investigacao-acidente/nova", label: "Nova investigação", icon: Plus },
    ],
  },
];

export default function InvestigacaoAcidenteLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("investigacao_acidente");

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Investigação de Acidente"
        subtitle="JCN Consultoria"
        logoHref="/investigacao-acidente"
        sections={SECTIONS}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="Investigação de Acidente de Trabalho" />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
