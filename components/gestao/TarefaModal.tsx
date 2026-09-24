"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Trash2, Loader2, Plus, Square, CheckSquare, X, ArrowRight, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import MultiChipInput from "@/components/ui/MultiChipInput";
import { useUserStore } from "@/lib/store";
import {
  useSalvarTarefa, useExcluirTarefa,
  useVinculados, useSalvarVinculados,
  useSubtarefas, useSalvarSubtarefas,
  useAddComentario, useExcluirComentario,
  useDependencias, useAddDependencia, useExcluirDependencia,
  useUsuarios, useCriarNotificacao, detectarMencoes, gerarIaGestao, useRegistrarAtividade,
  iniciais, corAvatar,
  PRIORIDADES,
  type GestaoTarefa, type StatusTarefa, type PrioridadeTarefa, type Subtarefa, type GestaoSubtarefa, type GestaoStatus, type GestaoCampo, type GestaoVinculado,
} from "@/lib/hooks/useGestao";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";
import CampoInput from "@/components/gestao/CampoInput";
import TempoTracker from "@/components/gestao/TempoTracker";
import AnexosTarefa from "@/components/gestao/AnexosTarefa";
import HistoricoTarefa from "@/components/gestao/HistoricoTarefa";
import TarefaSidebar from "@/components/gestao/TarefaSidebar";
import { confirmar } from "@/components/ui/confirm";

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

