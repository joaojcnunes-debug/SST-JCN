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
  Award,
  Brain,
} from "lucide-react";
import { useUserStore } from "@/lib/store";
import SidebarShell, { type NavItem, type NavSection } from "./SidebarShell";

const PRINCIPAL: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, variant: "dashboard" },
  { href: "/inspecoes", label: "Inspeções", icon: ClipboardList },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, variant: "report" },
];

// Cliente não vê: as duas telas cruzam TODAS as empresas atendidas.
const CONTROLE: NavItem[] = [
  { href: "/certificados", label: "Certificados", icon: Award },
  { href: "/riscos-psicossociais", label: "Riscos Psicossociais", icon: Brain, variant: "report" },
];

const ACOES: NavItem[] = [
  { href: "/inspecoes/nova", label: "Nova Inspeção", icon: PlusCircle, variant: "action" },
  { href: "/inspecoes/ficha", label: "Ficha em Branco", icon: ClipboardEdit, variant: "action" },
  { href: "/acoes", label: "Plano de Ação", icon: Target, variant: "action" },
];

const CONFIGURACAO_BASE: NavItem[] = [
  { href: "/texto-padrao", label: "Texto Padrão", icon: FileEdit, variant: "config" },
  // Capítulos do PDF do Plano de Ação — módulo próprio, separado do laudo de
  // inspeção, porque o documento é entregue sozinho.
  { href: "/acoes/texto-padrao", label: "Texto Padrão — Plano de Ação", icon: FileEdit, variant: "config" },
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
    {
      label: "Principal",
      items: user && user.perfil !== "Cliente" ? [...PRINCIPAL, ...CONTROLE] : PRINCIPAL,
    },
  ];
  if (canEdit) sections.push({ label: "Ações", items: ACOES });

  // O aviso de "no aparelho" mora na BARRA SUPERIOR (`ModuleTopbar`), não aqui.
  // Este menu só existe no painel de inspeções, e os outros dezoito módulos têm
  // menu próprio — repetir o item em cada um seria dezoito chances de esquecer
  // um e deixar o técnico daquele módulo sem enxergar o que está parado no
  // celular. A barra superior os dezenove compartilham.
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
      subtitle="JCN Consultoria"
      logoHref="/dashboard"
      sections={sections}
    />
  );
}
