"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AvisoRevisaoTrava from "@/components/sistema/AvisoRevisaoTrava";
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
  Moon,
  Sun,
  Menu as MenuIcon,
  X,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import type { VisaoGeralData } from "@/lib/hooks/useVisaoGeralUnidades";
import type { AtividadeItem } from "@/lib/hooks/useHomeStats";
import type { VencimentosData, VencimentoItem } from "@/lib/hooks/useVencimentos";
import AnimatedNumber from "./AnimatedNumber";
import { diasSemAcidente } from "@/lib/visao-geral/diasSemAcidente";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import SaudeAnel, { type SaudeDocumentos } from "./SaudeAnel";
import PulsoSeguranca from "./PulsoSeguranca";
import AcontecendoAgora from "./AcontecendoAgora";
import RadarVencimentos from "./RadarVencimentos";
import PainelEmpresas from "./PainelEmpresas";
import type { Pulso } from "@/lib/visao-geral/pulso";
import GraficosVisaoGeral, { type FatiaTipo, type PontoMes, type FatiaStatus } from "./GraficosVisaoGeral";
import { cn } from "@/lib/utils";
import { useUnidadeAtiva, useTema } from "@/lib/store";
import MenuDaFoto from "@/components/layout/MenuDaFoto";

// Marinho da marca (o verde #0f3d28 desta tela tinha escapado da Etapa 0).
const MARINHO_SIDEBAR = "#0b1e33";

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
  /** Data do último acidente COM afastamento (null = nenhum registrado). */
  ultimoAcidenteAfastamento?: string | null;
  acidenteLoading?: boolean;
  /** Pulso de segurança (Etapa 4): nota 0–100 de documentos válidos e ações 5W2H no prazo. */
  pulso?: Pulso;
  pulsoLoading?: boolean;
  onLogout: () => void;
  /** Sino de notificações da Gestão, ao lado da saudação (só para quem usa a Gestão). */
  sinoNotificacoes?: React.ReactNode;
  /** Notificações não lidas da Gestão — número vermelho no item "Gestão JCN Consultoria" do menu. */
  gestaoNaoLidas?: number;
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
  pendencias,
  statsLoading,
  vencimentos,
  vencimentosLoading,
  saude,
  laudosPorTipo,
  inspecoesPorMes,
  inspecoesPorStatus,
  ultimoAcidenteAfastamento,
  acidenteLoading,
  pulso,
  pulsoLoading,
  onLogout,
  sinoNotificacoes,
  gestaoNaoLidas = 0,
}: VisaoGeralViewProps) {
  const totais = data?.totais;
  const unidades = data?.unidades ?? [];
  const setUnidadeAtiva = useUnidadeAtiva((s) => s.setUnidade);
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
  // Toggle de tema também aqui (a tela inicial não usa a ModuleTopbar).
  const tema = useTema((s) => s.tema);
  const toggleTema = useTema((s) => s.toggle);
  const [temaMontado, setTemaMontado] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  useEffect(() => setTemaMontado(true), []);
  const escuro = temaMontado && tema === "dark";
  const dataFmt = agora
    ? agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    : "";
  const dataExtenso = dataFmt ? dataFmt.charAt(0).toUpperCase() + dataFmt.slice(1) : "";

  /**
   * O menu desta tela, desenhado UMA vez e montado em dois lugares: a barra
   * fixa do desktop e a gaveta do celular. `aoNavegar` fecha a gaveta — no
   * desktop é um no-op.
   *
   * Função comum, chamada como `{menuLateral(fn)}`, e NÃO um componente
   * declarado aqui dentro: componente aninhado remonta a cada render do pai e
   * levaria junto o scroll da lista de unidades.
   */
  const menuLateral = (aoNavegar: () => void) => (
    <>
      <div className="flex items-center gap-2.5 px-1">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo"
            className="force-light h-9 w-auto max-w-[40px] rounded-md bg-white object-contain p-0.5"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (!img.src.endsWith("/logo-jcn.svg")) img.src = "/logo-jcn.svg";
            }}
          />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-md bg-white/15">
            <Shield className="size-5" />
          </div>
        )}
        <div className="leading-tight">
          <p className="text-sm font-bold">JCN Consultoria</p>
          <p className="text-[10px] uppercase tracking-wider text-white/55">Painel SST</p>
        </div>
      </div>

      <nav className="mt-7 space-y-0.5">
        <NavItem active icon={<LayoutDashboard className="size-[15px]" />} label="Visão geral" />
        <Link href="/modulos" onClick={aoNavegar}>
          <NavItem icon={<Boxes className="size-[15px]" />} label="Módulos" />
        </Link>
        <Link href="/empresas" onClick={aoNavegar}>
          <NavItem icon={<Building2 className="size-[15px]" />} label="Empresas" />
        </Link>
        <Link href="/validades" onClick={aoNavegar}>
          <NavItem icon={<FileClock className="size-[15px]" />} label="Validades" />
        </Link>
        <Link href="/gestao" onClick={aoNavegar}>
          <NavItem icon={<KanbanSquare className="size-[15px]" />} label="Gestão JCN Consultoria" alerta={gestaoNaoLidas} />
        </Link>
      </nav>

      <p className="mb-1 mt-7 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        Unidades
      </p>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {unidades
          .filter((u) => u.id_unidade)
          .map((u) => (
            <Link
              key={u.id_unidade}
              href="/modulos"
              onClick={() => { setUnidadeAtiva(u.id_unidade!, u.nome); aoNavegar(); }}
            >
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
          <Link href="/usuarios" onClick={aoNavegar}>
            <NavItem icon={<Settings className="size-[15px]" />} label="Sistema" />
          </Link>
        )}
        <button type="button" onClick={toggleTema} className="w-full">
          <NavItem
            icon={escuro ? <Sun className="size-[15px]" /> : <Moon className="size-[15px]" />}
            label={escuro ? "Modo claro" : "Modo escuro"}
          />
        </button>
        <button type="button" onClick={onLogout} className="w-full">
          <NavItem icon={<LogOut className="size-[15px]" />} label="Sair" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-app-bg">
      {/* ── Menu ─────────────────────────────────────────────── */}
      {/* Hambúrguer (celular). Sem ele, abaixo de 768px esta tela não tinha
          NENHUMA navegação — nem o "Sair", que só existe no menu. */}
      <button
        type="button"
        onClick={() => setMenuAberto(true)}
        aria-label="Abrir menu"
        className="fixed left-3 top-3 z-40 flex size-10 items-center justify-center rounded-md text-white shadow md:hidden print:hidden"
        style={{ backgroundColor: MARINHO_SIDEBAR }}
      >
        <MenuIcon className="size-5" />
      </button>

      {/* Barra do desktop. `sticky` + `h-screen`: como item de um flex row ela
          esticava até a altura do documento (2.354px medidos), e rolar 800px
          deixava 1.554px de coluna verde vazia na tela. */}
      <aside
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col px-4 py-5 text-white md:flex print:hidden"
        style={{ backgroundColor: MARINHO_SIDEBAR }}
      >
        {menuLateral(() => {})}
      </aside>

      {/* Gaveta do celular */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMenuAberto(false)}>
          <aside
            className="absolute inset-y-0 left-0 flex w-[248px] flex-col px-4 py-5 text-white shadow-2xl"
            style={{ backgroundColor: MARINHO_SIDEBAR }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar menu"
              className="absolute right-2 top-2 rounded p-1 text-white/70 hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
            {menuLateral(() => setMenuAberto(false))}
          </aside>
        </div>
      )}

      {/* ── Conteúdo ─────────────────────────────────────────── */}
      {/* `overflow-x-clip`, e não `hidden`: pela CSS Overflow 3, um eixo em
          `hidden` computa o OUTRO para `auto` — este <main> era um scroll
          container sem ninguém ter pedido, e qualquer `sticky` colocado aqui
          dentro morreria em silêncio. `clip` corta igual e não faz isso.
          O `pt-16` abaixo de 768px é o espaço do hambúrguer, que é fixo. */}
      <main className="min-w-0 flex-1 overflow-x-clip px-5 pb-7 pt-16 sm:px-8 md:pt-7">
        <div className="mx-auto max-w-6xl">
          {/* Lembrete da revisão da trava por módulo (v236): aparece sozinho na
              semana da data e só para quem pode ver. Ver o componente. */}
          <AvisoRevisaoTrava />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="reveal-up">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">
                  {saudacao}{primeiroNome ? `, ${primeiroNome}` : ""} <span aria-hidden>👋</span>
                </h1>
                {sinoNotificacoes}
                {/* Foto = menu (0.3.258): nome, e-mail e Sair. */}
                <MenuDaFoto tema="claro" />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Visão geral{dataExtenso ? ` · ${dataExtenso}` : ""}
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs text-gray-500 shadow-sm">
                <span className="size-1.5 rounded-full bg-marca-primary" />
                {escopoRestrito
                  ? `${vinculadasCount} empresa(s) vinculada(s)`
                  : "Acesso total"}
              </p>
            </div>
            <PulsoSeguranca pulso={pulso} loading={pulsoLoading} />
          </div>

          {hasError ? (
            <div className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              Erro ao carregar os dados. Tente recarregar a página.
            </div>
          ) : (
            <>
              {/* Bento (Etapa 3 do plano-skin-viva): o que pede ação primeiro e maior; depois a
                  saúde dos documentos, o contador de dias sem acidente e os números. */}
              <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <AcaoAgora
                  className="lg:col-span-2"
                  vencidos={vencidos}
                  vencendo={vencendo}
                  loading={vencimentosLoading}
                />
                <div
                  className="tilt-3d reveal-up rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                  style={{ animationDelay: "90ms" }}
                >
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Saúde dos documentos
                    </p>
                    <Link href="/validades" className="text-xs font-semibold text-marca-primary hover:underline">
                      Gerenciar →
                    </Link>
                  </div>
                  {saude ? (
                    <SaudeAnel saude={saude} />
                  ) : (
                    <div className="skeleton-shimmer h-[120px]" />
                  )}
                </div>
                <ContadorAcidente
                  ultimoComAfastamento={ultimoAcidenteAfastamento}
                  loading={acidenteLoading}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-2">
                  <ResumoCard label="Empresas" valor={totais?.empresas} icon={<Building2 className="size-4" />} loading={isLoading} delay={120} />
                  <ResumoCard label="Inspeções" valor={totais?.inspecoes} icon={<ClipboardList className="size-4" />} loading={isLoading} delay={180} />
                  <ResumoCard label="Laudos" valor={totais?.laudos} icon={<FileText className="size-4" />} loading={isLoading} delay={240} />
                </div>
              </div>

              {/* Partes vivas (Etapa 5): radar de vencimentos + empresas por situação */}
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <RadarVencimentos vencidos={vencidos} vencendo={vencendo} />
                <div className="lg:col-span-2">
                  <PainelEmpresas />
                </div>
              </div>

              {/* Gráficos — inspeções por mês/status + laudos por tipo */}
              {(laudosPorTipo?.length || inspecoesPorMes?.length) ? (
                <GraficosVisaoGeral
                  laudosPorTipo={laudosPorTipo ?? []}
                  inspecoesPorMes={inspecoesPorMes ?? []}
                  inspecoesPorStatus={inspecoesPorStatus ?? []}
                />
              ) : null}

              {/* Acontecendo agora + Pendências */}
              <div className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <AcontecendoAgora />
                </div>

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
  alerta = 0,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  /** Itens novos (ex.: notificações não lidas): bolinha vermelha no ícone + número vermelho. */
  alerta?: number;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm font-medium transition-all duration-200",
        active ? "bg-white/[0.14] text-white" : "text-white/65 hover:bg-white/[0.08] hover:text-white/90",
      )}
    >
      {active && (
        <span className="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sky-400" />
      )}
      <span className={cn("relative", active ? "text-white" : "text-white/40")}>
        {icon}
        {alerta > 0 && <span className="absolute -right-1 -top-1 size-2 animate-pulse rounded-full bg-red-500" />}
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {alerta > 0 && (
        <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white" title={`${alerta} não lida(s)`}>
          {alerta > 99 ? "99+" : alerta}
        </span>
      )}
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
      className="tilt-3d reveal-up rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
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

