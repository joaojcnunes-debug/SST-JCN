"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  ListChecks,
  Layers,
  FileText,
  ClipboardCheck,
  LineChart,
  HelpCircle,
  ListTodo,
  Building2,
  BookOpen,
  Files,
  FileEdit,
  Globe,
  CheckCircle2,
  Gauge,
  FlaskConical,
} from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRequireModule } from "@/lib/hooks/useRequireModule";

const SECTIONS_LISTA: NavSection[] = [
  {
    label: "Psicossocial",
    items: [
      { href: "/psicossocial/dashboard-geral", label: "Dashboard Geral", icon: Globe },
      { href: "/psicossocial", label: "Relatórios DRPS", icon: Files },
    ],
  },
  {
    label: "Configuração",
    items: [
      {
        href: "/psicossocial/texto-padrao",
        label: "Texto Padrão",
        icon: FileEdit,
      },
    ],
  },
  {
    label: "Referência",
    items: [
      {
        href: "/psicossocial/metodologia",
        label: "Metodologia Aplicada",
        icon: FlaskConical,
      },
      {
        href: "/psicossocial/criterios",
        label: "Critérios de Probabilidade",
        icon: HelpCircle,
      },
      { href: "/psicossocial/ajuda", label: "Ajuda", icon: BookOpen },
    ],
  },
];

function sectionsRelatorio(idRelatorio: string): NavSection[] {
  const base = `/psicossocial/${idRelatorio}`;
  return [
    {
      label: "Diagnóstico",
      items: [
        { href: "/psicossocial/dashboard-geral", label: "Dashboard Geral", icon: Globe },
        { href: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
        { href: `${base}/dados`, label: "Dados do Forms", icon: Upload },
        { href: `${base}/escala`, label: "Escala", icon: ListChecks },
        { href: `${base}/resumo`, label: "Resumo por Tópico", icon: Layers },
        { href: `${base}/analise`, label: "Análise e Avaliação", icon: FileText },
        {
          href: `${base}/conclusao-geral`,
          label: "Conclusão Geral",
          icon: CheckCircle2,
        },
      ],
    },
    {
      label: "Gestão",
      items: [
        { href: `${base}/gestao`, label: "Painel de Gestão", icon: Gauge },
        { href: `${base}/medidas`, label: "Medidas de Controle", icon: ClipboardCheck },
        { href: `${base}/monitoramento`, label: "Monitoramento", icon: LineChart },
        { href: `${base}/revisao`, label: "Revisão e Melhoria", icon: ListTodo },
      ],
    },
    {
      label: "Configuração",
      items: [
        { href: `${base}/metadados`, label: "Metadados do Relatório", icon: Building2 },
        { href: "/psicossocial/texto-padrao", label: "Texto Padrão", icon: FileEdit },
      ],
    },
    {
      label: "Navegação",
      items: [
        { href: "/psicossocial", label: "← Voltar aos Relatórios", icon: Files },
      ],
    },
  ];
}

/**
 * Extrai o id_relatorio se a rota for /psicossocial/<id>/...
 * Retorna null para /psicossocial, /psicossocial/novo, /psicossocial/ajuda etc.
 */
function extrairIdRelatorio(pathname: string): string | null {
  const m = pathname.match(/^\/psicossocial\/([^/]+)(?:\/|$)/);
  if (!m) return null;
  const candidato = m[1];
  // Rotas reservadas que NÃO são ids
  const reservadas = new Set([
    "novo",
    "ajuda",
    "criterios",
    "metodologia",
    "texto-padrao",
    "dashboard-geral",
  ]);
  if (reservadas.has(candidato)) return null;
  return candidato;
}

export default function PsicossocialLayout({
  children,
}: {
  children: ReactNode;
}) {
  useAuth();
  useRequireModule("psicossocial");
  const pathname = usePathname();

  const idRelatorio = useMemo(() => extrairIdRelatorio(pathname), [pathname]);

  const sections = useMemo(
    () => (idRelatorio ? sectionsRelatorio(idRelatorio) : SECTIONS_LISTA),
    [idRelatorio]
  );

  const topbarTitle = idRelatorio
    ? "DRPS — Editor de Relatório"
    : "DRPS — Diagnóstico de Riscos Psicossociais";

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Psicossocial"
        subtitle="JCN"
        logoHref="/psicossocial"
        sections={sections}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar title={topbarTitle} />
        <main className="px-4 py-6 md:px-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
