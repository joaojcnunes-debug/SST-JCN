"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import { useSidebarMini, useUserStore } from "@/lib/store";
import UnidadeAtivaChip from "@/components/layout/UnidadeAtivaChip";
import ThemeToggle from "@/components/layout/ThemeToggle";

// ─── Breadcrumb mapping ───────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  dashboard:             "Dashboard",
  empresas:              "Empresas",
  inspecoes:             "Inspeções",
  relatorios:            "Relatórios",
  nova:                  "Nova",
  relatorio:             "Relatório",
  "texto-padrao":        "Texto Padrão",
  acoes:                 "Plano de Ação",
  usuarios:              "Usuários",
  config:                "Configurações",
  "pdfs-gerados":        "PDFs Gerados",
  "inspecoes-ficha":     "Ficha em Branco",
  ficha:                 "Ficha em Branco",
  produtividade:         "Produtividade",
  unidades:              "Unidades",
  documentos:            "Documentos SST",
  projecoes:             "Projeções",
  registros:             "Registros",
};

function buildCrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let path = "";
  for (const seg of segments) {
    path += `/${seg}`;
    const label = ROUTE_LABELS[seg] ?? (seg.length > 12 ? null : seg);
    if (label === null) continue; // IDs de relatório — não exibir no breadcrumb
    crumbs.push({ label, href: path });
  }
  return crumbs;
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PERFIL_COLORS: Record<string, string> = {
  Admin:        "bg-sky-500/20 text-sky-100 ring-sky-400/30",
  Tecnico:      "bg-emerald-500/20 text-emerald-100 ring-emerald-400/30",
  Visualizador: "bg-white/10 text-white/70 ring-white/20",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModuleTopbar({ title }: { title: string }) {
  const user = useUserStore((s) => s.user);
  const toggleSidebar = useSidebarMini((s) => s.toggle);
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);
  const initials = user?.nome ? getInitials(user.nome) : "?";
  const perfilColor = PERFIL_COLORS[user?.perfil ?? ""] ?? PERFIL_COLORS.Visualizador;

  return (
    <header
      className="sticky top-0 z-20 flex h-[54px] items-center justify-between border-b border-black/[0.12] px-4 md:px-6 text-white shadow-md print:hidden"
      style={{ background: "linear-gradient(90deg, #0ea5e9 0%, #00795e 100%)", viewTransitionName: "topbar" }}
    >
      {/* ── Esquerda: minimizador + breadcrumb ────────── */}
      <div className="ml-12 flex min-w-0 items-center gap-2 md:ml-0">
        {/* Recolhe/expande a sidebar. Só no desktop — no celular o menu é
            gaveta. Qual seta aparece quem decide é o CSS (globals.css), a
            partir do data-sidebar no <html>: assim nada aqui depende de
            estado e servidor e cliente renderizam igual. */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Recolher ou expandir o menu"
          title="Recolher ou expandir o menu"
          className="hidden size-7 shrink-0 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white md:flex"
        >
          <ChevronsLeft className="sidebar-seta-fechar size-4" />
          <ChevronsRight className="sidebar-seta-abrir size-4" />
        </button>

        <nav className="flex min-w-0 items-center gap-1" aria-label="breadcrumb">
          <Link
            href="/dashboard"
            className="flex items-center text-white/50 transition hover:text-white/90"
            title="Dashboard"
          >
            <Home className="size-3.5" />
          </Link>

          {crumbs.map((c, idx) => (
            <span key={c.href} className="flex items-center gap-1">
              <ChevronRight className="size-3 text-white/30" />
              {idx === crumbs.length - 1 ? (
                <span className="text-sm font-semibold text-white">{c.label}</span>
              ) : (
                <Link
                  href={c.href}
                  className="text-sm text-white/60 transition hover:text-white/90"
                >
                  {c.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* ── Direita: unidade ativa + usuário ─────────── */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UnidadeAtivaChip variant="topbar" />
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-[13px] font-semibold leading-tight text-white">
                {user.nome}
              </span>
              <span
                className={`mt-0.5 inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ${perfilColor}`}
              >
                {user.perfil}
              </span>
            </div>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white ring-1 ring-white/25">
              {initials}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
