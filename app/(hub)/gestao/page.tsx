"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, KanbanSquare, Plus, Search, X, LayoutList, CalendarDays, GanttChartSquare, SlidersHorizontal, Tags, Tag, Zap, Settings, ChevronDown, Clock, CircleUser, CheckSquare, BarChart3, FileText, Inbox, Lock } from "lucide-react";
import { useUserStore } from "@/lib/store";
import { useCanEdit, useIsAdmin } from "@/lib/hooks/useUsuario";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import {
  useQuadros, useTarefas, useReordenar, useUsuariosLista, useSalvarTarefa, useAcaoMassa,
  useMinhasTarefas, useTodosStatus, useNotificacoes, useMarcarLida, useMeusAcessos,
  usePreferenciaVisao, useSalvarPreferenciaVisao,
  useStatusQuadro, statusPadrao, useCamposQuadro, useEtiquetasQuadro,
  useEspacos, usePastas, useTodasDependencias, useAutomacaoRunner, useTempoQuadro, useAnexosCountQuadro,
  corAvatar, formatarDuracao,
  PRIORIDADES, FILTRO_VAZIO, contarFiltros,
  type GestaoTarefa, type StatusTarefa, type VistaGestao, type AgruparPor, type GestaoStatus, type GestaoNotificacao, type PrioridadeTarefa, type FiltrosGestao,
} from "@/lib/hooks/useGestao";
import GestaoSidebar from "@/components/gestao/GestaoSidebar";
import NotificacoesSino from "@/components/gestao/NotificacoesSino";
import TarefaModal from "@/components/gestao/TarefaModal";
import StatusManagerModal from "@/components/gestao/StatusManagerModal";
import CamposManagerModal from "@/components/gestao/CamposManagerModal";
import AutomacoesManagerModal from "@/components/gestao/AutomacoesManagerModal";
import TempoRelatorioModal from "@/components/gestao/TempoRelatorioModal";
import EtiquetasManagerModal from "@/components/gestao/EtiquetasManagerModal";
import FormulariosManagerModal from "@/components/gestao/FormulariosManagerModal";
import CalendarioModal from "@/components/gestao/CalendarioModal";
import CompartilharModal from "@/components/gestao/CompartilharModal";
import TarefaCard from "@/components/gestao/TarefaCard";
import FiltrosPanel from "@/components/gestao/FiltrosPanel";
import MinhasTarefas from "@/components/gestao/MinhasTarefas";
import CaixaEntrada from "@/components/gestao/CaixaEntrada";
import PainelGestao from "@/components/gestao/PainelGestao";
import BarraAcoesMassa from "@/components/gestao/BarraAcoesMassa";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import VistaLista from "@/components/gestao/VistaLista";
import VistaCalendario from "@/components/gestao/VistaCalendario";
import VistaTimeline from "@/components/gestao/VistaTimeline";

function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - hoje.getTime()) / 86_400_000);
}

const VISTAS: { value: VistaGestao; label: string; icon: typeof KanbanSquare }[] = [
  { value: "quadro", label: "Quadro", icon: KanbanSquare },
  { value: "lista", label: "Lista", icon: LayoutList },
  { value: "calendario", label: "Calendário", icon: CalendarDays },
  { value: "timeline", label: "Timeline", icon: GanttChartSquare },
];

