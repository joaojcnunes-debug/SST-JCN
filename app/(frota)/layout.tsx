"use client";

import { type ReactNode, useMemo } from "react";
import {
  Truck,
  Building2,
  HelpCircle,
  LayoutDashboard,
  Route,
  Smartphone,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";
import { useFilaOffline } from "@/lib/hooks/useFilaOffline";

/**
 * Moldura do módulo Frota JCN Consultoria — Checklist de Veículos (v177).
 *
 * Espelha o layout de Equipamentos de propósito: os dois são patrimônio interno
 * recortado por BASE, nunca por empresa cliente. Quem já usa um encontra o outro
 * no mesmo lugar, e a barra lateral lista as mesmas bases.
 *
 * Grupo de rotas `(frota)` não aparece na URL: o caminho é `/frota`.
 */

/** Cadastro que não é uma base real. Mesma regra do inventário e de equipamentos:
 *  cobre "Conselho" e "Conselheiro" (ex.: Conselheiro Lafaiete). */
const ehConselho = (nome: string | null) => /^conselh/i.test((nome ?? "").trim());

export default function FrotaLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("frota");

  const { data: unidades = [] } = useUnidades();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();

  /**
   * Montado na MOLDURA, não numa página: é aqui que ele fica vivo em todo o
   * módulo, escutando o evento `online` para subir a fila assim que o sinal
   * voltar — sem depender de o técnico estar numa tela específica.
   */
  const { naoResolvidas } = useFilaOffline();

  const sections: NavSection[] = useMemo(() => {
    // O PAINEL VEM PRIMEIRO (v178). Quem responde pelo setor abre o módulo para
    // saber o que está pendente, não para folhear cards de veículo — a lista de
    // veículos é onde se vai depois de decidir em qual carro mexer.
    // `/frota` continua sendo a lista: mudar o endereço da tela mais linkada do
    // módulo quebraria todo atalho já salvo por quem usa.
    const itens: NavSection["items"] = [
      { href: "/frota/painel", label: "Painel", icon: LayoutDashboard },
      { href: "/frota", label: "Veículos", icon: Truck },
      // "Saídas" saiu do menu em 2026-08-18: era a mesma lista da Movimentação,
      // com menos informação. A aba Viagens de lá cobre tudo — inclusive os
      // rascunhos, que eram o único assunto exclusivo da tela antiga.
      { href: "/frota/movimentacoes", label: "Movimentação", icon: Route },
    ];

    // Só aparece quando há o que resolver. Um item permanente e quase sempre
    // vazio vira ruído; um item que surge com número é aviso.
    if (naoResolvidas > 0) {
      itens.push({
        href: "/frota/pendencias",
        label: `No aparelho (${naoResolvidas})`,
        icon: Smartphone,
      });
    }

    itens.push({ href: "/frota/ajuda", label: "Ajuda", icon: HelpCircle });

    // Admin vê todas as bases; os demais só as suas — mesma régua da RLS da
    // tabela (`caller_unidades()` dentro de `frota_pode_veiculo`).
    const idsDoUsuario = new Set(user?.unidades ?? []);
    const visiveis = (isAdmin
      ? unidades
      : unidades.filter((u) => idsDoUsuario.has(u.id_unidade))
    ).filter((u) => !ehConselho(u.nome));

    const base: NavSection[] = [{ label: "Frota", items: itens }];

    if (visiveis.length > 0) {
      base.push({
        label: "Bases",
        items: visiveis.map((u) => ({
          href: `/frota?unidade=${u.id_unidade}`,
          label: u.nome,
          icon: Building2,
        })),
      });
    }

    return base;
  }, [unidades, user, isAdmin, naoResolvidas]);

  return (
    <div className="min-h-screen">
      <SidebarShell title="Frota" subtitle="JCN Consultoria" logoHref="/frota" sections={sections} />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6" style={{ viewTransitionName: "content" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