/** "O que exige ação agora": vencidos (mais atrasados no topo) e os que vencem em até 30 dias. */
function AcaoAgora({
  vencidos,
  vencendo,
  loading,
  className,
}: {
  vencidos: VencimentoItem[];
  vencendo: VencimentoItem[];
  loading?: boolean;
  className?: string;
}) {
  const atrasados = [...vencidos].sort((a, b) => a.dias - b.dias);
  const em30 = vencendo.filter((v) => v.dias <= 30).sort((a, b) => a.dias - b.dias);
  const lista = [...atrasados, ...em30];
  return (
    <section
      className={cn("reveal-up flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby="acao-agora"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="acao-agora" className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          O que exige ação agora
        </h2>
        {!loading && (
          <p className="flex items-center gap-2 text-xs text-gray-500">
            {atrasados.length > 0 && (
              <span className="pulse-alerta inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">
                <span className="size-1.5 rounded-full bg-red-500" />
                {atrasados.length} vencido(s)
              </span>
            )}
            <span>
              <span className="font-semibold text-amber-600">{em30.length}</span> vence(m) em 30 dias
            </span>
          </p>
        )}
      </div>
      <div className="mt-3 flex-1">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : lista.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            Nada vencido nem vencendo nos próximos 30 dias.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
            {lista.slice(0, 6).map((v, i) => (
              <VencimentoRow key={`${v.href}-${i}`} v={v} resolver />
            ))}
          </div>
        )}
      </div>
      <Link href="/validades" className="mt-3 self-start text-xs font-semibold text-marca-primary hover:underline">
        {lista.length > 6 ? `Ver todos os ${lista.length} →` : "Ver todos os vencimentos →"}
      </Link>
    </section>
  );
}

