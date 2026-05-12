"use client";

import { type ReactNode } from "react";
import {
  LayoutDashboard,
  Upload,
  ListChecks,
  Layers,
  FileText,
  ClipboardCheck,
  LineChart,
  HelpCircle,
  ListTodo,
  Building2,
  BookOpen,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const sections: NavSection[] = [
  {
    label: "Diagnóstico",
    items: [
      { href: "/psicossocial", label: "Dashboard", icon: LayoutDashboard },
      { href: "/psicossocial/dados", label: "Dados do Forms", icon: Upload },
      { href: "/psicossocial/escala", label: "Escala", icon: ListChecks },
      { href: "/psicossocial/resumo", label: "Resumo por Tópico", icon: Layers },
      { href: "/psicossocial/analise", label: "Análise e Avaliação", icon: FileText },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/psicossocial/medidas", label: "Medidas de Controle", icon: ClipboardCheck },
      { href: "/psicossocial/monitoramento", label: "Monitoramento", icon: LineChart },
      { href: "/psicossocial/revisao", label: "Revisão e Melhoria", icon: ListTodo },
    ],
  },
  {
    label: "Referência",
    items: [
      { href: "/psicossocial/criterios", label: "Critérios de Probabilidade", icon: HelpCircle },
      { href: "/psicossocial/empresa", label: "Empresa", icon: Building2 },
      { href: "/psicossocial/ajuda", label: "Ajuda", icon: BookOpen },
    ],
  },
];

export default function PsicossocialLayout({
  children,
}: {
  children: ReactNode;
}) {
  useAuth();
  useRequireModule("psicossocial");

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Psicossocial"
        subtitle="Chabra"
        logoHref="/psicossocial"
        sections={sections}
      />
      <div className="md:pl-[220px]">
        <ModuleTopbar title="DRPS — Diagnóstico de Riscos Psicossociais" />
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
