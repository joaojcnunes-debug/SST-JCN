"use client";

import { type ReactNode, useMemo } from "react";
import {
  BookOpen,
  Brain,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  HelpCircle,
  Info,
  LayoutDashboard,
  List,
  Plus,
  Printer,
  Settings2,
  Sliders,
  Users,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUserStore } from "@/lib/store";
import { usePathname } from "next/navigation";
import { ehSupervisor } from "@/lib/hooks/useUsuario";

export default function AetLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("aet");

  const user = useUserStore((s) => s.user);
  const isAdmin = ehSupervisor(user); // v229: configuração do módulo é de quem supervisiona
  const pathname = usePathname();

  const match = pathname.match(/\/aet\/([^/]+)\//);
  const idRelatorio = match?.[1];
  const isConfigPage = ["dashboard", "novo", "formulario-branco", "texto-padrao", "owas-config", "perfis-owas", "13fatores-config", "ajuda"].includes(idRelatorio ?? "");

  const sections = useMemo<NavSection[]>(() => {
    const base: NavSection[] = [
      {
        label: "AET",
        items: [
          { href: "/aet/dashboard", label: "Dashboard", icon: LayoutDashboard, variant: "dashboard" },
          { href: "/aet", label: "Laudos", icon: List },
          { href: "/aet/novo", label: "Novo Laudo", icon: Plus, variant: "action" },
          { href: "/aet/formulario-branco", label: "Formulário em Branco", icon: ClipboardPen },
          { href: "/aet/ajuda", label: "Ajuda", icon: HelpCircle },
        ],
      },
      ...(isAdmin
        ? [
            {
              label: "Configuração",
              items: [
                { href: "/aet/texto-padrao",      label: "Texto Padrão",       icon: BookOpen,  variant: "config" as const },
                { href: "/aet/owas-config",       label: "Config. OWAS",       icon: Sliders,   variant: "config" as const },
                { href: "/aet/perfis-owas",       label: "Perfis OWAS",        icon: Users,     variant: "config" as const },
                { href: "/aet/13fatores-config",  label: "Config. 13 Fatores", icon: Brain,     variant: "config" as const },
              ],
            },
          ]
        : []),
    ];

    if (idRelatorio && !isConfigPage) {
      base.push({
        label: "Laudo Atual",
        items: [
          // `/aet/[id]` redireciona para `/dados`, mas o item nunca esteve no
          // menu — quem saísse dali não tinha como voltar, e a Validade do
          // Documento (que só existe nessa tela) ficava inalcançável.
          { href: `/aet/${idRelatorio}/dados`,        label: "Dados do Laudo",    icon: Info },
          { href: `/aet/${idRelatorio}/setores`,      label: "Setores / Riscos",  icon: ClipboardCheck },
          { href: `/aet/${idRelatorio}/plano-acao`,   label: "Plano de Ação",     icon: ClipboardList },
          { href: `/aet/${idRelatorio}/laudo`,        label: "Laudo / Imprimir",  icon: Printer, variant: "report" as const },
        ],
      });
    }

    return base;
  }, [idRelatorio, isConfigPage, isAdmin]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="AET"
        subtitle="JCN Consultoria"
        logoHref="/aet"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
