"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Brain,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ModuloPermitido } from "@/lib/supabase/types";

interface HubCardCfg {
  modulo: ModuloPermitido;
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

const CARDS: HubCardCfg[] = [
  {
    modulo: "painel",
    href: "/dashboard",
    title: "Painel SST",
    description: "Inspeções, riscos, ações 5W2H, treinamentos e relatórios",
    icon: <Shield className="size-12" />,
    accent: "#00835A",
  },
  {
    modulo: "psicossocial",
    href: "/psicossocial",
    title: "Psicossocial",
    description: "Gestão de riscos psicossociais e IAPAT",
    icon: <Brain className="size-12" />,
    accent: "#7C3AED",
  },
  {
    modulo: "conformidade",
    href: "/relatorio-conformidade",
    title: "Relatório de Conformidade",
    description: "Itens em conformidade por empresa, setor e NR",
    icon: <CheckCircle2 className="size-12" />,
    accent: "#0D9488",
  },
  {
    modulo: "nao_conformidade",
    href: "/relatorio-nao-conformidade",
    title: "Relatório de Não Conformidade",
    description: "Itens em não conformidade e tratativas pendentes",
    icon: <AlertTriangle className="size-12" />,
    accent: "#DC2626",
  },
];

export default function InicioPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const { data: configs } = useConfiguracoes();

  const isAdmin = user?.perfil === "Admin";
  const cards = CARDS.filter((c) => {
    if (!user) return false;
    const permitidos = user.modulos_permitidos ?? [];
    return permitidos.includes(c.modulo);
  });

  async function handleLogout() {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // segue mesmo se a rede falhar
    }
    logout();
    toast.success("Sessão encerrada");
    router.replace("/login");
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(135deg, #1e4d28 0%, #006B54 60%, #00835A 100%)",
      }}
    >
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {configs?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={configs.logo_url}
              alt="Logo"
              className="h-10 w-auto max-w-[44px] rounded-md bg-white object-contain p-0.5 shadow"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-md bg-white/15 text-white shadow">
              <Shield className="size-5" />
            </div>
          )}
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">Chabra</p>
            <p className="text-[11px] text-white/70">
              Segurança e Saúde do Trabalho
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden text-right text-white/90 sm:block">
              <p className="text-sm font-semibold leading-tight">{user.nome}</p>
              <p className="text-[11px] text-white/60 leading-tight">
                {user.perfil}
              </p>
            </div>
          )}
          {isAdmin && (
            <Link
              href="/usuarios"
              className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              title="Gerenciar usuários"
            >
              <Users className="size-4" />
              <span className="hidden sm:inline">Usuários</span>
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Bem-vindo{user?.nome ? `, ${user.nome.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-2 text-sm text-white/75 sm:text-base">
            {cards.length > 0
              ? "Escolha o sistema que deseja acessar"
              : "Você ainda não tem acesso a nenhum módulo. Solicite acesso ao administrador."}
          </p>
        </div>

        {cards.length > 0 && (
          <div
            className={cn(
              "grid w-full gap-6 grid-cols-1",
              cards.length === 1 && "max-w-sm",
              cards.length === 2 && "max-w-3xl sm:grid-cols-2",
              cards.length === 3 && "max-w-5xl sm:grid-cols-2 lg:grid-cols-3",
              cards.length >= 4 && "max-w-4xl sm:grid-cols-2"
            )}
          >
            {cards.map((c) => (
              <HubCard key={c.modulo} {...c} />
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Chabra · Sistemas Internos
        </p>
      </main>
    </div>
  );
}

function HubCard({
  href,
  title,
  description,
  icon,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl"
    >
      <div
        className="flex size-20 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105"
        style={{ backgroundColor: accent }}
      >
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <span
        className="mt-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white"
        style={{ backgroundColor: accent }}
      >
        Acessar
      </span>
    </Link>
  );
}
