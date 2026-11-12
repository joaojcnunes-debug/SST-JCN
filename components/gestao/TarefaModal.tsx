"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import {
  Trash2, Loader2, Plus, Square, CheckSquare, X, ArrowRight, Sparkles, Maximize2, CornerDownRight, MessageSquare,
  Columns3, ArrowRightLeft, UserRound, Flag, Tag, CalendarDays, CalendarCheck, Repeat, Clock, Users, Gauge, List, Link2,
  PanelRightClose, PanelRightOpen, MapPin, Package, ListChecks, Timer, Hourglass, Building2, ExternalLink, LayoutTemplate,
  CheckCircle2, AlertCircle, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import Modal from "@/components/ui/Modal";
import Dica from "@/components/ui/Dica";
import { DICAS_GESTAO_TAREFA } from "@/lib/dicas/gestao";
import BotaoAutomacoes from "@/components/gestao/BotaoAutomacoes";
import MultiChipInput from "@/components/ui/MultiChipInput";
import { useUserStore } from "@/lib/store";
import {
  useSalvarTarefa, useExcluirTarefa, DIAS_LIXEIRA,
  useVinculados, useSalvarVinculados,
  useSubtarefas, useSalvarSubtarefas, useAbrirSubtarefa, useTarefaMae, useComentariosDasSubtarefas, buscarTarefa,
  useAddComentario, useExcluirComentario,
  useDependencias, useAddDependencia, useExcluirDependencia,
  useUsuarios, gerarIaGestao, useRegistrarAtividade, useCamposDeOrigem, useProdutosCatalogo, useQuadros, useChecklist, useAddChecklist,
  PRIORIDADES, useEmpresaSugerida, useNomesEmpresas,
  useAnexos, useExcluirAnexo,
  useResolverComentario, useMoverForcandoRequisito, ehErroRequisito, useSlaTarefas, useTempoTarefa, totalSegundos, formatarDuracao,
  type GestaoTempo,
  useModelos, useResponsaveisSugeridos,
  type GestaoTarefa, type StatusTarefa, type PrioridadeTarefa, type Subtarefa, type GestaoSubtarefa, type GestaoStatus, type GestaoCampo, type GestaoVinculado,
} from "@/lib/hooks/useGestao";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";
import { aplicarModelo } from "@/lib/gestao/modelos";
import AprovacaoNaTarefa from "@/components/gestao/AprovacaoNaTarefa";
import { nomesResponsaveis } from "@/lib/gestao/responsaveis";
import CampoInput from "@/components/gestao/CampoInput";
import CampoData from "@/components/gestao/CampoData";
import ChecklistTarefa from "@/components/gestao/ChecklistTarefa";
import { isoLocal } from "@/lib/gestao/datas-rapidas";
import { criadorDoFormulario } from "@/lib/gestao/filtros";
import { linkTarefa } from "@/lib/gestao/link-tarefa";
import ListaSuspensaMultipla from "@/components/gestao/ListaSuspensaMultipla";
import { CAMPO_PRODUTOS_ID, REGIOES, comRegiao, opcoesComMarcados, regiaoDasEtiquetas } from "@/lib/gestao/regiao-produtos";
import { situacaoResposta, situacaoResolucao, fmtPrazo, fmtMeta, type SituacaoSla } from "@/lib/gestao/sla";
import { entrouNaColunaEm, formatarTempoLongo } from "@/lib/gestao/tempo-etapas";
import { BotaoTempo, RegistroTempo } from "@/components/gestao/TempoTracker";
import AnexosTarefa from "@/components/gestao/AnexosTarefa";
import HistoricoTarefa from "@/components/gestao/HistoricoTarefa";
import ComentariosTarefa from "@/components/gestao/ComentariosTarefa";
import ImagensCartao from "@/components/gestao/ImagensCartao";
import { useColarImagens, useComentarComImagens, useEnviarImagens } from "@/lib/hooks/useImagensCartao";
import { nomearColada, separarImagens } from "@/lib/gestao/imagens-cartao";
import { useTarefaHistorico } from "@/lib/hooks/useTarefaHistorico";
import { confirmar } from "@/components/ui/confirm";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import {
  alocadosExibir, entregaAtrasada, etapaExibir, fmtDataDesejada, fmtHorasTrabalhadas, progressoExibir,
  vemDoRunrun, etapaDaLinha, erroDatasSubtarefa,
} from "@/lib/gestao/subtarefa-colunas";
import {
  useAtualizarSubtarefa, useAdicionarSubtarefas, useExcluirSubtarefa, useCriarSubtarefaComJanela, useAtualizarJanelaSubtarefa,
  useJanelasDasSubtarefas, useResponsaveisDasJanelas, useAlocarNaSubtarefa, type JanelaSubtarefa, type PatchJanela,
} from "@/lib/hooks/useSubtarefasAoVivo";
import { DataSubtarefa, PrioridadeSubtarefa, StatusSubtarefa, TituloSubtarefa } from "@/components/gestao/SubtarefaCelulas";
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

/** Campo sem valor: mostra "Adicionar" no painel (como no Runrun). `false` conta como vazio (caixa de seleção). */
function campoVazio(v: unknown): boolean {
  return v == null || v === "" || v === false || (Array.isArray(v) && v.length === 0);
}

/** v353: uma linha do prazo de atendimento (1ª resposta ou resolução) no painel. */
function LinhaSla({ rotulo, meta, sit }: { rotulo: string; meta: number | null; sit: SituacaoSla }) {
  const cor = { estourado: "text-red-600", perto: "text-amber-700", cumprido: "text-marca-primary", cumprido_atrasado: "text-amber-700", no_prazo: "text-gray-800" }[sit.estado];
  const quando = (iso: string | null) => (iso ? fmtPrazo(iso) : "—");
  const txt =
    sit.estado === "cumprido" ? `cumprida (${quando(sit.em)})`
    : sit.estado === "cumprido_atrasado" ? `cumprida com atraso (${quando(sit.em)})`
    : sit.estado === "estourado" ? `atrasada — era até ${quando(sit.prazo)}`
    : `até ${quando(sit.prazo)}${sit.estado === "perto" ? " · perto de vencer" : ""}`;
  return (
    <p className="leading-snug">
      <span className="text-gray-500">{rotulo}:</span> <span className={`font-medium ${cor}`}>{txt}</span>{" "}
      <span className="text-[11px] text-gray-400">(meta {fmtMeta(meta)} úteis)</span>
    </p>
  );
}

/**
 * Linha do painel de campos (coluna da direita, como no Runrun): ícone + nome à esquerda e o valor
 * à direita. `largo` põe o nome em cima e o valor na largura toda (múltipla escolha, ex.: Produtos).
 */
/** JCN (Etapa 7.9a): a dica de cada linha do painel de campos, pela chave da linha. */
const DICA_DA_LINHA: Record<string, keyof typeof DICAS_GESTAO_TAREFA> = {
  status: "status", responsavel: "responsaveis", prioridade: "prioridade", etiquetas: "etiquetas", inicio: "inicio",
  termino: "termino", recorrencia: "recorrencia", seguidores: "seguidores", pontos: "pontos",
};

