"use client";

import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  BarChart3,
  Target,
  ClipboardEdit,
  FileEdit,
  Settings,
  Trash2,
} from "lucide-react";
import { useUserStore } from "@/lib/store";
import SidebarShell, { type NavItem, type NavSection } from "./SidebarShell";

const PRINCIPAL: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, variant: "dashboard" },
  { href: "/inspecoes", label: "Inspeções", icon: ClipboardList },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, variant: "report" },
];

const ACOES: NavItem[] = [
  { href: "/inspecoes/nova", label: "Nova Inspeção", icon: PlusCircle, variant: "action" },
  { href: "/inspecoes/ficha", label: "Ficha em Branco", icon: ClipboardEdit, variant: "action" },
  { href: "/acoes", label: "Plano de Ação", icon: Target, variant: "action" },
];

const CONFIGURACAO_BASE: NavItem[] = [
  { href: "/texto-padrao", label: "Texto Padrão", icon: FileEdit, variant: "config" },
];

const CONFIGURACAO_ADMIN: NavItem[] = [
  { href: "/config", label: "Configurações", icon: Settings, variant: "config" },
  { href: "/lixeira", label: "Lixeira", icon: Trash2, variant: "config" },
];

export default function Sidebar() {
  const user = useUserStore((s) => s.user);
  const canEdit = user?.perfil === "Admin" || user?.perfil === "Tecnico";
  const isAdmin = user?.perfil === "Admin";

  const sections: NavSection[] = [
    { label: "Principal", items: PRINCIPAL },
  ];
  if (canEdit) sections.push({ label: "Ações", items: ACOES });
  if (canEdit) {
    sections.push({
      label: "Configuração",
      items: isAdmin
        ? [...CONFIGURACAO_BASE, ...CONFIGURACAO_ADMIN]
        : CONFIGURACAO_BASE,
    });
  }

  return (
    <SidebarShell
      title="SST JCN Consultoria"
      subtitle="JCN Consultoria"
      logoHref="/dashboard"
      sections={sections}
    />
  );
}
