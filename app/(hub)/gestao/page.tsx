"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, KanbanSquare, Menu as MenuIcon, Plus, Search, X, LayoutList, CalendarDays, GanttChartSquare, SlidersHorizontal, Tags, Tag, Zap, Settings, ChevronDown, Clock, CheckSquare, CheckCheck, BarChart3, FileText, Bell, Trash2, Users, UserSquare, ListChecks } from "lucide-react";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import {
  useQuadros, useTarefas, useReordenar, useUsuariosLista, useSalvarTarefa, useAcaoMassa,
  useMinhasTarefas, useTodosStatus, useNotificacoes, useMarcarLida, useLimparNotificacoes,
  usePreferenciaVisao, useSalvarPreferenciaVisao,
  useStatusQuadro, statusPadrao, useCamposQuadro, useEtiquetasQuadro,
  useEspacos, usePastas, useTodasDependencias, useAutomacaoTick, useTempoQuadro, useAnexosCountQuadro,
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
import ModelosManagerModal from "@/components/gestao/ModelosManagerModal";
import CalendarioModal from "@/components/gestao/CalendarioModal";
import MembrosModal from "@/components/gestao/MembrosModal";
import { useMeuPapelGestao, useMeuNivel, nivelPodeEditar, useColaboradores } from "@/lib/hooks/useGestaoAcesso";
import ColaboradoresView from "@/components/gestao/ColaboradoresView";
import TarefaCard from "@/components/gestao/TarefaCard";
import FiltrosPanel from "@/components/gestao/FiltrosPanel";
import MeuEspaco from "@/components/gestao/MeuEspaco";
import CaixaEntrada from "@/components/gestao/CaixaEntrada";
import PainelGestao from "@/components/gestao/PainelGestao";
import BarraAcoesMassa from "@/components/gestao/BarraAcoesMassa";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import VistaLista from "@/components/gestao/VistaLista";
import VistaCalendario from "@/components/gestao/VistaCalendario";
import VistaTimeline from "@/components/gestao/VistaTimeline";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";

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

