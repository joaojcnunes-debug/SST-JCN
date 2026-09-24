"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Users, Settings, FileClock, Trash2, ScrollText, Radio, BadgeCheck } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserStore } from "@/lib/store";
import { vePresencaAuditoria } from "@/lib/hooks/useUsuario";

const sections: NavSection[] = [
  {
    label: "Administração",
    items: [
      { href: "/usuarios", label: "Usuários", icon: Users },
      { href: "/funcoes", label: "Funções", icon: BadgeCheck },
      { href: "/config", label: "Configurações", icon: Settings },
      { href: "/pdfs-gerados", label: "PDFs Gerados", icon: FileClock },
      { href: "/lixeira", label: "Lixeira", icon: Trash2 },
      { href: "/auditoria", label: "Auditoria", icon: ScrollText },
      { href: "/presenca", label: "Presença", icon: Radio },
    ],
  },
];

// v231: Presença e Auditoria abrem também para a gerência (função com
// ve_presenca_auditoria). O resto da área Sistema continua só Admin.
const ROTAS_GERENCIA = ["/presenca", "/auditoria"];

const sectionsGerencia: NavSection[] = [
  {
    label: "Administração",
    items: sections[0].items.filter((i) => ROTAS_GERENCIA.includes(i.href)),
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);
  const isAdmin = user?.perfil === "Admin";
  const gerencia = !isAdmin && vePresencaAuditoria(user);
  const rotaDeGerencia = ROTAS_GERENCIA.some((r) => pathname === r || pathname.startsWith(r + "/"));

  useEffect(() => {
    if (!user) return; // ainda carregando
    if (isAdmin) return;
    if (gerencia && rotaDeGerencia) return;
    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error(gerencia ? "Sua função abre só Presença e Auditoria" : "Apenas administradores podem acessar esta área");
    }
    router.replace(gerencia ? "/presenca" : "/inicio");
  }, [user, isAdmin, gerencia, rotaDeGerencia, router]);

  return (
    <div className="min-h-screen">
      <SidebarShell
        title="Administração"
        subtitle="JCN Consultoria"
        logoHref={isAdmin ? "/usuarios" : "/presenca"}
        sections={isAdmin ? sections : sectionsGerencia}
      />
      <div className="md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6" style={{ viewTransitionName: "content" }}>{children}</main>
      </div>
    </div>
  );
}
