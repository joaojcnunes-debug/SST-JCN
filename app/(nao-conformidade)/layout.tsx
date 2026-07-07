"use client";

import { type ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Plus, ListChecks, FileEdit, HelpCircle, Printer } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const RESERVADAS = new Set(["novo", "historico", "texto-padrao", "ajuda", "laudo"]);

export default function NaoConformidadeLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("nao_conformidade");
  const pathname = usePathname();

  const idRelatorio = useMemo(() => {
    const m = pathname.match(/^\/relatorio-nao-conformidade\/([^/]+)(?:\/|$)/);
    if (!m) return null;
    const candidato = m[1];
    return RESERVADAS.has(candidato) ? null : candidato;
  }, [pathname]);

  const sections = useMemo<NavSection[]>(() => {
    const base: NavSection[] = [
      {
        label: "Não Conformidade",
        items: [
          { href: "/relatorio-nao-conformidade",          label: "Visão geral",    icon: AlertTriangle },
          { href: "/relatorio-nao-conformidade/novo",      label: "Novo relatório", icon: Plus },
          { href: "/relatorio-nao-conformidade/historico", label: "Histórico",      icon: ListChecks },
          { href: "/relatorio-nao-conformidade/ajuda",     label: "Ajuda",          icon: HelpCircle },
        ],
      },
      {
        label: "Configuração",
        items: [
          { href: "/relatorio-nao-conformidade/texto-padrao", label: "Texto Padrão", icon: FileEdit },
        ],
      },
    ];

    if (idRelatorio) {
      base.push({
        label: "Relatório Atual",
        items: [
          {
            href: `/relatorio-nao-conformidade/${idRelatorio}/laudo`,
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
        title="Não Conformidade"
        subtitle="JCN Consultoria"
        logoHref="/relatorio-nao-conformidade"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="Relatório de Não Conformidade" />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
