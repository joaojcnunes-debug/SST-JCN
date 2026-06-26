"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { Users, Settings, FileClock, Trash2 } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireAdmin } from "@/lib/hooks/useRequireAdmin";

const sections: NavSection[] = [
  {
    label: "Administração",
    items: [
      { href: "/usuarios", label: "Usuários", icon: Users },
      { href: "/config", label: "Configurações", icon: Settings },
      { href: "/pdfs-gerados", label: "PDFs Gerados", icon: FileClock },
      { href: "/lixeira", label: "Lixeira", icon: Trash2 },
    ],
  },
];

const TITULOS: Record<string, string> = {
  "/usuarios": "Usuários",
  "/config": "Configurações",
  "/pdfs-gerados": "PDFs Gerados",
  "/lixeira": "Lixeira",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireAdmin();
  const pathname = usePathname();
  const titulo = TITULOS[pathname] ?? "Administração";

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Administração"
        subtitle="JCN Consultoria"
        logoHref="/usuarios"
        sections={sections}
      />
      <div className="md:pl-[220px]">
        <ModuleTopbar title={titulo} />
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