export default function GestaoChabraPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const { data: meuPapelGestao, isFetched: papelGestaoFetched } = useMeuPapelGestao();
  const souGestor = meuPapelGestao === "owner" || meuPapelGestao === "admin";
  const { data: configs } = useConfiguracoes();
  const { data: quadros = [], isLoading: loadingQuadros } = useQuadros();
  const { data: espacos = [] } = useEspacos();
  const { data: pastas = [] } = usePastas();
  const { data: usuarios = [] } = useUsuariosLista();
  const reordenar = useReordenar();

  const [quadroId, setQuadroId] = useState<string | null>(null);
  const quadro = quadros.find((q) => q.id_quadro === quadroId) ?? quadros[0] ?? null;
  // Edição decidida pelo MESMO resolver do banco (v117: gestao_meu_nivel → view/comment/edit/full).
  // Fail-closed nos dois estados: sem quadro a query fica enabled:false e meuNivel = undefined;
  // enquanto não resolveu ou em erro, meuNivel = undefined. nivelPodeEditar(undefined) = false.
  // Sem `?? true`, sem `|| true`, sem atalho de perfil no cliente (o resolver já devolve `full`
  // para Admin/gestor server-side).
  const { data: meuNivel } = useMeuNivel("list", quadro?.id_quadro);
  const podeEditar = !!quadro && nivelPodeEditar(meuNivel);
  // Menu Configurar — itens sensíveis (Compartilhar, Assinar calendário, Automações) exigem
  // gestor do roster OU nível `full`; os demais itens seguem em podeEditar (decisão 5 da rubrica).
  const podeConfigurarAvancado = souGestor || meuNivel === "full";
  useEffect(() => {
    if (!quadroId && quadros.length) setQuadroId(quadros[0].id_quadro);
  }, [quadros, quadroId]);

  const { data: tarefas = [], isLoading: loadingTarefas } = useTarefas(quadro?.id_quadro);
  const { data: pref } = usePreferenciaVisao(quadro?.id_quadro);
  const salvarPref = useSalvarPreferenciaVisao();
  const { data: statusList = [], isLoading: loadingStatus } = useStatusQuadro(quadro?.id_quadro);
  const { data: campos = [] } = useCamposQuadro(quadro?.id_quadro);
  const { data: etiquetasCat = [] } = useEtiquetasQuadro(quadro?.id_quadro);
  useAutomacaoTick();  // fallback de agendamento sem pg_cron (.107): scan de prazos 1x/dia
  useEffect(() => {
    // F3.A: reflete tarefas com prazo na Agenda Google dos vinculados conectados. Best-effort ao
    // abrir a Gestão; dedup por minuto no server. Nunca derruba a página (fila drena na próxima).
    void fetch("/api/gestao/google/sync").catch(() => {});
  }, []);
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
  const [modelosOpen, setModelosOpen] = useState(false);
  const [calendarioOpen, setCalendarioOpen] = useState(false);
  const [membrosOpen, setMembrosOpen] = useState(false);
  const [quadroAgrupar, setQuadroAgrupar] = useState<"status" | "responsavel" | "prioridade" | "etiqueta">("status");
  const [online, setOnline] = useState(true);
  const [boardScrolled, setBoardScrolled] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [painelView, setPainelView] = useState(false);
  const [inboxView, setInboxView] = useState(false);
  // "Meu Espaço" (UX-C1): container pessoal, mutuamente exclusivo com as demais vistas
  // de topo (inbox/painel/quadro). Consolidou a antiga aba "Minhas tarefas" (removida no
  // ciclo 2) — é a única vista que exibe a agregação useMinhasTarefas (responsável+
  // seguidor). A UX-C(2) preenche este container com o quadro pessoal.
  const [meuEspacoView, setMeuEspacoView] = useState(false);
  // "Colaboradores" (v235): gestor/supervisor acompanham o Meu Quadro dos colaboradores. A entrada
  // só aparece quando o servidor devolve alguém (gestor: todos; supervisor: as equipes dele).
  const [colabView, setColabView] = useState(false);
  const { data: colaboradores = [] } = useColaboradores(!!user && user.perfil !== "Cliente");
  const mostrarColab = souGestor || colaboradores.length > 0;
  const [selecaoModo, setSelecaoModo] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const { data: minhas = [] } = useMinhasTarefas(meuEspacoView || inboxView);
  const { data: todosStatus = [] } = useTodosStatus(meuEspacoView || inboxView);
  const statusGlobalMap = useMemo(() => new Map(todosStatus.map((s) => [`${s.id_quadro}|${s.slug}`, s])), [todosStatus]);
  const { data: notificacoes = [] } = useNotificacoes();
  const marcarLida = useMarcarLida();
  const limparNotif = useLimparNotificacoes();
  const inboxCount = useMemo(() => notificacoes.filter((n) => !n.lida).length, [notificacoes]);

  // Altura das colunas do Quadro = o que sobra da tela abaixo da barra de ferramentas
  // (pedido do operador: a área de cards usa o espaço livre, com rolagem interna). Medido
  // no DOM porque a barra quebra linha em larguras menores e o topo do quadro muda.
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardTop, setBoardTop] = useState(0);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const medir = () => setBoardTop((prev) => { const v = Math.round(el.getBoundingClientRect().top + window.scrollY); return v !== prev ? v : prev; });
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", medir);
    return () => { ro?.disconnect(); window.removeEventListener("resize", medir); };
  }, [vista, inboxView, painelView, meuEspacoView, loadingQuadros, loadingTarefas, loadingStatus]);
  // 3.5rem = rodapé (dica "Arraste os cards" + pb-7); piso de 320px para telas baixas.
  const alturaColuna = boardTop > 0 ? `max(320px, calc(100vh - ${boardTop}px - 3.5rem))` : undefined;

  useEffect(() => {
    if (user?.perfil === "Cliente") { router.replace("/portal-cliente/inicio"); return; }
    // Portão de membership: quem não é membro da Gestão não entra. Só dispara quando a
    // query resolveu com NULL explícito (não-membro) — erro/loading mantém a guarda dormindo.
    if (papelGestaoFetched && meuPapelGestao === null && user) router.replace("/inicio");
  }, [user, user?.perfil, papelGestaoFetched, meuPapelGestao, router]);

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
  // Busca tolerante (acento, ordem das palavras, erro de digitação) sobre título,
  // descrição, responsável, etiquetas e campos do formulário. Resolvida uma vez
  // aqui e consultada por id no predicado, que roda coluna a coluna no quadro.
  const { idsDaBusca, buscaAproximada } = useMemo(() => {
    if (!busca.trim()) return { idsDaBusca: null, buscaAproximada: false };
    const r = buscar(items, busca, (t) => [
      t.titulo,
      t.descricao,
      t.responsavel,
      ...(t.etiquetas ?? []),
      ...Object.values(t.campos ?? {}).map((v) => (Array.isArray(v) ? v.join(" ") : v == null ? "" : String(v))),
    ]);
    return { idsDaBusca: new Set(r.itens.map((t) => t.id_tarefa)), buscaAproximada: r.aproximado };
  }, [items, busca]);
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
    if (idsDaBusca && !idsDaBusca.has(t.id_tarefa)) return false;
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

  /**
   * A árvore de Espaços/pastas/Inbox, desenhada uma vez e montada em dois
   * lugares: a barra do desktop e a gaveta do celular. `aoNavegar` fecha a
   * gaveta ao escolher uma lista.
   */
  const menuLateral = (aoNavegar: () => void) => (
    <>
      <Link href="/inicio" className="flex items-center gap-2.5 border-b border-white/[0.09] px-4 py-3.5 transition-colors hover:bg-white/[0.05]">
        {configs?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={configs.logo_url} alt="Logo JCN Consultoria" className="force-light h-8 w-auto max-w-[36px] shrink-0 rounded-md bg-white object-contain p-0.5 shadow" referrerPolicy="no-referrer" onError={(e) => { const img = e.currentTarget as HTMLImageElement; if (!img.src.endsWith("/logo-jcn.svg")) img.src = "/logo-jcn.svg"; }} />
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
        <GestaoSidebar espacos={espacos} pastas={pastas} quadros={quadros} quadroId={painelView || inboxView || meuEspacoView || colabView ? null : (quadro?.id_quadro ?? null)} onSelect={(id) => { setQuadroId(id); setPainelView(false); setInboxView(false); setMeuEspacoView(false); setColabView(false); aoNavegar(); }} podeEditar={souGestor} meuEspacoAtivo={meuEspacoView} onMeuEspaco={() => { setMeuEspacoView(true); setPainelView(false); setInboxView(false); setColabView(false); aoNavegar(); }} painelAtivo={painelView} onPainel={() => { setPainelView(true); setInboxView(false); setMeuEspacoView(false); setColabView(false); aoNavegar(); }} inboxAtivo={inboxView} onInbox={() => { setInboxView(true); setPainelView(false); setMeuEspacoView(false); setColabView(false); aoNavegar(); }} inboxCount={inboxCount} mostrarColab={mostrarColab} colabAtivo={colabView} onColab={() => { setColabView(true); setPainelView(false); setInboxView(false); setMeuEspacoView(false); aoNavegar(); }} />
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Hambúrguer (celular): abaixo de 768px a árvore some, e sem ele
          Espaços, pastas e Inbox ficavam inalcançáveis. */}
      <button
        type="button"
        onClick={() => setMenuAberto(true)}
        aria-label="Abrir listas"
        className="fixed left-3 top-3 z-30 flex size-10 items-center justify-center rounded-md text-white shadow md:hidden print:hidden"
        style={{ background: "linear-gradient(180deg, #0369a1 0%, #112a1a 60%, #0d2016 100%)" }}
      >
        <MenuIcon className="size-5" />
      </button>

      {/* Menu lateral fixo (verde, igual ao app). `md:flex` + 220px: o resto do
          painel abre a barra a partir de 768px e esta abria só em 1024px —
          entre os dois números a /gestao ficava sem navegação nenhuma. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col md:flex print:hidden" style={{ background: "linear-gradient(180deg, #0369a1 0%, #112a1a 60%, #0d2016 100%)" }}>
        {menuLateral(() => {})}
      </aside>

      {/* Gaveta do celular */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMenuAberto(false)}>
          <aside
            className="absolute inset-y-0 left-0 flex w-[248px] flex-col shadow-2xl"
            style={{ background: "linear-gradient(180deg, #0369a1 0%, #112a1a 60%, #0d2016 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar listas"
              className="absolute right-2 top-2 z-10 rounded p-1 text-white/70 hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
            {menuLateral(() => setMenuAberto(false))}
          </aside>
        </div>
      )}

      {/* Conteúdo: desloca pela sidebar e ocupa toda a largura restante */}
      <div className="md:pl-[220px] print:pl-0">
        {/* `pt-16` abaixo de 768px é o espaço do hambúrguer, que é fixo. */}
        <div className="px-5 pb-7 pt-16 sm:px-8 md:pt-7">
          {!online && (
            <div className="fixed inset-x-0 top-0 z-[60] bg-amber-500 px-3 py-1.5 text-center text-sm font-medium text-white shadow-md">
              Sem conexão — as alterações podem não ser salvas até reconectar.
            </div>
          )}
          <Link href="/inicio" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 md:hidden">
            <ArrowLeft className="size-4" /> Visão geral
          </Link>

        {inboxView ? (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-verde-light text-verde-primary"><Bell className="size-6" /></span>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
                <p className="text-sm text-gray-500">Avisos, aprovações e tarefas que precisam de você</p>
              </div>
              {/* Ações globais da caixa: "marcar todas" só faz sentido com não lidas; "limpar"
                  apaga TODAS as minhas (lidas e não lidas) — por isso confirma antes. */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={inboxCount === 0 || marcarLida.isPending}
                  onClick={() => marcarLida.mutate({ todas: true })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCheck className="size-4" /> Marcar todas como lidas
                </button>
                <button
                  type="button"
                  disabled={notificacoes.length === 0 || limparNotif.isPending}
                  onClick={async () => {
                    if (await confirmar({ title: "Limpar todas as notificações?", description: `As ${notificacoes.length} notificações (lidas e não lidas) serão apagadas. Aprovações pendentes e prazos continuam aparecendo.`, confirmLabel: "Limpar", variant: "danger" })) {
                      limparNotif.mutate(undefined, {
                        onSuccess: () => toast.success("Notificações limpas."),
                        onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível limpar as notificações."),
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="size-4" /> Limpar notificações
                </button>
              </div>
            </div>
            <CaixaEntrada
              notificacoes={notificacoes}
              tarefas={minhas}
              quadros={quadros}
              statusMap={statusGlobalMap}
              onAbrirNotif={(n) => { if (!n.lida) marcarLida.mutate({ id: n.id }); if (n.id_quadro) setQuadroId(n.id_quadro); setInboxView(false); const t = n.id_tarefa ? minhas.find((x) => x.id_tarefa === n.id_tarefa) : undefined; if (t) { setEditando(t); setModalOpen(true); } }}
              onMarcarLida={(id) => marcarLida.mutate({ id })}
              onAbrirTarefa={(t) => { setQuadroId(t.id_quadro); setInboxView(false); setEditando(t); setModalOpen(true); }}
            />
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
        ) : colabView ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-verde-light text-verde-primary"><Users className="size-6" /></span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Colaboradores</h1>
                <p className="text-sm text-gray-500">Acompanhe o Meu Quadro de cada colaborador — {colaboradores.length} visíve{colaboradores.length === 1 ? "l" : "is"}</p>
              </div>
            </div>
            <ColaboradoresView onAbrirQuadro={(id) => { setQuadroId(id); setColabView(false); }} />
          </div>
        ) : meuEspacoView ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-verde-light text-verde-primary"><UserSquare className="size-6" /></span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Meu Espaço</h1>
                <p className="text-sm text-gray-500">Tarefas em que sou responsável ou seguidor — {minhas.length} em todos os quadros</p>
              </div>
            </div>
            {/* UX-C1: vista agregada. O container MeuEspaco reserva o ponto de extensão
                para o quadro pessoal (UX-C2), sem construí-lo aqui. */}
            <MeuEspaco tarefas={minhas} quadros={quadros} statusMap={statusGlobalMap} souGestor={souGestor} onAbrir={(t) => { setQuadroId(t.id_quadro); setMeuEspacoView(false); setEditando(t); setModalOpen(true); }} onAbrirQuadro={(id) => { setQuadroId(id); setMeuEspacoView(false); }} />
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
        <div className="mt-4 md:hidden">
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
          {souGestor && (
            <button type="button" onClick={() => setMembrosOpen(true)} title="Membros e acessos da Gestão — quem vê cada quadro" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Users className="size-4" /> Membros e acessos
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
                    {podeConfigurarAvancado && (
                      <button type="button" onClick={() => { setConfigOpen(false); setAutoOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Zap className="size-4 text-gray-400" /> Automações</button>
                    )}
                    <button type="button" onClick={() => { setConfigOpen(false); setFormulariosOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><FileText className="size-4 text-gray-400" /> Formulários</button>
                    {podeConfigurarAvancado && (
                      <button type="button" onClick={() => { setConfigOpen(false); setModelosOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><ListChecks className="size-4 text-gray-400" /> Modelos de checklist</button>
                    )}
                    {podeConfigurarAvancado && (
                      <button type="button" onClick={() => { setConfigOpen(false); setCalendarioOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><CalendarDays className="size-4 text-gray-400" /> Assinar calendário</button>
                    )}
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

        <AvisoBuscaAproximada
          aproximado={buscaAproximada}
          busca={busca}
          total={idsDaBusca?.size ?? 0}
          className="mt-4"
        />

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
          <div ref={boardRef} className="relative mt-5">
          {boardScrolled && <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-[var(--esteira-fade)] to-transparent" />}
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
                  /* Altura = o que sobra da tela (alturaColuna, medida no DOM) e a
                     lista de cards rola por dentro — o quadro cabe na tela e as
                     colunas param no rodapé. Sem a medida (1º paint), cai no
                     `min-h` e na altura da coluna mais alta, como antes. */
                  style={alturaColuna ? { height: alturaColuna } : undefined}
                  className={`flex min-h-[220px] w-72 shrink-0 flex-col rounded-xl border bg-gray-50/60 p-2.5 transition ${colHover === col.slug ? "border-verde-primary ring-2 ring-verde-primary/20" : "border-gray-200"}`}
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

                  <div className="min-h-[40px] flex-1 space-y-2 overflow-y-auto overscroll-contain p-0.5">
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
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--esteira-fade)] to-transparent" />
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
        <ModelosManagerModal
          open={modelosOpen}
          onClose={() => setModelosOpen(false)}
          idQuadro={quadro.id_quadro}
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

      <MembrosModal open={membrosOpen} onClose={() => setMembrosOpen(false)} />

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
