"use client";

import { type ReactNode, useMemo } from "react";
import {
  LayoutDashboard,
  List,
  Plus,
  Settings2,
  ClipboardCheck,
  BarChart2,
  ListChecks,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUserStore } from "@/lib/store";
import { usePathname } from "next/navigation";

export default function QuestionariosLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("questionarios_psicossociais");

  const user = useUserStore((s) => s.user);
  const isAdmin = user?.perfil === "Admin";
  const pathname = usePathname();
  const match = pathname.match(/\/questionarios-psicossociais\/([^/]+)/);
  const idAplicacao = match?.[1];
  const isIdPage = idAplicacao && idAplicacao !== "nova" && idAplicacao !== "tipos" && idAplicacao !== "como-funciona" && idAplicacao !== "ajuda";

  const sections = useMemo<NavSection[]>(() => {
    const base: NavSection[] = [
      {
        label: "Questionários DRPS",
        items: [
          {
            href: "/questionarios-psicossociais",
            label: "Aplicações",
            icon: List,
          },
          {
            href: "/questionarios-psicossociais/nova",
            label: "Nova Aplicação",
            icon: Plus,
            variant: "action",
          },
          {
            href: "/questionarios-psicossociais/ajuda",
            label: "Ajuda",
            icon: HelpCircle,
          },
        ],
      },
      ...(isAdmin
        ? [
            {
              label: "Configuração",
              items: [
                {
                  href: "/questionarios-psicossociais/tipos",
                  label: "Tipos e Perguntas",
                  icon: Settings2,
                  variant: "config" as const,
                },
                {
                  href: "/questionarios-psicossociais/como-funciona",
                  label: "Metodologia",
                  icon: BookOpen,
                  variant: "config" as const,
                },
              ],
            },
          ]
        : []),
    ];

    if (isIdPage) {
      base.push({
        label: "Aplicação Atual",
        items: [
          {
            href: `/questionarios-psicossociais/${idAplicacao}`,
            label: "Resumo",
            icon: LayoutDashboard,
          },
          {
            href: `/questionarios-psicossociais/${idAplicacao}/respondentes`,
            label: "Respondentes",
            icon: ListChecks,
          },
          {
            href: `/questionarios-psicossociais/${idAplicacao}/resultados`,
            label: "Resultados / Matriz",
            icon: BarChart2,
          },
          {
            href: `/questionarios-psicossociais/${idAplicacao}/planos`,
            label: "Planos de Ação",
            icon: ClipboardCheck,
          },
        ],
      });
    }

    return base;
  }, [idAplicacao, isIdPage]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="QPS / DRPS"
        subtitle="Chabra"
        logoHref="/questionarios-psicossociais"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="Questionários Psicossociais / DRPS" />
        <main className="px-4 py-6 md:px-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
