"use client";

import { type ReactNode } from "react";
import { Brain } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";

const sections: NavSection[] = [
  {
    label: "Psicossocial",
    items: [
      { href: "/psicossocial", label: "Visão geral", icon: Brain },
    ],
  },
];

export default function PsicossocialLayout({
  children,
}: {
  children: ReactNode;
}) {
  useAuth();

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Psicossocial"
        subtitle="Chabra"
        logoHref="/psicossocial"
        sections={sections}
      />
      <div className="md:pl-[220px]">
        <ModuleTopbar title="Psicossocial" />
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
