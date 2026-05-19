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
  Settings,
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

const CONFIGURACAO_BASE = [
  { href: "/texto-padrao", label: "Texto Padrão", icon: FileEdit },
];

const CONFIGURACAO_ADMIN = [
  { href: "/config", label: "Configurações", icon: Settings },
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
      title="Painel SST"
      subtitle="Chabra"
      logoHref="/dashboard"
      sections={sections}
    />
  );
}
