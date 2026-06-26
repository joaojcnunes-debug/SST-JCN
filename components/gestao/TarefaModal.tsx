"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Trash2, Loader2, Plus, Square, CheckSquare, X, Send, ArrowRight, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import MultiChipInput from "@/components/ui/MultiChipInput";
import { useUserStore } from "@/lib/store";
import {
  useSalvarTarefa, useExcluirTarefa, useUsuariosLista,
  useComentarios, useAddComentario, useExcluirComentario,
  useDependencias, useAddDependencia, useExcluirDependencia,
  useUsuarios, useCriarNotificacao, detectarMencoes, gerarIaGestao, useRegistrarAtividade,
  iniciais, corAvatar,
  PRIORIDADES,
  type GestaoTarefa, type StatusTarefa, type PrioridadeTarefa, type Subtarefa, type GestaoStatus, type GestaoCampo,
} from "@/lib/hooks/useGestao";
import CampoInput from "@/components/gestao/CampoInput";
import TempoTracker from "@/components/gestao/TempoTracker";
import AnexosTarefa from "@/components/gestao/AnexosTarefa";
import HistoricoTarefa from "@/components/gestao/HistoricoTarefa";
import { confirmar } from "@/components/ui/confirm";

function quando(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Secao({ titulo, badge, defaultOpen = false, children }: { titulo: string; badge?: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);
  const primeiro = useRef(true);
  useEffect(() => {
    if (primeiro.current) { primeiro.current = false; return; }
    if (open) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open]);
  return (
    <div ref={ref} className="rounded-lg border border-gray-200">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
        <span className="flex items-center gap-2">
          {titulo}
          {badge != null && badge > 0 && <span className="rounded-full bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-500">{badge}</span>}
        </span>
        {open ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 p-3">{children}</div>}
    </div>
  );
}

export default function TarefaModal({
  open,
  onClose,
  idQuadro,
  tarefa,
  statusInicial = "A_FAZER",
  statuses,
  campos,
  tarefasQuadro,
  podeEditar,
  etiquetasSugeridas = [],
  aoAutomatizar,
}: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  tarefa: GestaoTarefa | null;
  statusInicial?: StatusTarefa;
  statuses: GestaoStatus[];
  campos: GestaoCampo[];
  tarefasQuadro: GestaoTarefa[];
  podeEditar: boolean;
  etiquetasSugeridas?: string[];
  aoAutomatizar?: (ctx: { gatilho: "status_muda" | "tarefa_criada"; tarefa: GestaoTarefa; de?: string; para?: string }) => void;
}) {
  const salvar = useSalvarTarefa();
  const excluir = useExcluirTarefa();
  const { data: usuarios = [] } = useUsuariosLista();
  const userNome = useUserStore((s) => s.user?.nome ?? null);
  const userEmail = useUserStore((s) => s.user?.email ?? null);
  const { data: usuariosFull = [] } = useUsuarios();
  const criarNotif = useCriarNotificacao();
  const registrarAtiv = useRegistrarAtividade();
  const emailDe = (nome: string | null) => (nome ? usuariosFull.find((u) => u.nome === nome)?.email ?? null : null);
  const { data: comentarios = [] } = useComentarios(tarefa?.id_tarefa);
  const addComentario = useAddComentario();
  const excluirComentario = useExcluirComentario();
  const [novoComentario, setNovoComentario] = useState("");
  const { data: deps } = useDependencias(tarefa?.id_tarefa);
  const addDep = useAddDependencia();
  const excluirDep = useExcluirDependencia();
  const tarefaMap = useMemo(() => new Map(tarefasQuadro.map((t) => [t.id_tarefa, t])), [tarefasQuadro]);
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.slug, s])), [statuses]);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>("Media");
  const [prazo, setPrazo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [status, setStatus] = useState<StatusTarefa>(statusInicial);
  const [recTipo, setRecTipo] = useState<"" | "diaria" | "semanal" | "mensal">("");
  const [recInt, setRecInt] = useState(1);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [pontos, setPontos] = useState("");
  const [subtarefas, setSubtarefas] = useState<Subtarefa[]>([]);
  const [novaSub, setNovaSub] = useState("");
  const [valoresCampos, setValoresCampos] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!open) return;
    setTitulo(tarefa?.titulo ?? "");
    setDescricao(tarefa?.descricao ?? "");
    setResponsavel(tarefa?.responsavel ?? "");
    setPrioridade(tarefa?.prioridade ?? "Media");
    setPrazo(tarefa?.prazo ?? "");
    setDataInicio(tarefa?.data_inicio ?? "");
    setStatus(tarefa?.status ?? statusInicial);
    setRecTipo(tarefa?.recorrencia?.tipo ?? "");
    setRecInt(tarefa?.recorrencia?.intervalo ?? 1);
    setEtiquetas(tarefa?.etiquetas ?? []);
    setPontos(tarefa?.pontos != null ? String(tarefa.pontos) : "");
    setSubtarefas(tarefa?.subtarefas ?? []);
    setNovaSub("");
    setValoresCampos((tarefa?.campos as Record<string, unknown>) ?? {});
  }, [open, tarefa, statusInicial]);

  const ro = !podeEditar;

  const [iaLoad, setIaLoad] = useState<"sub" | "desc" | null>(null);
  async function iaDescricao() {
    if (!titulo.trim()) { toast.error("Informe o título primeiro."); return; }
    setIaLoad("desc");
    try {
      const d = await gerarIaGestao({ acao: "descricao", titulo: titulo.trim(), descricao });
      if (d.descricao) { setDescricao((prev) => (prev.trim() ? `${prev}\n\n${d.descricao}` : d.descricao!)); toast.success("Descrição sugerida pela IA"); }
      else toast.error("A IA não retornou uma descrição.");
    } catch { toast.error("IA indisponível no momento."); } finally { setIaLoad(null); }
  }
  async function iaSubtarefas() {
    if (!titulo.trim()) { toast.error("Informe o título primeiro."); return; }
    setIaLoad("sub");
    try {
      const d = await gerarIaGestao({ acao: "subtarefas", titulo: titulo.trim(), descricao });
      const novas = (d.subtarefas ?? []).map((t) => ({ texto: t, feito: false }));
      if (novas.length) { setSubtarefas((s) => [...s, ...novas]); toast.success(`${novas.length} subtarefa(s) sugerida(s)`); }
      else toast.error("A IA não sugeriu subtarefas.");
    } catch { toast.error("IA indisponível no momento."); } finally { setIaLoad(null); }
  }

  function addSub() {
    const t = novaSub.trim();
    if (!t) return;
    setSubtarefas((s) => [...s, { texto: t, feito: false }]);
    setNovaSub("");
  }

  async function handleSalvar() {
    if (!titulo.trim()) {
      toast.error("Informe o título da tarefa.");
      return;
    }
    // Guarda de conclusão: bloqueia concluir se há dependências não concluídas.
    if (statusMap.get(status)?.tipo === "concluido" && deps?.dependeDe.length) {
      const pendentes = deps.dependeDe
        .map((d) => tarefaMap.get(d.tarefa))
        .filter((t): t is GestaoTarefa => !!t && statusMap.get(t.status)?.tipo !== "concluido");
      if (pendentes.length > 0) {
        toast.error(`Conclua antes: ${pendentes.map((t) => t.titulo).join(", ")}`);
        return;
      }
    }
    const idSalvo = await salvar.mutateAsync({
      id_tarefa: tarefa?.id_tarefa,
      id_quadro: idQuadro,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      responsavel: responsavel.trim() || null,
      prioridade,
      prazo: prazo || null,
      data_inicio: dataInicio || null,
      status,
      etiquetas,
      pontos: pontos.trim() === "" ? null : Math.max(0, parseInt(pontos, 10) || 0),
      subtarefas: subtarefas.filter((s) => s.texto.trim()),
      campos: valoresCampos,
      recorrencia: recTipo
        ? { tipo: recTipo, intervalo: Math.max(1, recInt || 1), proxima_geracao: tarefa?.recorrencia?.proxima_geracao || prazo || new Date().toISOString().slice(0, 10) }
        : null,
    });

    // Notificações (best-effort)
    const respNome = responsavel.trim() || null;
    const respEmail = emailDe(respNome);
    const respMudou = respNome !== (tarefa?.responsavel ?? null);
    const statusNome = statuses.find((s) => s.slug === status)?.nome ?? status;
    if (respMudou && respEmail && respEmail !== userEmail) {
      criarNotif.mutate({ destinatario: respEmail, tipo: "atribuicao", titulo: `Você foi atribuído à tarefa: ${titulo.trim()}`, id_tarefa: idSalvo, id_quadro: idQuadro });
    }
    if (tarefa && !respMudou && status !== tarefa.status && respEmail && respEmail !== userEmail) {
      criarNotif.mutate({ destinatario: respEmail, tipo: "status", titulo: `"${titulo.trim()}" mudou para ${statusNome}`, id_tarefa: idSalvo, id_quadro: idQuadro });
    }

    // Histórico de atividades
    const nomeStatus = (slug: string) => statuses.find((s) => s.slug === slug)?.nome ?? slug;
    const eventos: { acao: string; payload?: Record<string, unknown> }[] = [];
    if (!tarefa) {
      eventos.push({ acao: "criada" });
    } else {
      if (status !== tarefa.status) eventos.push({ acao: "status", payload: { de: nomeStatus(tarefa.status), para: nomeStatus(status) } });
      if (respNome !== (tarefa.responsavel ?? null)) eventos.push({ acao: "responsavel", payload: { de: tarefa.responsavel ?? "—", para: respNome ?? "—" } });
      if ((prazo || null) !== (tarefa.prazo ?? null)) eventos.push({ acao: "prazo", payload: { de: tarefa.prazo ?? "—", para: prazo || "—" } });
      if (prioridade !== tarefa.prioridade) eventos.push({ acao: "prioridade", payload: { de: tarefa.prioridade, para: prioridade } });
      if (titulo.trim() !== tarefa.titulo) eventos.push({ acao: "titulo", payload: { de: tarefa.titulo, para: titulo.trim() } });
    }
    if (eventos.length) registrarAtiv.mutate({ id_tarefa: idSalvo, ator: userNome, eventos });

    // Automações (gatilhos imediatos)
    const tNova = { ...(tarefa ?? {}), id_tarefa: idSalvo, id_quadro: idQuadro, titulo: titulo.trim(), status, responsavel: respNome } as GestaoTarefa;
    if (!tarefa) aoAutomatizar?.({ gatilho: "tarefa_criada", tarefa: tNova });
    else if (status !== tarefa.status) aoAutomatizar?.({ gatilho: "status_muda", tarefa: tNova, de: tarefa.status, para: status });

    toast.success(tarefa ? "Tarefa atualizada" : "Tarefa criada");
    onClose();
  }

  async function handleExcluir() {
    if (!tarefa) return;
    if (!(await confirmar({ title: "Excluir tarefa?", description: `"${tarefa.titulo}" e seus comentários/apontamentos serão removidos. Esta ação não pode ser desfeita.` }))) return;
    excluir.mutate(tarefa.id_tarefa, { onSuccess: () => { toast.success("Tarefa excluída"); onClose(); } });
  }

  function enviarComentario() {
    if (!tarefa || !novoComentario.trim()) return;
    const t = tarefa;
    const texto = novoComentario.trim();
    addComentario.mutate(
      { id_tarefa: t.id_tarefa, texto, autor: userNome },
      { onSuccess: () => {
        setNovoComentario("");
        const respEmail = emailDe(t.responsavel);
        if (respEmail && respEmail !== userEmail) {
          criarNotif.mutate({ destinatario: respEmail, tipo: "comentario", titulo: `Novo comentário em "${t.titulo}"`, id_tarefa: t.id_tarefa, id_quadro: idQuadro });
        }
        for (const em of detectarMencoes(texto, usuariosFull)) {
          if (em !== userEmail && em !== respEmail) {
            criarNotif.mutate({ destinatario: em, tipo: "mencao", titulo: `Você foi mencionado em "${t.titulo}"`, id_tarefa: t.id_tarefa, id_quadro: idQuadro });
          }
        }
      } },
    );
  }

  const inputCls =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-gray-50";
  const feitas = subtarefas.filter((s) => s.feito).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tarefa ? "Editar tarefa" : "Nova tarefa"}
      size="lg"
      footer={
        !ro ? (
          <div className="flex items-center justify-between">
            {tarefa ? (
              <button type="button" onClick={handleExcluir} disabled={excluir.isPending} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="size-4" /> Excluir
              </button>
            ) : <span />}
            <button type="button" onClick={handleSalvar} disabled={salvar.isPending} className="inline-flex items-center gap-2 rounded-lg bg-verde-primary px-5 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50">
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              {tarefa ? "Salvar" : "Criar tarefa"}
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Título *</label>
          <input value={titulo} disabled={ro} onChange={(e) => setTitulo(e.target.value)} placeholder="O que precisa ser feito?" className={inputCls} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-600">Descrição</label>
            {!ro && (
              <button type="button" onClick={iaDescricao} disabled={iaLoad !== null} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-verde-primary hover:bg-verde-light/50 disabled:opacity-50">
                {iaLoad === "desc" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Redigir com IA
              </button>
            )}
          </div>
          <textarea value={descricao} disabled={ro} onChange={(e) => setDescricao(e.target.value)} rows={3} className={inputCls} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Responsável</label>
            <input list="gestao-usuarios" value={responsavel} disabled={ro} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem vai fazer" className={inputCls} />
            <datalist id="gestao-usuarios">{usuarios.map((u) => <option key={u} value={u} />)}</datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Data de início</label>
            <input type="date" value={dataInicio} disabled={ro} max={prazo || undefined} onChange={(e) => setDataInicio(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Prazo</label>
            <input type="date" value={prazo} disabled={ro} min={dataInicio || undefined} onChange={(e) => setPrazo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Prioridade</label>
            <select value={prioridade} disabled={ro} onChange={(e) => setPrioridade(e.target.value as PrioridadeTarefa)} className={inputCls}>
              {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
            <select value={status} disabled={ro} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Pontos (esforço)</label>
            <input type="number" min="0" value={pontos} disabled={ro} onChange={(e) => setPontos(e.target.value)} placeholder="—" className={inputCls} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Recorrência</label>
          <div className="flex flex-wrap items-center gap-2">
            <select value={recTipo} disabled={ro} onChange={(e) => setRecTipo(e.target.value as "" | "diaria" | "semanal" | "mensal")} className={`${inputCls} max-w-[10rem]`}>
              <option value="">Não repete</option>
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>
            {recTipo && (
              <span className="flex items-center gap-1 text-sm text-gray-600">a cada
                <input type="number" min="1" value={recInt} disabled={ro} onChange={(e) => setRecInt(parseInt(e.target.value || "1", 10))} className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none" />
                {recTipo === "diaria" ? "dia(s)" : recTipo === "semanal" ? "semana(s)" : "mês(es)"}
              </span>
            )}
          </div>
          {recTipo && <p className="mt-1 text-[11px] text-gray-400">Uma nova tarefa é criada automaticamente a cada período (a partir do prazo).</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Etiquetas</label>
          <MultiChipInput value={etiquetas} onChange={setEtiquetas} sugestoes={etiquetasSugeridas} placeholder="Adicionar etiqueta…" ro={ro} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-600">
              Subtarefas {subtarefas.length > 0 && <span className="text-gray-400">({feitas}/{subtarefas.length})</span>}
            </label>
            {!ro && (
              <button type="button" onClick={iaSubtarefas} disabled={iaLoad !== null} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-verde-primary hover:bg-verde-light/50 disabled:opacity-50">
                {iaLoad === "sub" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Sugerir com IA
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {subtarefas.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <button type="button" disabled={ro} onClick={() => setSubtarefas((arr) => arr.map((x, j) => j === i ? { ...x, feito: !x.feito } : x))} className="text-gray-400 hover:text-verde-primary">
                  {s.feito ? <CheckSquare className="size-4 text-verde-primary" /> : <Square className="size-4" />}
                </button>
                <input
                  value={s.texto}
                  disabled={ro}
                  onChange={(e) => setSubtarefas((arr) => arr.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
                  className={`flex-1 rounded border border-transparent px-1.5 py-1 text-sm hover:border-gray-200 focus:border-verde-primary focus:outline-none ${s.feito ? "text-gray-400 line-through" : "text-gray-700"}`}
                />
                {!ro && (
                  <button type="button" onClick={() => setSubtarefas((arr) => arr.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-600">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {!ro && (
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-gray-300" />
                <input
                  value={novaSub}
                  onChange={(e) => setNovaSub(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
                  placeholder="Adicionar subtarefa e Enter…"
                  className="flex-1 rounded border border-gray-200 px-1.5 py-1 text-sm focus:border-verde-primary focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {campos.length > 0 && (
          <Secao titulo="Campos personalizados">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {campos.map((c) => (
                <div key={c.id}>
                  <label className="mb-1 block text-[11px] text-gray-500">{c.nome}</label>
                  <CampoInput campo={c} value={valoresCampos[c.id]} onChange={(v) => setValoresCampos((s) => ({ ...s, [c.id]: v }))} disabled={ro} />
                </div>
              ))}
            </div>
          </Secao>
        )}

        {tarefa && (
          <Secao titulo="Anexos">
            <AnexosTarefa idTarefa={tarefa.id_tarefa} podeEditar={podeEditar} />
          </Secao>
        )}

        {tarefa && (
          <Secao titulo="Tempo">
            <TempoTracker idTarefa={tarefa.id_tarefa} podeEditar={podeEditar} />
          </Secao>
        )}

        {tarefa && (
          <Secao titulo="Histórico">
            <HistoricoTarefa idTarefa={tarefa.id_tarefa} />
          </Secao>
        )}

        {tarefa && (
          <Secao titulo="Dependências">
            <div className="space-y-2">
            <div>
              <p className="mb-1 text-[11px] text-gray-500">Depende de (precisa concluir antes)</p>
              <div className="space-y-1">
                {deps?.dependeDe.map((d) => {
                  const t = tarefaMap.get(d.tarefa);
                  const concl = !!t && statusMap.get(t.status)?.tipo === "concluido";
                  return (
                    <div key={d.id} className="flex items-center gap-2 text-sm">
                      <span className={`size-2 shrink-0 rounded-full ${concl ? "bg-verde-primary" : "bg-gray-300"}`} />
                      <span className={`min-w-0 flex-1 truncate ${concl ? "text-gray-400 line-through" : "text-gray-700"}`}>{t?.titulo ?? d.tarefa}</span>
                      {!ro && <button type="button" onClick={() => excluirDep.mutate(d.id)} className="text-gray-300 hover:text-red-600"><X className="size-3.5" /></button>}
                    </div>
                  );
                })}
                {(!deps || deps.dependeDe.length === 0) && <p className="text-xs text-gray-400">Nenhuma.</p>}
              </div>
              {!ro && (
                <select value="" onChange={(e) => { if (e.target.value) addDep.mutate({ id_tarefa: tarefa.id_tarefa, depende_de: e.target.value }); }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none">
                  <option value="">+ Adicionar dependência…</option>
                  {tarefasQuadro.filter((t) => t.id_tarefa !== tarefa.id_tarefa && !deps?.dependeDe.some((d) => d.tarefa === t.id_tarefa)).map((t) => (
                    <option key={t.id_tarefa} value={t.id_tarefa}>{t.titulo}</option>
                  ))}
                </select>
              )}
            </div>
            {deps && deps.bloqueia.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] text-gray-500">Bloqueia</p>
                <div className="space-y-1">
                  {deps.bloqueia.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-sm text-gray-600">
                      <ArrowRight className="size-3 shrink-0 text-gray-300" />
                      <span className="min-w-0 flex-1 truncate">{tarefaMap.get(d.tarefa)?.titulo ?? d.tarefa}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </Secao>
        )}

        {tarefa && (
          <Secao titulo="Comentários" badge={comentarios.length} defaultOpen>
            <div className="space-y-2">
              {comentarios.map((c) => (
                <div key={c.id_comentario} className="group flex gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: corAvatar(c.autor ?? "?") }}>{iniciais(c.autor ?? "?")}</span>
                  <div className="flex-1 rounded-lg bg-gray-50 px-3 py-1.5">
                    <p className="text-[11px] text-gray-400">{c.autor ?? "—"} · {quando(c.created_at)}</p>
                    <p className="whitespace-pre-wrap text-sm text-gray-700">{c.texto}</p>
                  </div>
                  {!ro && (
                    <button type="button" onClick={() => excluirComentario.mutate({ id_comentario: c.id_comentario, id_tarefa: tarefa.id_tarefa })} className="self-start text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {comentarios.length === 0 && <p className="text-xs text-gray-400">Sem comentários ainda.</p>}
            </div>
            {!ro && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && novoComentario.trim()) { e.preventDefault(); enviarComentario(); } }}
                  placeholder="Escrever um comentário…"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none"
                />
                <button type="button" onClick={enviarComentario} disabled={!novoComentario.trim() || addComentario.isPending} className="rounded-lg bg-verde-primary px-3 py-2 text-white disabled:opacity-50">
                  <Send className="size-4" />
                </button>
              </div>
            )}
          </Secao>
        )}
      </div>
    </Modal>
  );
}
