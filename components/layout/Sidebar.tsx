"use client";

import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  PlusCircle,
  BarChart3,
  Target,
  ClipboardEdit,
  FileEdit,
} from "lucide-react";
import { useUserStore } from "@/lib/store";
import SidebarShell, { type NavSection } from "./SidebarShell";

const PRINCIPAL = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/inspecoes", label: "Inspeções", icon: ClipboardList },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

const ACOES = [
  { href: "/inspecoes/nova", label: "Nova Inspeção", icon: PlusCircle },
  { href: "/inspecoes/ficha", label: "Ficha em Branco", icon: ClipboardEdit },
  { href: "/acoes", label: "Plano de Ação", icon: Target },
];

const CONFIGURACAO = [
  { href: "/texto-padrao", label: "Texto Padrão", icon: FileEdit },
];

export default function Sidebar() {
  const user = useUserStore((s) => s.user);
  const canEdit = user?.perfil === "Admin" || user?.perfil === "Tecnico";

  const sections: NavSection[] = [
    { label: "Principal", items: PRINCIPAL },
  ];
  if (canEdit) sections.push({ label: "Ações", items: ACOES });
  if (canEdit) sections.push({ label: "Configuração", items: CONFIGURACAO });

  return (
    <SidebarShell
      title="Painel SST"
      subtitle="Chabra"
      logoHref="/dashboard"
      sections={sections}
    />
  );
}
