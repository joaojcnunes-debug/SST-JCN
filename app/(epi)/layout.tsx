"use client";

import { type ReactNode } from "react";
import { HardHat } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

// Módulo interno gated por ModuloPermitido "epi".
const sections: NavSection[] = [
  {
    label: "Gestão de EPI",
    items: [{ href: "/epi", label: "EPI", icon: HardHat }],
  },
];

export default function EpiLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("epi");

  return (
    <div className="min-h-screen">
      <SidebarShell title="Gestão de EPI" subtitle="JCN Consultoria" logoHref="/epi" sections={sections} />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
