"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Boxes,
  Building2,
  MapPin,
  LogOut,
  Shield,
  ClipboardList,
  FileText,
  FileClock,
  ArrowRight,
  Loader2,
  Settings,
  KanbanSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { UnidadeResumo, VisaoGeralData } from "@/lib/hooks/useVisaoGeralUnidades";
import type { AtividadeItem } from "@/lib/hooks/useHomeStats";
import type { VencimentosData, VencimentoItem } from "@/lib/hooks/useVencimentos";
import AnimatedNumber from "./AnimatedNumber";
import SaudeAnel, { type SaudeDocumentos } from "./SaudeAnel";
import GraficosVisaoGeral, { type FatiaTipo, type PontoMes, type FatiaStatus } from "./GraficosVisaoGeral";
import { cn } from "@/lib/utils";

const VERDE_SIDEBAR = "#0f3d28";

/** Item de pendência (módulo com registros não finalizados). */
export interface PendenciaItem {
  label: string;
  pendente: number;
  href: string;
}

export interface VisaoGeralViewProps {
  logoUrl?: string | null;
  userNome?: string;
  userPerfil?: string;
  isAdmin: boolean;
  /** Nº de empresas vinculadas (>0 só para Técnico com escopo restrito). */
  vinculadasCount: number;
  data?: VisaoGeralData;
  isLoading: boolean;
  hasError: boolean;
  /** Últimos registros editados (do useHomeStats). */
  atividade?: AtividadeItem[];
  /** Módulos com itens não finalizados (do useHomeStats). */
  pendencias?: PendenciaItem[];
  statsLoading?: boolean;
  /** Laudos vencidos / a vencer (do useVencimentos). */
  vencimentos?: VencimentosData;
  vencimentosLoading?: boolean;
  /** Saúde dos documentos (anel) — total + composição por status de validade. */
  saude?: SaudeDocumentos;
  /** Composição de laudos por tipo (donut). */
  laudosPorTipo?: FatiaTipo[];
  /** Inspeções por mês (barras). */
  inspecoesPorMes?: PontoMes[];
  /** Inspeções por status (donut). */
  inspecoesPorStatus?: FatiaStatus[];
  onLogout: () => void;
}

/**
 * Apresentação pura da tela "Visão geral" (recebe tudo por props). A página
 * (app/(hub)/visao-geral) liga aos hooks reais; a rota de preview injeta mock.
 */
