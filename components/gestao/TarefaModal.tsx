"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { Trash2, Loader2, Plus, Square, CheckSquare, X, ArrowRight, Sparkles, Maximize2, CornerDownRight, MessageSquare, Building2, ExternalLink } from "lucide-react";
import Link from "next/link";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import Modal from "@/components/ui/Modal";
import Dica from "@/components/ui/Dica";
import { DICAS_GESTAO_TAREFA } from "@/lib/dicas/gestao";
import BotaoAutomacoes from "@/components/gestao/BotaoAutomacoes";
import MultiChipInput from "@/components/ui/MultiChipInput";
import { useUserStore } from "@/lib/store";
import {
  useSalvarTarefa, useExcluirTarefa,
  useVinculados, useSalvarVinculados,
  useSubtarefas, useSalvarSubtarefas, useAbrirSubtarefa, useTituloTarefa, useComentariosDasSubtarefas,
  useAddComentario, useExcluirComentario,
  useDependencias, useAddDependencia, useExcluirDependencia,
  useUsuarios, gerarIaGestao, useRegistrarAtividade, useCamposDeOrigem,
  PRIORIDADES, useEmpresaSugerida, useNomesEmpresas,
  type GestaoTarefa, type StatusTarefa, type PrioridadeTarefa, type Subtarefa, type GestaoSubtarefa, type GestaoStatus, type GestaoCampo, type GestaoVinculado,
} from "@/lib/hooks/useGestao";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";
import AprovacaoNaTarefa from "@/components/gestao/AprovacaoNaTarefa";
import { nomesResponsaveis } from "@/lib/gestao/responsaveis";
import CampoInput from "@/components/gestao/CampoInput";
import { BotaoTempo, RegistroTempo } from "@/components/gestao/TempoTracker";
import AnexosTarefa from "@/components/gestao/AnexosTarefa";
import HistoricoTarefa from "@/components/gestao/HistoricoTarefa";
import ComentariosTarefa from "@/components/gestao/ComentariosTarefa";
import { useTarefaHistorico } from "@/lib/hooks/useTarefaHistorico";
import { confirmar } from "@/components/ui/confirm";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import { proximaGeracao } from "@/lib/gestao/recorrencia";
import { horaDe, minutos, MIN_DIA } from "@/lib/gestao/calendario";
import { useMeuQuadro } from "@/lib/hooks/useGestaoAcesso";
import { pendenciasParaConcluir, mensagemPendencias, eventosAlteracao, type EventoAtividade } from "@/lib/gestao/alteracao-tarefa";

/** Valor de um campo do cartão de origem (v315 = Painel v325): lista vira etiquetas; o resto, texto. */
function ValorOrigem({ valor }: { valor: unknown }) {
  if (Array.isArray(valor)) {
    if (!valor.length) return <span className="text-sm text-gray-300">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {valor.map((v, i) => (
          <span key={i} className="rounded-full bg-marca-light px-2 py-0.5 text-xs text-gray-800">{String(v)}</span>
        ))}
      </div>
    );
  }
  if (typeof valor === "boolean") return <span className="text-sm text-gray-800">{valor ? "Sim" : "Não"}</span>;
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return <span className="text-sm text-gray-800">{new Date(valor.length === 10 ? valor + "T12:00:00" : valor).toLocaleDateString("pt-BR")}</span>;
  }
  return <span className="whitespace-pre-wrap text-sm text-gray-800">{valor == null || valor === "" ? "—" : String(valor)}</span>;
}

