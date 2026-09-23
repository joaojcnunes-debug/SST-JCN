// Helpers puros/testáveis da F3.A (Google Agenda outbound) + F3.B (inbound).
// Ficam FORA dos route.ts DE PROPÓSITO: o `next build` do App Router rejeita qualquer
// export que não seja handler/config em route.ts (só o `tsc --noEmit` aceitava). Rotas e
// testes importam daqui. Ver connect/callback/sync/webhook/route.ts e ./inbound.ts.

import { createHash, timingSafeEqual } from "node:crypto";

export const STATE_COOKIE = "g_oauth_state";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

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
}
export interface CalendarEvent {
  summary: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: { private: { gestao_id_tarefa: string } };
}

function maisUmDia(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Mapeia a tarefa → corpo de evento all-day (puro/testável). Colunas prazo/data_inicio são DATE
 * (sem hora), então o evento é all-day: só prazo → 1 dia em `prazo`; data_inicio+prazo → intervalo
 * [data_inicio, prazo] (fim exclusivo = prazo+1, padrão da rota ics). Carimba gestao_id_tarefa.
 */
export function montarEvento(t: TarefaEvento): CalendarEvent {
  const inicio = t.data_inicio ?? t.prazo!;
  const fimBase = t.prazo!;
  return {
    summary: t.titulo,
    start: { date: inicio },
    end: { date: maisUmDia(fimBase) },
    extendedProperties: { private: { gestao_id_tarefa: t.id_tarefa } },
  };
}

function menosUmDia(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

// ── F3.B — INBOUND (Google → painel): helpers puros ────────────────────────────

/** Subconjunto de um evento do Google que o inbound observa. Só data/hora e status. */
export interface GoogleEventInbound {
  id?: string;
  status?: string; // "cancelled" = apagado no celular
  etag?: string;
  start?: { date?: string; dateTime?: string } | null;
  end?: { date?: string; dateTime?: string } | null;
  extendedProperties?: { private?: { gestao_id_tarefa?: string } } | null;
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

/**
 * C6 — deriva o writeback do evento tocando SÓ prazo/data_inicio (nunca titulo/descricao/status).
 * Espelha o outbound (montarEvento): start=data_inicio, end EXCLUSIVO=prazo+1 → prazo = end-1.
 * Evento de um dia (start == prazo) → data_inicio null (prazo-only), fecha o round-trip do outbound.
 */
export function writebackDoEvento(ev: GoogleEventInbound): { prazo: string | null; data_inicio: string | null } {
  const inicio = dataDoCampo(ev.start);
  const fimExcl = dataDoCampo(ev.end);
  const prazo = fimExcl ? menosUmDia(fimExcl) : inicio;
  const data_inicio = inicio && prazo && inicio !== prazo ? inicio : null;
  return { prazo: prazo ?? null, data_inicio };
}

/**
 * C4 — anti-loop camada 2 (por etag) + evita escrita à toa. Aplica o inbound só quando:
 *  - o etag do evento DIFERE do último que gravamos (etag igual = eco da nossa própria escrita outbound → pula); E
 *  - a data (prazo/data_inicio) mudou de fato em relação à tarefa.
 */
export function deveAplicarInbound(args: {
  etagEvento: string | null | undefined;
  etagGravado: string | null | undefined;
  prazoNovo: string | null;
  prazoAtual: string | null;
  inicioNovo: string | null;
  inicioAtual: string | null;
}): boolean {
  if (args.etagEvento && args.etagGravado && args.etagEvento === args.etagGravado) return false;
  return args.prazoNovo !== args.prazoAtual || args.inicioNovo !== args.inicioAtual;
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
