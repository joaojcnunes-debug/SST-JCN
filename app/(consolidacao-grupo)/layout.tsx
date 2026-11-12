"use client";

/**
 * Moldura do módulo Consolidação Psicossocial de Grupo (19/10/2026).
 *
 * Nasceu dentro do DRPS (/psicossocial/consolidacao); no mesmo dia foi pedido que
 * fosse um módulo próprio da categoria Segurança do Trabalho, com caixa própria em
 * Usuários › Acesso aos módulos. Exige "consolidacao_psicossocial" (inclusive Admin,
 * como os demais módulos).
 */

import type { ReactNode } from "react";
import { BadgeCheck, Building2, GitCompareArrows, GitMerge, HeartHandshake, Network } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { usePodeLiberarServicos } from "@/lib/hooks/useComercial";

const SECTIONS: NavSection[] = [
  {
    label: "Consolidação",
    items: [
      { href: "/consolidacao-grupo", label: "Grupos de empresas", icon: Network },
      { href: "/consolidacao-grupo/por-empresa", label: "Por empresa", icon: Building2 },
      // 29/10: questionários (DRPS/QPS) × AEP, empresa a empresa — não precisa de grupo.
      { href: "/consolidacao-grupo/conciliacao", label: "Conciliação DRPS/QPS × AEP", icon: GitCompareArrows },
      // 12/11 (v0.3.285): a mesma conciliação, com o grupo de empresas inteiro.
      { href: "/consolidacao-grupo/conciliacao-grupo", label: "Conciliação por grupo", icon: GitMerge },
      // v323: o que o Comercial vendeu; só leitura, para quem está na Consolidação.
      { href: "/consolidacao-grupo/vendas", label: "Vendas", icon: BadgeCheck },
    ],
  },
];

export default function ConsolidacaoGrupoLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("consolidacao_psicossocial");
  const podeLiberar = usePodeLiberarServicos();
  // 06/11: a liberação para o Comercial é etapa da Conciliação; aqui fica só o catálogo dela.
  const sections: NavSection[] = podeLiberar
    ? SECTIONS.map((s) => ({
        ...s,
        items: [
          ...s.items,
          { href: "/consolidacao-grupo/intervencoes", label: "Intervenções", icon: HeartHandshake },
        ],
      }))
    : SECTIONS;
  return (
    <div className="casca min-h-screen">
      <SidebarShell title="Consolidação" subtitle="Segurança do Trabalho" logoHref="/consolidacao-grupo" sections={sections} backHref="/modulos" />
      <div className="casca-folha md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
