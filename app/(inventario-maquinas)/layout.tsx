"use client";

import { type ReactNode, useMemo } from "react";
import {
  Boxes,
  ArrowLeftRight,
  HelpCircle,
  Building2,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";

// O painel filtra daqui o cadastro "Conselho/Conselheiro", que na Chabra não é
// uma base real de equipamentos. No JCN esse cadastro não existe, e o filtro
// (regex /^conselh/) excluiria por engano uma base legítima como "Conselheiro
// Lafaiete" — então todas as unidades aparecem.

export default function InventarioMaquinasLayout({
  children,
}: {
  children: ReactNode;
}) {
  useAuth();
  useRequireModule("inventario_maquinas");

  const { data: unidades = [] } = useUnidades();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();

  const sections: NavSection[] = useMemo(() => {
    // "Transferência" só aparece para quem tem o módulo (ou admin).
    const podeTransferir =
      isAdmin || (user?.modulos_permitidos ?? []).includes("transferencias");

    const itensInventario: NavSection["items"] = [
      { href: "/inventario-maquinas", label: "Visão geral", icon: Boxes },
      ...(podeTransferir
        ? [{ href: "/inventario-maquinas/transferencia", label: "Transferência", icon: ArrowLeftRight }]
        : []),
      { href: "/inventario-maquinas/ajuda", label: "Ajuda", icon: HelpCircle },
    ];

    // Unidades visíveis: admin vê todas; os demais só as suas (mesma regra de
    // acesso do cadastro de usuário). Todas aparecem mesmo sem equipamento.
    const idsDoUsuario = new Set(user?.unidades ?? []);
    const unidadesVisiveis = isAdmin
      ? unidades
      : unidades.filter((u) => idsDoUsuario.has(u.id_unidade));

    const base: NavSection[] = [{ label: "Inventário", items: itensInventario }];

    if (unidadesVisiveis.length > 0) {
      base.push({
        label: "Unidades",
        items: unidadesVisiveis.map((u) => ({
          href: `/inventario-maquinas?unidade=${u.id_unidade}`,
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
        title="Inventário"
        subtitle="JCN Consultoria"
        logoHref="/inventario-maquinas"
        sections={sections}
      />
      <div className="md:pl-[220px]">
        <ModuleTopbar title="Inventário de Máquinas e Equipamentos" />
        <main className="px-4 py-6 md:px-6" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
