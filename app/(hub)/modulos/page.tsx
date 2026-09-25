"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import UnidadeAtivaChip from "@/components/layout/UnidadeAtivaChip";
import {
  Shield,
  Brain,
  Building2,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Cog,
  Boxes,
  FlaskConical,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ClipboardList,
  ClipboardCheck,
  BookOpen,
  FileClock,
  Siren,
  CalendarClock,
  CalendarDays,
  HardHat,
  HardDrive,
  Truck,
  KanbanSquare,
  Radio,
  Gauge,
} from "lucide-react";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { useHomeStats, type ModuloStats } from "@/lib/hooks/useHomeStats";
import { useMeuPapelGestao } from "@/lib/hooks/useGestaoAcesso";
import { vePresencaAuditoria } from "@/lib/hooks/useUsuario";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ModuloPermitido } from "@/lib/supabase/types";

type Categoria = "seguranca" | "psicossocial" | "interno";

interface HubCardCfg {
  modulo: ModuloPermitido;
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  categoria: Categoria;
  skipStats?: boolean;
  staticLabel?: string;
  /** Some quando a conta tem este outro módulo (que já leva ao mesmo lugar). */
  ocultarSeTiver?: ModuloPermitido;
}

const CARDS: HubCardCfg[] = [
  // ── Segurança do Trabalho ──────────────────────────────────────────
  {
    modulo: "painel",
    href: "/dashboard",
    title: "Inspeções",
    description: "Inspeções, riscos, ações 5W2H, treinamentos e relatórios",
    icon: <Shield className="size-12" />,
    accent: "#00835A",
    categoria: "seguranca",
  },
  {
    modulo: "conformidade",
    href: "/relatorio-conformidade",
    title: "Relatório de Conformidade",
    description: "Itens em conformidade por empresa, setor e NR",
    icon: <CheckCircle2 className="size-12" />,
    accent: "#0D9488",
    categoria: "seguranca",
  },
  {
    modulo: "nao_conformidade",
    href: "/relatorio-nao-conformidade",
    title: "Relatório de Não Conformidade",
    description: "Itens em não conformidade e tratativas pendentes",
    icon: <AlertTriangle className="size-12" />,
    accent: "#DC2626",
    categoria: "seguranca",
  },
  {
    modulo: "apreciacao_maquinas",
    href: "/apreciacao-maquinas",
    title: "Apreciação de Máquinas",
    description: "Laudo NR-12: checklist por categoria, fotos por item, conclusão técnica",
    icon: <Cog className="size-12" />,
    accent: "#EA580C",
    categoria: "seguranca",
  },
  {
    modulo: "analise_quimicos",
    href: "/analise-quimicos",
    title: "Análise de Químicos JCN",
    description: "Análise quantitativa de agentes químicos e FISPQ",
    icon: <FlaskConical className="size-12" />,
    accent: "#0EA5E9",
    categoria: "seguranca",
  },
  {
    modulo: "aet",
    href: "/aet",
    title: "AET – Análise Ergonômica",
    description: "Avaliação ergonômica dos postos de trabalho por setor (NR-17)",
    icon: <ClipboardList className="size-12" />,
    accent: "#B45309",
    categoria: "seguranca",
  },
  {
    modulo: "aep",
    href: "/aep",
    title: "AEP – Análise Ergonômica Preliminar",
    description: "Triagem ergonômica por setor com indicação de necessidade de AET (NR-17)",
    icon: <ClipboardCheck className="size-12" />,
    accent: "#059669",
    categoria: "seguranca",
  },
  {
    modulo: "investigacao_acidente",
    href: "/investigacao-acidente",
    title: "Investigação de Acidente",
    description: "Investigação de acidentes de trabalho: CAT, análise de causas (5 porquês) e medidas",
    icon: <Siren className="size-12" />,
    accent: "#B91C1C",
    categoria: "seguranca",
    skipStats: true,
    staticLabel: "Investigação de acidentes do trabalho",
  },
  {
    modulo: "epi",
    href: "/epi",
    title: "Gestão de EPI",
    description: "Catálogo com C.A., estoque, entrega com ficha assinada e transferência entre empresas",
    icon: <HardHat className="size-12" />,
    accent: "#0369A1",
    categoria: "seguranca",
    skipStats: true,
    staticLabel: "Controle de EPI por empresa",
  },
  // ── NR — Fatores Psicossocial ──────────────────────────────────────
  {
    modulo: "psicossocial",
    href: "/psicossocial",
    title: "DRPS – Diagnóstico de Riscos Psicossociais",
    description: "Gestão de riscos psicossociais, IAPAT e relatórios por empresa",
    icon: <Brain className="size-12" />,
    accent: "#7C3AED",
    categoria: "psicossocial",
  },
  {
    modulo: "questionarios_psicossociais",
    href: "/questionarios-psicossociais",
    title: "Questionários Psicossociais",
    description: "Aplicação de questionários DRPS, matriz de risco por setor e planos de ação (NR-01)",
    icon: <BookOpen className="size-12" />,
    accent: "#6366F1",
    categoria: "psicossocial",
  },
  {
    modulo: "psicossocial",
    href: "/sinalizacao-psicossocial",
    title: "Sinalização Psicossocial",
    description: "Painel de alertas organizacionais por empresa e setor identificados nas triagens AEP",
    icon: <Brain className="size-12" />,
    accent: "#7C3AED",
    categoria: "psicossocial",
    skipStats: true,
    staticLabel: "Dashboard · Fatores organizacionais",
  },
  // ── Chabra Sistema Interno ─────────────────────────────────────────
  // O card "Inventário de Equipamentos" saiu daqui em 2026-09-14: o patrimônio
  // interno já vivia em /equipamentos e as máquinas de cliente continuam na
  // Relação de Máquinas (Apreciação) e na aba Máquinas da inspeção.
  {
    modulo: "equipamentos",
    href: "/equipamentos",
    title: "Equipamentos JCN",
    description: "Patrimônio interno por base: notebooks, monitores, ar-condicionado e o que mais for da casa",
    icon: <HardDrive className="size-12" />,
    accent: "#1D4ED8",
    categoria: "interno",
  },
  {
    modulo: "dimensionamento",
    href: "/dimensionamento",
    title: "Dimensionamento de Quadro (SST)",
    description: "Quantas pessoas para eliminar os documentos vencidos no prazo: carteira que vence, equipe real e deficit por area",
    icon: <Gauge className="size-12" />,
    accent: "#0D9488",
    categoria: "interno",
    // skipStats + staticLabel: o card mostra rotulo fixo em vez de contagem, e
    // useHomeStats.ts nao precisa ser tocado. Mesmo caminho de produtividade e frota.
    skipStats: true,
    staticLabel: "Headcount · so administradores",
  },
  {
    modulo: "frota",
    href: "/frota",
    title: "Frota JCN",
    description: "Checklist de saída de veículo: fotos obrigatórias, avarias, sinistros e abastecimento por base",
    icon: <Truck className="size-12" />,
    accent: "#1B3A8C",
    categoria: "interno",
    // skipStats + staticLabel poupam um terceiro arquivo compartilhado: com eles
    // o card mostra rótulo fixo em vez de contagem, e useHomeStats.ts NÃO precisa
    // ser tocado. Mesmo caminho de produtividade, epi e gestao_gerencial.
    skipStats: true,
    staticLabel: "Veículos · controle de saída",
  },
  // A "Escala de Supervisores" saiu daqui em 2026-09-14: a porta dela é a
  // Gestão Gerencial (card na tela inicial + item do menu). Em 2026-09-23 o card
  // voltou SÓ para quem tem a Escala sem a Gestão Gerencial — a v229 refez os
  // módulos por função e deixou 5 contas com a Escala e nenhum caminho até ela.
  // Quem tem as duas continua entrando pela Gestão Gerencial, sem card repetido.
  {
    modulo: "escala_supervisores",
    href: "/escala",
    title: "Escala de Supervisores",
    description:
      "Quem cobre qual unidade em cada dia útil: padrão semanal, grade mensal, feriados e conferência das regras",
    icon: <CalendarDays className="size-12" />,
    accent: "#0891B2",
    categoria: "interno",
    skipStats: true,
    staticLabel: "Escala · supervisores por unidade",
    ocultarSeTiver: "gestao_gerencial",
  },
];

