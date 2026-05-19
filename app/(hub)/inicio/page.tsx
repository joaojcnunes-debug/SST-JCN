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
  Cog,
  Boxes,
  FlaskConical,
  Activity,
  Loader2,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { useCanCreate } from "@/lib/hooks/useUsuario";
import { useHomeStats, type ModuloStats, type AtividadeItem } from "@/lib/hooks/useHomeStats";
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
  {
    modulo: "apreciacao_maquinas",
    href: "/apreciacao-maquinas",
    title: "Apreciação de Máquinas",
    description: "Avaliação técnica de máquinas conforme NR-12",
    icon: <Cog className="size-12" />,
    accent: "#EA580C",
  },
  {
    modulo: "inventario_maquinas",
    href: "/inventario-maquinas",
    title: "Inventário de Equipamentos",
    description: "Máquinas e equipamentos internos da Chabra",
    icon: <Boxes className="size-12" />,
    accent: "#2563EB",
  },
  {
    modulo: "analise_quimicos",
    href: "/analise-quimicos",
    title: "Análise de Químicos Chabra",
    description: "Análise quantitativa de agentes químicos e FISPQ",
    icon: <FlaskConical className="size-12" />,
    accent: "#0EA5E9",
  },
];

const NOMES_MODULOS: Record<ModuloPermitido, string> = {
  painel: "Painel SST",
  psicossocial: "Psicossocial",
  conformidade: "Conformidade NR",
  nao_conformidade: "Não Conformidade",
  apreciacao_maquinas: "Apreciação Máquinas",
  inventario_maquinas: "Inventário",
  analise_quimicos: "Análise Químicos",
};

interface QuickActionCfg {
  modulo: ModuloPermitido;
  href: string;
  label: string;
  icon: React.ReactNode;
  accent: string;
}

/** Ações rápidas — atalhos para criar registros novos nos módulos.
 *  Cada ação só aparece se o usuário tiver `pode_criar` E o módulo
 *  estiver na lista de permitidos. Psicossocial aponta pro hub do módulo
 *  porque o /novo precisa de empresa selecionada. */
const QUICK_ACTIONS: QuickActionCfg[] = [
  {
    modulo: "painel",
    href: "/inspecoes/nova",
    label: "Nova Inspeção",
    icon: <Shield className="size-4" />,
    accent: "#00835A",
  },
  {
    modulo: "conformidade",
    href: "/relatorio-conformidade/novo",
    label: "Novo Relatório NR",
    icon: <CheckCircle2 className="size-4" />,
    accent: "#0D9488",
  },
  {
    modulo: "nao_conformidade",
    href: "/relatorio-nao-conformidade/novo",
    label: "Novo RNC",
    icon: <AlertTriangle className="size-4" />,
    accent: "#DC2626",
  },
  {
    modulo: "analise_quimicos",
    href: "/analise-quimicos/nova",
    label: "Nova Análise Química",
    icon: <FlaskConical className="size-4" />,
    accent: "#0EA5E9",
  },
  {
    modulo: "psicossocial",
    href: "/psicossocial",
    label: "Iniciar DRPS",
    icon: <Brain className="size-4" />,
    accent: "#7C3AED",
  },
];

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

