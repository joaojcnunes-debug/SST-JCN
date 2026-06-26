"use client";

import { type ReactNode, useMemo } from "react";
import {
  BookMarked,
  Building2,
  CalendarRange,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Target,
  TrendingUp,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

export default function ProdutividadeLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("produtividade");

  const sections = useMemo<NavSection[]>(() => [
    {
      label: "Produtividade",
      items: [
        { href: "/produtividade",            label: "Dashboard",        icon: LayoutDashboard, variant: "dashboard" },
        { href: "/produtividade/unidades",   label: "Unidades e Equipe", icon: Building2 },
        { href: "/produtividade/documentos", label: "Documentos SST",   icon: FileText },
        { href: "/produtividade/controle-mensal", label: "Controle Mensal", icon: CalendarRange },
        { href: "/produtividade/projecoes",        label: "Projeções",        icon: TrendingUp, variant: "report" },
        { href: "/produtividade/projecoes-salvas", label: "Projeções Salvas", icon: BookMarked },
        { href: "/produtividade/registros",        label: "Registros Mensais", icon: ClipboardList },
        { href: "/produtividade/acompanhamento",   label: "Projetado × Realizado", icon: Target, variant: "report" },
      ],
    },
  ], []);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Produtividade"
        subtitle="JCN Consultoria"
        logoHref="/produtividade"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title="Projeção de Produtividade CHABRA" />
        <main className="px-4 py-6 md:px-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
