/**
 * Filtros das listas da Gestão (barra "Filtros" e lateral do calendário, etapa 2 do calendário do Runrun,
 * 10/11/2026). Valem para todas as visões (Quadro, Lista, Calendário…) porque o estado é um só.
 *
 * Os critérios também são gravados em `gestao_filtros_salvos.criterios` (jsonb): um filtro salvo antes de um
 * campo existir chega sem ele — por isso `comPadrao` completa com FILTRO_VAZIO antes de aplicar.
 */
import { differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { nomesResponsaveis, temResponsavel } from "@/lib/gestao/responsaveis";
import { CAMPO_PRODUTOS_ID, regiaoDasEtiquetas } from "@/lib/gestao/regiao-produtos";

export type PrazoFiltro = "" | "atrasadas" | "sem" | "hoje" | "amanha" | "semana" | "mes" | "periodo";
export type SituacaoFiltro = "" | "abertas" | "concluidas";
/** O que a lista mostra: só as tarefas (padrão), só as subtarefas ou as duas (11/11/2026: também dentro do "Filtros"). */
export type MostrarItens = "tarefas" | "subtarefas" | "ambas";
const MOSTRAR_VALIDOS: readonly MostrarItens[] = ["tarefas", "subtarefas", "ambas"];

export interface FiltrosGestao {
  responsavel: string;
  prioridades: string[];
  status: string[];
  etiquetas: string[];
  prazo: PrazoFiltro;
  semResponsavel: boolean;
  /** id da equipe: tarefas em que algum responsável é da equipe. */
  equipe: string;
  /** e-mail do seguidor. */
  seguidor: string;
  /** chave de `criadorDe` ("e:<email>" ou "r:<apelido do Runrun>"). */
  criadoPor: string;
  /** etiqueta da região (REGIOES.tag). */
  regiao: string;
  produtos: string[];
  situacao: SituacaoFiltro;
  /** prazo = "periodo": de/até (yyyy-MM-dd; vazio = sem limite). */
  prazoDe: string;
  prazoAte: string;
  /** Tarefas, subtarefas ou as duas. Não entra em `passaFiltros`: a página escolhe os itens antes (ver itensMostrar). */
  mostrar: MostrarItens;
}

export const FILTRO_VAZIO: FiltrosGestao = {
  responsavel: "", prioridades: [], status: [], etiquetas: [], prazo: "", semResponsavel: false,
  equipe: "", seguidor: "", criadoPor: "", regiao: "", produtos: [], situacao: "", prazoDe: "", prazoAte: "",
  mostrar: "tarefas",
};

/** Critérios de um filtro salvo (talvez antigo, sem os campos novos) → filtro completo. */
export function comPadrao(c: Partial<FiltrosGestao> | null | undefined): FiltrosGestao {
  const f = { ...FILTRO_VAZIO, ...(c ?? {}) };
  return MOSTRAR_VALIDOS.includes(f.mostrar) ? f : { ...f, mostrar: "tarefas" };
}

export function contarFiltros(f: FiltrosGestao): number {
  return [
    f.responsavel, f.prioridades.length, f.status.length, f.etiquetas.length,
    f.prazo === "periodo" ? f.prazoDe || f.prazoAte : f.prazo, f.semResponsavel,
    f.equipe, f.seguidor, f.criadoPor, f.regiao, (f.produtos ?? []).length, f.situacao,
    (f.mostrar ?? "tarefas") !== "tarefas",
  ].filter(Boolean).length;
}

/** Produtos marcados na tarefa (campo "Produtos" do Comercial). */
export function produtosDa(campos: Record<string, unknown> | null | undefined): string[] {
  const v = campos?.[CAMPO_PRODUTOS_ID];
  return Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? [v] : [];
}

// ── Quem criou ────────────────────────────────────────────────────────────────

export interface Pessoa { nome: string; email: string }
export interface Criador { chave: string; nome: string }

/** "Ana Clara Souza" → "ana-clara-souza" (como os apelidos de usuário do Runrun). */
export function apelido(nome: string): string {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Apelido do Runrun → e-mail da pessoa no painel. O Runrun grava o criador como apelido ("isabela-esteves",
 * "ana-clara", "madu"): casa com o nome completo, com nome + sobrenome ou com os dois primeiros nomes.
 * Apelido que casa com mais de uma pessoa fica de fora (melhor mostrar o apelido que juntar pessoas erradas).
 */
export function mapaApelidos(pessoas: readonly Pessoa[]): Map<string, string> {
  const achados = new Map<string, Set<string>>();
  for (const p of pessoas) {
    const ps = apelido(p.nome).split("-").filter(Boolean);
    if (!ps.length) continue;
    const formas = new Set([ps.join("-"), `${ps[0]}-${ps[ps.length - 1]}`, ps.slice(0, 2).join("-")]);
    for (const f of formas) {
      if (!f.includes("-")) continue; // um nome só ("maria") junta gente demais
      if (!achados.has(f)) achados.set(f, new Set());
      achados.get(f)!.add(p.email.toLowerCase());
    }
  }
  const out = new Map<string, string>();
  for (const [f, emails] of achados) if (emails.size === 1) out.set(f, [...emails][0]);
  return out;
}

function nomeDoApelido(a: string): string {
  return a.split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Tarefa que veio de um formulário da Gestão (11/11/2026, v0.3.935). `created_by` de formulário é o responsável FIXO
 * do formulário (ou "Formulário") — não quem preencheu — e continua assim porque decide quem vê e quem recebe aviso.
 * Quem preencheu fica em `origem.enviado_por` (só quando enviou logado no painel): é ela que aparece em "Criada por".
 * Sem login (ou formulário enviado antes da v0.3.935) → "Formulário: <título>" / "Formulário".
 * Não é formulário → null (segue a regra de `criadorDe`).
 */
export function criadorDoFormulario(
  t: { created_by: string | null; origem?: Record<string, unknown> | null },
  nomeDe: (email: string) => string | null | undefined,
): Criador | null {
  const o = t.origem ?? {};
  const legado = (t.created_by ?? "").trim().toLowerCase() === "formulário";
  if (o.tipo !== "formulario" && !legado) return null;
  const env = String(o.enviado_por ?? "").trim().toLowerCase();
  if (env.includes("@")) return { chave: `e:${env}`, nome: nomeDe(env) || env };
  const tit = String(o.titulo_formulario ?? "").trim();
  return { chave: `f:${tit.toLowerCase()}`, nome: tit ? `Formulário: ${tit}` : "Formulário" };
}

/**
 * Quem criou a tarefa. `created_by` é o e-mail; nas importadas do Runrun é "importador" e o criador vem em
 * `origem.user_id` (apelido do Runrun, às vezes vazio); nas de formulário, ver `criadorDoFormulario`.
 * Sem criador conhecido → null.
 */
export function criadorDe(
  t: { created_by: string | null; origem?: Record<string, unknown> | null },
  nomePorEmail: ReadonlyMap<string, string>,
  apelidos: ReadonlyMap<string, string>,
): Criador | null {
  const doForm = criadorDoFormulario(t, (e) => nomePorEmail.get(e));
  if (doForm) return doForm;
  const cb = (t.created_by ?? "").trim().toLowerCase();
  if (cb && cb !== "importador") return { chave: `e:${cb}`, nome: nomePorEmail.get(cb) ?? cb };
  const rr = String(t.origem?.user_id ?? "").trim().toLowerCase();
  if (!rr) return null;
  const email = apelidos.get(rr);
  if (email) return { chave: `e:${email}`, nome: nomePorEmail.get(email) ?? email };
  return { chave: `r:${rr}`, nome: `${nomeDoApelido(rr)} (Runrun)` };
}

// ── O filtro ─────────────────────────────────────────────────────────────────

export interface CtxFiltro {
  /** yyyy-MM-dd */
  hoje: string;
  concluida: (t: TarefaFiltravel) => boolean;
  /** Nomes dos membros da equipe escolhida (quando `equipe` está marcado). */
  nomesDaEquipe?: readonly string[];
  /** E-mails dos seguidores da tarefa. */
  seguidoresDe?: (idTarefa: string) => readonly string[];
  /** Chave de quem criou (ver `criadorDe`). */
  chaveCriador?: (t: TarefaFiltravel) => string | null;
  /** Campos que não se aplicam aqui (ex.: status no calendário de várias listas). */
  ignorar?: ReadonlySet<keyof FiltrosGestao>;
}

export interface TarefaFiltravel {
  id_tarefa: string;
  id_quadro: string;
  responsavel: string | null;
  prioridade: string;
  status: string;
  etiquetas: string[] | null;
  prazo: string | null;
  campos: Record<string, unknown> | null;
  created_by: string | null;
  origem?: Record<string, unknown> | null;
}

function noPrazo(f: FiltrosGestao, prazo: string | null, feita: boolean, hoje: string): boolean {
  if (!f.prazo) return true;
  if (f.prazo === "periodo" && !f.prazoDe && !f.prazoAte) return true; // "Período…" ainda sem datas: não filtra
  if (f.prazo === "sem") return !prazo;
  if (!prazo) return false;
  const d = differenceInCalendarDays(parseISO(prazo), parseISO(hoje));
  switch (f.prazo) {
    case "atrasadas": return d < 0 && !feita;
    case "hoje": return d === 0;
    case "amanha": return d === 1;
    case "semana": return d >= 0 && d <= 7;
    case "mes": {
      const h = parseISO(hoje);
      return prazo >= format(startOfMonth(h), "yyyy-MM-dd") && prazo <= format(endOfMonth(h), "yyyy-MM-dd");
    }
    case "periodo": return (!f.prazoDe || prazo >= f.prazoDe) && (!f.prazoAte || prazo <= f.prazoAte);
    default: return true;
  }
}

export function passaFiltros(t: TarefaFiltravel, f: FiltrosGestao, ctx: CtxFiltro): boolean {
  const usa = (k: keyof FiltrosGestao) => !ctx.ignorar?.has(k);
  if (usa("semResponsavel") && f.semResponsavel && (t.responsavel ?? "").trim()) return false;
  if (usa("responsavel") && f.responsavel && !temResponsavel(t.responsavel, f.responsavel)) return false;
  if (usa("prioridades") && f.prioridades.length && !f.prioridades.includes(t.prioridade)) return false;
  if (usa("status") && f.status.length && !f.status.includes(t.status)) return false;
  if (usa("etiquetas") && f.etiquetas.length && !f.etiquetas.some((e) => (t.etiquetas ?? []).includes(e))) return false;
  if (usa("prazo") && !noPrazo(f, t.prazo, f.prazo === "atrasadas" && ctx.concluida(t), ctx.hoje)) return false;
  if (usa("equipe") && f.equipe) {
    const nomes = ctx.nomesDaEquipe ?? [];
    const resp = nomesResponsaveis(t.responsavel);
    if (!resp.some((n) => nomes.includes(n))) return false;
  }
  if (usa("seguidor") && f.seguidor) {
    const s = f.seguidor.toLowerCase();
    if (!(ctx.seguidoresDe?.(t.id_tarefa) ?? []).some((e) => e.toLowerCase() === s)) return false;
  }
  if (usa("criadoPor") && f.criadoPor && (ctx.chaveCriador?.(t) ?? null) !== f.criadoPor) return false;
  if (usa("regiao") && f.regiao && regiaoDasEtiquetas(t.etiquetas) !== f.regiao) return false;
  if (usa("produtos") && (f.produtos ?? []).length) {
    const ps = produtosDa(t.campos);
    if (!f.produtos.some((p) => ps.includes(p))) return false;
  }
  if (usa("situacao") && f.situacao) {
    const feita = ctx.concluida(t);
    if (f.situacao === "abertas" && feita) return false;
    if (f.situacao === "concluidas" && !feita) return false;
  }
  return true;
}
