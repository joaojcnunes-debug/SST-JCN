"use client";

import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Gauge,
  History,
  Settings2,
  Users,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUserStore } from "@/lib/store";

/**
 * Dimensionamento (DIM-01) — substitui o módulo Produtividade.
 *
 * DUAS TRANCAS NA TELA, e nenhuma delas é a que realmente protege:
 *   • `useRequireModule("dimensionamento")` — o padrão do hub, igual aos outros 16 módulos.
 *   • `perfil === "Admin"` — porque este módulo é admin-only por decisão do operador (D7),
 *     e o módulo pode ser concedido a uma conta não-Admin por engano na tela /usuarios.
 *
 * As duas são conveniência de navegação. Quem protege o dado é a RLS `dim_admin` em cada
 * uma das 12 tabelas (v249) e a guarda `caller_eh_admin()` nas três RPCs: um não-Admin que
 * chame o PostgREST direto lê zero linhas e não grava nada. A trava por módulo do banco
 * (`rls_modulo_tabelas`) está em modo `log` até 21/10 e NÃO barra ninguém hoje.
 */
export default function DimensionamentoLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("dimensionamento");

  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const avisou = useRef(false);

  useEffect(() => {
    if (!user) return; // ainda carregando — useAuth cuida do "sem sessão"
    if (user.perfil === "Admin") return;
    if (!avisou.current) {
      avisou.current = true;
      toast.error("O Dimensionamento é restrito a administradores");
    }
    router.replace("/modulos");
  }, [user, router]);

  const sections = useMemo<NavSection[]>(
    () => [
      {
        label: "Dimensionamento",
        items: [
          { href: "/dimensionamento", label: "Headcount", icon: Gauge, variant: "dashboard" },
        ],
      },
      {
        label: "Cadastros",
        items: [
          { href: "/dimensionamento/unidades", label: "Unidades", icon: Building2 },
          { href: "/dimensionamento/empresas", label: "Empresas por Unidade", icon: ClipboardList },
          { href: "/dimensionamento/colaboradores", label: "Colaboradores", icon: Users },
          { href: "/dimensionamento/funcoes", label: "Funções", icon: Settings2 },
          { href: "/dimensionamento/calendario", label: "Calendário", icon: CalendarDays },
        ],
      },
      {
        label: "Acompanhamento",
        items: [
          { href: "/dimensionamento/historico", label: "Histórico", icon: History },
        ],
      },
    ],
    [],
  );

  // Não pisca a tela para quem vai ser mandado embora
  if (user && user.perfil !== "Admin") return null;

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Dimensionamento"
        subtitle="Chabra"
        logoHref="/dimensionamento"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
