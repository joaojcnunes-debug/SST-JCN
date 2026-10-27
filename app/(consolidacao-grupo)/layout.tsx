"use client";

/**
 * Moldura do módulo Consolidação Psicossocial de Grupo (19/10/2026).
 *
 * Nasceu dentro do DRPS (/psicossocial/consolidacao); no mesmo dia foi pedido que
 * fosse um módulo próprio da categoria Segurança do Trabalho, com caixa própria em
 * Usuários › Acesso aos módulos. Exige "consolidacao_psicossocial" (inclusive Admin,
 * como os demais módulos).
 */

import type { ReactNode } from "react";
import { Building2, Network } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const SECTIONS: NavSection[] = [
  {
    label: "Consolidação",
    items: [
      { href: "/consolidacao-grupo", label: "Grupos de empresas", icon: Network },
      { href: "/consolidacao-grupo/por-empresa", label: "Por empresa", icon: Building2 },
    ],
  },
];

export default function ConsolidacaoGrupoLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("consolidacao_psicossocial");
  return (
    <div className="min-h-screen">
      <SidebarShell title="Consolidação" subtitle="Segurança do Trabalho" logoHref="/consolidacao-grupo" sections={SECTIONS} backHref="/modulos" />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