/** "Dias sem acidente com afastamento" — sem nenhum registrado, diz isso (não inventa início). */
function ContadorAcidente({ ultimoComAfastamento, loading }: { ultimoComAfastamento?: string | null; loading?: boolean }) {
  const dias = diasSemAcidente(ultimoComAfastamento, hojeSP());
  return (
    <div
      className="tilt-3d reveal-up flex flex-col justify-center rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      style={{ animationDelay: "60ms" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        Dias sem acidente com afastamento
      </p>
      {loading ? (
        <span className="skeleton-shimmer mt-3 inline-block h-10 w-24" />
      ) : dias === null ? (
        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-gray-700">
          <ShieldCheck className="size-5 shrink-0 text-emerald-600" />
          Nenhum acidente com afastamento registrado.
        </p>
      ) : (
        <>
          <p className="mt-1 text-5xl font-bold tabular-nums text-gray-900">
            <AnimatedNumber value={dias} />
          </p>
          <p className="mt-1 text-xs text-gray-500">desde o último afastamento, em {fmtData(ultimoComAfastamento!.slice(0, 10))}</p>
        </>
      )}
    </div>
  );
}

function fmtData(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function VencimentoRow({ v, resolver }: { v: VencimentoItem; resolver?: boolean }) {
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
      {resolver && (
        <span className="hidden shrink-0 items-center gap-0.5 text-xs font-semibold text-marca-primary sm:inline-flex">
          Resolver <ArrowRight className="size-3.5" />
        </span>
      )}
    </Link>
  );
}
