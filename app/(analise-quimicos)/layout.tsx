"use client";

import { type ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  FlaskConical,
  Plus,
  History,
  HelpCircle,
  Database,
  FileEdit,
  Printer,
} from "lucide-react";
import SidebarShell, {
  type NavSection,
  type NavItem,
} from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUserStore } from "@/lib/store";

const RESERVADAS = new Set(["nova", "historico", "texto-padrao", "ajuda", "base", "laudo"]);

export default function AnaliseQuimicosLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("analise_quimicos");
  const user = useUserStore((s) => s.user);
  const pathname = usePathname();

  const idRelatorio = useMemo(() => {
    const m = pathname.match(/^\/analise-quimicos\/([^/]+)(?:\/|$)/);
    if (!m) return null;
    const candidato = m[1];
    return RESERVADAS.has(candidato) ? null : candidato;
  }, [pathname]);

  const sections = useMemo<NavSection[]>(() => {
    const items: NavItem[] = [
      { href: "/analise-quimicos",          label: "Visão geral",   icon: FlaskConical },
      { href: "/analise-quimicos/nova",     label: "Nova análise",  icon: Plus },
      { href: "/analise-quimicos/historico",label: "Histórico",     icon: History },
      { href: "/analise-quimicos/ajuda",    label: "Ajuda",         icon: HelpCircle },
    ];
    if (user?.perfil === "Admin") {
      items.push({ href: "/analise-quimicos/base", label: "Base de referência", icon: Database });
    }

    const base: NavSection[] = [
      { label: "Análise de Químicos", items },
      {
        label: "Configuração",
        items: [
          { href: "/analise-quimicos/texto-padrao", label: "Texto Padrão", icon: FileEdit },
        ],
      },
    ];

    if (idRelatorio) {
      base.push({
        label: "Análise Atual",
        items: [
          {
            href: `/analise-quimicos/${idRelatorio}/laudo`,
            label: "Laudo / Imprimir",
            icon: Printer,
            variant: "report" as const,
          },
        ],
      });
    }

    return base;
  }, [user?.perfil, idRelatorio]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Análise de Químicos"
        subtitle="JCN Consultoria"
        logoHref="/analise-quimicos"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="Análise de Químicos JCN Consultoria" />
        <main className="px-4 py-6 md:px-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
