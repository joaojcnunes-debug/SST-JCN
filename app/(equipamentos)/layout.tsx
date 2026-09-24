"use client";

import { type ReactNode, useMemo } from "react";
import { HardDrive, Building2, HelpCircle, ArrowLeftRight } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";

/**
 * Moldura do módulo Equipamentos JCN Consultoria (patrimônio interno).
 *
 * Espelha o layout do inventário NR-12 de propósito: quem já usa um encontra o
 * outro no mesmo lugar. O que muda é o recorte — aqui a barra lateral lista
 * BASES (unidades da JCN Consultoria), nunca empresas cliente, porque patrimônio interno
 * não pertence a cliente nenhum.
 */

/** Cadastro que não é uma base real de equipamentos. Mesma regra do inventário:
 *  cobre "Conselho" e "Conselheiro" (ex.: Conselheiro Lafaiete). */
const ehConselho = (nome: string | null) => /^conselh/i.test((nome ?? "").trim());

export default function EquipamentosLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("equipamentos");

  const { data: unidades = [] } = useUnidades();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();

  const sections: NavSection[] = useMemo(() => {
    const itens: NavSection["items"] = [
      { href: "/equipamentos", label: "Visão geral", icon: HardDrive },
      { href: "/equipamentos/movimentacao", label: "Movimentação", icon: ArrowLeftRight },
      // ✅ 2026-08-18: "Transferência" SAIU do menu porque virou uma ação DENTRO
      // de Movimentação — é lá que ela mora agora, ao lado da transferência por
      // quantidade, do histórico e do termo em PDF. Dois itens de menu abrindo a
      // mesma tela é o que a Frota acabou de deixar de ter, pelo mesmo motivo.
      //
      // A régua de permissão não mudou: quem dá entrada é quem transfere
      // (decisão de 11/08), e Movimentação já é aberta a quem tem o módulo. Por
      // isso o filtro por `transferencias` que existia aqui deixou de fazer
      // sentido no menu e saiu junto.
      { href: "/equipamentos/ajuda", label: "Ajuda", icon: HelpCircle },
    ];

    // Admin vê todas as bases; os demais só as suas — mesma régua do cadastro
    // de usuário e da RLS da tabela (`caller_unidades()`).
    const idsDoUsuario = new Set(user?.unidades ?? []);
    const visiveis = (isAdmin
      ? unidades
      : unidades.filter((u) => idsDoUsuario.has(u.id_unidade))
    ).filter((u) => !ehConselho(u.nome));

    const base: NavSection[] = [{ label: "Equipamentos", items: itens }];

    if (visiveis.length > 0) {
      base.push({
        label: "Bases",
        items: visiveis.map((u) => ({
          href: `/equipamentos?unidade=${u.id_unidade}`,
          label: u.nome,
          icon: Building2,
        })),
      });
    }

    return base;
  }, [unidades, user, isAdmin]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Equipamentos"
        subtitle="JCN Consultoria"
        logoHref="/equipamentos"
        sections={sections}
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
