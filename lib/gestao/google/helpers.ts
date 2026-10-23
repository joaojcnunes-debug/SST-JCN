// Helpers puros/testáveis da F3.A (Google Agenda outbound) + F3.B (inbound).
// Ficam FORA dos route.ts DE PROPÓSITO: o `next build` do App Router rejeita qualquer
// export que não seja handler/config em route.ts (só o `tsc --noEmit` aceitava). Rotas e
// testes importam daqui. Ver connect/callback/sync/webhook/route.ts e ./inbound.ts.

import { createHash, timingSafeEqual } from "node:crypto";

export const STATE_COOKIE = "g_oauth_state";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
// v302: + perfil básico, só para a foto da conta (no lugar das iniciais na Gestão).
const SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.profile";

/** Monta a URL de consent (pura/testável). scope, redirect_uri, access_type, prompt e state fixos. */
export function montarUrlConsent(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPE);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", params.state);
  return u.toString();
}

/** Validação de state anti-CSRF (pura/testável): rejeita ausente/vazio/divergente. */
export function validarState(
  cookieState: string | undefined | null,
  queryState: string | undefined | null
): boolean {
  if (!cookieState || !queryState) return false;
  return cookieState === queryState;
}

/** Bucket de minuto (puro/testável). */
export function janelaMinuto(ms: number): number {
  return Math.floor(ms / 60000);
}

// Dedup por minuto: estado por processo. Duas chamadas no mesmo minuto → 1 processamento.
let ultimaJanela = -1;
/** true na 1ª chamada do minuto; false nas seguintes do mesmo minuto (puro exceto pelo estado). */
export function podeProcessar(nowMs: number): boolean {
  const j = janelaMinuto(nowMs);
  if (j === ultimaJanela) return false;
  ultimaJanela = j;
  return true;
}

export interface TarefaEvento {
  id_tarefa: string;
  titulo: string;
  prazo: string | null;
  data_inicio: string | null;
  /** 'HH:MM' ou 'HH:MM:SS' (coluna TIME, v298). */
  hora_inicio?: string | null;
  hora_fim?: string | null;
}
/** Início/fim do evento: `date` (dia inteiro) OU `dateTime`+`timeZone` (com hora). O outro vai null
 * de propósito — no PATCH, trocar de dia inteiro para com hora (e vice-versa) exige limpar o campo antigo. */
export type CampoEvento =
  | { date: string; dateTime: null }
  | { date: null; dateTime: string; timeZone: string };
export interface CalendarEvent {
  summary: string;
  start: CampoEvento;
  end: CampoEvento;
  reminders: { useDefault: false; overrides: { method: "popup"; minutes: number }[] };
  extendedProperties: { private: { gestao_id_tarefa: string } };
}

/** Fuso das tarefas: as horas do painel são horário de Brasília. */
export const FUSO_TAREFAS = "America/Sao_Paulo";

/**
 * Lembrete dos eventos (Etapa 3): aviso no celular/computador NO DIA ANTERIOR ÀS 9h. Evento de dia
 * inteiro começa à 00:00 (fuso da agenda da pessoa) e o Google só aceita lembrete ANTES do início
 * (0 a 40320 min), então "dia anterior às 9h" = 15 h antes = 900 min. Na tarefa com intervalo
 * (data_inicio → prazo) o aviso vem na véspera do INÍCIO. Evento com hora soma os minutos do início
 * (ex.: começa 08:30 → 900 + 510 min antes).
 */
export const LEMBRETE_MINUTOS_ANTES = 15 * 60;

/** Duração usada quando a tarefa tem só uma das horas. */
const DURACAO_PADRAO_MIN = 60;

function maisUmDia(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function paraMinutos(h: string): number {
  const [hh, mm] = h.split(":").map((x) => parseInt(x, 10) || 0);
  return hh * 60 + mm;
}
function deMinutos(m: number): string {
  const c = Math.min(Math.max(m, 0), 23 * 60 + 59);
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
}

/**
 * Mapeia a tarefa → corpo do evento (puro/testável). Carimba gestao_id_tarefa.
 * - Sem hora: evento de dia inteiro. Só prazo → 1 dia em `prazo`; data_inicio+prazo → intervalo
 *   [data_inicio, prazo] (fim exclusivo = prazo+1, padrão da rota ics).
 * - Com hora (v298): início = data_inicio (ou prazo) às hora_inicio; fim = prazo às hora_fim. Falta
 *   uma das horas → 1 h de duração a partir da que existe. Fim antes do início → fim = início + 1 h.
 */
export function montarEvento(t: TarefaEvento): CalendarEvent {
  const inicio = t.data_inicio ?? t.prazo!;
  const fimBase = t.prazo!;
  const hIni = t.hora_inicio ? paraMinutos(t.hora_inicio) : null;
  const hFim = t.hora_fim ? paraMinutos(t.hora_fim) : null;
  const base = {
    summary: t.titulo,
    extendedProperties: { private: { gestao_id_tarefa: t.id_tarefa } },
  };

  if (hIni == null && hFim == null) {
    return {
      ...base,
      start: { date: inicio, dateTime: null },
      end: { date: maisUmDia(fimBase), dateTime: null },
      // useDefault:false — sem isto o Google aplica o padrão da agenda (em geral nenhum para dia inteiro).
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: LEMBRETE_MINUTOS_ANTES }] },
    };
  }

  const ini = hIni ?? Math.max(hFim! - DURACAO_PADRAO_MIN, 0);
  let fim = hFim ?? ini + DURACAO_PADRAO_MIN;
  if (inicio === fimBase && fim <= ini) fim = ini + DURACAO_PADRAO_MIN;
  return {
    ...base,
    start: { date: null, dateTime: `${inicio}T${deMinutos(ini)}:00`, timeZone: FUSO_TAREFAS },
    end: { date: null, dateTime: `${fimBase}T${deMinutos(fim)}:00`, timeZone: FUSO_TAREFAS },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: LEMBRETE_MINUTOS_ANTES + ini }] },
  };
}

