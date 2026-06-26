"use client";

import { type ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Cog, FileText, HelpCircle, List, Printer } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const RESERVADAS = new Set(["relacao-maquinas", "texto-padrao", "ajuda", "laudo"]);

export default function ApreciacaoMaquinasLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("apreciacao_maquinas");
  const pathname = usePathname();

  const idRelatorio = useMemo(() => {
    const m = pathname.match(/^\/apreciacao-maquinas\/([^/]+)(?:\/|$)/);
    if (!m) return null;
    const candidato = m[1];
    return RESERVADAS.has(candidato) ? null : candidato;
  }, [pathname]);

  const sections = useMemo<NavSection[]>(() => {
    const base: NavSection[] = [
      {
        label: "Apreciação de Máquinas",
        items: [
          { href: "/apreciacao-maquinas",                  label: "Visão geral",       icon: Cog },
          { href: "/apreciacao-maquinas/relacao-maquinas", label: "Relação de Máquinas", icon: List },
          { href: "/apreciacao-maquinas/texto-padrao",     label: "Texto Padrão",      icon: FileText },
          { href: "/apreciacao-maquinas/ajuda",            label: "Ajuda",             icon: HelpCircle },
        ],
      },
    ];

    if (idRelatorio) {
      base.push({
        label: "Apreciação Atual",
        items: [
          {
            href: `/apreciacao-maquinas/${idRelatorio}/laudo`,
            label: "Laudo / Imprimir",
            icon: Printer,
            variant: "report" as const,
          },
        ],
      });
    }

    return base;
  }, [idRelatorio]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Apreciação"
        subtitle="JCN Consultoria"
        logoHref="/apreciacao-maquinas"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="Apreciação de Máquinas" />
        <main className="px-4 py-6 md:px-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
