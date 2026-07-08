"use client";

import { type ReactNode } from "react";
import { HardHat, HelpCircle } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const sections: NavSection[] = [
  {
    label: "EPI",
    items: [
      { href: "/epi", label: "Visão geral", icon: HardHat },
      { href: "/epi/ajuda", label: "Ajuda", icon: HelpCircle },
    ],
  },
];

export default function EpiLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("epi");

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="EPI"
        subtitle="JCN Consultoria"
        logoHref="/epi"
        sections={sections}
      />
      <div className="md:pl-[220px]">
        <ModuleTopbar title="Equipamentos de Proteção Individual" />
        <main
          className="px-4 py-6 md:px-6"
          style={{ viewTransitionName: "content" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
