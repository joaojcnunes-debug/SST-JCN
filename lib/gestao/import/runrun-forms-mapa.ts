/**
 * De-para Runrun.it → Gestão para FORMULÁRIOS (GESTAO-KANBAN-03 F3). Puro e testável offline:
 * recebe o JSON capturado (raw/runrun/forms-AAAA-MM-DD.json no vault) e devolve o que gravar em
 * gestao_formularios (+ quadros/status/campos que precisam existir e as automações de roteamento
 * do "SST — Entrada"). Quem faz I/O é scripts/importar-runrun-forms.ts.
 */

import { tipoParaPrioridade } from "@/lib/gestao/import/runrun-mapa";
import type { PerguntaFormulario, TipoPergunta } from "@/lib/hooks/useGestao";

// ── Entrada (formato do JSON capturado) ──────────────────────────────────────────
export interface RRQuestion {
  id: number;
  type: string;
  label: string;
  field_key: string | null;
  required: boolean;
  description: string | null;
  details?: Record<string, unknown>;
  options?: { id: number; label: string; field_option_id: number | null }[];
  ramifications?: { id: number; option_id: number; option_label: string }[];
  ramification_id?: number;
}
export interface RRForm {
  id: number;
  title: string;
  is_active: boolean;
  answers_count: number;
  board_id: number;
  board_name: string;
  board_stage_id: number;
  board_stage_name: string;
  task_type_id: number;
  task_type_name: string;
  tags: string[];
  title_pattern: (number | string)[];
  is_public: boolean;
  is_shared_by_link: boolean;
  should_collect_sender_email: boolean;
  should_send_answers_to_sender_email: boolean;
  should_sender_become_guest: boolean;
  should_show_recaptcha: boolean;
  should_redirect: boolean;
  redirect_url: string | null;
  custom_confirmation: unknown;
  description: string | null;
  questions: RRQuestion[];
}

// ── Alvos no Gestão (decisão do operador 2026-09-18, briefing GESTAO-KANBAN-03) ──
export interface QuadroAlvo {
  id_quadro: string;
  nome: string;
  novo: boolean;          // precisa ser criado (espaço Geral / pasta JCN Consultoria)
  /** Status do quadro NOVO (slug → nome/tipo), criados pelo SQL. */
  status?: { slug: string; nome: string; tipo: "nao_iniciado" | "ativo" | "concluido"; ordem: number }[];
  /** Quadro EXISTENTE: etapa do Runrun (nome) → slug já existente no quadro (medido 2026-09-18). */
  etapas?: Record<string, string>;
}
export const ESPACO_GERAL = "87644a33-1ff5-4d64-8239-f69e831c72c6";
export const PASTA_CHABRA = "da3e65a5-ba9f-4c57-8ee2-ba69ed9a6698";
// Campos "globais" (vivem no Comercial; as automações das unidades condicionam por este id).
export const CAMPO_PRODUTOS_ID = "eb5d9daf-9b81-4903-bfd5-4fea654225e7";
export const CAMPO_TIPO_CLIENTE_ID = "9f953f19-99ef-4d5c-98c4-d147bec071a2";
export const QUADRO_SST_ENTRADA = "QDR-SSTENTRA";

const STATUS_PADRAO: NonNullable<QuadroAlvo["status"]> = [
  { slug: "A_FAZER", nome: "A fazer", tipo: "nao_iniciado", ordem: 0 },
  { slug: "EM_ANDAMENTO", nome: "Em andamento", tipo: "ativo", ordem: 1 },
  { slug: "EM_REVISAO", nome: "Em revisão", tipo: "ativo", ordem: 2 },
  { slug: "CONCLUIDO", nome: "Concluído", tipo: "concluido", ordem: 3 },
];