export default function GestaoJCNPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const canEditGlobal = useCanEdit();
  const isAdmin = useIsAdmin();
  const { data: meusAcessos } = useMeusAcessos();
  const podeEditarGlobal = isAdmin || canEditGlobal;
  const { data: configs } = useConfiguracoes();
  const { data: quadros = [], isLoading: loadingQuadros } = useQuadros();
  const { data: espacos = [] } = useEspacos();
  const { data: pastas = [] } = usePastas();
  const { data: usuarios = [] } = useUsuariosLista();
  const reordenar = useReordenar();

  const [quadroId, setQuadroId] = useState<string | null>(null);
  const quadro = quadros.find((q) => q.id_quadro === quadroId) ?? quadros[0] ?? null;
  // Permissão de edição da lista selecionada (admin sempre; aberta = global; restrita = papel editor).
  const podeEditar = !quadro ? podeEditarGlobal : isAdmin ? true : !quadro.restrito ? canEditGlobal : meusAcessos?.get(quadro.id_quadro) === "editor";
  useEffect(() => {
    if (!quadroId && quadros.length) setQuadroId(quadros[0].id_quadro);
  }, [quadros, quadroId]);

  const { data: tarefas = [], isLoading: loadingTarefas } = useTarefas(quadro?.id_quadro);
  const { data: pref } = usePreferenciaVisao(quadro?.id_quadro);
  const salvarPref = useSalvarPreferenciaVisao();
  const { data: statusList = [], isLoading: loadingStatus } = useStatusQuadro(quadro?.id_quadro);
  const { data: campos = [] } = useCamposQuadro(quadro?.id_quadro);
  const { data: etiquetasCat = [] } = useEtiquetasQuadro(quadro?.id_quadro);
  const runAuto = useAutomacaoRunner(quadro?.id_quadro);
  const salvar = useSalvarTarefa();
  const acaoMassa = useAcaoMassa();
  const { data: tempoEntries = [] } = useTempoQuadro(quadro?.id_quadro, tarefas.map((t) => t.id_tarefa));
  const { data: anexosCount = new Map<string, number>() } = useAnexosCountQuadro(quadro?.id_quadro, tarefas.map((t) => t.id_tarefa));
  const etiquetaCor = useMemo(() => new Map(etiquetasCat.map((e) => [e.nome, e.cor])), [etiquetasCat]);

  const [items, setItems] = useState<GestaoTarefa[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [colHover, setColHover] = useState<StatusTarefa | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<GestaoTarefa | null>(null);
  const [statusNovo, setStatusNovo] = useState<StatusTarefa>("A_FAZER");

  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<FiltrosGestao>(FILTRO_VAZIO);
  const [vista, setVista] = useState<VistaGestao>("quadro");
  const [agruparPor, setAgruparPor] = useState<AgruparPor | null>(null);
  const [soMinhas, setSoMinhas] = useState(false);
  const [dropAlvo, setDropAlvo] = useState<{ col: StatusTarefa; beforeId: string | null } | null>(null);
  const { data: dependencias = [] } = useTodasDependencias(vista === "timeline");

  const [managerOpen, setManagerOpen] = useState(false);
  const [camposOpen, setCamposOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [etiquetasOpen, setEtiquetasOpen] = useState(false);
  const [formulariosOpen, setFormulariosOpen] = useState(false);
  const [calendarioOpen, setCalendarioOpen] = useState(false);
  const [compartilharOpen, setCompartilharOpen] = useState(false);
  const [quadroAgrupar, setQuadroAgrupar] = useState<"status" | "responsavel" | "prioridade" | "etiqueta">("status");
  const [online, setOnline] = useState(true);
  const [boardScrolled, setBoardScrolled] = useState(false);
  const [minhasView, setMinhasView] = useState(false);
  const [painelView, setPainelView] = useState(false);
  const [inboxView, setInboxView] = useState(false);
  const [selecaoModo, setSelecaoModo] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const { data: minhas = [] } = useMinhasTarefas(minhasView || inboxView);
  const { data: todosStatus = [] } = useTodosStatus(minhasView || inboxView);
  const statusGlobalMap = useMemo(() => new Map(todosStatus.map((s) => [`${s.id_quadro}|${s.slug}`, s])), [todosStatus]);
  const { data: notificacoes = [] } = useNotificacoes();
  const marcarLida = useMarcarLida();
  const inboxCount = useMemo(() => notificacoes.filter((n) => !n.lida).length, [notificacoes]);

  useEffect(() => {
    if (user?.perfil === "Cliente") router.replace("/portal-cliente/inicio");
  }, [user?.perfil, router]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const recompute = () => {
      if (navigator.onLine) { if (t) clearTimeout(t); setOnline(true); }
      else { if (t) clearTimeout(t); t = setTimeout(() => setOnline(false), 3000); }
    };
    recompute();
    window.addEventListener("online", recompute);
    window.addEventListener("offline", recompute);
    return () => { if (t) clearTimeout(t); window.removeEventListener("online", recompute); window.removeEventListener("offline", recompute); };
  }, []);

  useEffect(() => setItems(tarefas), [tarefas]);

  // Limpa a seleção ao trocar de lista ou de visão.
  useEffect(() => { setSelecaoModo(false); setSelecionados(new Set()); }, [quadroId, vista]);

  // Aplica a preferência de visão salva (por usuário/quadro).
  useEffect(() => {
    if (pref) { setVista(pref.vista); setAgruparPor(pref.agrupar_por); }
  }, [pref]);

  function mudarVista(v: VistaGestao) {
    setVista(v);
    if (quadro) salvarPref.mutate({ id_quadro: quadro.id_quadro, vista: v, agrupar_por: agruparPor });
  }
  function mudarAgrupar(a: AgruparPor | null) {
    setAgruparPor(a);
    if (quadro) salvarPref.mutate({ id_quadro: quadro.id_quadro, vista, agrupar_por: a });
  }

  const etiquetasSugeridas = useMemo(
    () => [...new Set([...etiquetasCat.map((e) => e.nome), ...items.flatMap((t) => t.etiquetas ?? [])])].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [items, etiquetasCat],
  );

  const tempoPorTarefa = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of tempoEntries) {
      const seg = e.fim ? (e.segundos ?? 0) : Math.max(0, Math.round((Date.now() - new Date(e.inicio).getTime()) / 1000));
      m.set(e.id_tarefa, (m.get(e.id_tarefa) ?? 0) + seg);
    }
    return m;
  }, [tempoEntries]);

  const temFiltro = !!(busca.trim() || soMinhas || contarFiltros(filtros));
  const passaFiltro = (t: GestaoTarefa) => {
    if (soMinhas && (t.responsavel ?? "") !== (user?.nome ?? "")) return false;
    if (filtros.semResponsavel && (t.responsavel ?? "").trim()) return false;
    if (filtros.responsavel && (t.responsavel ?? "") !== filtros.responsavel) return false;
    if (filtros.prioridades.length && !filtros.prioridades.includes(t.prioridade)) return false;
    if (filtros.status.length && !filtros.status.includes(t.status)) return false;
    if (filtros.etiquetas.length && !filtros.etiquetas.some((e) => (t.etiquetas ?? []).includes(e))) return false;
    if (filtros.prazo) {
      if (filtros.prazo === "sem") { if (t.prazo) return false; }
      else {
        if (!t.prazo) return false;
        const d = diasAte(t.prazo);
        const concl = statusMap.get(t.status)?.tipo === "concluido";
        if (filtros.prazo === "atrasadas" && !(d < 0 && !concl)) return false;
        if (filtros.prazo === "hoje" && d !== 0) return false;
        if (filtros.prazo === "semana" && !(d >= 0 && d <= 7)) return false;
      }
    }
    const q = busca.trim().toLowerCase();
    if (q) {
      const valoresCampos = Object.values(t.campos ?? {}).map((v) => (Array.isArray(v) ? v.join(" ") : v ?? "")).join(" ");
      const hay = `${t.titulo} ${t.descricao ?? ""} ${t.responsavel ?? ""} ${(t.etiquetas ?? []).join(" ")} ${valoresCampos}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const statuses = useMemo<GestaoStatus[]>(
    () => (statusList.length ? statusList : quadro ? statusPadrao(quadro.id_quadro) : []),
    [statusList, quadro],
  );
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.slug, s])), [statuses]);
  const statusInicialSlug = statuses.find((s) => s.tipo === "nao_iniciado")?.slug ?? statuses[0]?.slug ?? "A_FAZER";

  // Colunas do Kanban = status do quadro + quaisquer slugs órfãos presentes nas tarefas (nada some).
  const colunasDef = useMemo<GestaoStatus[]>(() => {
    const conhecidos = new Set(statuses.map((s) => s.slug));
    const extras = [...new Set(items.map((t) => t.status))].filter((slug) => !conhecidos.has(slug));
    return [
      ...statuses,
      ...extras.map((slug, i) => ({ id: slug, id_quadro: quadro?.id_quadro ?? "", slug, nome: slug, cor: "#cbd5e1", ordem: 9990 + i, tipo: "ativo" as const })),
    ];
  }, [statuses, items, quadro]);

  // Grupos do Quadro: por status (default) ou por responsável/prioridade/etiqueta.
  const gruposQuadro = useMemo<{ slug: string; nome: string; cor: string }[]>(() => {
    if (quadroAgrupar === "status") return colunasDef.map((c) => ({ slug: c.slug, nome: c.nome, cor: c.cor }));
    if (quadroAgrupar === "prioridade") return PRIORIDADES.map((p) => ({ slug: p.value, nome: p.label, cor: p.cor }));
    if (quadroAgrupar === "responsavel") {
      const nomes = [...new Set(items.map((t) => t.responsavel).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR"));
      return [...nomes.map((n) => ({ slug: n, nome: n, cor: corAvatar(n) })), { slug: "__none__", nome: "Sem responsável", cor: "#cbd5e1" }];
    }
    const tags = [...new Set(items.flatMap((t) => t.etiquetas ?? []))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [...tags.map((tg) => ({ slug: tg, nome: tg, cor: etiquetaCor.get(tg) ?? "#94a3b8" })), { slug: "__none__", nome: "Sem etiqueta", cor: "#cbd5e1" }];
  }, [quadroAgrupar, colunasDef, items, etiquetaCor]);

  const porGrupo = useMemo(() => {
    const pertence = (t: GestaoTarefa, chave: string) => {
      if (quadroAgrupar === "status") return t.status === chave;
      if (quadroAgrupar === "prioridade") return t.prioridade === chave;
      if (quadroAgrupar === "responsavel") return (t.responsavel || "__none__") === chave;
      return chave === "__none__" ? (t.etiquetas?.length ?? 0) === 0 : (t.etiquetas ?? []).includes(chave);
    };
    const m: Record<string, GestaoTarefa[]> = {};
    for (const g of gruposQuadro) {
      m[g.slug] = items.filter((t) => pertence(t, g.slug));
      m[g.slug].sort(quadroAgrupar === "status"
        ? (a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at)
        : (a, b) => a.created_at.localeCompare(b.created_at));
    }
    return m;
  }, [gruposQuadro, items, quadroAgrupar]);

  function novaTarefa(status: StatusTarefa) {
    setEditando(null);
    setStatusNovo(status);
    setModalOpen(true);
  }

  function abrirNotif(n: GestaoNotificacao) {
    if (n.id_quadro) setQuadroId(n.id_quadro);
    if (n.id_tarefa) {
      const t = items.find((x) => x.id_tarefa === n.id_tarefa);
      if (t) { setEditando(t); setModalOpen(true); }
    }
  }

  function soltar(targetStatus: StatusTarefa, beforeId?: string) {
    setColHover(null);
    setDropAlvo(null);
    const dragged = items.find((t) => t.id_tarefa === dragId);
    setDragId(null);
    if (!dragged || !podeEditar) return;
    const rest = items.filter((t) => t.id_tarefa !== dragId);
    const col = rest.filter((t) => t.status === targetStatus).sort((a, b) => a.ordem - b.ordem);
    const fora = rest.filter((t) => t.status !== targetStatus);
    let idx = col.length;
    if (beforeId && beforeId !== dragId) {
      const i = col.findIndex((t) => t.id_tarefa === beforeId);
      if (i >= 0) idx = i;
    }
    col.splice(idx, 0, { ...dragged, status: targetStatus });
    const reindex = col.map((t, i) => ({ ...t, ordem: i }));
    setItems([...fora, ...reindex]);
    reordenar.mutate(reindex.map((t) => ({ id_tarefa: t.id_tarefa, status: targetStatus, ordem: t.ordem })));
    if (dragged.status !== targetStatus) {
      runAuto({ gatilho: "status_muda", tarefa: { ...dragged, status: targetStatus }, de: dragged.status, para: targetStatus });
    }
  }

  // Soltar num grupo: por status reaproveita soltar(); nos demais, define o campo do grupo.
  function soltarGrupo(chave: string, beforeId?: string) {
    if (quadroAgrupar === "status") { soltar(chave, beforeId); return; }
    setColHover(null);
    const dragged = items.find((t) => t.id_tarefa === dragId);
    setDragId(null);
    if (!dragged || !podeEditar) return;
    const base = { id_tarefa: dragged.id_tarefa, id_quadro: dragged.id_quadro };
    if (quadroAgrupar === "prioridade") {
      const prio = chave as PrioridadeTarefa;
      setItems((arr) => arr.map((t) => (t.id_tarefa === dragged.id_tarefa ? { ...t, prioridade: prio } : t)));
      salvar.mutate({ ...base, prioridade: prio });
    } else if (quadroAgrupar === "responsavel") {
      const novo = chave === "__none__" ? null : chave;
      setItems((arr) => arr.map((t) => (t.id_tarefa === dragged.id_tarefa ? { ...t, responsavel: novo } : t)));
      salvar.mutate({ ...base, responsavel: novo });
    }
  }

  // Ações em massa
  const limparSel = () => { setSelecionados(new Set()); setSelecaoModo(false); };
  const toggleSel = (id: string) => setSelecionados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const aplicarMassa = (patch: Partial<GestaoTarefa>) => acaoMassa.mutate({ ids: [...selecionados], patch }, { onSuccess: limparSel });
  function aplicarEtiquetaMassa(nome: string) {
    const alvo = items.filter((t) => selecionados.has(t.id_tarefa));
    Promise.all(alvo.map((t) => salvar.mutateAsync({ id_tarefa: t.id_tarefa, id_quadro: t.id_quadro, etiquetas: [...new Set([...(t.etiquetas ?? []), nome])] }))).then(limparSel).catch(() => {});
  }
  async function excluirMassa() {
    if (await confirmar({ title: `Excluir ${selecionados.size} tarefa(s)?`, description: "Esta ação não pode ser desfeita." })) acaoMassa.mutate({ ids: [...selecionados], excluir: true }, { onSuccess: limparSel });
  }

  return (
    <div className="min-h-screen bg-[#f6f5f2]">
      {/* Menu lateral fixo (verde, igual ao app) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex print:hidden" style={{ background: "linear-gradient(180deg, #0369a1 0%, #112a1a 60%, #0d2016 100%)" }}>
        <Link href="/visao-geral" className="flex items-center gap-2.5 border-b border-white/[0.09] px-4 py-3.5 transition-colors hover:bg-white/[0.05]">
          {configs?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={configs.logo_url} alt="Logo JCN Consultoria" className="h-8 w-auto max-w-[36px] shrink-0 rounded-md bg-white object-contain p-0.5 shadow" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-verde-primary text-white shadow"><KanbanSquare className="size-4" /></span>
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-bold tracking-tight text-white">Gestão JCN Consultoria</p>
            <p className="inline-flex items-center gap-1 text-[10px] tracking-wide text-white/50"><ArrowLeft className="size-3" /> Visão geral</p>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">Espaços</p>
          <GestaoSidebar espacos={espacos} pastas={pastas} quadros={quadros} quadroId={minhasView || painelView || inboxView ? null : (quadro?.id_quadro ?? null)} onSelect={(id) => { setQuadroId(id); setMinhasView(false); setPainelView(false); setInboxView(false); }} podeEditar={podeEditarGlobal} minhasAtivo={minhasView} onMinhas={() => { setMinhasView(true); setPainelView(false); setInboxView(false); }} painelAtivo={painelView} onPainel={() => { setPainelView(true); setMinhasView(false); setInboxView(false); }} inboxAtivo={inboxView} onInbox={() => { setInboxView(true); setMinhasView(false); setPainelView(false); }} inboxCount={inboxCount} />
        </div>
      </aside>

      {/* Conteúdo: desloca pela sidebar e ocupa toda a largura restante */}
      <div className="lg:pl-64">
        <div className="px-5 py-7 sm:px-8">
          {!online && (
            <div className="fixed inset-x-0 top-0 z-[60] bg-amber-500 px-3 py-1.5 text-center text-sm font-medium text-white shadow-md">
              Sem conexão — as alterações podem não ser salvas até reconectar.
            </div>
          )}
          <Link href="/visao-geral" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 lg:hidden">
            <ArrowLeft className="size-4" /> Visão geral
          </Link>

        {inboxView ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-verde-light text-verde-primary"><Inbox className="size-6" /></span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Caixa de entrada</h1>
                <p className="text-sm text-gray-500">Notificações e tarefas que precisam de você</p>
              </div>
            </div>
            <CaixaEntrada
              notificacoes={notificacoes}
              tarefas={minhas}
              quadros={quadros}
              statusMap={statusGlobalMap}
              onAbrirNotif={(n) => { marcarLida.mutate({ id: n.id }); if (n.id_quadro) setQuadroId(n.id_quadro); setInboxView(false); const t = n.id_tarefa ? minhas.find((x) => x.id_tarefa === n.id_tarefa) : undefined; if (t) { setEditando(t); setModalOpen(true); } }}
              onMarcarLida={(id) => marcarLida.mutate({ id })}
              onMarcarTodas={() => marcarLida.mutate({ todas: true })}
              onAbrirTarefa={(t) => { setQuadroId(t.id_quadro); setInboxView(false); setEditando(t); setModalOpen(true); }}
            />
          </div>
        ) : minhasView ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-verde-light text-verde-primary"><CircleUser className="size-6" /></span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Minhas tarefas</h1>
                <p className="text-sm text-gray-500">{minhas.length} tarefa(s) em todos os quadros</p>
              </div>
            </div>
            <MinhasTarefas tarefas={minhas} quadros={quadros} statusMap={statusGlobalMap} onAbrir={(t) => { setQuadroId(t.id_quadro); setMinhasView(false); setEditando(t); setModalOpen(true); }} />
          </div>
        ) : painelView ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-verde-light text-verde-primary"><BarChart3 className="size-6" /></span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Painel{quadro ? ` — ${quadro.nome}` : ""}</h1>
                <p className="text-sm text-gray-500">Métricas da lista selecionada</p>
              </div>
            </div>
            <PainelGestao tarefas={items} statuses={statuses} tempoPorTarefa={tempoPorTarefa} />
          </div>
        ) : (
        <>
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-verde-light text-verde-primary">
            <KanbanSquare className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quadro?.nome ?? "Gestão JCN Consultoria"}</h1>
            <p className="text-sm text-gray-500">{items.length} tarefa(s) nesta lista</p>
          </div>
        </div>

        {/* Seletor de lista (mobile, já que a árvore fica oculta em telas pequenas) */}
        <div className="mt-4 lg:hidden">
          <select value={quadro?.id_quadro ?? ""} onChange={(e) => setQuadroId(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            {quadros.map((q) => <option key={q.id_quadro} value={q.id_quadro}>{q.nome}</option>)}
          </select>
        </div>

        {/* Barra de ferramentas: busca + filtros + ações, tudo agrupado */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {podeEditar && (
            <button type="button" onClick={() => novaTarefa(statusInicialSlug)} className="inline-flex items-center gap-2 rounded-lg bg-verde-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent active:scale-95">
              <Plus className="size-4" /> Nova tarefa
            </button>
          )}
          <NotificacoesSino onAbrir={abrirNotif} />
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tarefa…" className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-verde-primary focus:outline-none" />
          </div>
          <FiltrosPanel filtros={filtros} onChange={setFiltros} statuses={statuses} etiquetas={etiquetasCat} usuarios={usuarios} idQuadro={quadro?.id_quadro ?? ""} />
          {user?.nome && (
            <button type="button" onClick={() => setSoMinhas((v) => !v)} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${soMinhas ? "bg-verde-primary text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
              Minhas
            </button>
          )}
          {temFiltro && (
            <button type="button" onClick={() => { setBusca(""); setFiltros(FILTRO_VAZIO); setSoMinhas(false); }} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
              <X className="size-4" /> Limpar
            </button>
          )}
          {podeEditar && (
            <div className="relative">
              <button type="button" onClick={() => setConfigOpen((v) => !v)} title="Configurar quadro" className="relative z-40 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <Settings className="size-4" /> Configurar <ChevronDown className="size-3.5 text-gray-400" />
              </button>
              {configOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setConfigOpen(false)} />
                  <div className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button type="button" onClick={() => { setConfigOpen(false); setManagerOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><SlidersHorizontal className="size-4 text-gray-400" /> Status</button>
                    <button type="button" onClick={() => { setConfigOpen(false); setCamposOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Tags className="size-4 text-gray-400" /> Campos personalizados</button>
                    <button type="button" onClick={() => { setConfigOpen(false); setEtiquetasOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Tag className="size-4 text-gray-400" /> Etiquetas</button>
                    <button type="button" onClick={() => { setConfigOpen(false); setAutoOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Zap className="size-4 text-gray-400" /> Automações</button>
                    <button type="button" onClick={() => { setConfigOpen(false); setFormulariosOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><FileText className="size-4 text-gray-400" /> Formulários</button>
                    <button type="button" onClick={() => { setConfigOpen(false); setCalendarioOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><CalendarDays className="size-4 text-gray-400" /> Assinar calendário</button>
                    <button type="button" onClick={() => { setConfigOpen(false); setCompartilharOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Lock className="size-4 text-gray-400" /> Compartilhar / acesso</button>
                    <button type="button" onClick={() => { setConfigOpen(false); setRelatorioOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Clock className="size-4 text-gray-400" /> Relatório de tempo</button>
                  </div>
                </>
              )}
            </div>
          )}
          {podeEditar && vista === "quadro" && (
            <button type="button" onClick={() => { if (selecaoModo) limparSel(); else setSelecaoModo(true); }} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-sm font-medium ${selecaoModo ? "border-verde-primary bg-verde-light/60 text-verde-primary" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
              <CheckSquare className="size-4" /> {selecaoModo ? "Cancelar" : "Selecionar"}
            </button>
          )}
        </div>

        {/* Modo de exibição (abaixo da busca) + agrupar */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-white p-0.5 text-sm font-medium">
            {VISTAS.map((v) => {
              const Icon = v.icon;
              return (
                <button key={v.value} type="button" onClick={() => mudarVista(v.value)} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${vista === v.value ? "bg-verde-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                  <Icon className="size-4" /> {v.label}
                </button>
              );
            })}
          </div>
          {vista === "quadro" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-gray-500">Agrupar:</span>
              {([["status", "Status"], ["responsavel", "Responsável"], ["prioridade", "Prioridade"], ["etiqueta", "Etiqueta"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setQuadroAgrupar(v)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${quadroAgrupar === v ? "bg-verde-primary text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        {(loadingQuadros || loadingTarefas || loadingStatus) ? (
          <div className="mt-5 flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-72 shrink-0 rounded-xl border border-gray-200 bg-gray-50/60 p-2.5">
                <div className="mb-3 h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="space-y-2">
                  <div className="h-16 animate-pulse rounded-lg bg-white" />
                  <div className="h-16 animate-pulse rounded-lg bg-white" />
                </div>
              </div>
            ))}
          </div>
        ) : vista === "quadro" ? (
          <div className="relative mt-5">
          {boardScrolled && <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-[#f6f5f2] to-transparent" />}
          <div className="flex gap-3 overflow-x-auto pb-2" onScroll={(e) => { const s = e.currentTarget.scrollLeft > 4; setBoardScrolled((p) => (p !== s ? s : p)); }}>
            {gruposQuadro.map((col) => {
              const todas = porGrupo[col.slug] ?? [];
              const lista = todas.filter(passaFiltro);
              const atrasadasCol = todas.filter((t) => t.prazo && diasAte(t.prazo) < 0 && statusMap.get(t.status)?.tipo !== "concluido").length;
              const tempoCol = todas.reduce((s, t) => s + (tempoPorTarefa.get(t.id_tarefa) ?? 0), 0);
              return (
                <div
                  key={col.slug}
                  onDragOver={(e) => { if (dragId) { e.preventDefault(); setColHover(col.slug); setDropAlvo({ col: col.slug, beforeId: null }); } }}
                  onDragLeave={(e) => { if (dragId && !e.currentTarget.contains(e.relatedTarget as Node)) setColHover((c) => (c === col.slug ? null : c)); }}
                  onDrop={() => soltarGrupo(col.slug)}
                  className={`flex w-72 shrink-0 flex-col rounded-xl border bg-gray-50/60 p-2.5 transition ${colHover === col.slug ? "border-verde-primary ring-2 ring-verde-primary/20" : "border-gray-200"}`}
                  style={{ minHeight: "calc(100vh - 15rem)" }}
                >
                  <div className="mb-2 flex items-center justify-between px-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: col.cor }} />
                      <p className="text-sm font-semibold text-gray-700">{col.nome}</p>
                      <span className="rounded-full bg-gray-200 px-1.5 text-[11px] font-semibold text-gray-600">{temFiltro ? `${lista.length}/${todas.length}` : todas.length}</span>
                      {atrasadasCol > 0 && <span className="rounded-full bg-red-50 px-1.5 text-[11px] font-semibold text-red-600" title="Atrasadas">{atrasadasCol} atras.</span>}
                      {tempoCol > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-400" title="Tempo total"><Clock className="size-3" />{formatarDuracao(tempoCol)}</span>}
                    </div>
                    {podeEditar && (
                      <button type="button" onClick={() => novaTarefa(quadroAgrupar === "status" ? col.slug : statusInicialSlug)} className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700" title="Nova tarefa aqui">
                        <Plus className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="min-h-[40px] flex-1 space-y-2">
                    {lista.map((t) => (
                      <div key={t.id_tarefa}>
                        {quadroAgrupar === "status" && dropAlvo?.col === col.slug && dropAlvo.beforeId === t.id_tarefa && dragId !== t.id_tarefa && (
                          <div className="mb-2 h-1 rounded-full bg-verde-primary/70" />
                        )}
                        <TarefaCard
                          t={t}
                          statusMap={statusMap}
                          etiquetaCor={etiquetaCor}
                          tempoSeg={tempoPorTarefa.get(t.id_tarefa) ?? 0}
                          anexos={anexosCount.get(t.id_tarefa) ?? 0}
                          campos={campos}
                          arrastavel={podeEditar && quadroAgrupar !== "etiqueta"}
                          arrastando={dragId === t.id_tarefa}
                          selecionavel={selecaoModo}
                          selecionado={selecionados.has(t.id_tarefa)}
                          onToggleSel={() => toggleSel(t.id_tarefa)}
                          onAbrir={() => { setEditando(t); setModalOpen(true); }}
                          onDragStart={() => setDragId(t.id_tarefa)}
                          onDragEnd={() => { setDragId(null); setColHover(null); setDropAlvo(null); }}
                          onDragOver={(e) => { if (dragId) { e.preventDefault(); e.stopPropagation(); setColHover(col.slug); setDropAlvo({ col: col.slug, beforeId: t.id_tarefa }); } }}
                          onDrop={(e) => { e.stopPropagation(); soltarGrupo(col.slug, t.id_tarefa); }}
                        />
                      </div>
                    ))}
                    {quadroAgrupar === "status" && dropAlvo?.col === col.slug && dropAlvo.beforeId === null && dragId && (
                      <div className="h-1 rounded-full bg-verde-primary/70" />
                    )}
                    {lista.length === 0 && (
                      <div className="rounded-lg border border-dashed border-gray-200 px-2 py-6 text-center text-xs text-gray-300">{todas.length > 0 ? "Nada no filtro" : "Sem tarefas"}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#f6f5f2] to-transparent" />
          </div>
        ) : vista === "lista" ? (
          <VistaLista
            tarefas={items.filter(passaFiltro)}
            statuses={statuses}
            campos={campos}
            agruparPor={agruparPor}
            onAgruparPor={mudarAgrupar}
            podeEditar={podeEditar}
            onAbrir={(t) => { setEditando(t); setModalOpen(true); }}
            aoMudarStatus={(t, de, para) => runAuto({ gatilho: "status_muda", tarefa: { ...t, status: para }, de, para })}
          />
        ) : vista === "calendario" ? (
          <VistaCalendario
            tarefas={items.filter(passaFiltro)}
            statuses={statuses}
            podeEditar={podeEditar}
            onAbrir={(t) => { setEditando(t); setModalOpen(true); }}
          />
        ) : (
          <VistaTimeline
            tarefas={items.filter(passaFiltro)}
            statuses={statuses}
            dependencias={dependencias}
            onAbrir={(t) => { setEditando(t); setModalOpen(true); }}
          />
        )}

        {podeEditar && vista === "quadro" && (
          <p className="mt-3 text-center text-xs text-gray-400">
            {quadroAgrupar === "etiqueta"
              ? "Agrupado por etiqueta — arraste desabilitado neste modo."
              : `Arraste os cards entre as colunas para mudar ${quadroAgrupar === "responsavel" ? "o responsável" : quadroAgrupar === "prioridade" ? "a prioridade" : "o status"}.`}
          </p>
        )}
        </>
        )}
        </div>
      </div>

      {quadro && (
        <TarefaModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          idQuadro={quadro.id_quadro}
          tarefa={editando}
          statusInicial={statusNovo}
          statuses={statuses}
          campos={campos}
          tarefasQuadro={items}
          podeEditar={podeEditar}
          etiquetasSugeridas={etiquetasSugeridas}
          aoAutomatizar={runAuto}
        />
      )}

      {quadro && (
        <StatusManagerModal
          open={managerOpen}
          onClose={() => setManagerOpen(false)}
          idQuadro={quadro.id_quadro}
          statuses={statuses}
          podeEditar={podeEditar}
        />
      )}

      {quadro && (
        <CamposManagerModal
          open={camposOpen}
          onClose={() => setCamposOpen(false)}
          idQuadro={quadro.id_quadro}
          campos={campos}
          podeEditar={podeEditar}
        />
      )}

      {quadro && (
        <AutomacoesManagerModal
          open={autoOpen}
          onClose={() => setAutoOpen(false)}
          idQuadro={quadro.id_quadro}
          statuses={statuses}
          campos={campos}
          podeEditar={podeEditar}
        />
      )}

      <TempoRelatorioModal open={relatorioOpen} onClose={() => setRelatorioOpen(false)} entries={tempoEntries} />

      {quadro && (
        <EtiquetasManagerModal
          open={etiquetasOpen}
          onClose={() => setEtiquetasOpen(false)}
          idQuadro={quadro.id_quadro}
          etiquetas={etiquetasCat}
          podeEditar={podeEditar}
        />
      )}

      {quadro && (
        <FormulariosManagerModal
          open={formulariosOpen}
          onClose={() => setFormulariosOpen(false)}
          idQuadro={quadro.id_quadro}
          statuses={statuses}
          etiquetas={etiquetasCat}
          usuarios={usuarios}
          podeEditar={podeEditar}
        />
      )}

      {quadro && (
        <CalendarioModal
          open={calendarioOpen}
          onClose={() => setCalendarioOpen(false)}
          quadro={quadro}
          podeEditar={podeEditar}
        />
      )}

      {quadro && (
        <CompartilharModal
          open={compartilharOpen}
          onClose={() => setCompartilharOpen(false)}
          quadro={quadro}
          podeEditar={podeEditar}
        />
      )}

      {selecaoModo && selecionados.size > 0 && (
        <BarraAcoesMassa
          count={selecionados.size}
          statuses={statuses}
          usuarios={usuarios}
          etiquetas={etiquetasCat}
          onStatus={(slug) => aplicarMassa({ status: slug })}
          onResponsavel={(nome) => aplicarMassa({ responsavel: nome })}
          onPrioridade={(p) => aplicarMassa({ prioridade: p as PrioridadeTarefa })}
          onEtiqueta={aplicarEtiquetaMassa}
          onExcluir={excluirMassa}
          onCancelar={limparSel}
        />
      )}

      <ConfirmHost />
    </div>
  );
}
