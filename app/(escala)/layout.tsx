"use client";

import { type ReactNode } from "react";
import { CalendarCheck, CalendarDays, CalendarRange, FileBarChart, Grid3x3, HelpCircle, Settings } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

/**
 * Moldura do módulo Escala de Supervisores (Fase 3).
 *
 * Espelha a moldura da Frota de propósito: os dois são operação interna da
 * JCN Consultoria, sem empresa cliente no meio. Quem já usa um encontra o outro no mesmo
 * lugar.
 *
 * Grupo de rotas `(escala)` não aparece na URL: o caminho é `/escala`.
 *
 * ⚠️ O menu lista SÓ O QUE EXISTE — item apontando para rota inexistente é
 * 404, e quem clica acha que o módulo está quebrado.
 *
 * Fora do componente porque não depende de nada dele: aqui, ao contrário da
 * Frota, o menu não muda com unidade, perfil nem fila offline.
 */
const SECOES: NavSection[] = [
  {
    label: "Escala",
    items: [
      { href: "/escala", label: "Grade mensal", icon: CalendarDays },
      { href: "/escala/padrao", label: "Padrão semanal", icon: CalendarRange },
      { href: "/escala/conferencia", label: "Conferência", icon: CalendarCheck },
      { href: "/escala/calendario", label: "Calendário", icon: Grid3x3 },
      { href: "/escala/relatorios", label: "Relatórios", icon: FileBarChart },
      { href: "/escala/configuracao", label: "Configuração", icon: Settings },
      { href: "/escala/ajuda", label: "Ajuda", icon: HelpCircle },
    ],
  },
];

export default function EscalaLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("escala_supervisores");

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Escala"
        subtitle="Supervisores"
        logoHref="/escala"
        sections={SECOES}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6" style={{ viewTransitionName: "content" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