export const MAPA_BOARDS: Record<number, QuadroAlvo | null> = {
  594780: { id_quadro: "QDR-AAFEE5F3", nome: "Comercial", novo: false, etapas: {
    "Orçamento - Aguardando Aprovação": "ORC_AG_APROV", "Em negociação": "EM_NEGOCIACAO", "Solicitação de Orçamento": "SOLIC_ORCAMENTO",
  } },
  // Suporte T.I: "Novos chamados" virou A_FAZER na fusão do piloto (2026-09-18).
  598871: { id_quadro: "QDR-3F2CC5EF", nome: "Suporte T.I", novo: false, etapas: { "Novos chamados": "A_FAZER" } },
  // SST: quadro de ENTRADA; a automação roteia pela tag de unidade para o quadro da unidade,
  // na mesma etapa (mover_tarefa_quadro + status_destino). Slugs = os das unidades.
  594810: {
    id_quadro: QUADRO_SST_ENTRADA, nome: "SST — Entrada (formulários)", novo: true,
    status: [
      { slug: "REVISOES_A_FAZER", nome: "Revisões a Fazer", tipo: "nao_iniciado", ordem: 0 },
      { slug: "FISCALIZACAO", nome: "Fiscalização", tipo: "ativo", ordem: 1 },
      { slug: "DOC_RETROATIVAS", nome: "Documentações Retroativas", tipo: "ativo", ordem: 2 },
      { slug: "CONCLUIDA", nome: "Concluída", tipo: "concluido", ordem: 3 },
    ],
  },
  597675: { id_quadro: "QDR-RRPSICOS", nome: "Psicossocial", novo: true, status: [
    { slug: "DRPS", nome: "DRPS", tipo: "nao_iniciado", ordem: 0 },
    { slug: "ENVIO_DO_FORMULARIO", nome: "Envio do formulário", tipo: "ativo", ordem: 1 },
    { slug: "CAMPANHAS", nome: "Campanhas", tipo: "ativo", ordem: 2 },
    { slug: "PER", nome: "PER", tipo: "ativo", ordem: 3 },
    { slug: "EM_ANDAMENTO", nome: "Em andamento", tipo: "ativo", ordem: 4 },
    { slug: "CONCLUIDO", nome: "Concluído", tipo: "concluido", ordem: 5 },
  ] },
  595427: { id_quadro: "QDR-RRPPP001", nome: "PPP", novo: true, status: STATUS_PADRAO },
  597054: { id_quadro: "QDR-RRCAT001", nome: "CAT", novo: true, status: STATUS_PADRAO },
  595455: { id_quadro: "QDR-RRCERTRE", nome: "Certificados e Treinamentos", novo: true, status: [
    { slug: "CERTIFICADOS", nome: "Certificados", tipo: "nao_iniciado", ordem: 0 },
    { slug: "TREINAMENTOS", nome: "Treinamentos", tipo: "nao_iniciado", ordem: 1 },
    { slug: "EM_ANDAMENTO", nome: "Em andamento", tipo: "ativo", ordem: 2 },
    { slug: "CONCLUIDO", nome: "Concluído", tipo: "concluido", ordem: 3 },
  ] },
  595144: { id_quadro: "QDR-RREPIS01", nome: "EPIs", novo: true, status: STATUS_PADRAO },
  596354: null, // Agenda — só tem form inativo; ignorado
};