export default function InicioPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const { data: configs } = useConfiguracoes();
  const stats = useHomeStats();
  const canCreate = useCanCreate();

  const isAdmin = user?.perfil === "Admin";
  const modulosPermitidos = new Set(user?.modulos_permitidos ?? []);

  // Cards visíveis ordenados por pendência (estável: sobe quem tem trabalho
  // pendente, mantém ordem original entre empates pra não bagunçar memória
  // muscular do usuário).
  const cards = CARDS.filter((c) => modulosPermitidos.has(c.modulo))
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

  // Quick Actions filtradas por permissão (canCreate) + módulos permitidos.
  const quickActions = canCreate
    ? QUICK_ACTIONS.filter((a) => modulosPermitidos.has(a.modulo))
    : [];

  // Atividade recente filtrada por módulos permitidos do usuário
  const atividadeFiltrada = stats.atividadeRecente.filter((a) =>
    modulosPermitidos.has(a.modulo)
  );

  const agora = new Date();
  const saudacao = saudacaoPorHorario(agora);
  const primeiroNome = user?.nome ? user.nome.split(" ")[0] : "";

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

      <main className="flex flex-1 flex-col items-center px-4 py-10">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            {saudacao}
            {primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
          <p className="mt-1 text-sm capitalize text-white/70">
            {formatarDataExtenso(agora)}
          </p>
          {cards.length > 0 && (
            <p className="mt-3 text-sm text-white/80 sm:text-base">
              Escolha o sistema que deseja acessar
            </p>
          )}
        </div>

        {cards.length === 0 ? (
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
              Admin: <span className="font-mono">suporte.ti@chabra.com.br</span>
            </p>
          </div>
        ) : (
          <>
            {quickActions.length > 0 && (
              <QuickActionsBloco actions={quickActions} />
            )}

            <div
              className={cn(
                "grid w-full gap-6 grid-cols-1",
                cards.length === 1 && "max-w-sm",
                cards.length === 2 && "max-w-3xl sm:grid-cols-2",
                cards.length === 3 && "max-w-5xl sm:grid-cols-2 lg:grid-cols-3",
                cards.length === 4 && "max-w-4xl sm:grid-cols-2",
                cards.length >= 5 && "max-w-6xl sm:grid-cols-2 lg:grid-cols-3"
              )}
            >
              {cards.map((c) => (
                <HubCard
                  key={c.modulo}
                  {...c}
                  stats={statsPorModulo(stats, c.modulo)}
                  isLoadingStats={stats.isLoading}
                />
              ))}
            </div>

            {(stats.isLoading || atividadeFiltrada.length > 0) && (
              <AtividadeRecenteBloco
                itens={atividadeFiltrada}
                isLoading={stats.isLoading}
              />
            )}
          </>
        )}

        <p className="mt-10 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Chabra · Sistemas Internos
        </p>
      </main>
    </div>
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
    default:
      return undefined; // Apreciação e Inventário ainda sem dados
  }
}

function HubCard({
  href,
  title,
  description,
  icon,
  accent,
  stats,
  isLoadingStats,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  stats?: ModuloStats;
  isLoadingStats?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl"
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

/** Bloco "Ações Rápidas" — atalhos pra criação nos módulos.
 *  Só renderiza pra quem tem `pode_criar`. Botões em linha horizontal com
 *  wrap em telas pequenas. */
function QuickActionsBloco({ actions }: { actions: QuickActionCfg[] }) {
  return (
    <div className="mb-8 flex w-full max-w-6xl flex-wrap items-center justify-center gap-2 sm:gap-3">
      {actions.map((a) => (
        <Link
          key={a.modulo}
          href={a.href}
          className="group flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"
        >
          <span
            className="flex size-7 items-center justify-center rounded-full text-white shadow-sm transition-colors"
            style={{ backgroundColor: a.accent }}
          >
            {a.icon}
          </span>
          <span className="transition-colors group-hover:text-gray-900">
            {a.label}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Bloco "Atividade Recente" — top 8 registros agregados dos módulos. */
function AtividadeRecenteBloco({
  itens,
  isLoading,
}: {
  itens: AtividadeItem[];
  isLoading: boolean;
}) {
  return (
    <section className="mt-12 w-full max-w-6xl rounded-2xl bg-white/95 p-5 shadow-xl backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="size-5 text-verde-primary" />
        <h2 className="text-base font-bold text-gray-900">Atividade Recente</h2>
        <span className="ml-auto text-xs text-gray-500">
          Últimos {itens.length} de todos os módulos liberados
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 px-2 py-6 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Carregando atividade...
        </div>
      ) : itens.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-gray-500">
          Nenhuma atividade recente nos módulos liberados.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {itens.map((item, idx) => (
            <li key={idx}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-2 py-2.5 hover:bg-gray-50"
              >
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                  {NOMES_MODULOS[item.modulo] ?? item.modulo}
                </span>
                <span className="flex-1 truncate text-sm text-gray-800">
                  {item.titulo}
                </span>
                {item.status && (
                  <span className="hidden text-[10px] uppercase text-gray-400 sm:inline">
                    {item.status}
                  </span>
                )}
                <span className="shrink-0 text-xs text-gray-500">
                  {diferencaTexto(item.data)}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