export default function VisaoGeralView({
  logoUrl,
  userNome,
  userPerfil,
  isAdmin,
  vinculadasCount,
  data,
  isLoading,
  hasError,
  atividade,
  pendencias,
  statsLoading,
  vencimentos,
  vencimentosLoading,
  saude,
  laudosPorTipo,
  inspecoesPorMes,
  inspecoesPorStatus,
  onLogout,
}: VisaoGeralViewProps) {
  const totais = data?.totais;
  const unidades = data?.unidades ?? [];
  const escopoRestrito = userPerfil === "Tecnico" && vinculadasCount > 0;
  const totalPendencias = (pendencias ?? []).reduce((s, p) => s + p.pendente, 0);
  const vencidos = vencimentos?.vencidos ?? [];
  const vencendo = vencimentos?.vencendo ?? [];

  // Saudação + data (no mount, evita mismatch de SSR).
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => setAgora(new Date()), []);
  const hora = agora?.getHours() ?? -1;
  const saudacao = hora < 0 ? "Olá" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = (userNome ?? "").split(" ")[0];
  const dataFmt = agora
    ? agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    : "";
  const dataExtenso = dataFmt ? dataFmt.charAt(0).toUpperCase() + dataFmt.slice(1) : "";

  return (
    <div className="flex min-h-screen bg-[#f6f5f2]">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className="hidden w-60 shrink-0 flex-col px-4 py-5 text-white md:flex"
        style={{ backgroundColor: VERDE_SIDEBAR }}
      >
        <div className="flex items-center gap-2.5 px-1">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo"
              className="h-9 w-auto max-w-[40px] rounded-md bg-white object-contain p-0.5"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-md bg-white/15">
              <Shield className="size-5" />
            </div>
          )}
          <div className="leading-tight">
            <p className="text-sm font-bold">JCN Consultoria</p>
            <p className="text-[10px] uppercase tracking-wider text-white/55">SST JCN Consultoria</p>
          </div>
        </div>

        <nav className="mt-7 space-y-0.5">
          <NavItem active icon={<LayoutDashboard className="size-[15px]" />} label="Visão geral" />
          <Link href="/inicio">
            <NavItem icon={<Boxes className="size-[15px]" />} label="Módulos" />
          </Link>
          <Link href="/empresas">
            <NavItem icon={<Building2 className="size-[15px]" />} label="Empresas" />
          </Link>
          <Link href="/validades">
            <NavItem icon={<FileClock className="size-[15px]" />} label="Validades" />
          </Link>
          <Link href="/gestao">
            <NavItem icon={<KanbanSquare className="size-[15px]" />} label="Gestão JCN Consultoria" />
          </Link>
        </nav>

        <p className="mb-1 mt-7 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Unidades
        </p>
        <div className="space-y-0.5 overflow-y-auto">
          {unidades
            .filter((u) => u.id_unidade)
            .map((u) => (
              <Link key={u.id_unidade} href={`/empresas?unidade=${u.id_unidade}`}>
                <NavItem icon={<MapPin className="size-[15px]" />} label={u.nome} badge={u.empresas} />
              </Link>
            ))}
        </div>

        <div className="mt-auto border-t border-white/10 pt-3">
          {userNome && (
            <div className="px-3 pb-2 leading-tight">
              <p className="truncate text-sm font-semibold text-white/90">{userNome}</p>
              <p className="text-[11px] text-white/50">{userPerfil}</p>
            </div>
          )}
          {isAdmin && (
            <Link href="/usuarios">
              <NavItem icon={<Settings className="size-[15px]" />} label="Sistema" />
            </Link>
          )}
          <button type="button" onClick={onLogout} className="w-full">
            <NavItem icon={<LogOut className="size-[15px]" />} label="Sair" />
          </button>
        </div>
      </aside>

      {/* ── Conteúdo ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-x-hidden px-5 py-7 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="reveal-up">
              <h1 className="text-3xl font-bold text-gray-900">
                {saudacao}{primeiroNome ? `, ${primeiroNome}` : ""} <span aria-hidden>👋</span>
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Visão geral por unidade{dataExtenso ? ` · ${dataExtenso}` : ""}
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs text-gray-500 shadow-sm">
                <span className="size-1.5 rounded-full bg-verde-primary" />
                {escopoRestrito
                  ? `${vinculadasCount} empresa(s) vinculada(s)`
                  : `Acesso total · ${totais?.unidades ?? 0} unidades`}
              </p>
            </div>
            {saude && (
              <div
                className="reveal-up w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:w-auto"
                style={{ animationDelay: "90ms" }}
              >
                <div className="mb-3 flex items-center justify-between gap-8">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Saúde dos documentos
                  </p>
                  <Link href="/validades" className="text-xs font-semibold text-verde-primary hover:underline">
                    Gerenciar →
                  </Link>
                </div>
                <SaudeAnel saude={saude} />
              </div>
            )}
          </div>

          {hasError ? (
            <div className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              Erro ao carregar os dados. Tente recarregar a página.
            </div>
          ) : (
            <>
              <p className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Resumo
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ResumoCard label="Unidades" valor={totais?.unidades} icon={<MapPin className="size-4" />} loading={isLoading} delay={0} />
                <ResumoCard label="Empresas" valor={totais?.empresas} icon={<Building2 className="size-4" />} loading={isLoading} delay={60} />
                <ResumoCard label="Inspeções" valor={totais?.inspecoes} icon={<ClipboardList className="size-4" />} loading={isLoading} delay={120} />
                <ResumoCard label="Laudos" valor={totais?.laudos} icon={<FileText className="size-4" />} loading={isLoading} delay={180} />
              </div>

              <p className="mb-2 mt-9 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Unidades
              </p>
              {isLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="skeleton-shimmer h-[92px]" />
                  ))}
                </div>
              ) : unidades.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center text-sm text-gray-500">
                  Nenhuma unidade cadastrada. Crie unidades ou vincule empresas a uma unidade.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {unidades.map((u, i) => (
                    <UnidadeCard key={u.id_unidade ?? "sem"} u={u} delay={i * 45} />
                  ))}
                </div>
              )}

              {/* Gráficos — inspeções por mês/status + laudos por tipo */}
              {(laudosPorTipo?.length || inspecoesPorMes?.length) ? (
                <GraficosVisaoGeral
                  laudosPorTipo={laudosPorTipo ?? []}
                  inspecoesPorMes={inspecoesPorMes ?? []}
                  inspecoesPorStatus={inspecoesPorStatus ?? []}
                />
              ) : null}

              {/* Vencimentos */}
              <div className="mt-9 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vencimentos</p>
                <div className="flex items-center gap-3">
                  {!vencimentosLoading && (
                    <p className="flex items-center gap-2 text-xs text-gray-500">
                      {vencidos.length > 0 && (
                        <span className="pulse-alerta inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">
                          <span className="size-1.5 rounded-full bg-red-500" />
                          {vencidos.length} vencido(s)
                        </span>
                      )}
                      <span>
                        <span className="font-semibold text-amber-600">{vencendo.length}</span> a vencer (60 dias)
                      </span>
                    </p>
                  )}
                  <Link href="/validades" className="text-xs font-semibold text-verde-primary hover:underline">
                    Gerenciar →
                  </Link>
                </div>
              </div>
              <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {vencimentosLoading ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-gray-400">
                    <Loader2 className="size-4 animate-spin" /> Carregando…
                  </div>
                ) : vencidos.length === 0 && vencendo.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">
                    Nenhum laudo vencido ou a vencer. Informe a validade nos editores dos laudos.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {[...vencidos, ...vencendo].slice(0, 8).map((v, i) => (
                      <VencimentoRow key={`${v.href}-${i}`} v={v} />
                    ))}
                  </div>
                )}
              </div>

              {/* Atividade recente + Pendências */}
              <div className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-3">
                <section className="lg:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Atividade recente
                  </p>
                  <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    {statsLoading ? (
                      <div className="flex items-center gap-2 p-4 text-sm text-gray-400">
                        <Loader2 className="size-4 animate-spin" /> Carregando…
                      </div>
                    ) : (atividade ?? []).length === 0 ? (
                      <p className="p-4 text-sm text-gray-400">Nenhuma atividade recente.</p>
                    ) : (
                      (atividade ?? []).map((a, i) => {
                        const secundario = [a.titulo, a.tecnicoVinculado ? `téc.: ${a.tecnicoVinculado}` : null]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <Link
                            key={`${a.href}-${i}`}
                            href={a.href}
                            className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50"
                          >
                            <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: moduloAccent(a.modulo) }} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-800">
                                {a.empresaNome ?? "Sem empresa"}
                                {a.responsavel ? (
                                  <span className="font-normal text-gray-500"> · resp.: {a.responsavel}</span>
                                ) : null}
                              </p>
                              <p className="truncate text-xs text-gray-400">{secundario}</p>
                            </div>
                            {a.status && <StatusPill status={a.status} />}
                            <span className="mt-0.5 shrink-0 text-xs text-gray-400">{tempoRelativo(a.data)}</span>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Pendências
                  </p>
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-2xl font-bold text-gray-900">
                      {statsLoading ? (
                        <span className="skeleton-shimmer inline-block h-7 w-12" />
                      ) : (
                        totalPendencias
                      )}
                    </p>
                    <p className="text-xs text-gray-500">itens não finalizados</p>
                    <div className="mt-3 space-y-1">
                      {statsLoading ? null : (pendencias ?? []).length === 0 ? (
                        <p className="text-sm text-gray-400">Nada pendente 🎉</p>
                      ) : (
                        (pendencias ?? []).map((p) => (
                          <Link
                            key={p.label}
                            href={p.href}
                            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-gray-50"
                          >
                            <span className="truncate text-gray-700">{p.label}</span>
                            <span className="ml-2 shrink-0 rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-700">
                              {p.pendente}
                            </span>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm font-medium transition-all duration-200",
        active ? "bg-white/[0.14] text-white" : "text-white/65 hover:bg-white/[0.08] hover:text-white/90",
      )}
    >
      {active && (
        <span className="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400" />
      )}
      <span className={active ? "text-white" : "text-white/40"}>{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {badge !== undefined && (
        <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-semibold text-white/70">{badge}</span>
      )}
    </div>
  );
}

function ResumoCard({
  label,
  valor,
  icon,
  loading,
  delay = 0,
}: {
  label: string;
  valor?: number;
  icon: React.ReactNode;
  loading?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="reveal-up rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-1.5 text-gray-400">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">
        {loading ? (
          <span className="skeleton-shimmer inline-block h-7 w-12" />
        ) : (
          <AnimatedNumber value={valor ?? 0} />
        )}
      </p>
    </div>
  );
}

function UnidadeCard({ u, delay = 0 }: { u: UnidadeResumo; delay?: number }) {
  const semUnidade = u.id_unidade === null;
  const href = `/empresas?unidade=${semUnidade ? "__sem__" : u.id_unidade}`;
  return (
    <Link
      href={href}
      style={{ animationDelay: `${delay}ms` }}
      className="reveal-up group flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-verde-primary hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              semUnidade ? "bg-gray-100 text-gray-400" : "bg-verde-light text-verde-primary",
            )}
          >
            <MapPin className="size-4" />
          </span>
          <span className="font-semibold text-gray-900">{u.nome}</span>
        </div>
        <ArrowRight className="size-4 text-gray-300 transition-colors group-hover:text-verde-primary" />
      </div>
      <div className="mt-3 flex items-center gap-4 text-sm">
        <Metric label="empresas" valor={u.empresas} />
        <span className="text-gray-200">·</span>
        <Metric label="inspeções" valor={u.inspecoes} />
        <span className="text-gray-200">·</span>
        <Metric label="laudos" valor={u.laudos} />
      </div>
    </Link>
  );
}

function Metric({ label, valor }: { label: string; valor: number }) {
  return (
    <span className="text-gray-600">
      <span className="font-bold text-gray-900">{valor}</span> {label}
    </span>
  );
}

const MODULO_ACCENT: Record<string, string> = {
  painel: "#0284c7",
  conformidade: "#0D9488",
  nao_conformidade: "#dc2626",
  psicossocial: "#7c3aed",
  analise_quimicos: "#d97706",
  inventario_maquinas: "#475569",
  apreciacao_maquinas: "#0ea5e9",
  aet: "#16a34a",
  aep: "#0891b2",
};

function moduloAccent(m: string): string {
  return MODULO_ACCENT[m] ?? "#9ca3af";
}

function tempoRelativo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

const STATUS_PENDENTE = ["RASCUNHO", "EM_ANDAMENTO", "ABERTA", "EM_TRATAMENTO", "PENDENTE"];

function StatusPill({ status }: { status: string }) {
  const pend = STATUS_PENDENTE.includes(status.toUpperCase());
  return (
    <span
      className={cn(
        "hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-block",
        pend ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700",
      )}
    >
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

function fmtData(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function VencimentoRow({ v }: { v: VencimentoItem }) {
  const vencido = v.dias < 0;
  return (
    <Link href={v.href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-800">{v.empresaNome ?? "Sem empresa"}</span>
        <span className="block truncate text-xs text-gray-400">{v.tipo} · vence {fmtData(v.data_validade)}</span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
          vencido ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
        )}
      >
        {vencido ? `vencido há ${Math.abs(v.dias)}d` : v.dias === 0 ? "vence hoje" : `faltam ${v.dias}d`}
      </span>
    </Link>
  );
}