const CATEGORIES: { id: Categoria; label: string; icon: React.ReactNode }[] = [
  { id: "seguranca",    label: "Segurança do Trabalho",      icon: <Shield className="size-4" /> },
  { id: "psicossocial", label: "NR — Fatores Psicossocial",  icon: <Brain className="size-4" /> },
  { id: "interno",      label: "JCN Sistema Interno",     icon: <Boxes className="size-4" /> },
];

const CATEGORY_CONFIG: Record<Categoria, { descricao: string; accent: string; icon: React.ReactNode }> = {
  seguranca: {
    descricao: "Inspeções, conformidade NR, laudos NR-12, ergonomia e análise de agentes químicos",
    accent: "#00835A",
    icon: <Shield className="size-12" />,
  },
  psicossocial: {
    descricao: "Diagnóstico de riscos psicossociais, questionários DRPS e planos de ação (NR-01)",
    accent: "#7C3AED",
    icon: <Brain className="size-12" />,
  },
  interno: {
    descricao: "Patrimônio JCN, inventário de equipamentos e sistemas de gestão interna",
    accent: "#2563EB",
    icon: <Boxes className="size-12" />,
  },
};


function saudacaoPorHorario(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatarDataExtenso(d: Date): string {
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function diferencaTexto(iso: string): string {
  const agora = Date.now();
  const data = new Date(iso).getTime();
  const diff = agora - data;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `há ${dias}d`;
  const meses = Math.floor(dias / 30);
  return `há ${meses}mês${meses > 1 ? "es" : ""}`;
}

function InicioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoriaAtiva = (searchParams.get("c") as Categoria) || null;
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const { data: configs } = useConfiguracoes();
  const stats = useHomeStats();
  // A Gestão Chabra não é um `modulos_permitidos`: quem entra é decidido pelo
  // roster (gestao_membros) e a própria /gestao devolve não-membro pra /inicio.
  // Sem esse portão aqui o card apareceria pra todo mundo e quicaria.
  const { data: papelGestao } = useMeuPapelGestao();
  const temGestaoChabra = papelGestao != null;

  const isAdmin = user?.perfil === "Admin";
  // v231: Presença também para a gerência (função com ve_presenca_auditoria).
  const vePresenca = vePresencaAuditoria(user);
  const modulosPermitidos = new Set(user?.modulos_permitidos ?? []);

  // Cards visíveis ordenados por pendência dentro de cada categoria.
  const cardsDisponiveis = CARDS.filter(
    (c) => modulosPermitidos.has(c.modulo) && !(c.ocultarSeTiver && modulosPermitidos.has(c.ocultarSeTiver)),
  )
    .map((c, idx) => ({
      cfg: c,
      pendente: statsPorModulo(stats, c.modulo)?.pendente ?? 0,
      idx,
    }))
    .sort((a, b) => {
      if (b.pendente !== a.pendente) return b.pendente - a.pendente;
      return a.idx - b.idx;
    })
    .map((x) => x.cfg);

  const temCards = cardsDisponiveis.length > 0;

  // Clientes não usam o hub — redirecionados para o portal
  useEffect(() => {
    if (user?.perfil === "Cliente") router.replace("/portal-cliente/inicio");
  }, [user?.perfil, router]);

  const [saudacao, setSaudacao] = useState("");
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    const now = new Date();
    setSaudacao(saudacaoPorHorario(now));
    setAgora(now);
  }, []);
  const primeiroNome = user?.nome ? user.nome.split(" ")[0] : "";

  // Evita flash do hub antes do redirect completar (depois de todos os hooks)
  if (user?.perfil === "Cliente") {
    return (
      <div
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(135deg, #1e4d28 0%, #006B54 60%, #00835A 100%)",
        }}
      />
    );
  }

  async function handleLogout() {
    sessionStorage.setItem("intentional-logout", "1");
    const api = (window as Window & { electronAPI?: { clearCredentials?: () => Promise<void> } }).electronAPI;
    await api?.clearCredentials?.();
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
          <Link
            href="/inicio"
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            title="Voltar à Visão geral"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Visão geral</span>
          </Link>
          {configs?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={configs.logo_url}
              alt="Logo"
              // force-light: a placa branca atrás da logo tem que continuar
              // branca. Sem isso o shim escurece o bg-white e a logo fica com
              // fundo preto. Mesmo tratamento da SidebarShell e do portal.
              className="force-light h-10 w-auto max-w-[44px] rounded-md bg-white object-contain p-0.5 shadow"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (!img.src.endsWith("/logo-chabra.png")) img.src = "/logo-chabra.png";
              }}
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-md bg-white/15 text-white shadow">
              <Shield className="size-5" />
            </div>
          )}
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">JCN Consultoria</p>
            <p className="text-[11px] text-white/70">
              Segurança e Saúde do Trabalho
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <UnidadeAtivaChip variant="hub" />
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
              title="Administração do sistema (usuários, configurações, lixeira)"
            >
              <Settings className="size-4" />
              <span className="hidden sm:inline">Sistema</span>
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

      <main className="flex flex-1 flex-col items-center px-4 py-10">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            {saudacao}
            {primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
          <p className="mt-1 text-sm capitalize text-white/70">
            {agora ? formatarDataExtenso(agora) : null}
          </p>
          {temCards && (
            <p className="mt-3 text-sm text-white/80 sm:text-base">
              {categoriaAtiva
                ? CATEGORIES.find((c) => c.id === categoriaAtiva)?.label
                : "Selecione uma área para acessar"}
            </p>
          )}
        </div>

        {!temCards ? (
          <div className="mx-auto max-w-md rounded-2xl bg-white/10 p-6 text-center text-white backdrop-blur">
            <AlertTriangle className="mx-auto size-8 text-amber-300" />
            <p className="mt-3 font-semibold">
              Sem módulos liberados pra sua conta
            </p>
            <p className="mt-1 text-sm text-white/80">
              Fale com o admin do sistema pra solicitar acesso aos módulos
              (Painel SST, Conformidade NR, RNC, Análise de Químicos,
              Psicossocial e outros).
            </p>
            <p className="mt-3 text-xs text-white/60">
              Admin: <span className="font-mono">sst.jcnconsultoria@gmail.com</span>
            </p>
          </div>
        ) : categoriaAtiva === null ? (
          /* ── Nível 1: seleção de categoria ── */
          (() => {
            const visibleCats = CATEGORIES.filter((c) => cardsDisponiveis.some((d) => d.categoria === c.id));
            // +1 Empresa (todos internos) + Gestão Gerencial (quem tem o módulo)
            // + PDFs (admin) + Gestão Chabra (quem está no roster) + Presença (admin ou gerência, v231).
            const totalCards =
              visibleCats.length + 1 + (modulosPermitidos.has("gestao_gerencial") ? 1 : 0) + (isAdmin ? 1 : 0) + (vePresenca ? 1 : 0) + (temGestaoChabra ? 1 : 0);
            return (
              <div
                className={cn(
                  "grid w-full gap-5",
                  "grid-cols-1",
                  totalCards === 1 && "max-w-sm",
                  totalCards === 2 && "sm:grid-cols-2 max-w-3xl",
                  totalCards === 3 && "sm:grid-cols-2 lg:grid-cols-3 max-w-5xl",
                  totalCards >= 4 && "sm:grid-cols-2 lg:grid-cols-4 max-w-7xl",
                )}
              >
                {visibleCats.map((cat) => {
                  const catCards = cardsDisponiveis.filter((c) => c.categoria === cat.id);
                  const cfg = CATEGORY_CONFIG[cat.id];
                  // Descrição reflete os módulos que o usuário REALMENTE acessa
                  // (evita citar inventário/patrimônio p/ quem só tem Produtividade).
                  const descricao = catCards.map((c) => c.title).join(" · ") || cfg.descricao;
                  return (
                    <CategoryCard
                      key={cat.id}
                      label={cat.label}
                      icon={cfg.icon}
                      descricao={descricao}
                      accent={cfg.accent}
                      totalModulos={catCards.length}
                      pendentes={catCards.reduce(
                        (sum, c) => sum + (statsPorModulo(stats, c.modulo)?.pendente ?? 0),
                        0
                      )}
                      isLoading={stats.isLoading}
                      onClick={() => router.push(`/modulos?c=${cat.id}`)}
                    />
                  );
                })}
                <EmpresaDirectCard />
                {modulosPermitidos.has("gestao_gerencial") && <GestaoGerencialDirectCard />}
                {isAdmin && <PdfDirectCard />}
                {temGestaoChabra && <GestaoChabraDirectCard />}
                {vePresenca && <PresencaDirectCard />}
              </div>
            );
          })()
        ) : (
          /* ── Nível 2: módulos da categoria selecionada ── */
          <div className="w-full max-w-6xl">
            {/* Botão voltar */}
            <button
              type="button"
              onClick={() => router.push("/modulos")}
              className="mb-6 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-white/25"
            >
              <ArrowLeft className="size-4" />
              Voltar às categorias
            </button>

            {/* Cabeçalho da categoria */}
            <div className="mb-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/20" />
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur">
                <span className="text-white/70">
                  {CATEGORIES.find((c) => c.id === categoriaAtiva)?.icon}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-white/80">
                  {CATEGORIES.find((c) => c.id === categoriaAtiva)?.label}
                </span>
              </div>
              <div className="h-px flex-1 bg-white/20" />
            </div>

            {/* Cards dos módulos */}
            {(() => {
              const catCards = cardsDisponiveis.filter((c) => c.categoria === categoriaAtiva);
              return (
                <div
                  className={cn(
                    "grid gap-5",
                    catCards.length === 1 && "grid-cols-1 max-w-sm mx-auto",
                    catCards.length === 2 && "grid-cols-1 sm:grid-cols-2",
                    catCards.length >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                  )}
                >
                  {catCards.map((c, i) => (
                    <HubCard
                      key={`${c.modulo}-${i}`}
                      {...c}
                      stats={c.skipStats ? undefined : statsPorModulo(stats, c.modulo)}
                      isLoadingStats={c.skipStats ? false : stats.isLoading}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-white/50">
          © {new Date().getFullYear()} JCN Consultoria · Sistemas Internos
          {process.env.NEXT_PUBLIC_APP_VERSION && (
            <span className="ml-2 opacity-60">
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
          )}
        </p>
      </main>
    </div>
  );
}

export default function InicioPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen"
          style={{
            background:
              "linear-gradient(135deg, #1e4d28 0%, #006B54 60%, #00835A 100%)",
          }}
        />
      }
    >
      <InicioContent />
    </Suspense>
  );
}

/** Retorna stats do módulo (ou undefined pros sem suporte: apreciação/inventário). */
function statsPorModulo(
  data: ReturnType<typeof useHomeStats>,
  modulo: ModuloPermitido
): ModuloStats | undefined {
  switch (modulo) {
    case "painel":
      return data.painel;
    case "psicossocial":
      return data.psicossocial;
    case "conformidade":
      return data.conformidade;
    case "nao_conformidade":
      return data.nao_conformidade;
    case "analise_quimicos":
      return data.analise_quimicos;
    case "apreciacao_maquinas":
      return data.apreciacao_maquinas;
    case "aet":
      return data.aet;
    case "aep":
      return data.aep;
    case "questionarios_psicossociais":
      return data.questionarios_psicossociais;
    default:
      return undefined;
  }
}

function EmpresaDirectCard() {
  const accent = "#0E7490";
  return (
    <Link
      href="/empresas"
      className="group flex w-full flex-col gap-4 glass tilt-3d sheen reveal-up rounded-2xl p-6 text-left"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105"
          style={{ backgroundColor: accent }}
        >
          <Building2 className="size-12" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">Empresas</h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
            Cadastro e gestão das empresas clientes — base usada por todos os módulos
          </p>
        </div>
      </div>
      <div className="flex min-h-[40px] items-center gap-2 border-t border-gray-100 pt-3 text-xs">
        <span
          className="rounded-full px-2 py-0.5 font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          Cadastro
        </span>
        <span className="text-gray-500">Todos os módulos</span>
        <ArrowRight
          className="ml-auto size-4 transition-transform group-hover:translate-x-1"
          style={{ color: accent }}
        />
      </div>
    </Link>
  );
}

function GestaoGerencialDirectCard() {
  const accent = "#00432F";
  return (
    <Link
      href="/gestao-gerencial"
      className="group flex w-full flex-col gap-4 glass tilt-3d sheen reveal-up rounded-2xl p-6 text-left"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105"
          style={{ backgroundColor: accent }}
        >
          <CalendarClock className="size-12" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">Gestão Gerencial</h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
            Escalas e substituições por unidade · Escala de Supervisores
          </p>
        </div>
      </div>
      <div className="flex min-h-[40px] items-center gap-2 border-t border-gray-100 pt-3 text-xs">
        <span
          className="rounded-full px-2 py-0.5 font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          Gerencial
        </span>
        <span className="text-gray-500">Uso interno</span>
        <ArrowRight
          className="ml-auto size-4 transition-transform group-hover:translate-x-1"
          style={{ color: accent }}
        />
      </div>
    </Link>
  );
}

function PdfDirectCard() {
  return (
    <Link
      href="/pdfs-gerados"
      className="group flex w-full flex-col gap-4 glass tilt-3d sheen reveal-up rounded-2xl p-6 text-left"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105"
          style={{ backgroundColor: "#64748B" }}
        >
          <FileClock className="size-12" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">PDFs Gerados</h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
            Histórico de todos os PDFs gerados pelo sistema, com download e status de assinatura
          </p>
        </div>
      </div>
      <div className="flex min-h-[40px] items-center gap-2 border-t border-gray-100 pt-3 text-xs">
        <span
          className="rounded-full px-2 py-0.5 font-semibold text-white"
          style={{ backgroundColor: "#64748B" }}
        >
          Histórico
        </span>
        <span className="text-gray-500">Todos os módulos</span>
        <ArrowRight
          className="ml-auto size-4 transition-transform group-hover:translate-x-1"
          style={{ color: "#64748B" }}
        />
      </div>
    </Link>
  );
}

function GestaoChabraDirectCard() {
  // Verde do quadro, mas NÃO o #1A3D26 do cabeçalho da /gestao: aquele tom some
  // dentro do card no modo noturno (medido na prévia) e ainda se confunde com o
  // #00432F da Gestão Gerencial, que fica no card ao lado.
  const accent = "#15803D";
  return (
    <Link
      href="/gestao"
      className="group flex w-full flex-col gap-4 glass tilt-3d sheen reveal-up rounded-2xl p-6 text-left"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105"
          style={{ backgroundColor: accent }}
        >
          <KanbanSquare className="size-12" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">Gestão JCN</h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
            Quadros de tarefas da equipe: espaços, prazos, responsáveis e automações
          </p>
        </div>
      </div>
      <div className="flex min-h-[40px] items-center gap-2 border-t border-gray-100 pt-3 text-xs">
        <span
          className="rounded-full px-2 py-0.5 font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          Tarefas
        </span>
        <span className="text-gray-500">Uso interno</span>
        <ArrowRight
          className="ml-auto size-4 transition-transform group-hover:translate-x-1"
          style={{ color: accent }}
        />
      </div>
    </Link>
  );
}


function PresencaDirectCard() {
  // Presença no painel (v218): quem está mexendo agora, quando entrou e quanto
  // ficou ativo. Admin e gerência (v231). Mora aqui, depois do Gestão Chabra, por decisão dele
  // em 16/09 — saiu da tela Início no mesmo dia.
  const accent = "#0E7490";
  return (
    <Link
      href="/presenca"
      className="group flex w-full flex-col gap-4 glass tilt-3d sheen reveal-up rounded-2xl p-6 text-left"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105"
          style={{ backgroundColor: accent }}
        >
          <Radio className="size-12" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">Presença no painel</h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
            Quem está ativo agora, quando entrou, quando parou de mexer e quanto tempo ficou no painel por dia
          </p>
        </div>
      </div>
      <div className="flex min-h-[40px] items-center gap-2 border-t border-gray-100 pt-3 text-xs">
        <span
          className="rounded-full px-2 py-0.5 font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          Presença
        </span>
        <span className="text-gray-500">Só administradores</span>
        <ArrowRight
          className="ml-auto size-4 transition-transform group-hover:translate-x-1"
          style={{ color: accent }}
        />
      </div>
    </Link>
  );
}

function HubCard({
  href,
  title,
  description,
  icon,
  accent,
  stats,
  isLoadingStats,
  staticLabel,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  stats?: ModuloStats;
  isLoadingStats?: boolean;
  staticLabel?: string;
  skipStats?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group glass tilt-3d sheen reveal-up flex flex-col gap-4 rounded-2xl p-6"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
            {description}
          </p>
        </div>
      </div>

      {/* Stats / placeholder */}
      <div className="flex min-h-[40px] items-center gap-2 border-t border-gray-100 pt-3 text-xs">
        {isLoadingStats ? (
          <span className="flex items-center gap-1.5 text-gray-400">
            <Loader2 className="size-3 animate-spin" /> Carregando...
          </span>
        ) : stats ? (
          <>
            <span
              className="rounded-full px-2 py-0.5 font-semibold text-white"
              style={{ backgroundColor: accent }}
              title="Total no período"
            >
              {stats.total}
            </span>
            <span className="text-gray-500">
              {stats.pendente > 0 && (
                <>
                  <span className="font-semibold text-amber-700">
                    {stats.pendente}
                  </span>
                  <span> pendente{stats.pendente !== 1 && "s"}</span>
                </>
              )}
              {stats.pendente === 0 && stats.recente > 0 && (
                <span>
                  {stats.recente} novo{stats.recente !== 1 && "s"} (30d)
                </span>
              )}
              {stats.pendente === 0 && stats.recente === 0 && stats.total === 0 && (
                <span className="italic">Nenhum registro ainda</span>
              )}
              {stats.pendente === 0 && stats.recente === 0 && stats.total > 0 && (
                <span>Tudo em dia</span>
              )}
            </span>
          </>
        ) : staticLabel ? (
          <span className="font-medium" style={{ color: accent }}>{staticLabel}</span>
        ) : (
          <span className="italic text-gray-400">Em construção</span>
        )}
        <ArrowRight
          className="ml-auto size-4 text-gray-400 transition-transform group-hover:translate-x-1"
          style={{ color: accent }}
        />
      </div>
    </Link>
  );
}

function CategoryCard({
  label,
  icon,
  descricao,
  accent,
  totalModulos,
  pendentes,
  isLoading,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  descricao: string;
  accent: string;
  totalModulos: number;
  pendentes: number;
  isLoading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col gap-4 glass tilt-3d sheen reveal-up rounded-2xl p-6 text-left"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">{label}</h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
            {descricao}
          </p>
        </div>
      </div>

      <div className="flex min-h-[40px] items-center gap-2 border-t border-gray-100 pt-3 text-xs">
        {isLoading ? (
          <span className="flex items-center gap-1.5 text-gray-400">
            <Loader2 className="size-3 animate-spin" /> Carregando...
          </span>
        ) : (
          <>
            <span
              className="rounded-full px-2 py-0.5 font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {totalModulos} módulo{totalModulos !== 1 && "s"}
            </span>
            {pendentes > 0 && (
              <span className="text-amber-700">
                <span className="font-semibold">{pendentes}</span>
                {" pendente"}{pendentes !== 1 && "s"}
              </span>
            )}
            {pendentes === 0 && (
              <span className="text-gray-500">Tudo em dia</span>
            )}
          </>
        )}
        <ArrowRight
          className="ml-auto size-4 text-gray-400 transition-transform group-hover:translate-x-1"
          style={{ color: accent }}
        />
      </div>
    </button>
  );
}

