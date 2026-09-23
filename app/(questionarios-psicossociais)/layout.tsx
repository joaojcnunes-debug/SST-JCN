"use client";

import { type ReactNode, useMemo } from "react";
import {
  LayoutDashboard,
  List,
  Plus,
  Settings2,
  ClipboardCheck,
  BarChart2,
  FileSearch,
  ListChecks,
  BookOpen,
  HelpCircle,
  LineChart,
  ListTodo,
  Printer,
  FileEdit,
  Gauge,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";
import { useUserStore } from "@/lib/store";
import { usePathname } from "next/navigation";
import { ehSupervisor } from "@/lib/hooks/useUsuario";

export default function QuestionariosLayout({ children }: { children: ReactNode }) {
  useAuth();
  useRequireModule("questionarios_psicossociais");

  const user = useUserStore((s) => s.user);
  const isAdmin = ehSupervisor(user); // v229: configuração do módulo é de quem supervisiona
  const pathname = usePathname();
  const match = pathname.match(/\/questionarios-psicossociais\/([^/]+)/);
  const idAplicacao = match?.[1];
  // Rotas fixas da área não são id de aplicação. Esquecer uma aqui faz o menu
  // "Aplicação Atual" aparecer apontando para uma aplicação que não existe.
  const ROTAS_FIXAS = ["nova", "tipos", "como-funciona", "ajuda", "resumo"];
  const isIdPage = !!idAplicacao && !ROTAS_FIXAS.includes(idAplicacao);

  const sections = useMemo<NavSection[]>(() => {
    const base: NavSection[] = [
      {
        label: "Questionários DRPS",
        items: [
          {
            href: "/questionarios-psicossociais/resumo",
            label: "Resumo",
            icon: LayoutDashboard,
          },
          {
            href: "/questionarios-psicossociais",
            label: "Aplicações",
            icon: List,
          },
          {
            href: "/questionarios-psicossociais/nova",
            label: "Nova Aplicação",
            icon: Plus,
            variant: "action",
          },
          {
            href: "/questionarios-psicossociais/ajuda",
            label: "Ajuda",
            icon: HelpCircle,
          },
        ],
      },
      ...(isAdmin
        ? [
            {
              label: "Configuração",
              items: [
                {
                  href: "/questionarios-psicossociais/tipos",
                  label: "Tipos e Perguntas",
                  icon: Settings2,
                  variant: "config" as const,
                },
                {
                  href: "/questionarios-psicossociais/como-funciona",
                  label: "Metodologia",
                  icon: BookOpen,
                  variant: "config" as const,
                },
                {
                  href: "/questionarios-psicossociais/texto-padrao",
                  label: "Texto Padrão (laudo)",
                  icon: FileEdit,
                  variant: "config" as const,
                },
              ],
            },
          ]
        : []),
    ];

    if (isIdPage) {
      base.push({
        label: "Aplicação Atual",
        items: [
          {
            href: `/questionarios-psicossociais/${idAplicacao}`,
            label: "Resumo",
            icon: LayoutDashboard,
          },
          {
            href: `/questionarios-psicossociais/${idAplicacao}/respondentes`,
            label: "Respondentes",
            icon: ListChecks,
          },
          {
            href: `/questionarios-psicossociais/${idAplicacao}/resultados`,
            label: "Resultados / Matriz",
            icon: BarChart2,
          },
          {
            href: `/questionarios-psicossociais/${idAplicacao}/analise`,
            label: "Análise (régua do DRPS)",
            icon: FileSearch,
          },
          // v0.3.637 — o Plano de Ação 5W2H saiu do menu a pedido do João
          // Marcos (18/09): "não vamos usar o plano de ação dessa forma". A
          // tela continua de pé em /plano-acao e o dado segue no banco; o que
          // saiu foi a porta de entrada, aqui, no card da aplicação e no
          // alerta da tela Resumo. No laudo, a seção está desligada (v243).
        ],
      });
      // v225 — as mesmas 3 telas de gestão do DRPS (o laudo imprime o que elas gravam).
      base.push({
        label: "Gestão",
        items: [
          { href: `/questionarios-psicossociais/${idAplicacao}/gestao`, label: "Painel de Gestão", icon: Gauge },
          { href: `/questionarios-psicossociais/${idAplicacao}/medidas`, label: "Medidas de Controle", icon: ClipboardCheck },
          { href: `/questionarios-psicossociais/${idAplicacao}/monitoramento`, label: "Monitoramento", icon: LineChart },
          { href: `/questionarios-psicossociais/${idAplicacao}/revisao`, label: "Revisão e Melhoria", icon: ListTodo },
        ],
      });
      // v226 — o laudo em PDF, igual ao do DRPS.
      base.push({
        label: "Laudo",
        items: [
          { href: `/questionarios-psicossociais/${idAplicacao}/laudo`, label: "Laudo / Imprimir", icon: Printer, variant: "report" as const },
        ],
      });
    }

    return base;
    // `isAdmin` FALTAVA aqui (defeito antigo, achado em 22/09 ao conferir a
    // v0.3.637). `user` chega depois da primeira renderização: sem a
    // dependência, o useMemo nunca recalculava e o bloco "Configuração"
    // (Tipos e Perguntas, Metodologia, Texto Padrão) NUNCA aparecia no menu da
    // QAP — nem na lista, nem na tela da aplicação. Medido na produção antes
    // do conserto: 0 link para /texto-padrao, /tipos e /como-funciona em
    // qualquer tela do módulo; só dava para chegar digitando a URL.
  }, [idAplicacao, isIdPage, isAdmin]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="QPS / DRPS"
        subtitle="JCN Consultoria"
        logoHref="/questionarios-psicossociais"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