// Defaults ESTÁVEIS (referência constante): sem eles, `const { data = [] }` cria um array
// novo a cada render, tornando a dep do efeito de pré-população instável e disparando-o em
// todo render — o que zerava a seleção do usuário numa tarefa nova (C13).
const EMPTY_VINCULADOS: GestaoVinculado[] = [];
const EMPTY_USUARIOS: { nome: string; email: string }[] = [];
const EMPTY_SUBTAREFAS: GestaoSubtarefa[] = [];

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
}) {
  const salvar = useSalvarTarefa();
  const excluir = useExcluirTarefa();
  const salvarVinc = useSalvarVinculados();
  const salvarSub = useSalvarSubtarefas();
  const { data: subtarefasTabela = EMPTY_SUBTAREFAS } = useSubtarefas(tarefa?.id_tarefa);
  const { data: vinculados = EMPTY_VINCULADOS } = useVinculados(tarefa?.id_tarefa);
  const userNome = useUserStore((s) => s.user?.nome ?? null);
  const userEmail = useUserStore((s) => s.user?.email ?? null);
  const { data: usuariosFull = EMPTY_USUARIOS } = useUsuarios();
  const criarNotif = useCriarNotificacao();
  const registrarAtiv = useRegistrarAtividade();
  const emailDe = (nome: string | null) => (nome ? usuariosFull.find((u) => u.nome === nome)?.email ?? null : null);
  const nomeDe = (email: string | null) => (email ? usuariosFull.find((u) => u.email.toLowerCase() === email.toLowerCase())?.nome ?? null : null);
  const qc = useQueryClient();
  const addComentario = useAddComentario();
  const excluirComentario = useExcluirComentario();
  const [novoComentario, setNovoComentario] = useState("");
  // A sidebar (G1.2) lê a linha do tempo mesclada por ["gestao-tarefa-timeline", id]; comentar/
  // excluir precisa reinvalidar essa chave além da de comentários (que os hooks já invalidam).
  const invalidarTimeline = () => {
    if (tarefa) qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline", tarefa.id_tarefa] });
  };
  const { data: deps } = useDependencias(tarefa?.id_tarefa);
  const addDep = useAddDependencia();
  const excluirDep = useExcluirDependencia();
  const tarefaMap = useMemo(() => new Map(tarefasQuadro.map((t) => [t.id_tarefa, t])), [tarefasQuadro]);
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.slug, s])), [statuses]);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [seguidoresEmails, setSeguidoresEmails] = useState<string[]>([]);
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>("Media");
  const [prazo, setPrazo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [status, setStatus] = useState<StatusTarefa>(statusInicial);
  const [recTipo, setRecTipo] = useState<"" | "diaria" | "semanal" | "mensal">("");
  const [recInt, setRecInt] = useState(1);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [pontos, setPontos] = useState("");
  const [subtarefas, setSubtarefas] = useState<(Subtarefa & { id?: string })[]>([]);
  const [novaSub, setNovaSub] = useState("");
  const [valoresCampos, setValoresCampos] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!open) return;
    setTitulo(tarefa?.titulo ?? "");
    setDescricao(tarefa?.descricao ?? "");
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

  // Pré-popula responsável + seguidores a partir dos vínculos existentes (v187/F1.2).
  // Guard: inicializa UMA vez por abertura de tarefa e re-sincroniza só quando a assinatura
  // dos vínculos DAQUELA tarefa muda (ao carregar). Sem isso, o efeito rodava a cada render e
  // zerava a escolha do usuário numa tarefa nova. Para tarefa nova a chave é fixa ("__nova__"),
  // então nenhuma carga posterior (ex.: usuariosFull) reinicializa e apaga a seleção (C13).
  // Para tarefa existente, a assinatura muda quando os vínculos chegam → pré-popula (C10).
  const vincInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { vincInitRef.current = null; return; }
    const nova = !tarefa?.id_tarefa;
    const assinatura = vinculados
      .map((v) => `${v.tipo}:${v.usuario_email}`)
      .sort()
      .join("|");
    const chave = nova ? "__nova__" : `${tarefa!.id_tarefa}#${assinatura}`;
    if (vincInitRef.current === chave) return;
    vincInitRef.current = chave;
    const resp = vinculados.find((v) => v.tipo === "responsavel")?.usuario_email
      ?? emailDe(tarefa?.responsavel ?? null)?.toLowerCase()
      ?? "";
    setResponsavelEmail(resp);
    setSeguidoresEmails(vinculados.filter((v) => v.tipo === "seguidor").map((v) => v.usuario_email));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tarefa, vinculados]);

  // Subtarefas (F2.1/v199): a TABELA gestao_subtarefas e a fonte de verdade. O efeito de
  // abertura ja semeia do jsonb espelhado (imediato, sem flash); quando a leitura da tabela
  // chega, re-sincroniza UMA vez por assinatura (mesmo guard dos vinculos) — antes de o
  // usuario editar. Tarefa nova nao tem linha na tabela: o seed [] da abertura basta.
  const subInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { subInitRef.current = null; return; }
    if (!tarefa?.id_tarefa) return;
    const assinatura = subtarefasTabela.map((s) => `${s.ordem}:${s.feito ? 1 : 0}:${s.texto}`).join("|");
    const chave = `${tarefa.id_tarefa}#${assinatura}`;
    if (subInitRef.current === chave) return;
    subInitRef.current = chave;
    setSubtarefas(subtarefasTabela.map((s) => ({ id: s.id, texto: s.texto, feito: s.feito, responsavel_email: s.responsavel_email })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tarefa, subtarefasTabela]);

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
      const novas = (d.subtarefas ?? []).map((t) => ({ texto: t, feito: false, responsavel_email: null }));
      if (novas.length) { setSubtarefas((s) => [...s, ...novas]); toast.success(`${novas.length} subtarefa(s) sugerida(s)`); }
      else toast.error("A IA não sugeriu subtarefas.");
    } catch { toast.error("IA indisponível no momento."); } finally { setIaLoad(null); }
  }

  function addSub() {
    const t = novaSub.trim();
    if (!t) return;
    setSubtarefas((s) => [...s, { texto: t, feito: false, responsavel_email: null }]);
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
    // Responsável agora vem do vínculo (por e-mail); o texto `responsavel` (nome) é
    // mantido em compat p/ ICS/notificar. O trigger-espelho server-side também o reflete.
    const respNome = nomeDe(responsavelEmail) ?? null;
    // Flush do buffer de subtarefa ainda não confirmado por Enter/botão (#2a): sem
    // isto, o texto digitado e não confirmado era descartado em silêncio ao salvar.
    const subPend = novaSub.trim();
    const subsFinal = (subPend ? [...subtarefas, { texto: subPend, feito: false, responsavel_email: null }] : subtarefas)
      .filter((s) => s.texto.trim());
    const idSalvo = await salvar.mutateAsync({
      id_tarefa: tarefa?.id_tarefa,
      id_quadro: idQuadro,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      responsavel: respNome,
      prioridade,
      prazo: prazo || null,
      data_inicio: dataInicio || null,
      status,
      etiquetas,
      pontos: pontos.trim() === "" ? null : Math.max(0, parseInt(pontos, 10) || 0),
      // subtarefas NAO vai mais no payload da tarefa (F2.1/v199): persiste na tabela abaixo.
      campos: valoresCampos,
      recorrencia: recTipo
        ? { tipo: recTipo, intervalo: Math.max(1, recInt || 1), proxima_geracao: tarefa?.recorrencia?.proxima_geracao || prazo || new Date().toISOString().slice(0, 10) }
        : null,
    });

    // Subtarefas (F2.1/v199): na EDICAO reconcilia (delete+insert) a tabela com o estado do modal
    // (subsFinal ja inclui o flush do novaSub — UX-A). Na CRIACAO usa append (reconciliar:false)
    // p/ NAO apagar subtarefas que uma automacao (esteira/checklists em tarefa_criada) acabou de
    // criar server-side. O trigger-espelho reescreve o jsonb.
    await salvarSub.mutateAsync({ id_tarefa: idSalvo, subtarefas: subsFinal, reconciliar: !!tarefa?.id_tarefa });

    // Vínculos: 1 responsável + N seguidores (por e-mail). O espelho reflete o responsável.
    await salvarVinc.mutateAsync({
      id_tarefa: idSalvo,
      responsavelEmail: responsavelEmail.trim() || null,
      seguidoresEmails,
    });

    // Notificações (best-effort)
    const respEmail = responsavelEmail.trim().toLowerCase() || null;
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

    // Automações rodam no servidor (v120: trigger em gestao_tarefas + gestao_automacao_prazos).
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
        invalidarTimeline();
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
      size="xl"
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
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-3">
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
            <UsuarioCombobox
              usuarios={usuariosFull}
              value={responsavelEmail}
              onChange={setResponsavelEmail}
              disabled={ro}
              incluirVazio
              vazioLabel="Sem responsável"
              placeholder="Buscar responsável…"
            />
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
          <label className="mb-1 block text-xs font-medium text-gray-600">Seguidores</label>
          {seguidoresEmails.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {seguidoresEmails.map((em) => {
                const nome = nomeDe(em) ?? em;
                return (
                  <span key={em} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-1 pr-2 text-xs font-medium text-gray-700">
                    <span className="flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: corAvatar(nome) }}>{iniciais(nome)}</span>
                    {nome}
                    {!ro && (
                      <button type="button" aria-label={`Remover seguidor ${nome}`} onClick={() => setSeguidoresEmails((s) => s.filter((x) => x !== em))} className="text-gray-400 hover:text-red-600">
                        <X className="size-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
          {!ro && (
            <UsuarioCombobox
              usuarios={usuariosFull.filter((u) => u.email !== responsavelEmail && !seguidoresEmails.includes(u.email))}
              value=""
              onChange={(em) => { if (em) setSeguidoresEmails((s) => [...new Set([...s, em])]); }}
              placeholder="Adicionar seguidor…"
            />
          )}
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
                {s.responsavel_email && (() => {
                  const nome = nomeDe(s.responsavel_email) ?? s.responsavel_email;
                  return (
                    <span title={nome} className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: corAvatar(nome) }}>{iniciais(nome)}</span>
                  );
                })()}
                <div className="w-32 shrink-0">
                  <UsuarioCombobox
                    usuarios={usuariosFull}
                    value={s.responsavel_email ?? ""}
                    onChange={(em) => setSubtarefas((arr) => arr.map((x, j) => j === i ? { ...x, responsavel_email: em || null } : x))}
                    disabled={ro}
                    incluirVazio
                    vazioLabel="Sem responsável"
                    placeholder="Responsável…"
                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-verde-primary focus:outline-none disabled:bg-gray-50"
                  />
                </div>
                {!ro && (
                  <button type="button" onClick={() => setSubtarefas((arr) => arr.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-600">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {!ro && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={addSub} disabled={!novaSub.trim()} aria-label="Adicionar subtarefa" className="text-gray-400 hover:text-verde-primary disabled:text-gray-300 disabled:hover:text-gray-300">
                  <Plus className="size-4" />
                </button>
                <input
                  value={novaSub}
                  onChange={(e) => setNovaSub(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
                  placeholder="Adicionar subtarefa (Enter ou +)…"
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

        </div>

        {tarefa && (
          <TarefaSidebar
            idTarefa={tarefa.id_tarefa}
            ro={ro}
            statuses={statuses}
            novoComentario={novoComentario}
            setNovoComentario={setNovoComentario}
            onEnviar={enviarComentario}
            enviando={addComentario.isPending}
            onExcluirComentario={(id) =>
              excluirComentario.mutate(
                { id_comentario: id, id_tarefa: tarefa.id_tarefa },
                { onSuccess: invalidarTimeline },
              )
            }
          />
        )}
      </div>
    </Modal>
  );
}
