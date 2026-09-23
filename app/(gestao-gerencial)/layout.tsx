"use client";

import { type ReactNode, useMemo } from "react";
import { Building2, CalendarDays, LayoutGrid } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUserStore } from "@/lib/store";

// Módulo interno gated por ModuloPermitido "gestao_gerencial" (Fase 2). Fase 1: só a
// navegação de unidades; as escalas entram nas próximas fases.
export default function GestaoGerencialLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("gestao_gerencial");
  const user = useUserStore((s) => s.user);
  const temEscala = (user?.modulos_permitidos ?? []).includes("escala_supervisores");

  const sections: NavSection[] = useMemo(() => {
    const items: NavSection["items"] = [
      { href: "/gestao-gerencial", label: "Início", icon: LayoutGrid },
      { href: "/gestao-gerencial/unidades", label: "Unidades", icon: Building2 },
    ];
    // Atalho para o módulo vizinho, só para quem tem os dois. A permissão é
    // independente: quem não tem a Escala veria um item que quica de volta.
    if (temEscala) {
      items.push({ href: "/escala", label: "Escala de Supervisores", icon: CalendarDays });
    }
    return [{ label: "Gestão Gerencial", items }];
  }, [temEscala]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Gestão Gerencial"
        subtitle="JCN Consultoria"
        logoHref="/gestao-gerencial"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
