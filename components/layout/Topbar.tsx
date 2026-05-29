"use client";

import { usePathname } from "next/navigation";
import ModuleTopbar from "./ModuleTopbar";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/empresas": "Empresas",
  "/inspecoes": "Inspeções",
  "/inspecoes/nova": "Nova Inspeção",
  "/relatorios": "Relatórios",
};

function deriveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/inspecoes/") && pathname.endsWith("/relatorio"))
    return "Relatório de Inspeção";
  if (pathname.startsWith("/inspecoes/")) return "Editor de Inspeção";
  if (pathname.startsWith("/empresas/")) return "Detalhes da Empresa";
  return "Painel SST";
}

export default function Topbar() {
  const pathname = usePathname();
  return <ModuleTopbar title={deriveTitle(pathname)} />;
}
