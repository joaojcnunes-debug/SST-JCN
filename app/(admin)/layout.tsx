"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Users, Settings, FileClock, Trash2, ScrollText, Radio, BadgeCheck, Globe } from "lucide-react";
import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserStore } from "@/lib/store";
import { vePresencaAuditoria } from "@/lib/hooks/useUsuario";
import { AcessoVerificando } from "@/components/layout/TravaRota";
import { podeGerirUsuarios } from "@/lib/usuarios/gestao-supervisor";

const sections: NavSection[] = [
  {
    label: "Administração",
    items: [
      { href: "/usuarios", label: "Usuários", icon: Users },
      { href: "/funcoes", label: "Funções", icon: BadgeCheck },
      { href: "/config", label: "Configurações", icon: Settings },
      // 0.3.229: a tela existia, mas nenhum link levava a ela.
      { href: "/portal-sst", label: "Portal SST", icon: Globe },
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

// 10/11 (v355): Usuários abre também para o supervisor (nível Aprovação), com as travas de
// lib/usuarios/gestao-supervisor.ts. Funções, Configurações, Lixeira etc. seguem só Admin.
const ROTA_USUARIOS = "/usuarios";

function secoesPara(rotas: string[]): NavSection[] {
  return [{ label: "Administração", items: sections[0].items.filter((i) => rotas.includes(i.href)) }];
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);
  const isAdmin = user?.perfil === "Admin";
  const gerencia = !isAdmin && vePresencaAuditoria(user);
  const supervisor = !isAdmin && podeGerirUsuarios(user);
  const rotasLiberadas = useMemo(
    () => [...(supervisor ? [ROTA_USUARIOS] : []), ...(gerencia ? ROTAS_GERENCIA : [])],
    [supervisor, gerencia],
  );
  const rotaLiberada = rotasLiberadas.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const liberado = isAdmin || rotaLiberada;

  useEffect(() => {
    if (!user) return; // ainda carregando
    if (isAdmin) return;
    if (rotaLiberada) return;
    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error(
        rotasLiberadas.length > 0 ? "Esta parte do Sistema é só de administradores" : "Apenas administradores podem acessar esta área",
      );
    }
    router.replace(rotasLiberadas[0] ?? "/inicio");
  }, [user, isAdmin, rotasLiberadas, rotaLiberada, router]);

  return (
    <div className="casca min-h-screen">
      <SidebarShell
        title="Administração"
        subtitle="JCN Consultoria"
        logoHref={isAdmin ? "/usuarios" : (rotasLiberadas[0] ?? "/inicio")}
        sections={isAdmin ? sections : secoesPara(rotasLiberadas)}
      />
      <div className="casca-folha md:pl-[220px] print:pl-0">
        <ModuleTopbar />
        <main className="px-4 py-6 md:px-6" style={{ viewTransitionName: "content" }}>
          {/* Antes o efeito redirecionava, mas a tela era desenhada assim mesmo
              até o redirecionamento (e as consultas dela já disparavam). */}
          {liberado ? children : <AcessoVerificando />}
        </main>
      </div>
    </div>
  );
}