/**
 * Decide, conta a conta, o que o worker faz com a agenda (puro/testável). Os destinatários são
 * os vinculados ATUAIS mais quem JÁ TEM evento no mapa (gestao_google_eventos): sem o mapa, apagar
 * a tarefa (os vinculados somem em cascata antes do worker rodar) ou tirar alguém dela deixava o
 * evento esquecido na agenda. Quem está no mapa e não está mais vinculado → delete; tarefa a
 * desagendar → delete para todos; os demais → upsert. Só contas conectadas entram.
 */
export function planejarDestinatarios(args: {
  vinculados: string[];
  comEvento: string[];
  conectados: string[];
  ehDelete: boolean;
}): { email: string; acao: "upsert" | "delete" }[] {
  const vinc = new Set(args.vinculados);
  const conectados = new Set(args.conectados);
  const todos = Array.from(new Set([...args.vinculados, ...args.comEvento]));
  return todos
    .filter((email) => conectados.has(email))
    .map((email) => ({
      email,
      acao: args.ehDelete || !vinc.has(email) ? ("delete" as const) : ("upsert" as const),
    }));
}

function menosUmDia(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

// ── F3.B — INBOUND (Google → painel): helpers puros ────────────────────────────

/** Subconjunto de um evento do Google que o inbound observa. Data/hora e status; o resto (título,
 * criador, convidados…) só é lido para o evento criado direto na agenda virar tarefa (v301). */
export interface GoogleEventInbound {
  id?: string;
  status?: string; // "cancelled" = apagado no celular
  etag?: string;
  start?: { date?: string; dateTime?: string } | null;
  end?: { date?: string; dateTime?: string } | null;
  extendedProperties?: { private?: { gestao_id_tarefa?: string } } | null;
  summary?: string;
  description?: string;
  created?: string;
  recurringEventId?: string;
  eventType?: string;
  organizer?: { email?: string; self?: boolean } | null;
  attendees?: { email?: string; self?: boolean; resource?: boolean; responseStatus?: string }[] | null;
}

/**
 * v301 — o evento SEM carimbo vira tarefa? Só o que a própria pessoa criou (organizador = ela; convite
 * de outro fica de fora), evento comum (não "fora do escritório", aniversário, voo do Gmail…), sem
 * repetição (cada ocorrência viraria uma tarefa) e criado depois de `importarDesde` (só daqui para
 * frente: editar um evento antigo não o transforma em tarefa).
 */
export function deveImportarEvento(ev: GoogleEventInbound, importarDesde: string | null | undefined): boolean {
  if (ev.status === "cancelled") return false;
  if (ev.organizer?.self !== true) return false;
  if (ev.recurringEventId) return false;
  if (ev.eventType && ev.eventType !== "default") return false;
  if (!ev.start || !dataDoCampo(ev.start)) return false;
  const desde = importarDesde ? Date.parse(importarDesde) : NaN;
  const criado = ev.created ? Date.parse(ev.created) : NaN;
  if (Number.isNaN(desde) || Number.isNaN(criado)) return false;
  return criado >= desde;
}

/** v301 — e-mails dos convidados que viram responsáveis: tira a própria pessoa, salas/recursos e
 * quem recusou. O banco ainda filtra quem é usuário interno da Gestão. */
export function convidadosDoEvento(ev: GoogleEventInbound): string[] {
  const emails = (ev.attendees ?? [])
    .filter((a) => !a.self && !a.resource && a.responseStatus !== "declined")
    .map((a) => (a.email ?? "").trim().toLowerCase())
    .filter((e) => e.includes("@"));
  return Array.from(new Set(emails)).sort();
}

/** v301 — a descrição do Google vem em HTML simples (<br>, <a>, <b>…): vira texto para a tarefa. */
export function textoDaDescricao(html: string | null | undefined): string | null {
  if (!html) return null;
  const texto = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return texto || null;
}

/**
 * C6 — filtro por dono: devolve o id_tarefa se o evento é NOSSO (carimbado com
 * extendedProperties.private.gestao_id_tarefa), senão null. Evento pessoal do técnico → null → ignorado.
 */
export function idTarefaDoEvento(ev: GoogleEventInbound): string | null {
  const id = ev?.extendedProperties?.private?.gestao_id_tarefa;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Campo start/end do Google → 'YYYY-MM-DD' (as colunas prazo/data_inicio são DATE). dateTime → recorta a data. */
export function dataDoCampo(campo?: { date?: string; dateTime?: string } | null): string | null {
  if (!campo) return null;
  if (campo.date) return campo.date; // all-day
  if (campo.dateTime) return campo.dateTime.slice(0, 10); // com hora → só a data
  return null;
}

/** Campo start/end do Google → 'HH:MM:SS' (hora local do evento), ou null se for dia inteiro. */
export function horaDoCampo(campo?: { date?: string; dateTime?: string } | null): string | null {
  if (!campo?.dateTime) return null;
  return campo.dateTime.slice(11, 19) || null; // 'YYYY-MM-DDTHH:MM:SS±HH:MM' → 'HH:MM:SS'
}

export interface WritebackEvento {
  prazo: string | null;
  data_inicio: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
}

/**
 * C6 — deriva o writeback do evento tocando SÓ prazo/data_inicio/horas (nunca titulo/descricao/status).
 * Espelha o outbound (montarEvento):
 *  - dia inteiro: start=data_inicio, end EXCLUSIVO=prazo+1 → prazo = end-1; horas null.
 *  - com hora: end é o instante final → prazo = data do end; horas = hora do start/end.
 * Evento de um dia (start == prazo) → data_inicio null (prazo-only), fecha o round-trip do outbound.
 */
export function writebackDoEvento(ev: GoogleEventInbound): WritebackEvento {
  const inicio = dataDoCampo(ev.start);
  const comHora = !!ev.end?.dateTime;
  const fim = dataDoCampo(ev.end);
  const prazo = fim ? (comHora ? fim : menosUmDia(fim)) : inicio;
  const data_inicio = inicio && prazo && inicio !== prazo ? inicio : null;
  return {
    prazo: prazo ?? null,
    data_inicio,
    hora_inicio: horaDoCampo(ev.start),
    hora_fim: horaDoCampo(ev.end),
  };
}

/** Normaliza hora para comparar ('08:30' e '08:30:00' são a mesma). */
function normHora(h: string | null | undefined): string | null {
  return h ? (h.length === 5 ? `${h}:00` : h.slice(0, 8)) : null;
}

/**
 * C4 — anti-loop camada 2 (por etag) + evita escrita à toa. Aplica o inbound só quando:
 *  - o etag do evento DIFERE do último que gravamos (etag igual = eco da nossa própria escrita outbound → pula); E
 *  - a data (prazo/data_inicio) ou a hora mudou de fato em relação à tarefa.
 */
export function deveAplicarInbound(args: {
  etagEvento: string | null | undefined;
  etagGravado: string | null | undefined;
  prazoNovo: string | null;
  prazoAtual: string | null;
  inicioNovo: string | null;
  inicioAtual: string | null;
  horaInicioNova?: string | null;
  horaInicioAtual?: string | null;
  horaFimNova?: string | null;
  horaFimAtual?: string | null;
}): boolean {
  if (args.etagEvento && args.etagGravado && args.etagEvento === args.etagGravado) return false;
  return (
    args.prazoNovo !== args.prazoAtual ||
    args.inicioNovo !== args.inicioAtual ||
    normHora(args.horaInicioNova) !== normHora(args.horaInicioAtual) ||
    normHora(args.horaFimNova) !== normHora(args.horaFimAtual)
  );
}

/**
 * C5/C7 — compara o X-Goog-Channel-Token em TEMPO CONSTANTE (anti timing-attack). SHA-256 dos dois
 * lados → comprimento fixo → timingSafeEqual não vaza tamanho e não lança por tamanhos diferentes.
 * Ausente/vazio → false (o webhook devolve 401).
 */
export function tokenConfere(esperado: string | undefined | null, recebido: string | undefined | null): boolean {
  if (!esperado || !recebido) return false;
  const a = createHash("sha256").update(esperado).digest();
  const b = createHash("sha256").update(recebido).digest();
  return timingSafeEqual(a, b);
}

/**
 * Endereço público do painel para o retorno do Google (callback → /gestao) e o webhook do watch.
 * Dentro do container `req.nextUrl.origin` é `https://0.0.0.0:3000` (o Next escuta em 0.0.0.0 atrás do
 * túnel): o navegador voltava para um endereço inválido (ERR_ADDRESS_INVALID) e o Google recusava o
 * webhook. Preferência: APP_URL (env do container) → origem da requisição (dev local).
 */
export function origemPublica(appUrl: string | undefined | null, origemReq: string): string {
  const u = (appUrl ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^/]+$/i.test(u) ? u : origemReq;
}

/** Watch expira em ~7 dias; renova best-effort se falta canal ou expira dentro da margem (default 24h). */
export function precisaRenovarWatch(
  channelExpira: string | null | undefined,
  nowMs: number,
  margemMs = 24 * 60 * 60 * 1000
): boolean {
  if (!channelExpira) return true;
  const t = Date.parse(channelExpira);
  if (Number.isNaN(t)) return true;
  return t - nowMs < margemMs;
}
