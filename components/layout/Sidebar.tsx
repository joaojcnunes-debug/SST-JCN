"use client";

import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  PlusCircle,
  Users,
  Settings,
  BarChart3,
  Target,
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
  { href: "/acoes", label: "Plano de Ação", icon: Target },
];

const ADMIN = [
  { href: "/usuarios", label: "Usuários", icon: Users },
  { href: "/config", label: "Configurações", icon: Settings },
];

export default function Sidebar() {
  const user = useUserStore((s) => s.user);
  const isAdmin = user?.perfil === "Admin";
  const canEdit = user?.perfil === "Admin" || user?.perfil === "Tecnico";

  const sections: NavSection[] = [
    { label: "Principal", items: PRINCIPAL },
  ];
  if (canEdit) sections.push({ label: "Ações", items: ACOES });
  if (isAdmin) sections.push({ label: "Admin", items: ADMIN });

  return (
    <SidebarShell
      title="Painel SST"
      subtitle="Chabra"
      logoHref="/dashboard"
      sections={sections}
    />
  );
}