/** Unidades = quadros de destino do roteamento SST (tag da tarefa, como as automações do Comercial usam). */
export const UNIDADES: { tag: string; label: string; id_quadro: string }[] = [
  { tag: "teresopolis", label: "Teresópolis", id_quadro: "QDR-CBDD056A" },
  { tag: "nova friburgo", label: "Nova Friburgo", id_quadro: "QDR-7D4CA761" },
  { tag: "guapimirim", label: "Guapimirim", id_quadro: "QDR-82E95561" },
  { tag: "campos", label: "Campos", id_quadro: "QDR-82EB39A0" },
  { tag: "piabeta", label: "Piabetá", id_quadro: "QDR-A6B208EC" },
  { tag: "petropolis", label: "Petrópolis", id_quadro: "QDR-25F53712" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────────
export function slugStatus(nome: string): string {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Etapa do Runrun → slug de status no quadro-alvo. Nas etapas do SST usa o slug da unidade. */
export function slugEtapa(boardId: number, etapa: string): string {
  const alvo = MAPA_BOARDS[boardId];
  const nome = etapa.trim().toLowerCase();
  const existente = Object.entries(alvo?.etapas ?? {}).find(([n]) => n.toLowerCase() === nome);
  if (existente) return existente[1];
  const conhecido = alvo?.status?.find((s) => s.nome.toLowerCase() === nome);
  if (conhecido) return conhecido.slug;
  return slugStatus(etapa);
}

const TIPO_POR_QUESTION: Record<string, TipoPergunta> = {
  short_text: "texto", long_text: "texto_longo", email: "email", creator_email: "email",
  cnpj: "cnpj", cpf: "cpf", phone: "telefone", date: "data", date_time: "data_hora",
  single_option: "selecao", multiple_options: "multipla", tags: "selecao", documents: "texto_longo",
};

export const idPergunta = (q: RRQuestion) => `rr${q.id}`;

export interface CampoNecessario {
  id_quadro: string;
  nome: string;
  tipo: "multi" | "selecao";
  opcoes: string[];
  /** Chave estável para o script resolver o id (existente ou novo) — `${id_quadro}|${nome}`. */
  chave: string;
}

export interface CtxMapa {
  /** Resolve o destino `campo:<id>` de um field_key custom no quadro-alvo. Devolve null se desconhecido. */
  campoDestino: (fieldKey: string, quadro: string, nome: string, tipo: "multi" | "selecao", opcoes: string[]) => string | null;
}

/** Uma pergunta do Runrun → PerguntaFormulario (F1 + F1.5). */
export function mapearPergunta(q: RRQuestion, form: RRForm, alvo: QuadroAlvo, ctx: CtxMapa, avisos: string[]): PerguntaFormulario {
  const tipo = TIPO_POR_QUESTION[q.type] ?? "texto";
  const p: PerguntaFormulario = { id: idPergunta(q), label: q.label.trim(), obrigatorio: !!q.required, tipo, destino: "descricao" };
  if (q.description) p.ajuda = q.description.trim();
  if (q.type === "creator_email") { p.label = p.label || "Seu e-mail"; p.obrigatorio = true; }
  if (q.type === "documents") {
    p.pendente_anexo = true;
    p.obrigatorio = false; // sem upload público o texto é opcional; a tarefa nasce marcada
    avisos.push(`form ${form.id} "${form.title}": pergunta de anexo "${q.label}" vira texto + anexo pendente (F2 decide upload)`);
  }
  if (q.type === "tags") {
    // "Região"/"Cidade": a tag de unidade que o roteamento usa. Opções = unidades (o Runrun tinha
    // "todas as tags da conta"). Gravada em etiquetas (a rota normaliza "Teresópolis"→"teresopolis").
    p.tipo = "selecao";
    p.opcoes = UNIDADES.map((u) => u.label);
    p.destino = "etiquetas";
  } else if (q.type === "single_option" || q.type === "multiple_options") {
    p.opcoes = (q.options ?? []).map((o) => o.label.trim()).filter(Boolean);
    if (q.field_key && q.field_key.startsWith("custom_")) {
      const nome = q.field_key === "custom_86" ? "Produtos" : q.field_key === "custom_100" ? "Tipo de Cliente" : q.label.trim();
      const dest = ctx.campoDestino(q.field_key, alvo.id_quadro, nome, q.type === "multiple_options" ? "multi" : "selecao", p.opcoes);
      if (dest) p.destino = dest;
      else avisos.push(`form ${form.id}: campo ${q.field_key} ("${q.label}") sem destino no quadro ${alvo.id_quadro} — vai para a descrição`);
    }
  }
  // Ramificação: a pergunta-alvo (ramification_id) aparece só quando a origem tem a opção.
  if (q.ramification_id) {
    const origem = form.questions.find((x) => (x.ramifications ?? []).some((r) => r.id === q.ramification_id));
    const ram = origem?.ramifications?.find((r) => r.id === q.ramification_id);
    if (origem && ram) p.condicao = { pergunta: idPergunta(origem), opcao: ram.option_label };
    else avisos.push(`form ${form.id}: pergunta "${q.label}" tem ramification_id ${q.ramification_id} sem origem — fica sempre visível`);
  }
  return p;
}

/** `task_title_composition_pattern` → tokens do Gestão. */
export function mapearTitulo(form: RRForm): string[] | null {
  const tokens = (form.title_pattern ?? []).map((t) => (t === "form_title" ? "form_title" : typeof t === "number" ? `p:rr${t}` : null)).filter((t): t is string => !!t);
  // Só "form_title" = não compõe nada (o título é o do form); deixa o respondente digitar? Não:
  // o Runrun usa o título do form como título da tarefa. Mantém a composição para fidelidade.
  return tokens.length ? tokens : null;
}

export interface FormMapeado {
  runrun_form_id: number;
  id_quadro: string;
  titulo: string;
  descricao: string | null;
  ativo: boolean;
  mostra_descricao: boolean;
  mostra_prazo: boolean;
  mostra_prioridade: boolean;
  prioridade_padrao: string;
  status_inicial: string;
  etiquetas_padrao: string[];
  perguntas: PerguntaFormulario[];
  titulo_composicao: string[] | null;
  origem: Record<string, unknown>;
}

export function mapearForm(form: RRForm, ctx: CtxMapa, avisos: string[]): FormMapeado | null {
  const alvo = MAPA_BOARDS[form.board_id];
  if (!alvo) { avisos.push(`form ${form.id} "${form.title}" (board ${form.board_name}) ignorado — sem quadro-alvo`); return null; }
  const prio = tipoParaPrioridade(form.task_type_name);
  const etiquetasPadrao = [...prio.etiquetasExtra, ...(form.tags ?? []).map((t) => t.toLowerCase().trim())].filter(Boolean);
  const perguntas = form.questions.map((q) => mapearPergunta(q, form, alvo, ctx, avisos));
  // Prazo desejado do Runrun (field_key desired_start_date/desired_delivery_date) → destino prazo.
  for (let i = 0; i < perguntas.length; i++) {
    const fk = form.questions[i].field_key;
    if (fk === "desired_delivery_date" || fk === "desired_start_date") perguntas[i].destino = "prazo";
  }
  return {
    runrun_form_id: form.id,
    id_quadro: alvo.id_quadro,
    titulo: form.title.trim(),
    descricao: form.description?.trim() || null,
    ativo: !!form.is_active,
    mostra_descricao: false,      // o Runrun não tem "detalhes" livre além das perguntas
    mostra_prazo: false,
    mostra_prioridade: false,
    prioridade_padrao: prio.prioridade,
    status_inicial: slugEtapa(form.board_id, form.board_stage_name),
    etiquetas_padrao: [...new Set(etiquetasPadrao)],
    perguntas,
    titulo_composicao: mapearTitulo(form),
    origem: {
      fonte: "runrun.it", board_id: form.board_id, board_name: form.board_name, stage_id: form.board_stage_id,
      stage_name: form.board_stage_name, task_type: form.task_type_name, answers_count: form.answers_count,
      is_public: form.is_public, is_shared_by_link: form.is_shared_by_link, guest: form.should_sender_become_guest,
      recaptcha: form.should_show_recaptcha, redirect_url: form.redirect_url ?? null,
    },
  };
}

/** Automações de roteamento do "SST — Entrada": tarefa criada na etapa X com tag da unidade → move p/ a unidade, mesma etapa. */
export function automacoesRoteamentoSST(): { nome: string; gatilho: string; condicao: unknown; acao: unknown }[] {
  const etapas = MAPA_BOARDS[594810]!.status!.filter((s) => s.tipo !== "concluido");
  const out: { nome: string; gatilho: string; condicao: unknown; acao: unknown }[] = [];
  for (const u of UNIDADES) for (const e of etapas) {
    out.push({
      nome: `[SST] Entrada → ${u.label} · ${e.nome} (tag → move p/ a unidade)`,
      gatilho: "tarefa_criada",
      condicao: { all: [{ campo: "status", op: "=", valor: e.slug }, { campo: "etiqueta", op: "contains", valor: u.tag }] },
      acao: { tipo: "mover_tarefa_quadro", id_quadro_destino: u.id_quadro, status_destino: e.slug },
    });
  }
  return out;
}