function LinhaCampo({ icone: Icone, rotulo, campo, largo = false, children }: {
  icone: LucideIcon;
  rotulo: string;
  /** Chave da linha: o "Adicionar" põe o cursor no primeiro campo dela. */
  campo?: string;
  largo?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-campo={campo} className={largo ? "py-1.5" : "flex items-start gap-3 py-1"}>
      <div className={`flex min-w-0 items-center gap-2 text-sm font-medium text-gray-600 ${largo ? "mb-1.5" : "w-32 shrink-0 pt-1.5"}`}>
        <Icone className="size-4 shrink-0 text-gray-400" aria-hidden />
        {campo && DICA_DA_LINHA[campo] ? (
          <Dica texto={DICAS_GESTAO_TAREFA[DICA_DA_LINHA[campo]]}><span className="truncate">{rotulo}</span></Dica>
        ) : (
          <span className="truncate" title={rotulo}>{rotulo}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function BotaoAdicionar({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Adicionar: ${rotulo}`} className="py-1.5 text-sm font-semibold text-marca-primary hover:underline">
      Adicionar
    </button>
  );
}

const SemValor = () => <span className="inline-block py-1.5 text-sm text-gray-400">—</span>;

type Aba = "detalhes" | "subtarefas" | "checklist" | "comentarios" | "anexos" | "historico" | "dependencias";

// Defaults ESTÁVEIS (referência constante): sem eles, `const { data = [] }` cria um array
// novo a cada render, tornando a dep do efeito de pré-população instável e disparando-o em
// todo render — o que zerava a seleção do usuário numa tarefa nova (C13).
const EMPTY_VINCULADOS: GestaoVinculado[] = [];
const EMPTY_USUARIOS: { nome: string; email: string }[] = [];
const EMPTY_SUBTAREFAS: GestaoSubtarefa[] = [];
const EMPTY_CHECKLIST: { feito: boolean }[] = [];
const EMPTY_TEMPO: GestaoTempo[] = [];
const EMPTY_TEXTOS: string[] = [];

export default function TarefaModal({
  open,
  onClose,
  idQuadro,
  tarefa: tarefaRecebida,
  statusInicial = "A_FAZER",
  statuses,
  campos,
  tarefasQuadro,
  podeEditar,
  podeComentar,
  etiquetasSugeridas = [],
  inicial = null,
  novaSubDe = null,
  onVoltarAoOriginal,
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
  /** Janela "Nova subtarefa" (11/11/2026): a tarefa-mãe. Com `tarefa` null, cria a subtarefa já com a janela completa. */
  novaSubDe?: GestaoTarefa | null;
  /** Janela de subtarefa aberta de DENTRO da tarefa-mãe (11/11/2026): o nome da mãe no topo só fecha esta janela e a mãe,
   *  que está embaixo, volta. Sem isto (subtarefa aberta pelo cartão, Agenda, link…), o nome troca a janela para a mãe. */
  onVoltarAoOriginal?: () => void;
}) {
  // 11/11/2026: "Subtarefa de <nome>" no topo é clicável e leva ao cartão original. Aberta sozinha, a janela passa a
  // mostrar a tarefa-mãe no lugar da subtarefa (mesmo quadro, mesmos status e campos). Fechar ou abrir outra volta ao normal.
  const [original, setOriginal] = useState<GestaoTarefa | null>(null);
  const [abrindoOriginal, setAbrindoOriginal] = useState(false);
  useEffect(() => { setOriginal(null); }, [open, tarefaRecebida?.id_tarefa]);
  const tarefa = original ?? tarefaRecebida;
  const salvar = useSalvarTarefa();
  const excluir = useExcluirTarefa();
  const salvarVinc = useSalvarVinculados();
  const salvarSub = useSalvarSubtarefas();
  const { data: subtarefasTabela = EMPTY_SUBTAREFAS } = useSubtarefas(tarefa?.id_tarefa);
  // v357: colunas do Runrun (etapa, tipo, alocados, horas, progresso, início) de cada subtarefa salva, pelo id.
  const subPorId = useMemo(() => new Map(subtarefasTabela.map((s) => [s.id, s])), [subtarefasTabela]);
  // 11/11/2026: na tarefa salva, cada mudança na lista de subtarefas grava na hora (lib/hooks/useSubtarefasAoVivo.ts).
  // Status, prioridade e datas vêm da janela de cada subtarefa (as do Runrun mostram, sem editar: a sincronização manda).
  const atualizarSub = useAtualizarSubtarefa();
  const adicionarSubs = useAdicionarSubtarefas();
  const excluirSub = useExcluirSubtarefa();
  const criarSubComJanela = useCriarSubtarefaComJanela();
  const atualizarJanela = useAtualizarJanelaSubtarefa();
  const filhasComJanela = useMemo(
    () => subtarefasTabela.filter((s) => s.id_tarefa_filha).map((s) => s.id_tarefa_filha as string),
    [subtarefasTabela],
  );
  const { data: janelas } = useJanelasDasSubtarefas(filhasComJanela);
  // 11/11/2026: todos os responsáveis da janela de cada subtarefa (a linha guarda um só).
  const { data: respJanelas } = useResponsaveisDasJanelas(filhasComJanela);
  const alocarNaSub = useAlocarNaSubtarefa();
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
  // 0.3.281 (= Painel 0.3.941): também a Nova subtarefa (novaSubDe = a tarefa-mãe).
  const idPai = tarefa?.id_tarefa_pai ?? (tarefa ? null : novaSubDe?.id_tarefa ?? null);
  const ehSub = !!idPai;
  // Lista de subtarefas de tarefa já salva: grava cada mudança na hora. Na Nova tarefa é rascunho até "Criar tarefa".
  const subAoVivo = !!tarefa && !ehSub;
  // Região e Produtos em toda tarefa (0.3.269 = Painel 0.3.908), como no formulário do Comercial — não na janela de
  // subtarefa. Na lista Comercial, Produtos é campo da própria lista (opções dela); nas outras, as opções vêm da v342.
  const campoProdutos = campos.find((c) => c.id === CAMPO_PRODUTOS_ID) ?? null;
  const { data: catalogoProdutos = EMPTY_TEXTOS } = useProdutosCatalogo(open && !ehSub && !campoProdutos);
  // 0.3.279 (= Painel 0.3.938): a janela da subtarefa mostra também a descrição do cartão original (lida sempre do
  // banco: a da lista em mãos pode estar velha ou nem estar carregada).
  const { data: mae } = useTarefaMae(idPai);
  const tituloPai = idPai ? tarefaMap.get(idPai)?.titulo ?? mae?.titulo ?? novaSubDe?.titulo ?? null : null;
  const descricaoMae = (idPai && mae?.descricao?.trim()) || null;
  // v292: duplo clique numa subtarefa abre a janela completa dela (por cima desta).
  const abrirSubtarefa = useAbrirSubtarefa();
  const [subAberta, setSubAberta] = useState<GestaoTarefa | null>(null);
  // 11/11/2026: "Nova subtarefa" abre por cima a mesma janela da Nova tarefa (novaSubDe = esta tarefa).
  const [novaSubAberta, setNovaSubAberta] = useState(false);
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
  // Painel de campos à direita (como no Runrun): campo vazio aparece como "Adicionar" e só vira
  // caixa de edição depois do clique (ou quando já tem valor). A seta esconde o painel na tela larga.
  const [camposAbertos, setCamposAbertos] = useState<Set<string>>(() => new Set());
  const [painelAberto, setPainelAberto] = useState(true);
  // "Criar outra" (como no Jira): depois de criar, a janela fica aberta e limpa para a próxima. Fica marcado
  // enquanto a tela estiver aberta (a janela não é desmontada ao fechar).
  const [criarOutra, setCriarOutra] = useState(false);
  // v351: checklist. Na Nova tarefa os itens ficam aqui até "Criar tarefa"; na existente gravam na hora.
  const [rascunhoChecklist, setRascunhoChecklist] = useState<string[]>([]);
  // 12/11/2026: imagens no cartão (abaixo da descrição) e no comentário. Na Nova tarefa/subtarefa ficam aqui até criar;
  // na existente gravam na hora. Ctrl+V em qualquer lugar desta janela cola no cartão; na caixa do comentário, nele.
  const [rascunhoImagens, setRascunhoImagens] = useState<File[]>([]);
  const [imagensComentario, setImagensComentario] = useState<File[]>([]);
  const enviarImagens = useEnviarImagens();
  const comentarComImagens = useComentarComImagens();
  const excluirAnexo = useExcluirAnexo();
  const colunaRef = useRef<HTMLDivElement>(null);
  const { data: checklist = EMPTY_CHECKLIST } = useChecklist(tarefa?.id_tarefa);
  const addChecklist = useAddChecklist();
  // v353: tempo estimado (horas + minutos, gravado em minutos no Salvar), comentário atribuído, requisito forçado
  // pelo Admin e prazo de atendimento (só nos quadros com prazo ligado).
  const [estH, setEstH] = useState("");
  const [estM, setEstM] = useState("");
  // v343 (= v354 do Painel): modelo usado na Nova tarefa.
  const [modeloUsado, setModeloUsado] = useState<string | null>(null);
  const [atribuirA, setAtribuirA] = useState("");
  const resolverComentario = useResolverComentario();
  const forcarRequisito = useMoverForcandoRequisito();
  const isAdmin = useUserStore((s) => s.user?.perfil === "Admin");
  const meuEmail = useUserStore((s) => s.user?.email ?? null);
  const { data: slaDaTarefa } = useSlaTarefas(tarefa && !tarefa.id_tarefa_pai ? tarefa.id_quadro : null, tarefa ? [tarefa.id_tarefa] : null);
  const sla = tarefa ? slaDaTarefa?.get(tarefa.id_tarefa) ?? null : null;
  const { data: modelosQuadro = [] } = useModelos(open && !tarefa && !ehSub ? idQuadro : null);
  const modelosNovaTarefa = useMemo(() => modelosQuadro.filter((m) => m.na_criacao), [modelosQuadro]);
  // v356 (item 15): sem responsável, sugere quem costuma fazer tarefas de título parecido neste quadro (histórico do
  // banco, sem IA externa). O título é lido 0,7 s depois de parar de digitar.
  const [tituloSug, setTituloSug] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTituloSug(titulo), 700);
    return () => clearTimeout(t);
  }, [titulo]);
  const pedeRespSug = open && !ehSub && podeEditar && responsaveisEmails.length === 0;
  const { data: respSugeridos = [] } = useResponsaveisSugeridos(tarefa?.id_quadro ?? idQuadro, tituloSug, pedeRespSug);
  const { data: tempoEntries = EMPTY_TEMPO } = useTempoTarefa(tarefa?.id_tarefa);
  const tituloRef = useRef<HTMLInputElement>(null);
  const painelRef = useRef<HTMLElement>(null);
  const { data: quadros } = useQuadros();
  const idDescricao = useId();
  const { data: timeline } = useTarefaHistorico(tarefa?.id_tarefa);
  const nComentarios = (timeline ?? []).filter((i) => i.kind === "comentario").length;
  // v353: desde quando a tarefa está na coluna atual (última mudança de status gravada pelo banco).
  const entrouEm = useMemo(
    () => (tarefa ? entrouNaColunaEm(tarefa.created_at, (timeline ?? []).filter((i) => i.kind === "movimentacao" && i.tipo === "status").map((i) => ({ de: null, para: null, em: i.created_at }))) : null),
    [tarefa, timeline],
  );

  useEffect(() => {
    if (!open) return;
    setAba("detalhes");
    setCamposAbertos(new Set());
    setRascunhoChecklist([]);
    setRascunhoImagens([]);
    setImagensComentario([]);
    setAtribuirA("");
    setModeloUsado(null);
    setEstH(tarefa?.tempo_estimado_min != null ? String(Math.floor(tarefa.tempo_estimado_min / 60)) : "");
    setEstM(tarefa?.tempo_estimado_min != null ? String(tarefa.tempo_estimado_min % 60) : "");
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
      const textos = (d.subtarefas ?? []).filter((t) => t.trim());
      if (!textos.length) toast.error("A IA não sugeriu subtarefas.");
      else if (subAoVivo && tarefa) {
        // Na tarefa salva entram direto na lista (se falhar, o hook avisa).
        adicionarSubs.mutate({ id_tarefa: tarefa.id_tarefa, textos }, { onSuccess: () => toast.success(`${textos.length} subtarefa(s) sugerida(s) e adicionada(s)`) });
      } else {
        setSubtarefas((s) => [...s, ...textos.map((t) => ({ texto: t, feito: false, responsavel_email: null }))]);
        toast.success(`${textos.length} subtarefa(s) sugerida(s)`);
      }
    } catch (e) { toast.error(mensagemErro(e, "IA indisponível no momento.")); } finally { setIaLoad(null); }
  }

  /** O nome da tarefa-mãe no topo da subtarefa: volta à mãe (fecha esta janela, se ela está por cima da mãe; senão, a
   *  janela passa a mostrar a mãe). Quem não vê a mãe recebe o aviso e fica onde está. */
  async function voltarAoOriginal() {
    if (onVoltarAoOriginal) { onVoltarAoOriginal(); return; }
    if (!idPai || abrindoOriginal) return;
    setAbrindoOriginal(true);
    try {
      const mae = (novaSubDe?.id_tarefa === idPai ? novaSubDe : null) ?? (await buscarTarefa(idPai));
      if (mae) setOriginal(mae);
      else toast.error("Você não tem acesso ao cartão original.");
    } catch (e) {
      toast.error(mensagemErro(e, "Não foi possível abrir o cartão original."));
    } finally {
      setAbrindoOriginal(false);
    }
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
    qc.invalidateQueries({ queryKey: ["gestao-subtarefas-janelas"] }); // datas e status da janela
    qc.invalidateQueries({ queryKey: ["gestao-subtarefas-responsaveis"] }); // responsáveis da janela
    qc.invalidateQueries({ queryKey: ["gestao-comentarios-subtarefas"] });
  }

  function addSub() {
    const t = novaSub.trim();
    if (!t) return;
    if (subAoVivo && tarefa) adicionarSubs.mutate({ id_tarefa: tarefa.id_tarefa, textos: [t] });
    else setSubtarefas((s) => [...s, { texto: t, feito: false, responsavel_email: null }]);
    setNovaSub("");
  }

  /** Título, feito ou responsável de uma linha: na tarefa salva grava na hora; na Nova tarefa fica no rascunho. */
  function mudarLinha(i: number, patch: Partial<Subtarefa>) {
    const s = subtarefas[i];
    setSubtarefas((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    if (subAoVivo && tarefa && s?.id) atualizarSub.mutate({ id: s.id, id_tarefa: tarefa.id_tarefa, patch });
  }

  async function removerLinha(i: number) {
    const s = subtarefas[i];
    if (!s) return;
    if (!subAoVivo || !tarefa || !s.id) {
      setSubtarefas((arr) => arr.filter((_, j) => j !== i));
      return;
    }
    // Com janela vai para a Lixeira (v361), como o Excluir de dentro da subtarefa; sem janela é só o título, sai de vez.
    const idFilha = subPorId.get(s.id)?.id_tarefa_filha ?? null;
    if (!(await confirmar({
      title: "Excluir subtarefa?",
      description: idFilha
        ? `"${s.texto}" vai para a Lixeira com comentários, checklist e anexos (sai também da lista de subtarefas). Dá para restaurar por ${DIAS_LIXEIRA} dias (menu da Gestão › Lixeira).`
        : `"${s.texto}" sai da lista. Esta ação não pode ser desfeita.`,
    }))) return;
    const id = s.id;
    setSubtarefas((arr) => arr.filter((x) => x.id !== id));
    excluirSub.mutate(
      { id, id_tarefa: tarefa.id_tarefa, id_filha: idFilha },
      { onSuccess: () => toast.success(idFilha ? "Subtarefa enviada para a Lixeira" : "Subtarefa excluída") },
    );
  }

  /** Etapa ou datas na própria linha: gravam na janela da subtarefa (criada na 1ª vez, como no duplo clique). */
  async function mudarJanela(s: Subtarefa & { id?: string }, patch: PatchJanela, evento?: { acao: string; payload: Record<string, unknown> }): Promise<boolean> {
    if (!tarefa || !s.id) return false;
    try {
      const idFilha = await atualizarJanela.mutateAsync({
        id_subtarefa: s.id, id_tarefa: tarefa.id_tarefa, id_filha: subPorId.get(s.id)?.id_tarefa_filha ?? null, patch,
      });
      if (evento) registrarAtiv.mutate({ id_tarefa: idFilha, ator: userNome, eventos: [evento] });
      return true;
    } catch {
      return false;   // o hook já avisou
    }
  }

  function mudarDataSub(s: Subtarefa & { id?: string }, j: JanelaSubtarefa | undefined, campo: "inicio" | "entrega", data: string, hora: string): Promise<boolean> | boolean {
    const atual = {
      data_inicio: j?.data_inicio ?? null,
      hora_inicio: j?.hora_inicio?.slice(0, 5) || null,
      prazo: j?.prazo ?? null,
      hora_fim: j?.hora_fim?.slice(0, 5) || null,
    };
    const patch: PatchJanela = campo === "inicio"
      ? { data_inicio: data || null, hora_inicio: hora || null }
      : { prazo: data || null, hora_fim: hora || null };
    const erro = erroDatasSubtarefa({ ...atual, ...patch });
    if (erro) { toast.error(erro); return false; }
    const mudouPrazo = campo === "entrega" && (data || null) !== atual.prazo;
    return mudarJanela(s, patch, mudouPrazo ? { acao: "prazo", payload: { de: atual.prazo ?? "—", para: data || "—" } } : undefined);
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
    } catch (e) {
      // useSalvarTarefa já avisou o erro e devolveu o cartão à coluna de antes
      setStatusSalvo(anterior);
      setStatus(anterior);
      // v353: requisito da etapa — o Admin pode forçar (fica no histórico da tarefa).
      if (ehErroRequisito(e) && isAdmin && await confirmar({
        title: "Forçar a mudança de coluna?",
        description: `${(e as Error).message} Como Admin, você pode forçar mesmo assim; fica registrado no histórico da tarefa.`,
        confirmLabel: "Forçar",
        variant: "primary",
      })) {
        try {
          await forcarRequisito.mutateAsync({ id_tarefa: tarefa.id_tarefa, status: novo });
          setStatusSalvo(novo);
          setStatus(novo);
          toast.success(`Status: ${nomeStatus(novo)} (forçado)`);
        } catch { /* o hook já avisou */ }
      }
    }
  }

  async function handleSalvar() {
    if (!titulo.trim()) {
      toast.error(ehSub ? "Informe o título da subtarefa." : "Informe o título da tarefa.");
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
    const estimadoMin = estH.trim() === "" && estM.trim() === "" ? null : Math.max(0, (parseInt(estH || "0", 10) || 0) * 60 + (parseInt(estM || "0", 10) || 0));
    const dados: Partial<GestaoTarefa> & { id_quadro: string } = {
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
      tempo_estimado_min: estimadoMin,
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
    };
    let idSalvo: string;
    if (!tarefa && novaSubDe) {
      // Nova subtarefa (11/11/2026): a linha no fim da lista da mãe + a janela dela; o resto entra como numa edição.
      const idFilha = await criarSubComJanela.mutateAsync({
        id_tarefa: novaSubDe.id_tarefa, texto: titulo.trim(), responsavel_email: responsaveisEmails[0] ?? null,
      });
      idSalvo = await salvar.mutateAsync({ ...dados, id_tarefa: idFilha });
    } else {
      idSalvo = await salvar.mutateAsync({ ...dados, id_tarefa: tarefa?.id_tarefa });
    }

    // Subtarefas (F2.1/v199). Na CRIACAO usa append (reconciliar:false) p/ NAO apagar subtarefas que uma automacao
    // (esteira/checklists em tarefa_criada) acabou de criar server-side; subsFinal ja inclui o flush do novaSub (UX-A).
    // Na EDICAO (11/11/2026) a lista ja gravou cada mudanca na hora: so entra o que ficou digitado sem Enter.
    if (!ehSub) {
      if (!tarefa) await salvarSub.mutateAsync({ id_tarefa: idSalvo, subtarefas: subsFinal, reconciliar: false });
      else if (subPend) await adicionarSubs.mutateAsync({ id_tarefa: idSalvo, textos: [subPend] });
    }
    // v351: checklist feito na Nova tarefa. Se falhar, a tarefa já existe (o aviso sai do hook) e segue o fluxo.
    if (!tarefa && rascunhoChecklist.length) {
      try { await addChecklist.mutateAsync({ id_tarefa: idSalvo, textos: rascunhoChecklist, ordemInicial: 0 }); } catch { /* avisado */ }
    }
    // Imagens coladas na Nova tarefa/subtarefa. Se falhar, a tarefa já existe (o aviso sai do hook) e segue o fluxo.
    if (!tarefa && rascunhoImagens.length) {
      try { await enviarImagens.mutateAsync({ id_tarefa: idSalvo, files: rascunhoImagens }); } catch { /* avisado */ }
    }

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
      toast.success(ehSub ? "Subtarefa criada. Pode escrever a próxima." : "Tarefa criada. Pode escrever a próxima.");
      setTitulo("");
      setDescricao("");
      setSubtarefas([]);
      setNovaSub("");
      setRascunhoChecklist([]);
      setRascunhoImagens([]);
      setModeloUsado(null);
      setAba("detalhes");
      requestAnimationFrame(() => tituloRef.current?.focus());
      return;
    }
    toast.success(ehSub ? (tarefa ? "Subtarefa atualizada" : "Subtarefa criada") : tarefa ? "Tarefa atualizada" : "Tarefa criada");
    onClose();
  }

  // v343 (= v354 do Painel, item 13): o modelo preenche o que está vazio e soma listas (lib/gestao/modelos.ts).
  function usarModelo(id: string) {
    const m = modelosNovaTarefa.find((x) => x.id === id);
    if (!m) return;
    const r = aplicarModelo(
      { titulo, descricao, prioridade, prazo, etiquetas, checklist: rascunhoChecklist, subtarefas },
      m,
      isoLocal(new Date()),
    );
    setTitulo(r.titulo);
    setDescricao(r.descricao);
    setPrioridade(r.prioridade);
    setPrazo(r.prazo);
    setEtiquetas(r.etiquetas);
    setRascunhoChecklist(r.checklist);
    setSubtarefas(r.subtarefas);
    setModeloUsado(m.titulo);
    toast.success(`Modelo "${m.titulo}" aplicado`);
  }

  // Ctrl+Enter (ou Cmd+Enter) salva, em qualquer campo da janela.
  function atalhoSalvar(e: { ctrlKey: boolean; metaKey: boolean; key: string; preventDefault: () => void }) {
    if (ro || !(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
    e.preventDefault();
    void handleSalvar();
  }

  async function handleExcluir() {
    if (!tarefa) return;
    const oQue = ehSub ? "subtarefa" : "tarefa";
    if (!(await confirmar({ title: `Excluir ${oQue}?`, description: `"${tarefa.titulo}" vai para a Lixeira com comentários, checklist, anexos e subtarefas${ehSub ? " (sai também da lista de subtarefas)" : ""}. Dá para restaurar por ${DIAS_LIXEIRA} dias (menu da Gestão › Lixeira).` }))) return;
    excluir.mutate(tarefa.id_tarefa, { onSuccess: () => { toast.success(ehSub ? "Subtarefa enviada para a Lixeira" : "Tarefa enviada para a Lixeira"); onClose(); } });
  }

  /** Imagens para o cartão (Ctrl+V, "Inserir imagem", "Colar imagem copiada"): grava na hora ou guarda até criar. */
  function adicionarImagensCartao(imagens: File[]) {
    if (!podeComentar) { toast.error("Você só pode ver este cartão."); return; }
    const nomeadas = imagens.map((f, k) => nomearColada(f, rascunhoImagens.length + k + 1));
    if (tarefa) {
      enviarImagens.mutate(
        { id_tarefa: tarefa.id_tarefa, files: nomeadas },
        { onSuccess: (n) => { if (n) toast.success(n > 1 ? `${n} imagens adicionadas ao cartão` : "Imagem adicionada ao cartão"); } },
      );
    } else {
      setRascunhoImagens((r) => [...r, ...nomeadas]);
    }
    setAba("detalhes");   // colou em outra aba: mostra onde a imagem foi parar
  }
  useColarImagens(open && podeComentarEf, colunaRef, adicionarImagensCartao, { ignorarDentro: "[data-colar-comentario]" });
  const { data: anexosTarefa = [] } = useAnexos(tarefa?.id_tarefa);

  function enviarComentario() {
    if (!tarefa || (!novoComentario.trim() && imagensComentario.length === 0)) return;
    const t = tarefa;
    const texto = novoComentario.trim();
    if (imagensComentario.length) {
      // Com imagem: o comentário nasce com id próprio e as imagens vão na pasta dele.
      comentarComImagens.mutate(
        { id_tarefa: t.id_tarefa, texto, autor: userNome, atribuido_a: atribuirA || null, files: imagensComentario },
        { onSuccess: () => {
          setNovoComentario("");
          setAtribuirA("");
          setImagensComentario([]);
          invalidarTimeline();
        } },
      );
      return;
    }
    addComentario.mutate(
      { id_tarefa: t.id_tarefa, texto, autor: userNome, atribuido_a: atribuirA || null },
      { onSuccess: () => {
        setNovoComentario("");
        setAtribuirA("");
        invalidarTimeline();
        // Avisos de comentário e de menção (@nome): gerados no banco por gatilho (v295).
      } },
    );
  }

  const inputCls =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-marca-primary focus:outline-none focus:ring-1 focus:ring-marca-primary/30 disabled:bg-gray-50";
  // Caixas do painel de campos: mais baixas e com fundo próprio (o painel é cinza); a largura vem de quem usa.
  const caixaPainel =
    "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-marca-primary focus:outline-none focus:ring-1 focus:ring-marca-primary/30 disabled:bg-gray-50";
  const produtosMarcados = Array.isArray(valoresCampos[CAMPO_PRODUTOS_ID]) ? (valoresCampos[CAMPO_PRODUTOS_ID] as string[]) : EMPTY_TEXTOS;
  // Fora da janela de subtarefa, Produtos tem linha própria (logo abaixo da Região): sai da lista de campos e dos "de origem".
  const camposGrade = ehSub ? campos : campos.filter((c) => c.id !== CAMPO_PRODUTOS_ID);
  const camposOrigemGrade = ehSub ? camposOrigem : camposOrigem.filter((c) => c.id !== CAMPO_PRODUTOS_ID);
  const regiao = regiaoDasEtiquetas(etiquetas);
  const totalChecklist = tarefa ? checklist.length : rascunhoChecklist.length;
  const feitosChecklist = tarefa ? checklist.filter((i) => i.feito).length : 0;
  const atrasada = !!prazo && prazo < isoLocal(new Date()) && statusMap.get(status)?.tipo !== "concluido";
  const estimadoAtual = (parseInt(estH || "0", 10) || 0) * 60 + (parseInt(estM || "0", 10) || 0);
  const gastoSeg = totalSegundos(tempoEntries);
  const pctEstimativa = estimadoAtual > 0 ? Math.round((gastoSeg / (estimadoAtual * 60)) * 100) : 0;
  const passouEstimativa = estimadoAtual > 0 && gastoSeg > estimadoAtual * 60;
  const feitas = subtarefas.filter((s) => s.feito).length;

  const nomeQuadro = quadros?.find((q) => q.id_quadro === (tarefa?.id_quadro ?? idQuadro))?.nome ?? null;
  // "Criada por" só quando quem criou é uma pessoa (e-mail); importação, recorrência etc. ficam só com a data.
  // v0.3.935: a de formulário mostra quem preencheu (ou o formulário), não o responsável fixo do formulário.
  const criadorForm = tarefa ? criadorDoFormulario(tarefa, nomeDe) : null;
  // "Criada por Ana (formulário)" / "Criada pelo formulário Ordem de Serviço" (enviado sem login).
  const criadaPeloForm = !!criadorForm && !criadorForm.chave.startsWith("e:");
  const criadaPor = criadorForm
    ? (criadaPeloForm ? criadorForm.nome.replace(/^Formulário:?\s*/, "") : `${criadorForm.nome} (formulário)`)
    : tarefa?.created_by?.includes("@") ? nomeDe(tarefa.created_by) ?? tarefa.created_by : null;
  const criadaEm = tarefa?.created_at ? new Date(tarefa.created_at) : null;
  const corStatus = statusMap.get(status)?.cor ?? "#94a3b8";
  const corPrioridade = PRIORIDADES.find((p) => p.value === prioridade)?.cor ?? "#94a3b8";

  /** Item 4: link direto da tarefa (o mesmo dos avisos e e-mails: /gestao?quadro=…&tarefa=…). */
  async function copiarLink() {
    if (!tarefa) return;
    const url = linkTarefa(window.location.origin, { id_quadro: tarefa.id_quadro, id_tarefa: tarefa.id_tarefa });
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link da tarefa copiado");
    } catch {
      // Sem a API da área de transferência (permissão negada / navegador antigo): cópia pelo jeito antigo.
      const caixa = document.createElement("textarea");
      caixa.value = url;
      caixa.style.position = "fixed";
      caixa.style.opacity = "0";
      document.body.appendChild(caixa);
      caixa.select();
      const ok = document.execCommand("copy");
      caixa.remove();
      if (ok) toast.success("Link da tarefa copiado");
      else toast.error(`Não deu para copiar. O link é: ${url}`);
    }
  }

  function abrirCampo(chave: string) {
    setCamposAbertos((s) => new Set(s).add(chave));
    // Depois de o React desenhar a caixa, o cursor vai para ela.
    requestAnimationFrame(() => {
      painelRef.current?.querySelector<HTMLElement>(`[data-campo="${chave}"] :is(input, select, textarea)`)?.focus();
    });
  }

  /** Campo com valor (ou já aberto pelo "Adicionar") mostra a caixa; vazio mostra "Adicionar" — ou "—" para quem só lê. */
  function campoOuAdicionar(chave: string, cheio: boolean, rotulo: string, caixa: () => ReactNode) {
    if (cheio || camposAbertos.has(chave)) return caixa();
    return ro ? <SemValor /> : <BotaoAdicionar rotulo={rotulo} onClick={() => abrirCampo(chave)} />;
  }

  /** Responsáveis/seguidores: as pessoas escolhidas e, para quem edita, "Adicionar" → caixa de busca. */
  function pessoas(chave: string, rotulo: string, emails: string[], remover: (em: string) => void, busca: ReactNode, destaque: boolean) {
    return (
      <div className="space-y-1.5">
        {emails.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {emails.map((em) => {
              const nome = nomeDe(em) ?? em;
              return (
                <span key={em} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-2 text-xs font-medium ${destaque ? "bg-marca-light text-marca-primary" : "bg-gray-100 text-gray-700"}`}>
                  <AvatarPessoa nome={nome} email={em} className="size-5 text-[9px]" />
                  {nome}
                  {!ro && (
                    <button type="button" aria-label={`Remover ${rotulo.toLowerCase()} ${nome}`} onClick={() => remover(em)} className="text-gray-400 hover:text-red-600">
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
        {ro
          ? emails.length === 0 && <SemValor />
          : camposAbertos.has(chave)
            ? busca
            : <BotaoAdicionar rotulo={rotulo} onClick={() => abrirCampo(chave)} />}
      </div>
    );
  }

  // Tarefa nova só tem Subtarefas (o resto precisa do id salvo); a janela de uma subtarefa
  // não tem Subtarefas nem Dependências (v300). Os campos ficam no painel da direita.
  const abas: { id: Aba; rotulo: string; contagem?: number }[] = [
    { id: "detalhes", rotulo: "Descrição" },
    ...(!ehSub ? [{ id: "subtarefas" as const, rotulo: "Subtarefas", contagem: subtarefas.length }] : []),
    { id: "checklist" as const, rotulo: "Checklist", contagem: totalChecklist },
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
      title={ehSub ? (tarefa ? "Subtarefa" : "Nova subtarefa") : tarefa ? "Editar tarefa" : "Nova tarefa"}
      size="3xl"
      // Tela larga: duas colunas (como no Runrun), cada uma com a própria rolagem e altura fixa — a janela
      // não pula ao trocar de aba. Celular: uma coluna só, o conteúdo e depois os campos.
      corpoClassName="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-[0_1_70vh] lg:flex-row lg:overflow-hidden"
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
              <button type="button" onClick={handleSalvar} disabled={salvar.isPending || criarSubComJanela.isPending} className="inline-flex items-center gap-2 rounded-lg bg-marca-primary px-5 py-2 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-50">
                {(salvar.isPending || criarSubComJanela.isPending) && <Loader2 className="size-4 animate-spin" />}
                {tarefa ? "Salvar" : ehSub ? "Criar subtarefa" : "Criar tarefa"}
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      {/* Coluna da esquerda: título, número/autoria e as abas. */}
      <div ref={colunaRef} className="flex min-w-0 flex-1 flex-col lg:min-h-0" onKeyDown={atalhoSalvar}>
        <div className="px-6 pt-5">
          {ehSub && (
            <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
              <CornerDownRight className="size-3.5 shrink-0" />
              Subtarefa de{" "}
              <button
                type="button"
                onClick={() => void voltarAoOriginal()}
                disabled={abrindoOriginal}
                title="Abrir o cartão original"
                className="inline-flex min-w-0 items-center gap-1 truncate rounded font-medium text-marca-primary hover:underline disabled:opacity-60"
              >
                <span className="truncate">{tituloPai ?? "…"}</span>
                {abrindoOriginal && <Loader2 className="size-3 shrink-0 animate-spin" />}
              </button>
            </p>
          )}
          <input
            ref={tituloRef}
            value={titulo}
            disabled={ro}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="O que precisa ser feito?"
            aria-label="Título (obrigatório)"
            className="-mx-2 w-[calc(100%+1rem)] rounded-md border border-transparent bg-transparent px-2 py-1 text-xl font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 hover:border-gray-200 focus:border-marca-primary focus:outline-none focus:ring-1 focus:ring-marca-primary/30 disabled:hover:border-transparent"
          />
          {!tarefa && !ehSub && modelosNovaTarefa.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <LayoutTemplate className="size-3.5 shrink-0 text-gray-400" aria-hidden />
              <select
                value=""
                onChange={(e) => { if (e.target.value) usarModelo(e.target.value); }}
                aria-label="Usar modelo"
                className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700 focus:border-marca-primary focus:outline-none"
              >
                <option value="">Usar modelo…</option>
                {modelosNovaTarefa.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
              </select>
              {modeloUsado && <span>Modelo <b className="font-medium text-gray-700">{modeloUsado}</b> aplicado (o que você já tinha escrito ficou)</span>}
            </div>
          )}
          {tarefa && (
            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-600">#{tarefa.id_tarefa}</span>
              <button
                type="button"
                onClick={copiarLink}
                title="Copiar o link desta tarefa"
                className="ml-1 inline-flex items-center gap-0.5 rounded px-1 align-middle font-medium text-gray-400 transition hover:bg-gray-100 hover:text-marca-primary"
              >
                <Link2 className="size-3.5" /> Copiar link
              </button>
              {criadaEm && (
                <>
                  {" · "}Criada{criadaPeloForm ? <> pelo formulário{criadaPor && <> <span className="font-medium text-gray-600">{criadaPor}</span></>}</> : criadaPor && <> por <span className="font-medium text-gray-600">{criadaPor}</span></>}
                  {" em "}{criadaEm.toLocaleDateString("pt-BR")} {criadaEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </>
              )}
            </p>
            {!ro && <BotaoTempo idTarefa={tarefa.id_tarefa} compacto />}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-end gap-2 border-b border-gray-200 px-6">
          <div role="tablist" aria-label="Seções da tarefa" className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={abaAtiva === a.id}
                onClick={() => setAba(a.id)}
                className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-sm font-medium transition ${
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
          <button
            type="button"
            onClick={() => setPainelAberto((v) => !v)}
            aria-expanded={painelAberto}
            aria-label={painelAberto ? "Esconder os campos" : "Mostrar os campos"}
            title={painelAberto ? "Esconder os campos" : "Mostrar os campos"}
            className="mb-1 hidden size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 lg:flex"
          >
            {painelAberto ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </button>
        </div>

        <div role="tabpanel" className="px-6 py-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {abaAtiva === "detalhes" && (
          <div>
            {/* Aprovação pendente (Painel 0.3.919): decide aqui, sem depender da Caixa de entrada da aprovadora. */}
            {tarefa?.id_tarefa && <AprovacaoNaTarefa idTarefa={tarefa.id_tarefa} podeEditarQuadro={podeEditar} onDecidido={onClose} />}
            {descricaoMae && (
              // Subtarefa: a descrição do cartão original (empresa, CNPJ, produtos…), só leitura; muda-se lá na tarefa.
              <section aria-label="Descrição do cartão original" className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <p className="mb-1 text-xs font-medium text-gray-600">
                  Do cartão original{tituloPai && <span className="font-normal text-gray-500"> · {tituloPai}</span>}
                </p>
                <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-sm text-gray-800">{descricaoMae}</div>
              </section>
            )}
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor={ro ? undefined : idDescricao} className="block text-xs font-medium text-gray-600"><Dica texto={DICAS_GESTAO_TAREFA.descricao}>{descricaoMae ? "Descrição da subtarefa" : "Descrição"}</Dica></label>
              {!ro && (
                <button type="button" onClick={iaDescricao} disabled={iaLoad !== null} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-marca-primary hover:bg-marca-light/50 disabled:opacity-50">
                  {iaLoad === "desc" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Redigir com IA
                </button>
              )}
            </div>
            {ro ? (
              // Quem só lê vê o texto (a caixa desabilitada ficava clara no tema escuro, com a letra apagada).
              <div id={idDescricao} className="whitespace-pre-wrap break-words text-sm text-gray-800">
                {descricao.trim() || <span className="text-gray-400">Sem descrição.</span>}
              </div>
            ) : (
              <textarea id={idDescricao} value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={descricaoMae ? 5 : 12} className={`${inputCls} resize-y`} />
            )}
            <ImagensCartao
              idTarefa={tarefa?.id_tarefa ?? null}
              podeAnexar={podeComentarEf}
              podeEditar={podeEditar}
              rascunho={rascunhoImagens}
              onAdicionar={adicionarImagensCartao}
              onTirarRascunho={(i) => setRascunhoImagens((r) => r.filter((_, j) => j !== i))}
              enviando={enviarImagens.isPending}
            />
          </div>
        )}

        {abaAtiva === "subtarefas" && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {subtarefas.length > 0 ? `${feitas} de ${subtarefas.length} concluída(s)` : "Nenhuma subtarefa ainda."}
            </span>
            {!ro && (
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={iaSubtarefas} disabled={iaLoad !== null} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-marca-primary hover:bg-marca-light/50 disabled:opacity-50">
                  {iaLoad === "sub" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Sugerir com IA
                </button>
                {/* 11/11/2026: a subtarefa completa (descrição, etapa, responsáveis, datas, checklist) numa janela igual à
                    da Nova tarefa. Na tarefa ainda não criada só dá o "Adicionar" da lista (a janela precisa da tarefa salva). */}
                {tarefa && (
                  <button
                    type="button"
                    onClick={() => setNovaSubAberta(true)}
                    className="inline-flex items-center gap-1 rounded-md bg-marca-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-marca-accent"
                  >
                    <Plus className="size-3.5" /> Nova subtarefa
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            {/* v357: colunas como a lista de subtarefas do Runrun (Etapa, Alocados, Horas trabalhadas, Progresso, Início
                desejado; v358 Entrega desejada, vermelha quando vence com a subtarefa aberta). Os valores vêm da
                sincronização; subtarefa da Gestão mostra o que tem. Rola na horizontal.
                11/11/2026 (pedido do usuário): Prioridade depois do título e Status no lugar de Tipo — os dois da janela
                da subtarefa (o "Status" e a "Prioridade" dela); Etapa fica só com a etapa que vem do Runrun. */}
            {subtarefas.length > 0 && (
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full min-w-[1400px] text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                    <tr>
                      <th className="w-8 px-2 py-1.5"><span className="sr-only">Concluída</span></th>
                      <th className="min-w-[220px] px-1.5 py-1.5">Título</th>
                      <th className="px-2 py-1.5">Prioridade</th>
                      <th className="px-2 py-1.5">Etapa</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="min-w-[290px] px-2 py-1.5">Alocados</th>
                      <th className="whitespace-nowrap px-2 py-1.5">Horas trabalhadas</th>
                      <th className="px-2 py-1.5">Progresso</th>
                      <th className="whitespace-nowrap px-2 py-1.5">Início desejado</th>
                      <th className="whitespace-nowrap px-2 py-1.5">Entrega desejada</th>
                      <th className="w-20 px-2 py-1.5"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  {/* divide-gray-100 não tem par no escuro (linha branca): a borda vai em cada linha. */}
                  <tbody>
                    {subtarefas.map((s, i) => {
                      const db = s.id ? subPorId.get(s.id) : undefined;
                      const etapa = db ? etapaExibir({ ...db, feito: s.feito }, statuses) : null;
                      const alocados = alocadosExibir({
                        alocados: db?.alocados, responsavel_email: s.responsavel_email, feito: s.feito,
                        responsaveis: db?.id_tarefa_filha ? respJanelas?.[db.id_tarefa_filha] : null,
                      }, nomeDe);
                      const prog = progressoExibir(db?.progresso);
                      const inicio = fmtDataDesejada(db?.inicio_desejado);
                      const entrega = fmtDataDesejada(db?.entrega_desejada);
                      // 11/11/2026: subtarefa da Gestão (não SRR-) numa tarefa salva edita status, prioridade e datas aqui mesmo
                      // (na janela dela). As do Runrun mostram status e prioridade da janela, sem editar.
                      const naLinha = subAoVivo && !!s.id && !vemDoRunrun(s.id);
                      const janela = db?.id_tarefa_filha ? janelas?.[db.id_tarefa_filha] : undefined;
                      const statusLinha = s.id ? etapaDaLinha(s.feito, janela?.status, statuses) : null;
                      const atrasada = entregaAtrasada(db?.entrega_desejada, s.feito)
                        || (naLinha && !!janela?.prazo && janela.prazo < isoLocal(new Date()) && !s.feito);
                      const n = (s.id && comentariosSub?.[filhaDaSub.get(s.id) ?? ""]) || 0;
                      return (
                        <tr key={i} className={`h-14 border-t border-gray-100 first:border-t-0 [&>td]:py-2.5 ${atrasada ? "bg-red-50" : s.feito ? "bg-gray-50/70" : ""}`} onDoubleClick={() => abrirSub(s)} title="Duplo clique abre a subtarefa">
                          <td className="px-2 py-1">
                            <button type="button" disabled={ro} onClick={() => mudarLinha(i, { feito: !s.feito })} aria-label={s.feito ? `Reabrir ${s.texto}` : `Concluir ${s.texto}`} className="align-middle text-gray-400 hover:text-marca-primary">
                              {s.feito ? <CheckSquare className="size-4 text-marca-primary" /> : <Square className="size-4" />}
                            </button>
                          </td>
                          <td className="px-1.5 py-1">
                            {subAoVivo && s.id ? (
                              <TituloSubtarefa valor={s.texto} feito={s.feito} ro={ro} rotulo={`Título da subtarefa ${i + 1}`} onSalvar={(t) => mudarLinha(i, { texto: t })} />
                            ) : (
                              <input
                                value={s.texto}
                                disabled={ro}
                                onChange={(e) => setSubtarefas((arr) => arr.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
                                className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-gray-200 focus:border-marca-primary focus:outline-none ${s.feito ? "text-gray-400 line-through" : "text-gray-700"}`}
                              />
                            )}
                          </td>
                          <td className="px-2 py-1">
                            {s.id ? (
                              <PrioridadeSubtarefa
                                valor={janela?.prioridade ?? null}
                                ro={ro || !naLinha}
                                rotulo={`Prioridade de ${s.texto}`}
                                onMudar={(pr) => void mudarJanela(s, { prioridade: pr }, { acao: "prioridade", payload: { de: janela?.prioridade ?? "—", para: pr } })}
                              />
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-1">
                            {etapa ? (
                              <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${etapa.concluida ? "bg-green-600 text-white" : "border border-gray-300 bg-gray-100 text-gray-700"}`}>{etapa.nome}</span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-1">
                            {s.id ? (
                              <StatusSubtarefa
                                valor={statusLinha}
                                statuses={statuses}
                                ro={ro || !naLinha}
                                rotulo={`Status de ${s.texto}`}
                                onMudar={(slug) => void mudarJanela(s, { status: slug }, { acao: "status", payload: { de: nomeStatus(statusLinha ?? ""), para: nomeStatus(slug) } })}
                              />
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex min-w-[280px] flex-wrap items-center gap-1.5">
                              {/* 11/11/2026: com 2+ alocados (ou só leitura), todos aparecem, cada um com foto e nome (antes: fotos
                                  sobrepostas e, na subtarefa da Gestão, só o responsável da linha). Com 1 ou nenhum, a linha
                                  continua com a foto + o campo de trocar o responsável; vários se ajustam na janela da subtarefa. */}
                              {(ro || alocados.length >= 2 || naLinha) && alocados.map((a, k) => (
                                <span key={`${a.email ?? a.nome}-${k}`} className="inline-flex max-w-[11rem] items-center gap-1 rounded-full border border-gray-200 bg-white py-0.5 pl-0.5 pr-2" title={a.feito ? `${a.nome} (entregou)` : a.nome}>
                                  <span className="relative inline-flex shrink-0">
                                    <AvatarPessoa nome={a.nome} email={a.email ?? undefined} className="size-5 text-[9px]" />
                                    {a.feito && <CheckCircle2 aria-hidden className="absolute -bottom-1 -right-1 size-3 rounded-full bg-white text-sky-600" />}
                                  </span>
                                  <span className="truncate text-xs text-gray-700">{a.nome.split(/\s+/).slice(0, 2).join(" ")}</span>
                                  {/* 11/11/2026: tirar a pessoa pela própria lista (subtarefa da Gestão, tarefa salva) */}
                                  {naLinha && !ro && a.email && (
                                    <button type="button" disabled={alocarNaSub.isPending} aria-label={`Tirar ${a.nome} de ${s.texto}`} title={`Tirar ${a.nome}`}
                                      onClick={() => alocarNaSub.mutate({ idTarefa: tarefa!.id_tarefa, idSubtarefa: s.id!, idFilha: db?.id_tarefa_filha ?? null, responsavelLinha: s.responsavel_email ?? null, email: a.email!, tirar: true })}
                                      className="-mr-1 shrink-0 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-40">
                                      <X className="size-3" />
                                    </button>
                                  )}
                                </span>
                              ))}
                              {/* 11/11/2026: acrescentar alguém sem abrir a subtarefa */}
                              {naLinha && !ro && (
                                <div className="w-36 shrink-0">
                                  <UsuarioCombobox
                                    usuarios={usuariosFull.filter((u) => !alocados.some((a) => a.email && a.email.toLowerCase() === u.email.toLowerCase()))}
                                    value=""
                                    onChange={(em) => { if (em) alocarNaSub.mutate({ idTarefa: tarefa!.id_tarefa, idSubtarefa: s.id!, idFilha: db?.id_tarefa_filha ?? null, responsavelLinha: s.responsavel_email ?? null, email: em }); }}
                                    placeholder="+ Adicionar"
                                    className="w-full rounded border border-dashed border-gray-300 px-2 py-1 text-xs focus:border-marca-primary focus:outline-none"
                                  />
                                </div>
                              )}
                              {!ro && !naLinha && alocados.length >= 2 && (
                                <span className="w-full text-[10px] text-gray-400">Para mudar, abra a subtarefa (duplo clique)</span>
                              )}
                              {!ro && !naLinha && alocados.length === 1 && (
                                <span className="relative inline-flex shrink-0" title={alocados[0].feito ? `${alocados[0].nome} (entregou)` : alocados[0].nome}>
                                  <AvatarPessoa nome={alocados[0].nome} email={alocados[0].email ?? undefined} className="size-5 text-[9px]" />
                                  {alocados[0].feito && <CheckCircle2 aria-hidden className="absolute -bottom-1 -right-1 size-3 rounded-full bg-white text-sky-600" />}
                                </span>
                              )}
                              {!ro && !naLinha && alocados.length <= 1 ? (
                                <div className="w-36 shrink-0">
                                  <UsuarioCombobox
                                    usuarios={usuariosFull}
                                    value={s.responsavel_email ?? ""}
                                    onChange={(em) => mudarLinha(i, { responsavel_email: em || null })}
                                    incluirVazio
                                    vazioLabel="Sem responsável"
                                    placeholder="Responsável…"
                                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-marca-primary focus:outline-none"
                                  />
                                </div>
                              ) : ro && alocados.length === 0 && <span className="text-gray-300">—</span>}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 text-xs tabular-nums text-gray-700">{fmtHorasTrabalhadas(db?.tempo_trabalhado_seg)}</td>
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-1.5" title={`Progresso: ${prog.texto}`}>
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                                <div className="h-full rounded-full bg-marca-primary" style={{ width: `${prog.barra}%` }} />
                              </div>
                              <span className="text-xs tabular-nums text-gray-600">{prog.texto}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 text-xs tabular-nums text-gray-700">
                            {naLinha ? (
                              <DataSubtarefa
                                data={janela?.data_inicio ?? ""}
                                hora={janela?.hora_inicio?.slice(0, 5) ?? ""}
                                ro={ro}
                                rotulo={`Início de ${s.texto}`}
                                onSalvar={(d, h) => mudarDataSub(s, janela, "inicio", d, h)}
                              />
                            ) : inicio ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`whitespace-nowrap px-2 py-1 text-xs tabular-nums ${atrasada ? "font-medium text-red-700" : "text-gray-700"}`}>
                            {naLinha ? (
                              <DataSubtarefa
                                data={janela?.prazo ?? ""}
                                hora={janela?.hora_fim?.slice(0, 5) ?? ""}
                                ro={ro}
                                atrasada={atrasada}
                                rotulo={`Entrega de ${s.texto}`}
                                onSalvar={(d, h) => mudarDataSub(s, janela, "entrega", d, h)}
                              />
                            ) : entrega ? (
                              <span className="inline-flex items-center gap-1" title={atrasada ? "Entrega desejada vencida" : undefined}>
                                {entrega}
                                {atrasada && <AlertCircle aria-label="Atrasada" className="size-3.5 text-red-600" />}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex items-center justify-end gap-1.5">
                              {n > 0 && (
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
                              )}
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
                                <button type="button" onClick={() => void removerLinha(i)} disabled={excluirSub.isPending} aria-label={`Remover subtarefa ${s.texto}`} className="text-gray-300 hover:text-red-600 disabled:opacity-50">
                                  <X className="size-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!ro && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={addSub} disabled={!novaSub.trim()} aria-label="Adicionar subtarefa" className="text-gray-400 hover:text-marca-primary disabled:text-gray-300 disabled:hover:text-gray-300">
                  <Plus className="size-4" />
                </button>
                <input
                  value={novaSub}
                  onChange={(e) => setNovaSub(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
                  placeholder={tarefa ? "Adicionar rápido: só o título (Enter ou +)…" : "Adicionar subtarefa (Enter ou +)…"}
                  className="flex-1 rounded border border-gray-200 px-1.5 py-1 text-sm focus:border-marca-primary focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
        )}

        {abaAtiva === "checklist" && (
          <ChecklistTarefa
            idTarefa={tarefa?.id_tarefa ?? null}
            podeEditar={podeEditar}
            rascunho={rascunhoChecklist}
            setRascunho={setRascunhoChecklist}
            nomeDe={nomeDe}
            titulo={titulo}
            descricao={descricao}
          />
        )}

        {tarefa && abaAtiva === "comentarios" && (
          <ComentariosTarefa
            idTarefa={tarefa.id_tarefa}
            ro={ro}
            podeComentar={podeComentarEf}
            usuarios={usuariosFull}
            meuEmail={meuEmail}
            podeResolverTodos={podeEditar}
            atribuirA={atribuirA}
            setAtribuirA={setAtribuirA}
            onResolver={(id, resolvido) => resolverComentario.mutate({ id_comentario: id, id_tarefa: tarefa.id_tarefa, resolvido })}
            novoComentario={novoComentario}
            setNovoComentario={setNovoComentario}
            onEnviar={enviarComentario}
            enviando={addComentario.isPending || comentarComImagens.isPending}
            imagensRascunho={imagensComentario}
            onAdicionarImagens={(imgs) => setImagensComentario((r) => [...r, ...imgs.map((f, k) => nomearColada(f, r.length + k + 1))])}
            onTirarImagem={(i) => setImagensComentario((r) => r.filter((_, j) => j !== i))}
            onExcluirComentario={(id) =>
              excluirComentario.mutate(
                { id_comentario: id, id_tarefa: tarefa.id_tarefa },
                { onSuccess: () => {
                  invalidarTimeline();
                  // As imagens do comentário saem com ele (do storage e da aba Anexos).
                  for (const a of separarImagens(anexosTarefa).porComentario.get(id) ?? []) {
                    excluirAnexo.mutate({ id: a.id, storage_path: a.storage_path });
                  }
                } },
              )
            }
          />
        )}

        {tarefa && abaAtiva === "anexos" && <AnexosTarefa idTarefa={tarefa.id_tarefa} podeEditar={podeEditar} />}

        {tarefa && abaAtiva === "historico" && <HistoricoTarefa idTarefa={tarefa.id_tarefa} statuses={statuses} statusAtual={statusSalvo} criadaEm={tarefa.created_at} />}

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

      {/* Coluna da direita: os campos da tarefa, um por linha (como no Runrun). Vazio = "Adicionar". */}
      <aside
        ref={painelRef}
        onKeyDown={atalhoSalvar}
        aria-label="Campos da tarefa"
        className={`shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-4 lg:w-[27rem] lg:overflow-y-auto lg:border-l lg:border-t-0 ${painelAberto ? "" : "lg:hidden"}`}
      >
        <div className="space-y-0.5">
          {nomeQuadro && (
            <LinhaCampo icone={Columns3} rotulo="Quadro">
              <p className="truncate py-1.5 text-sm font-medium text-gray-800" title={nomeQuadro}>{nomeQuadro}</p>
            </LinhaCampo>
          )}
          <LinhaCampo icone={ArrowRightLeft} rotulo="Status" campo="status">
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: corStatus }} aria-hidden />
              <select value={status} disabled={ro} onChange={(e) => mudarStatus(e.target.value)} aria-label="Status" className={`${caixaPainel} w-full`}>
                {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
              </select>
            </div>
            {(statusMap.get(status)?.requer_checklist || statusMap.get(status)?.requer_anexo) && (
              <p className="mt-1 text-[11px] text-gray-500">
                Para entrar aqui: {[statusMap.get(status)?.requer_checklist && "checklist todo marcado", statusMap.get(status)?.requer_anexo && "um anexo"].filter(Boolean).join(" e ")}
              </p>
            )}
            {tarefa && entrouEm && status === statusSalvo && (
              <p className="mt-0.5 text-[11px] text-gray-500">Nesta coluna há {formatarTempoLongo(Date.now() - new Date(entrouEm).getTime())}</p>
            )}
          </LinhaCampo>
          <LinhaCampo icone={UserRound} rotulo={responsaveisEmails.length > 1 ? `Responsáveis (${responsaveisEmails.length})` : "Responsável"} campo="responsavel">
            {pessoas(
              "responsavel",
              "Responsável",
              responsaveisEmails,
              (em) => setResponsaveisEmails((s) => s.filter((x) => x !== em)),
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
                className={`${caixaPainel} w-full`}
              />,
              true,
            )}
            {pedeRespSug && respSugeridos.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
                <span>Costuma fazer tarefas parecidas:</span>
                {respSugeridos.map((r) => (
                  <button
                    key={r.email}
                    type="button"
                    onClick={() => {
                      const e = r.email.toLowerCase();
                      setResponsaveisEmails((s) => [...new Set([...s, e])]);
                      setSeguidoresEmails((s) => s.filter((x) => x.toLowerCase() !== e)); // responsável não é também seguidor
                    }}
                    title={`Responsável em ${r.tarefas} tarefa(s) parecida(s) deste quadro`}
                    className="max-w-full truncate rounded-full border border-marca-primary/40 bg-white px-2 py-0.5 font-medium text-marca-primary hover:bg-marca-light"
                  >
                    {r.nome}
                  </button>
                ))}
              </div>
            )}
          </LinhaCampo>
          <LinhaCampo icone={Flag} rotulo="Prioridade" campo="prioridade">
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: corPrioridade }} aria-hidden />
              <select value={prioridade} disabled={ro} onChange={(e) => setPrioridade(e.target.value as PrioridadeTarefa)} aria-label="Prioridade" className={`${caixaPainel} w-full`}>
                {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </LinhaCampo>
          {!ehSub && (
            <>
              {/* Região e Produtos (0.3.269 = Painel 0.3.908), iguais ao formulário do Comercial, em todas as listas. A Região
                  grava a etiqueta da unidade; Produtos grava o campo da lista Comercial. */}
              <LinhaCampo icone={MapPin} rotulo="Região" campo="regiao">
                {campoOuAdicionar("regiao", !!regiao, "Região", () => (
                  <select value={regiao ?? ""} disabled={ro} onChange={(e) => setEtiquetas((s) => comRegiao(s, e.target.value || null))} aria-label="Região" className={`${caixaPainel} w-full`}>
                    <option value="">Selecione…</option>
                    {REGIOES.map((r) => <option key={r.tag} value={r.tag}>{r.label}</option>)}
                  </select>
                ))}
              </LinhaCampo>
              <LinhaCampo icone={Package} rotulo="Produtos" campo="produtos">
                <ListaSuspensaMultipla
                  opcoes={opcoesComMarcados(campoProdutos?.opcoes ?? catalogoProdutos, produtosMarcados)}
                  valor={produtosMarcados}
                  onChange={(v) => setValoresCampos((s) => ({ ...s, [CAMPO_PRODUTOS_ID]: v }))}
                  disabled={ro}
                />
              </LinhaCampo>
              {/* v338 (Painel v354, item 11): empresa do cadastro. Sem empresa, a sugestão (CNPJ ou nome no título) só preenche
                  quando a pessoa clica — e grava no Salvar, como os outros campos. A Agenda mostra a empresa de cada atividade. */}
              <LinhaCampo icone={Building2} rotulo="Empresa" campo="empresa">
                {ro ? (
                  idEmpresa ? (
                    <Link href={`/empresas/${idEmpresa}`} className="block truncate py-1.5 text-sm font-medium text-marca-primary hover:underline">
                      {nomeEmpresaDe(idEmpresa) ?? idEmpresa}
                    </Link>
                  ) : <SemValor />
                ) : campoOuAdicionar("empresa", !!idEmpresa, "Empresa", () => (
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
                ))}
                {!ro && !idEmpresa && sugestoesEmpresa.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
                    <span>{sugestoesEmpresa.length > 1 ? "Sugeridas pelo título:" : sugestoesEmpresa[0].por === "cnpj" ? "Sugerida pelo CNPJ do título:" : "Sugerida pelo título:"}</span>
                    {sugestoesEmpresa.map((s) => (
                      <button
                        key={s.id_empresa}
                        type="button"
                        onClick={() => { setIdEmpresa(s.id_empresa); abrirCampo("empresa"); }}
                        title="Usar esta empresa (grava ao salvar)"
                        className="max-w-full truncate rounded-full border border-marca-primary/40 bg-white px-2 py-0.5 font-medium text-marca-primary hover:bg-marca-light"
                      >
                        {s.nome}{s.municipio ? ` · ${s.municipio}` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </LinhaCampo>
            </>
          )}
          <LinhaCampo icone={Tag} rotulo="Etiquetas" campo="etiquetas">
            {campoOuAdicionar("etiquetas", etiquetas.length > 0, "Etiquetas", () => (
              <MultiChipInput value={etiquetas} onChange={setEtiquetas} sugestoes={etiquetasSugeridas} placeholder="Adicionar etiqueta…" ro={ro} />
            ))}
          </LinhaCampo>
        </div>

        <hr className="my-3 border-gray-200" />

        <div className="space-y-0.5">
          <LinhaCampo icone={CalendarDays} rotulo="Início" campo="inicio">
            {campoOuAdicionar("inicio", !!(dataInicio || horaInicio), "Início", () => (
              <CampoData
                data={dataInicio}
                hora={horaInicio}
                onChange={(d, h) => { setDataInicio(d); setHoraInicio(h); }}
                max={prazo || undefined}
                ro={ro}
                rotulo="Início"
                abrirAoMontar={!(dataInicio || horaInicio)}
                caixaCls={caixaPainel}
              />
            ))}
          </LinhaCampo>
          <LinhaCampo icone={CalendarCheck} rotulo="Término" campo="termino">
            {campoOuAdicionar("termino", !!(prazo || horaFim), "Término", () => (
              <CampoData
                data={prazo}
                hora={horaFim}
                onChange={(d, h) => { setPrazo(d); setHoraFim(h); }}
                min={dataInicio || undefined}
                ro={ro}
                rotulo="Término"
                atrasada={atrasada}
                abrirAoMontar={!(prazo || horaFim)}
                caixaCls={caixaPainel}
              />
            ))}
          </LinhaCampo>
          {!ehSub && (
            <LinhaCampo icone={Repeat} rotulo="Recorrência" campo="recorrencia">
              {campoOuAdicionar("recorrencia", !!recTipo, "Recorrência", () => (
                <div className="space-y-1.5">
                  <select value={recTipo} disabled={ro} onChange={(e) => setRecTipo(e.target.value as "" | "diaria" | "semanal" | "mensal")} aria-label="Recorrência" className={`${caixaPainel} w-full`}>
                    <option value="">Não repete</option>
                    <option value="diaria">Diária</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                  {recTipo && (
                    <span className="flex items-center gap-1.5 text-sm text-gray-600">a cada
                      <input type="number" min="1" value={recInt} disabled={ro} onChange={(e) => setRecInt(parseInt(e.target.value || "1", 10))} aria-label="Intervalo da recorrência" className={`${caixaPainel} w-16`} />
                      {recTipo === "diaria" ? "dia(s)" : recTipo === "semanal" ? "semana(s)" : "mês(es)"}
                    </span>
                  )}
                  {recTipo && <p className="text-[11px] text-gray-400">Uma nova tarefa é criada automaticamente a cada período (a partir do prazo).</p>}
                </div>
              ))}
            </LinhaCampo>
          )}
        </div>

        <hr className="my-3 border-gray-200" />
        <div className="space-y-0.5">
          {tarefa && (
            <LinhaCampo icone={Clock} rotulo="Tempo gasto">
              <div className="pt-1">
                <RegistroTempo idTarefa={tarefa.id_tarefa} podeEditar={podeEditar} semRotulo />
                {estimadoAtual > 0 && (
                  <div className="mt-1 flex items-center gap-2 px-1" title="Tempo gasto × estimado">
                    <span className="h-1.5 flex-1 rounded-full bg-gray-100" aria-hidden>
                      <span className={`block h-full rounded-full ${passouEstimativa ? "bg-red-500" : "bg-marca-primary"}`} style={{ width: `${Math.min(100, pctEstimativa)}%` }} />
                    </span>
                    <span className={`shrink-0 text-[11px] ${passouEstimativa ? "font-semibold text-red-600" : "text-gray-500"}`}>
                      {pctEstimativa}% de {formatarDuracao(estimadoAtual * 60)}
                    </span>
                  </div>
                )}
              </div>
            </LinhaCampo>
          )}
          <LinhaCampo icone={Hourglass} rotulo="Estimativa" campo="estimativa">
            {campoOuAdicionar("estimativa", estH.trim() !== "" || estM.trim() !== "", "Estimativa", () => (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <input type="number" min="0" value={estH} disabled={ro} onChange={(e) => setEstH(e.target.value)} aria-label="Horas estimadas" className={`${caixaPainel} w-16`} /> h
                <input type="number" min="0" max="59" value={estM} disabled={ro} onChange={(e) => setEstM(e.target.value)} aria-label="Minutos estimados" className={`${caixaPainel} w-16`} /> min
              </div>
            ))}
          </LinhaCampo>
          {sla && (
            <LinhaCampo icone={Timer} rotulo="Atendimento">
              <div className="space-y-1 py-1 text-sm">
                <LinhaSla rotulo="1ª resposta" meta={sla.meta_resposta} sit={situacaoResposta(sla)} />
                <LinhaSla rotulo="Resolução" meta={sla.meta_resolucao} sit={situacaoResolucao(sla)} />
              </div>
            </LinhaCampo>
          )}
        </div>

        <hr className="my-3 border-gray-200" />

        <div className="space-y-0.5">
          <LinhaCampo icone={Users} rotulo="Seguidores" campo="seguidores">
            {pessoas(
              "seguidores",
              "Seguidor",
              seguidoresEmails,
              (em) => setSeguidoresEmails((s) => s.filter((x) => x !== em)),
              <UsuarioCombobox
                usuarios={usuariosFull.filter((u) => !responsaveisEmails.includes(u.email.toLowerCase()) && !seguidoresEmails.includes(u.email))}
                value=""
                onChange={(em) => { if (em) setSeguidoresEmails((s) => [...new Set([...s, em])]); }}
                placeholder="Adicionar seguidor…"
                className={`${caixaPainel} w-full`}
              />,
              false,
            )}
          </LinhaCampo>
          <LinhaCampo icone={ListChecks} rotulo="Checklist" campo="checklist">
            {totalChecklist > 0 ? (
              <button type="button" onClick={() => setAba("checklist")} title="Abrir o checklist" className="flex w-full items-center gap-2 py-1.5 text-left text-sm text-gray-800 hover:text-marca-primary">
                <span className="font-medium">{tarefa ? `${feitosChecklist}/${totalChecklist}` : `${totalChecklist} item(ns)`}</span>
                {tarefa && (
                  <span className="h-1.5 flex-1 rounded-full bg-gray-100" aria-hidden>
                    <span className="block h-full rounded-full bg-marca-primary" style={{ width: `${Math.round((feitosChecklist / totalChecklist) * 100)}%` }} />
                  </span>
                )}
              </button>
            ) : ro ? <SemValor /> : <BotaoAdicionar rotulo="Checklist" onClick={() => setAba("checklist")} />}
          </LinhaCampo>
          <LinhaCampo icone={Gauge} rotulo="Pontos" campo="pontos">
            {campoOuAdicionar("pontos", pontos.trim() !== "", "Pontos", () => (
              <input type="number" min="0" value={pontos} disabled={ro} onChange={(e) => setPontos(e.target.value)} placeholder="—" aria-label="Pontos (esforço)" className={`${caixaPainel} w-24`} />
            ))}
          </LinhaCampo>
          {/* Campos personalizados do quadro. Múltipla escolha e caixa de seleção já são compactos e
              aparecem direto; os demais vazios ficam como "Adicionar". */}
          {camposGrade.map((c) => (
            <LinhaCampo key={c.id} icone={List} rotulo={c.nome} campo={`campo-${c.id}`} largo={c.tipo === "multi"}>
              {campoOuAdicionar(`campo-${c.id}`, c.tipo === "multi" || c.tipo === "checkbox" || !campoVazio(valoresCampos[c.id]), c.nome, () => (
                <CampoInput campo={c} value={valoresCampos[c.id]} onChange={(v) => setValoresCampos((s) => ({ ...s, [c.id]: v }))} disabled={ro} />
              ))}
            </LinhaCampo>
          ))}
          {/* Campos que vieram do cartão de origem (v325): só leitura, com o nome do quadro. */}
          {camposOrigemGrade.map((c) => (
            <LinhaCampo key={`origem:${c.id}`} icone={Link2} rotulo={`${c.nome} · ${c.quadro}`} largo={c.tipo === "multi"}>
              <div className="py-1.5" title="Só leitura — vem do cartão de origem">
                <ValorOrigem valor={c.valor} />
              </div>
            </LinhaCampo>
          ))}
        </div>
      </aside>

      {novaSubAberta && tarefa && (
        <TarefaModal
          open
          onClose={() => setNovaSubAberta(false)}
          onVoltarAoOriginal={() => setNovaSubAberta(false)}
          idQuadro={tarefa.id_quadro}
          tarefa={null}
          novaSubDe={tarefa}
          statusInicial={etapaDaLinha(false, null, statuses) ?? statusInicial}
          statuses={statuses}
          campos={campos}
          tarefasQuadro={tarefasQuadro}
          podeEditar={podeEditar}
          etiquetasSugeridas={etiquetasSugeridas}
        />
      )}
      {subAberta && (
        <TarefaModal
          open
          onClose={fecharSub}
          onVoltarAoOriginal={fecharSub}
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
