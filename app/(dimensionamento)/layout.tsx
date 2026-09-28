"use client";

import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { permissoesDim } from "@/lib/dimensionamento/permissoes";

/**
 * Dimensionamento (DIM-01) — substitui o módulo Produtividade.
 *
 * Quem entra (v263, lib/dimensionamento/permissoes.ts):
 *   • Admin → tudo;
 *   • Gerente → vê Headcount, Cadastros e Histórico, sem criar/editar/excluir;
 *   • Supervisores → só Cadastros, com criar/editar/excluir (sem Headcount/Histórico).
 * Além disso, o módulo "dimensionamento" precisa estar liberado na conta.
 *
 * A tela só organiza a navegação. Quem protege o dado é a RLS das tabelas dim_*
 * (`dim_pode_ver()` para ler, `dim_pode_editar()` para gravar) e as RPCs.
 */
export default function DimensionamentoLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("dimensionamento");

  const router = useRouter();
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);
  const perm = permissoesDim(user);
  const avisou = useRef(false);

  // Rotas que só Admin e Gerente enxergam.
  const ehHeadcount = pathname === "/dimensionamento";
  const ehHistorico = pathname.startsWith("/dimensionamento/historico");
  const rotaProibida = (ehHeadcount && !perm.verHeadcount) || (ehHistorico && !perm.verHistorico);

  useEffect(() => {
    if (!user) return; // ainda carregando — useAuth cuida do "sem sessão"
    if (!perm.acesso) {
      if (!avisou.current) {
        avisou.current = true;
        toast.error("Sem permissão para o Dimensionamento");
      }
      router.replace("/modulos");
      return;
    }
    // Supervisor que cai no Headcount (ex.: pelo logo) vai para os Cadastros.
    if (rotaProibida) router.replace("/dimensionamento/unidades");
  }, [user, perm.acesso, rotaProibida, router]);

  const sections = useMemo<NavSection[]>(
    () => [
      ...(perm.verHeadcount
        ? [{
            label: "Dimensionamento",
            items: [
              { href: "/dimensionamento", label: "Headcount", icon: Gauge, variant: "dashboard" as const },
            ],
          }]
        : []),
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
      ...(perm.verHistorico
        ? [{
            label: "Acompanhamento",
            items: [
              { href: "/dimensionamento/historico", label: "Histórico", icon: History },
            ],
          }]
        : []),
    ],
    [perm.verHeadcount, perm.verHistorico],
  );

  // Não pisca a tela para quem vai ser mandado embora
  if (user && (!perm.acesso || rotaProibida)) return null;

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Dimensionamento"
        subtitle="JCN Consultoria"
        logoHref={perm.verHeadcount ? "/dimensionamento" : "/dimensionamento/unidades"}
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
