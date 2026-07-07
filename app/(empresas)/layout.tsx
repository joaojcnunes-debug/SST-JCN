"use client";

import { type ReactNode, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserStore } from "@/lib/store";

export default function EmpresasLayout({ children }: { children: ReactNode }) {
  useAuth();
  const router = useRouter();
  const user = useUserStore((s) => s.user);

  // Área interna (Admin/Técnico/Visualizador). Cliente usa o portal próprio.
  useEffect(() => {
    if (user?.perfil === "Cliente") router.replace("/portal-cliente/inicio");
  }, [user?.perfil, router]);

  const sections = useMemo<NavSection[]>(() => [
    {
      label: "Cadastro",
      items: [
        { href: "/empresas", label: "Empresas", icon: Building2, variant: "dashboard" },
      ],
    },
  ], []);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Empresas"
        subtitle="JCN Consultoria"
        logoHref="/empresas"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="Cadastro de Empresas" />
        <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