type Aba = "detalhes" | "subtarefas" | "comentarios" | "anexos" | "historico" | "dependencias";

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
  podeComentar,
  etiquetasSugeridas = [],
  inicial = null,
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
  /** Nível "ver e comentar" (comment/comment_all): comenta sem editar. Omitido = igual a podeEditar. */
  podeComentar?: boolean;
  etiquetasSugeridas?: string[];
  /** Tarefa NOVA criada pelo calendário (v0.3.914): já vem com o dia (prazo) e, na grade, a hora (1 hora). */
  inicial?: { prazo: string; hora?: string } | null;
}) {
  const salvar = useSalvarTarefa();
  const excluir = useExcluirTarefa();
  const salvarVinc = useSalvarVinculados();
  const salvarSub = useSalvarSubtarefas();
  const { data: subtarefasTabela = EMPTY_SUBTAREFAS } = useSubtarefas(tarefa?.id_tarefa);
  // Balão na lista de subtarefas: comentários da janela (tarefa filha) de cada uma.
  const filhaDaSub = useMemo(
    () => new Map(subtarefasTabela.filter((s) => s.id_tarefa_filha).map((s) => [s.id, s.id_tarefa_filha as string])),
    [subtarefasTabela],
  );
  const { data: comentariosSub } = useComentariosDasSubtarefas([...filhaDaSub.values()]);
  const { data: vinculados = EMPTY_VINCULADOS } = useVinculados(tarefa?.id_tarefa);
  const userNome = useUserStore((s) => s.user?.nome ?? null);
  const userEmail = useUserStore((s) => s.user?.email ?? null);
  // Tarefa nova no MEU Quadro já vem comigo como responsável (dá para tirar antes de salvar).
  const { data: idMeuQuadro } = useMeuQuadro(open);
  const novaNoMeuQuadro = !tarefa?.id_tarefa && !!idMeuQuadro && idQuadro === idMeuQuadro;
  const { data: usuariosFull = EMPTY_USUARIOS } = useUsuarios();
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
  // v315 (Painel v325): campos que vieram de outro quadro (ex.: Produtos) — só leitura.
  const { data: camposOrigem = [] } = useCamposDeOrigem(tarefa?.id_tarefa);
  const addDep = useAddDependencia();
  const excluirDep = useExcluirDependencia();
  const tarefaMap = useMemo(() => new Map(tarefasQuadro.map((t) => [t.id_tarefa, t])), [tarefasQuadro]);
  // v292: esta janela é a de uma subtarefa (tarefa filha)? Sem recorrência, subtarefas e dependências.
  const idPai = tarefa?.id_tarefa_pai ?? null;
  const ehSub = !!idPai;
  const { data: tituloPaiLido } = useTituloTarefa(idPai && !tarefaMap.has(idPai) ? idPai : null);
  const tituloPai = idPai ? tarefaMap.get(idPai)?.titulo ?? tituloPaiLido ?? null : null;
  // v292: duplo clique numa subtarefa abre a janela completa dela (por cima desta).
  const abrirSubtarefa = useAbrirSubtarefa();
  const [subAberta, setSubAberta] = useState<GestaoTarefa | null>(null);
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.slug, s])), [statuses]);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  // v295: vários responsáveis (botão "+ responsável"). O banco espelha todos em `responsavel`.
  const [responsaveisEmails, setResponsaveisEmails] = useState<string[]>([]);
  const [seguidoresEmails, setSeguidoresEmails] = useState<string[]>([]);
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>("Media");
  const [prazo, setPrazo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [status, setStatus] = useState<StatusTarefa>(statusInicial);
  // Status já gravado no banco: na tarefa existente, escolher outro status grava NA HORA (como no Runrun) e o
  // cartão muda de coluna; o "Salvar" compara com este para não registrar a mesma mudança duas vezes.
  const [statusSalvo, setStatusSalvo] = useState<StatusTarefa>(statusInicial);
  const [recTipo, setRecTipo] = useState<"" | "diaria" | "semanal" | "mensal">("");
  const [recInt, setRecInt] = useState(1);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [pontos, setPontos] = useState("");
  // v338 (Painel v354): empresa do cadastro. Sem empresa, sugere pelo CNPJ ou pelo nome no título; a pessoa confirma.
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);
  const [subtarefas, setSubtarefas] = useState<(Subtarefa & { id?: string })[]>([]);
  const [novaSub, setNovaSub] = useState("");
  const [valoresCampos, setValoresCampos] = useState<Record<string, unknown>>({});
  // Campos como vieram na abertura: ao salvar, só vai o que a pessoa mudou (diff contra isto),
  // para não regravar por cima do que uma automação escreveu enquanto a janela estava aberta.
  const camposCarregados = useRef<Record<string, unknown>>({});
  // Abas no topo do modal (como no Runrun): detalhes (o formulário), subtarefas, comentários,
  // anexos, histórico e dependências. O tempo fica no início de Detalhes e no rodapé.
  const [aba, setAba] = useState<Aba>("detalhes");
  // "Criar outra" (como no Jira, Painel 0.3.912): depois de criar, a janela fica aberta e limpa para a próxima.
  // Fica marcado enquanto a tela estiver aberta (a janela não é desmontada ao fechar).
  const [criarOutra, setCriarOutra] = useState(false);
  const tituloRef = useRef<HTMLInputElement>(null);
  const { data: timeline } = useTarefaHistorico(tarefa?.id_tarefa);
  const nComentarios = (timeline ?? []).filter((i) => i.kind === "comentario").length;

  useEffect(() => {
    if (!open) return;
    setAba("detalhes");
    setTitulo(tarefa?.titulo ?? "");
    setDescricao(tarefa?.descricao ?? "");
    setPrioridade(tarefa?.prioridade ?? "Media");
    // Tarefa nova pelo calendário: o dia clicado vira o prazo (e, na grade, a hora com 1 hora de duração).
    const ini = tarefa ? null : inicial;
    setPrazo(tarefa?.prazo ?? ini?.prazo ?? "");
    setDataInicio(tarefa?.data_inicio ?? "");
    // Coluna TIME volta 'HH:MM:SS'; o <input type="time"> trabalha em 'HH:MM'.
    setHoraInicio(tarefa?.hora_inicio?.slice(0, 5) ?? ini?.hora ?? "");
    setHoraFim(tarefa?.hora_fim?.slice(0, 5) ?? (ini?.hora ? horaDe(Math.min(minutos(ini.hora) + 60, MIN_DIA - 1)) : ""));
    setStatus(tarefa?.status ?? statusInicial);
    setStatusSalvo(tarefa?.status ?? statusInicial);
    setRecTipo(tarefa?.recorrencia?.tipo ?? "");
    setRecInt(tarefa?.recorrencia?.intervalo ?? 1);
    setEtiquetas(tarefa?.etiquetas ?? []);
    setPontos(tarefa?.pontos != null ? String(tarefa.pontos) : "");
    setIdEmpresa(tarefa?.id_empresa ?? null);
    setSubtarefas(tarefa?.subtarefas ?? []);
    setNovaSub("");
    setValoresCampos((tarefa?.campos as Record<string, unknown>) ?? {});
    camposCarregados.current = (tarefa?.campos as Record<string, unknown>) ?? {};
  }, [open, tarefa, statusInicial, inicial]);

  // Pré-popula responsável + seguidores a partir dos vínculos existentes (v187/F1.2).
  // Guard: inicializa UMA vez por abertura de tarefa e re-sincroniza só quando a assinatura
  // dos vínculos DAQUELA tarefa muda (ao carregar). Sem isso, o efeito rodava a cada render e
  // zerava a escolha do usuário numa tarefa nova. Para tarefa nova a chave é fixa ("__nova__"),
  // então nenhuma carga posterior (ex.: usuariosFull) reinicializa e apaga a seleção (C13).
  // Para tarefa existente, a assinatura muda quando os vínculos chegam → pré-popula (C10).
  const vincInitRef = useRef<string | null>(null);
  const vincBaseRef = useRef<{ responsaveisEmails: string[]; seguidoresEmails: string[] }>({ responsaveisEmails: [], seguidoresEmails: [] });
  useEffect(() => {
    if (!open) { vincInitRef.current = null; return; }
    const nova = !tarefa?.id_tarefa;
    const assinatura = vinculados
      .map((v) => `${v.tipo}:${v.usuario_email}`)
      .sort()
      .join("|");
    const chave = nova ? `__nova__#${novaNoMeuQuadro ? "meu" : ""}` : `${tarefa!.id_tarefa}#${assinatura}`;
    if (vincInitRef.current === chave) return;
    vincInitRef.current = chave;
    if (novaNoMeuQuadro && userEmail) {
      setResponsaveisEmails([userEmail.toLowerCase()]);
      setSeguidoresEmails([]);
      return;
    }
    const resps = vinculados.filter((v) => v.tipo === "responsavel").map((v) => v.usuario_email);
    // O que a janela carregou do banco: ao salvar, só sai quem estava aqui e foi tirado à mão (ver useSalvarVinculados).
    vincBaseRef.current = {
      responsaveisEmails: resps,
      seguidoresEmails: vinculados.filter((v) => v.tipo === "seguidor").map((v) => v.usuario_email),
    };
    // Fallback ao texto legado (tarefa sem vínculo ainda): nomes → e-mails conhecidos.
    setResponsaveisEmails(
      resps.length > 0
        ? resps
        : nomesResponsaveis(tarefa?.responsavel).map((n) => emailDe(n)?.toLowerCase()).filter((e): e is string => !!e)
    );
    setSeguidoresEmails(vinculados.filter((v) => v.tipo === "seguidor").map((v) => v.usuario_email));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tarefa, vinculados, novaNoMeuQuadro]);

  // Subtarefas (F2.1/v199): a TABELA gestao_subtarefas e a fonte de verdade. O efeito de
  // abertura ja semeia do jsonb espelhado (imediato, sem flash); quando a leitura da tabela
  // chega, re-sincroniza UMA vez por assinatura (mesmo guard dos vinculos) — antes de o
  // usuario editar. Tarefa nova nao tem linha na tabela: o seed [] da abertura basta.
  // v292: a janela da subtarefa muda a linha no banco (título/status/responsável) — a assinatura
  // inclui o responsável, e depois da 1ª carga as linhas ainda não salvas (sem id) são mantidas.
  const subInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { subInitRef.current = null; return; }
    if (!tarefa?.id_tarefa) return;
    const assinatura = subtarefasTabela.map((s) => `${s.ordem}:${s.feito ? 1 : 0}:${s.responsavel_email ?? ""}:${s.texto}`).join("|");
    const chave = `${tarefa.id_tarefa}#${assinatura}`;
    if (subInitRef.current === chave) return;
    const primeira = subInitRef.current === null;
    subInitRef.current = chave;
    const daTabela = subtarefasTabela.map((s) => ({ id: s.id, texto: s.texto, feito: s.feito, responsavel_email: s.responsavel_email }));
    setSubtarefas((atuais) => (primeira ? daTabela : [...daTabela, ...atuais.filter((s) => !s.id)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tarefa, subtarefasTabela]);

  const ro = !podeEditar;
  const { data: sugestoesEmpresa = [] } = useEmpresaSugerida(tarefa?.id_tarefa, open && !!tarefa && !tarefa.id_tarefa_pai && !tarefa.id_empresa && podeEditar);
  const { data: nomesEmpresa } = useNomesEmpresas(open ? [idEmpresa, tarefa?.id_empresa] : []);
  const nomeEmpresaDe = (id: string | null | undefined) => (id ? nomesEmpresa?.get(id)?.nome ?? null : null);
  // Comentar não exige editar: o banco aceita o INSERT de quem tem nível >= comment (policy
  // gestao_coment_ins_comment, v197). Excluir comentário continua só para quem edita.
  const podeComentarEf = podeEditar || !!podeComentar;

  const [iaLoad, setIaLoad] = useState<"sub" | "desc" | null>(null);
  async function iaDescricao() {
    if (!titulo.trim()) { toast.error("Informe o título primeiro."); return; }
    setIaLoad("desc");
    try {
      const d = await gerarIaGestao({ acao: "descricao", titulo: titulo.trim(), descricao });
      if (d.descricao) { setDescricao((prev) => (prev.trim() ? `${prev}\n\n${d.descricao}` : d.descricao!)); toast.success("Descrição sugerida pela IA"); }
      else toast.error("A IA não retornou uma descrição.");
    } catch (e) { toast.error(mensagemErro(e, "IA indisponível no momento.")); } finally { setIaLoad(null); }
  }
  async function iaSubtarefas() {
    if (!titulo.trim()) { toast.error("Informe o título primeiro."); return; }
    setIaLoad("sub");
    try {
      const d = await gerarIaGestao({ acao: "subtarefas", titulo: titulo.trim(), descricao });
      const novas = (d.subtarefas ?? []).map((t) => ({ texto: t, feito: false, responsavel_email: null }));
      if (novas.length) { setSubtarefas((s) => [...s, ...novas]); toast.success(`${novas.length} subtarefa(s) sugerida(s)`); }
      else toast.error("A IA não sugeriu subtarefas.");
    } catch (e) { toast.error(mensagemErro(e, "IA indisponível no momento.")); } finally { setIaLoad(null); }
  }

  function abrirSub(s: Subtarefa & { id?: string }) {
    if (!tarefa || !s.id) {
      toast("Salve a tarefa para abrir esta subtarefa.");
      return;
    }
    abrirSubtarefa.mutate({ id_subtarefa: s.id, id_tarefa: tarefa.id_tarefa }, { onSuccess: (t) => setSubAberta(t) });
  }
  function fecharSub() {
    setSubAberta(null);
    // O que mudou na janela da subtarefa volta para a linha pelo banco (v292) — recarrega a lista.
    if (tarefa) qc.invalidateQueries({ queryKey: ["gestao-subtarefas", tarefa.id_tarefa] });
    qc.invalidateQueries({ queryKey: ["gestao-comentarios-subtarefas"] });
  }

  function addSub() {
    const t = novaSub.trim();
    if (!t) return;
    setSubtarefas((s) => [...s, { texto: t, feito: false, responsavel_email: null }]);
    setNovaSub("");
  }

  const nomeStatus = (slug: string) => statuses.find((s) => s.slug === slug)?.nome ?? slug;

  /** Guarda de conclusão: tarefas de que esta depende e ainda não estão concluídas (vazio = pode concluir). */
  function bloqueiaConcluir(slug: StatusTarefa): GestaoTarefa[] {
    if (statusMap.get(slug)?.tipo !== "concluido" || !deps?.dependeDe.length) return [];
    return pendenciasParaConcluir(deps.dependeDe.map((d) => d.tarefa), tarefaMap, (s) => statusMap.get(s)?.tipo);
  }

  /** Escolher outro status numa tarefa existente grava na hora e o cartão muda de coluna (como no Runrun).
   *  Tarefa nova (ainda sem id) ou de outro quadro que não o desta janela: vale só no "Salvar". */
  async function mudarStatus(novo: StatusTarefa) {
    setStatus(novo);
    if (!tarefa || ro || novo === statusSalvo || tarefa.id_quadro !== idQuadro) return;
    const pendentes = bloqueiaConcluir(novo);
    if (pendentes.length > 0) {
      toast.error(mensagemPendencias(pendentes));
      setStatus(statusSalvo);
      return;
    }
    const anterior = statusSalvo;
    setStatusSalvo(novo);
    try {
      await salvar.mutateAsync({ id_tarefa: tarefa.id_tarefa, id_quadro: tarefa.id_quadro, status: novo });
      registrarAtiv.mutate({ id_tarefa: tarefa.id_tarefa, ator: userNome, eventos: [{ acao: "status", payload: { de: nomeStatus(anterior), para: nomeStatus(novo) } }] });
      toast.success(`Status: ${nomeStatus(novo)}`);
    } catch {
      // useSalvarTarefa já avisou o erro e devolveu o cartão à coluna de antes
      setStatusSalvo(anterior);
      setStatus(anterior);
    }
  }

  async function handleSalvar() {
    if (!titulo.trim()) {
      toast.error("Informe o título da tarefa.");
      return;
    }
    if (horaInicio && horaFim && dataInicio && dataInicio === prazo && horaFim < horaInicio) {
      toast.error("A hora fim não pode ser antes da hora de início no mesmo dia.");
      return;
    }
    // Guarda de conclusão: bloqueia concluir se há dependências não concluídas (mesma regra da Lista).
    const pendentes = bloqueiaConcluir(status);
    if (pendentes.length > 0) {
      toast.error(mensagemPendencias(pendentes));
      return;
    }
    // Responsável agora vem do vínculo (por e-mail); o texto `responsavel` (nome) é
    // mantido em compat p/ ICS/notificar. O trigger-espelho server-side também o reflete.
    // Mesmo formato do espelho do banco (v295): nomes na ordem, separados por vírgula.
    const respNome = responsaveisEmails.map((e) => nomeDe(e) ?? e).join(", ") || null;
    // Flush do buffer de subtarefa ainda não confirmado por Enter/botão (#2a): sem
    // isto, o texto digitado e não confirmado era descartado em silêncio ao salvar.
    const subPend = novaSub.trim();
    const subsFinal = (subPend ? [...subtarefas, { texto: subPend, feito: false, responsavel_email: null }] : subtarefas)
      .filter((s) => s.texto.trim());
    // Campos personalizados: na edição, só as chaves que mudaram nesta janela (o hook mescla com o
    // valor atual do banco). Campo limpo vai como null — undefined sumiria do JSON e não limparia.
    const camposAlterados: Record<string, unknown> = {};
    if (tarefa?.id_tarefa) {
      const orig = camposCarregados.current;
      for (const k of new Set([...Object.keys(orig), ...Object.keys(valoresCampos)])) {
        if (JSON.stringify(valoresCampos[k] ?? null) !== JSON.stringify(orig[k] ?? null)) camposAlterados[k] = valoresCampos[k] ?? null;
      }
    }
    const idSalvo = await salvar.mutateAsync({
      id_tarefa: tarefa?.id_tarefa,
      id_quadro: idQuadro,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      responsavel: respNome,
      prioridade,
      prazo: prazo || null,
      data_inicio: dataInicio || null,
      hora_inicio: horaInicio || null,
      hora_fim: horaFim || null,
      status,
      etiquetas,
      pontos: pontos.trim() === "" ? null : Math.max(0, parseInt(pontos, 10) || 0),
      // v338: a janela da subtarefa não mostra a empresa — não manda (fica a que estiver gravada).
      ...(ehSub ? {} : { id_empresa: idEmpresa }),
      // subtarefas NAO vai mais no payload da tarefa (F2.1/v199): persiste na tabela abaixo.
      ...(tarefa?.id_tarefa ? { camposAlterados } : { campos: valoresCampos }),
      recorrencia: recTipo
        ? {
            tipo: recTipo,
            intervalo: Math.max(1, recInt || 1),
            // Recalcula quando muda o término/tipo/intervalo (antes ficava presa à data original).
            proxima_geracao: proximaGeracao(tarefa ? { recorrencia: tarefa.recorrencia, prazo: tarefa.prazo } : null, {
              tipo: recTipo, intervalo: recInt, prazo: prazo || null, dataInicio: dataInicio || null, hoje: new Date().toLocaleDateString("sv-SE"),
            }),
          }
        : null,
    });

    // Subtarefas (F2.1/v199): na EDICAO reconcilia (delete+insert) a tabela com o estado do modal
    // (subsFinal ja inclui o flush do novaSub — UX-A). Na CRIACAO usa append (reconciliar:false)
    // p/ NAO apagar subtarefas que uma automacao (esteira/checklists em tarefa_criada) acabou de
    // criar server-side. O trigger-espelho reescreve o jsonb.
    if (!ehSub) await salvarSub.mutateAsync({ id_tarefa: idSalvo, subtarefas: subsFinal, reconciliar: !!tarefa?.id_tarefa });

    // Vínculos: N responsáveis + N seguidores (por e-mail). O espelho reflete os responsáveis.
    await salvarVinc.mutateAsync({
      id_tarefa: idSalvo,
      responsaveisEmails,
      seguidoresEmails,
      // Tarefa nova sem responsável escolhido: mantém o que o banco pôs ao criar (dono do Meu
      // Quadro, v294) em vez de apagar.
      manterResponsaveisAtuais: !tarefa,
      // Na CRIACAO só adiciona (Painel 0.3.917): não apaga quem a automação de tarefa_criada acabou de vincular.
      somenteAdicionar: !tarefa?.id_tarefa,
      // Na EDICAO (Painel 0.3.919): não tira quem a automação vinculou com a janela aberta.
      base: tarefa?.id_tarefa ? vincBaseRef.current : undefined,
    });

    // Avisos (atribuição, seguidor, status) e e-mail: gerados no banco por gatilho (v295).

    // Histórico de atividades
    // Mudança de status já gravada na hora (mudarStatus) já entrou no histórico: compara com o gravado.
    const eventos: EventoAtividade[] = !tarefa
      ? [{ acao: "criada" }]
      : eventosAlteracao({ ...tarefa, status: statusSalvo }, { status, responsavel: respNome, prazo: prazo || null, prioridade, titulo: titulo.trim() }, nomeStatus);
    if (tarefa && !ehSub && (idEmpresa ?? null) !== (tarefa.id_empresa ?? null)) {
      eventos.push({ acao: "empresa", payload: { de: nomeEmpresaDe(tarefa.id_empresa) ?? "—", para: nomeEmpresaDe(idEmpresa) ?? "—" } });
      qc.invalidateQueries({ queryKey: ["gestao-tarefas-da-empresa"] });
      qc.invalidateQueries({ queryKey: ["gestao-empresa-sugerida", idSalvo] });
    }
    if (eventos.length) registrarAtiv.mutate({ id_tarefa: idSalvo, ator: userNome, eventos });

    // Automações rodam no servidor (v120: trigger em gestao_tarefas + gestao_automacao_prazos).
    if (!tarefa && criarOutra) {
      // Limpa só o que é de cada tarefa (título, descrição, subtarefas); responsável, datas, etiquetas e empresa
      // ficam, para criar várias parecidas em sequência.
      toast.success("Tarefa criada. Pode escrever a próxima.");
      setTitulo("");
      setDescricao("");
      setSubtarefas([]);
      setNovaSub("");
      setAba("detalhes");
      requestAnimationFrame(() => tituloRef.current?.focus());
      return;
    }
    toast.success(ehSub ? "Subtarefa atualizada" : tarefa ? "Tarefa atualizada" : "Tarefa criada");
    onClose();
  }

  async function handleExcluir() {
    if (!tarefa) return;
    const oQue = ehSub ? "subtarefa" : "tarefa";
    if (!(await confirmar({ title: `Excluir ${oQue}?`, description: `"${tarefa.titulo}" e seus comentários/apontamentos serão removidos${ehSub ? " (sai também da lista de subtarefas)" : ""}. Esta ação não pode ser desfeita.` }))) return;
    excluir.mutate(tarefa.id_tarefa, { onSuccess: () => { toast.success(ehSub ? "Subtarefa excluída" : "Tarefa excluída"); onClose(); } });
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
        // Avisos de comentário e de menção (@nome): gerados no banco por gatilho (v295).
      } },
    );
  }

  const inputCls =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-marca-primary focus:outline-none focus:ring-1 focus:ring-marca-primary/30 disabled:bg-gray-50";
  const feitas = subtarefas.filter((s) => s.feito).length;

  // Tarefa nova só tem Subtarefas (o resto precisa do id salvo); a janela de uma subtarefa
  // não tem Subtarefas nem Dependências (v292).
  const abas: { id: Aba; rotulo: string; contagem?: number }[] = [
    { id: "detalhes", rotulo: "Detalhes" },
    ...(!ehSub ? [{ id: "subtarefas" as const, rotulo: "Subtarefas", contagem: subtarefas.length }] : []),
    ...(tarefa
      ? [
          { id: "comentarios" as const, rotulo: "Comentários", contagem: nComentarios },
          { id: "anexos" as const, rotulo: "Anexos" },
          { id: "historico" as const, rotulo: "Histórico" },
          ...(!ehSub ? [{ id: "dependencias" as const, rotulo: "Dependências", contagem: deps?.dependeDe.length }] : []),
        ]
      : []),
  ];
  const abaAtiva: Aba = abas.some((a) => a.id === aba) ? aba : "detalhes";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ehSub ? "Subtarefa" : tarefa ? "Editar tarefa" : "Nova tarefa"}
      size="xl"
      footer={
        !ro ? (
          <div className="flex items-center justify-between">
            {tarefa ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleExcluir} disabled={excluir.isPending} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                  <Trash2 className="size-4" /> Excluir
                </button>
                {!ehSub && <BotaoAutomacoes idQuadro={tarefa.id_quadro} ids={[tarefa.id_tarefa]} />}
              </div>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600" title="Depois de criar, a janela fica aberta e limpa para a próxima (responsável, datas e etiquetas continuam)">
                <input type="checkbox" checked={criarOutra} onChange={(e) => setCriarOutra(e.target.checked)} className="size-4 rounded accent-marca-primary" />
                Criar outra
              </label>
            )}
            <div className="flex items-center gap-2">
              {tarefa && <BotaoTempo idTarefa={tarefa.id_tarefa} />}
              <button type="button" onClick={handleSalvar} disabled={salvar.isPending} className="inline-flex items-center gap-2 rounded-lg bg-marca-primary px-5 py-2 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-50">
                {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
                {tarefa ? "Salvar" : "Criar tarefa"}
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div>
        {abas.length > 1 && (
          // Fila de abas presa no topo do corpo do modal (o -top-5/-mx-6 anulam o padding do Modal).
          <div role="tablist" aria-label="Seções da tarefa" className="sticky -top-5 z-10 -mx-6 -mt-5 mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-6 pt-2">
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={abaAtiva === a.id}
                onClick={() => setAba(a.id)}
                className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                  abaAtiva === a.id
                    ? "border-marca-primary text-marca-primary"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {a.rotulo}
                {a.contagem ? <span className="rounded-full bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-500">{a.contagem}</span> : null}
              </button>
            ))}
          </div>
        )}
        <div role="tabpanel">
        {abaAtiva === "detalhes" && (
        <div className="space-y-3">
        {tarefa && <RegistroTempo idTarefa={tarefa.id_tarefa} podeEditar={podeEditar} />}
        {ehSub && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <CornerDownRight className="size-3.5 shrink-0" />
            Subtarefa de <span className="truncate font-medium text-gray-700">{tituloPai ?? "…"}</span>
          </p>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.titulo}>Título</Dica> *</label>
          <input ref={tituloRef} value={titulo} disabled={ro} onChange={(e) => setTitulo(e.target.value)} placeholder="O que precisa ser feito?" className={inputCls} />
        </div>
        <div>
            {/* Aprovação pendente (10/11/2026): decide aqui, sem depender da Caixa de entrada da aprovadora. */}
            {tarefa?.id_tarefa && <AprovacaoNaTarefa idTarefa={tarefa.id_tarefa} podeEditarQuadro={podeEditar} onDecidido={onClose} />}
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.descricao}>Descrição</Dica></label>
            {!ro && (
              <button type="button" onClick={iaDescricao} disabled={iaLoad !== null} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-marca-primary hover:bg-marca-light/50 disabled:opacity-50">
                {iaLoad === "desc" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Redigir com IA
              </button>
            )}
          </div>
          <textarea value={descricao} disabled={ro} onChange={(e) => setDescricao(e.target.value)} rows={8} className={`${inputCls} resize-y`} />
        </div>
        {/* Datas lado a lado, horas logo abaixo; responsável desce para junto dos seguidores. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.inicio}>Data de início</Dica></label>
            <input type="date" value={dataInicio} disabled={ro} max={prazo || undefined} onChange={(e) => setDataInicio(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.termino}>Data de término</Dica></label>
            <input type="date" value={prazo} disabled={ro} min={dataInicio || undefined} onChange={(e) => setPrazo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.hora_inicio}>Hora de início</Dica></label>
            <input type="time" value={horaInicio} disabled={ro} onChange={(e) => setHoraInicio(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.hora_fim}>Hora fim</Dica></label>
            <input type="time" value={horaFim} disabled={ro} onChange={(e) => setHoraFim(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.prioridade}>Prioridade</Dica></label>
            <select value={prioridade} disabled={ro} onChange={(e) => setPrioridade(e.target.value as PrioridadeTarefa)} className={inputCls}>
              {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.status}>Status</Dica></label>
            <select value={status} disabled={ro} onChange={(e) => mudarStatus(e.target.value)} className={inputCls}>
              {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.pontos}>Pontos (esforço)</Dica></label>
            <input type="number" min="0" value={pontos} disabled={ro} onChange={(e) => setPontos(e.target.value)} placeholder="—" className={inputCls} />
          </div>
        </div>

        {!ehSub && (
          // v338 (Painel v354): empresa do cadastro. A Agenda mostra a empresa de cada atividade (a da subtarefa vem da mãe).
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600"><Building2 className="size-3.5" /> Empresa</label>
            {ro ? (
              idEmpresa ? (
                <Link href={`/empresas/${idEmpresa}`} className="block truncate py-1.5 text-sm font-medium text-marca-primary hover:underline">{nomeEmpresaDe(idEmpresa) ?? idEmpresa}</Link>
              ) : (
                <p className="py-1.5 text-sm text-gray-400">—</p>
              )
            ) : (
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <EmpresaSelect value={idEmpresa} onChange={(v) => setIdEmpresa(v || null)} allowAll placeholder="Buscar empresa…" />
                </div>
                {idEmpresa && (
                  <Link href={`/empresas/${idEmpresa}`} target="_blank" title="Abrir a ficha da empresa" aria-label="Abrir a ficha da empresa" className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-marca-primary">
                    <ExternalLink className="size-4" />
                  </Link>
                )}
              </div>
            )}
            {!ro && !idEmpresa && sugestoesEmpresa.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                <span>{sugestoesEmpresa.length > 1 ? "Sugeridas pelo título:" : sugestoesEmpresa[0].por === "cnpj" ? "Sugerida pelo CNPJ do título:" : "Sugerida pelo título:"}</span>
                {sugestoesEmpresa.map((s) => (
                  <button key={s.id_empresa} type="button" onClick={() => setIdEmpresa(s.id_empresa)} title="Usar esta empresa (grava ao salvar)"
                    className="rounded-full border border-marca-primary/40 bg-marca-light/50 px-2 py-0.5 font-medium text-marca-primary hover:bg-marca-light">
                    {s.nome}{s.municipio ? ` · ${s.municipio}` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(campos.length > 0 || camposOrigem.length > 0) && (
          // Campos personalizados na mesma grade dos campos fixos (antes ficavam numa caixa fechada).
          // Os que vieram do cartão de origem (v315 = Painel v325) aparecem só para leitura, com o nome do quadro.
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {campos.map((c) => (
              <div key={c.id} className={c.tipo === "multi" ? "sm:col-span-2" : undefined}>
                <label className="mb-1 block text-xs font-medium text-gray-600">{c.nome}</label>
                <CampoInput campo={c} value={valoresCampos[c.id]} onChange={(v) => setValoresCampos((s) => ({ ...s, [c.id]: v }))} disabled={ro} />
              </div>
            ))}
            {camposOrigem.map((c) => (
              <div key={`origem:${c.id}`} className={c.tipo === "multi" ? "sm:col-span-2" : undefined}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {c.nome} <span className="font-normal text-gray-400">· {c.quadro}</span>
                </label>
                <div className="min-h-[38px] rounded-md border border-gray-200 bg-gray-50 px-3 py-2" title="Só leitura — vem do cartão de origem">
                  <ValorOrigem valor={c.valor} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            <Dica texto={DICAS_GESTAO_TAREFA.responsaveis}>{responsaveisEmails.length > 1 ? `Responsáveis (${responsaveisEmails.length})` : "Responsável"}</Dica>
          </label>
          {/* Campo de busca menor, com os selecionados ao lado. */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
            {!ro && (
              <div className="w-full shrink-0 sm:w-60">
                <UsuarioCombobox
                  usuarios={usuariosFull.filter((u) => !responsaveisEmails.includes(u.email.toLowerCase()))}
                  value=""
                  onChange={(em) => {
                    if (!em) return;
                    const e = em.toLowerCase();
                    setResponsaveisEmails((s) => [...new Set([...s, e])]);
                    setSeguidoresEmails((s) => s.filter((x) => x.toLowerCase() !== e)); // responsável não é também seguidor
                  }}
                  placeholder={responsaveisEmails.length === 0 ? "Buscar responsável…" : "Adicionar responsável…"}
                />
              </div>
            )}
            {responsaveisEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 sm:pt-1.5">
                {responsaveisEmails.map((em) => {
                  const nome = nomeDe(em) ?? em;
                  return (
                    <span key={em} className="inline-flex items-center gap-1 rounded-full bg-marca-light/60 py-0.5 pl-1 pr-2 text-xs font-medium text-marca-primary">
                      <AvatarPessoa nome={nome} email={em} className="size-5 text-[9px]" />
                      {nome}
                      {!ro && (
                        <button type="button" aria-label={`Remover responsável ${nome}`} onClick={() => setResponsaveisEmails((s) => s.filter((x) => x !== em))} className="text-gray-400 hover:text-red-600">
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.seguidores}>Seguidores</Dica></label>
          {seguidoresEmails.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {seguidoresEmails.map((em) => {
                const nome = nomeDe(em) ?? em;
                return (
                  <span key={em} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-1 pr-2 text-xs font-medium text-gray-700">
                    <AvatarPessoa nome={nome} email={em} className="size-5 text-[9px]" />
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
              usuarios={usuariosFull.filter((u) => !responsaveisEmails.includes(u.email.toLowerCase()) && !seguidoresEmails.includes(u.email))}
              value=""
              onChange={(em) => { if (em) setSeguidoresEmails((s) => [...new Set([...s, em])]); }}
              placeholder="Adicionar seguidor…"
            />
          )}
        </div>

        {!ehSub && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.recorrencia}>Recorrência</Dica></label>
          <div className="flex flex-wrap items-center gap-2">
            <select value={recTipo} disabled={ro} onChange={(e) => setRecTipo(e.target.value as "" | "diaria" | "semanal" | "mensal")} className={`${inputCls} max-w-[10rem]`}>
              <option value="">Não repete</option>
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>
            {recTipo && (
              <span className="flex items-center gap-1 text-sm text-gray-600">a cada
                <input type="number" min="1" value={recInt} disabled={ro} onChange={(e) => setRecInt(parseInt(e.target.value || "1", 10))} className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none" />
                {recTipo === "diaria" ? "dia(s)" : recTipo === "semanal" ? "semana(s)" : "mês(es)"}
              </span>
            )}
          </div>
          {recTipo && <p className="mt-1 text-[11px] text-gray-400">Uma nova tarefa é criada automaticamente a cada período (a partir do prazo).</p>}
        </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.etiquetas}>Etiquetas</Dica></label>
          <MultiChipInput value={etiquetas} onChange={setEtiquetas} sugestoes={etiquetasSugeridas} placeholder="Adicionar etiqueta…" ro={ro} />
        </div>

        </div>
        )}

        {abaAtiva === "subtarefas" && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {subtarefas.length > 0 ? `${feitas} de ${subtarefas.length} concluída(s)` : "Nenhuma subtarefa ainda."}
            </span>
            {!ro && (
              <button type="button" onClick={iaSubtarefas} disabled={iaLoad !== null} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-marca-primary hover:bg-marca-light/50 disabled:opacity-50">
                {iaLoad === "sub" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Sugerir com IA
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {subtarefas.map((s, i) => (
              <div key={i} className="flex items-center gap-2" onDoubleClick={() => abrirSub(s)} title="Duplo clique abre a subtarefa">
                <button type="button" disabled={ro} onClick={() => setSubtarefas((arr) => arr.map((x, j) => j === i ? { ...x, feito: !x.feito } : x))} className="text-gray-400 hover:text-marca-primary">
                  {s.feito ? <CheckSquare className="size-4 text-marca-primary" /> : <Square className="size-4" />}
                </button>
                <input
                  value={s.texto}
                  disabled={ro}
                  onChange={(e) => setSubtarefas((arr) => arr.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
                  className={`flex-1 rounded border border-transparent px-1.5 py-1 text-sm hover:border-gray-200 focus:border-marca-primary focus:outline-none ${s.feito ? "text-gray-400 line-through" : "text-gray-700"}`}
                />
                {s.responsavel_email && (() => {
                  const nome = nomeDe(s.responsavel_email) ?? s.responsavel_email;
                  return (
                    <AvatarPessoa nome={nome} email={s.responsavel_email} title={nome} className="size-5 text-[9px]" />
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
                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-marca-primary focus:outline-none disabled:bg-gray-50"
                  />
                </div>
                {(() => {
                  const n = (s.id && comentariosSub?.[filhaDaSub.get(s.id) ?? ""]) || 0;
                  return n > 0 ? (
                    <button
                      type="button"
                      onClick={() => abrirSub(s)}
                      aria-label={`${n} comentário(s) na subtarefa ${s.texto}`}
                      title={`${n} comentário(s): abrir a subtarefa`}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 text-xs font-medium text-gray-500 hover:text-marca-primary"
                    >
                      <MessageSquare className="size-3.5" />
                      {n}
                    </button>
                  ) : null;
                })()}
                <button
                  type="button"
                  onClick={() => abrirSub(s)}
                  disabled={abrirSubtarefa.isPending}
                  aria-label={`Abrir subtarefa ${s.texto}`}
                  title="Abrir subtarefa"
                  className="text-gray-300 hover:text-marca-primary disabled:opacity-50"
                >
                  {abrirSubtarefa.isPending && abrirSubtarefa.variables?.id_subtarefa === s.id ? <Loader2 className="size-4 animate-spin" /> : <Maximize2 className="size-4" />}
                </button>
                {!ro && (
                  <button type="button" onClick={() => setSubtarefas((arr) => arr.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-600">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {!ro && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={addSub} disabled={!novaSub.trim()} aria-label="Adicionar subtarefa" className="text-gray-400 hover:text-marca-primary disabled:text-gray-300 disabled:hover:text-gray-300">
                  <Plus className="size-4" />
                </button>
                <input
                  value={novaSub}
                  onChange={(e) => setNovaSub(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
                  placeholder="Adicionar subtarefa (Enter ou +)…"
                  className="flex-1 rounded border border-gray-200 px-1.5 py-1 text-sm focus:border-marca-primary focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
        )}

        {tarefa && abaAtiva === "comentarios" && (
          <ComentariosTarefa
            idTarefa={tarefa.id_tarefa}
            ro={ro}
            podeComentar={podeComentarEf}
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

        {tarefa && abaAtiva === "anexos" && <AnexosTarefa idTarefa={tarefa.id_tarefa} podeEditar={podeEditar} />}

        {tarefa && abaAtiva === "historico" && <HistoricoTarefa idTarefa={tarefa.id_tarefa} statuses={statuses} />}

        {tarefa && abaAtiva === "dependencias" && (
            <div className="space-y-2">
            <div>
              <p className="mb-1 text-[11px] text-gray-500">Depende de (precisa concluir antes)</p>
              <div className="space-y-1">
                {deps?.dependeDe.map((d) => {
                  const t = tarefaMap.get(d.tarefa);
                  const concl = !!t && statusMap.get(t.status)?.tipo === "concluido";
                  return (
                    <div key={d.id} className="flex items-center gap-2 text-sm">
                      <span className={`size-2 shrink-0 rounded-full ${concl ? "bg-marca-primary" : "bg-gray-300"}`} />
                      <span className={`min-w-0 flex-1 truncate ${concl ? "text-gray-400 line-through" : "text-gray-700"}`}>{t?.titulo ?? d.tarefa}</span>
                      {!ro && <button type="button" onClick={() => excluirDep.mutate(d.id)} className="text-gray-300 hover:text-red-600"><X className="size-3.5" /></button>}
                    </div>
                  );
                })}
                {(!deps || deps.dependeDe.length === 0) && <p className="text-xs text-gray-400">Nenhuma.</p>}
              </div>
              {!ro && (
                <select value="" onChange={(e) => { if (e.target.value) addDep.mutate({ id_tarefa: tarefa.id_tarefa, depende_de: e.target.value }); }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-marca-primary focus:outline-none">
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
        )}
        </div>
      </div>

      {subAberta && (
        <TarefaModal
          open
          onClose={fecharSub}
          idQuadro={subAberta.id_quadro}
          tarefa={subAberta}
          statuses={statuses}
          campos={campos}
          tarefasQuadro={tarefasQuadro}
          podeEditar={podeEditar}
          podeComentar={podeComentar}
          etiquetasSugeridas={etiquetasSugeridas}
        />
      )}
    </Modal>
  );
}
