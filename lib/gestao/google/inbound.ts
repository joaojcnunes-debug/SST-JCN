// F3.B — INBOUND (Google → painel): orquestração do pull incremental por syncToken + writeback
// guardado por GUC + registro/renovação do watch. Vive em lib/ (NÃO em route.ts) porque o
// `next build` do App Router rejeita export de não-handler em route.ts. Importado por
// sync/route.ts (o worker do browser) e webhook/route.ts (o push do Google, server-to-server).
//
// Segurança:
//   • Endpoints do Google FIXOS (constantes abaixo) — sem SSRF (nenhuma URL vem de dado externo).
//   • syncToken/channel_token NUNCA são logados; refresh_token só é decifrado no banco (RPC).
//   • Só eventos NOSSOS (extendedProperties.private.gestao_id_tarefa) entram (idTarefaDoEvento) — e,
//     desde a v301, o evento que a própria pessoa criou na agenda, que vira tarefa (deveImportarEvento).
//   • O writeback toca só prazo/data_inicio, sob `set local gestao.in_google_sync='on'` (anti-loop
//     camada 1, dentro das RPCs) + comparação de etag (camada 2, deveAplicarInbound).

import { randomUUID, randomBytes } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/client";
import {
  idTarefaDoEvento,
  deveImportarEvento,
  convidadosDoEvento,
  textoDaDescricao,
  writebackDoEvento,
  deveAplicarInbound,
  precisaRenovarWatch,
  type GoogleEventInbound,
} from "./helpers";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars";
const MAX_PAGINAS = 20; // teto defensivo por conta (250 eventos/página)

type Svc = ReturnType<typeof createSupabaseServiceClient>;

export interface InboundCfg {
  clientId: string;
  clientSecret: string;
  encKey: string;
  /** Origin público do app (ex.: https://dev.jcnconsultoria.com.br). Só usado p/ montar o address do watch. */
  appOrigin?: string | null;
}

export interface ContaInbound {
  usuario_email: string;
  calendar_id: string | null;
  sync_token: string | null;
  channel_expira?: string | null;
  /** v301: evento criado antes disto não vira tarefa. */
  importar_desde?: string | null;
}

type Resultado = { aplicados: number; excluidos: number; importados: number };

async function obterAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string };
  return j.access_token ?? null;
}

/**
 * Pull incremental de UMA conta. Sem syncToken → sync inicial (só guarda o nextSyncToken, não aplica).
 * 410 Gone → syncToken inválido → limpa e refaz do zero. Para cada evento nosso: cancelled → exclui;
 * senão, se etag difere e a data mudou → aplica. Best-effort: erro de rede não derruba o resto.
 */
export async function puxarInboundConta(
  sb: Svc,
  conta: ContaInbound,
  cfg: InboundCfg
): Promise<Resultado> {
  const email = conta.usuario_email;
  const encCal = encodeURIComponent(conta.calendar_id || "primary");

  const { data: refreshToken } = await sb.rpc("gestao_google_ler_token", { p_email: email, p_enc_key: cfg.encKey } as never);
  if (!refreshToken || typeof refreshToken !== "string") return { aplicados: 0, excluidos: 0, importados: 0 };
  const accessToken = await obterAccessToken(refreshToken, cfg.clientId, cfg.clientSecret);
  if (!accessToken) return { aplicados: 0, excluidos: 0, importados: 0 };
  const authH = { Authorization: `Bearer ${accessToken}` };

  let syncToken = conta.sync_token ?? null;
  let modoInicial = !syncToken; // 1ª vez (ou pós-410): só captura o token, não aplica
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  let aplicados = 0;
  let excluidos = 0;
  let importados = 0;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const u = new URL(`${CAL_BASE}/${encCal}/events`);
    u.searchParams.set("showDeleted", "true");
    u.searchParams.set("singleEvents", "true");
    u.searchParams.set("maxResults", "250");
    if (syncToken) u.searchParams.set("syncToken", syncToken);
    if (pageToken) u.searchParams.set("pageToken", pageToken);

    const resp = await fetch(u.toString(), { headers: authH });
    if (resp.status === 410) {
      // syncToken expirado/inválido → zera e recomeça como sync inicial.
      await sb.rpc("gestao_google_salvar_sync_token", { p_email: email, p_token: null } as never);
      syncToken = null;
      modoInicial = true;
      pageToken = null;
      nextSyncToken = null;
      continue;
    }
    if (!resp.ok) return { aplicados, excluidos, importados }; // best-effort: não loga corpo (pode ter dado)

    const page = (await resp.json()) as {
      items?: GoogleEventInbound[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };
    const items = page.items ?? [];

    if (!modoInicial) {
      for (const ev of items) {
        let idTarefa = idTarefaDoEvento(ev);
        if (!idTarefa) {
          // v301: evento sem carimbo — criado direto na agenda. Vira tarefa se a pessoa o criou
          // (deveImportarEvento); senão (convite de outro, evento antigo…) → ignora, como antes.
          const r = await tarefaDoEventoDaAgenda(sb, email, ev, conta.importar_desde ?? null, accessToken, encCal);
          if (!r) continue;
          if (r.nova) {
            importados++;
            continue; // nasceu agora com as datas do evento — nada a aplicar
          }
          idTarefa = r.idTarefa; // já virou tarefa antes (o carimbo ainda não tinha chegado)
        }

        if (ev.status === "cancelled") {
          // Apagou no celular → desagenda a tarefa (limpa prazo/data_inicio) + remove o mapa.
          await sb.rpc("gestao_google_excluir_inbound", { p_id_tarefa: idTarefa, p_email: email } as never);
          excluidos++;
          continue;
        }

        const { data: mapRow } = await sb
          .from("gestao_google_eventos")
          .select("etag,origem")
          .eq("id_tarefa", idTarefa)
          .eq("usuario_email", email)
          .maybeSingle();
        const { data: tRow } = await sb
          .from("gestao_tarefas")
          .select("prazo,data_inicio,hora_inicio,hora_fim")
          .eq("id_tarefa", idTarefa)
          .maybeSingle();

        const wb = writebackDoEvento(ev);
        const aplica = deveAplicarInbound({
          etagEvento: ev.etag,
          etagGravado: (mapRow as { etag?: string } | null)?.etag,
          prazoNovo: wb.prazo,
          prazoAtual: (tRow as { prazo?: string | null } | null)?.prazo ?? null,
          inicioNovo: wb.data_inicio,
          inicioAtual: (tRow as { data_inicio?: string | null } | null)?.data_inicio ?? null,
          horaInicioNova: wb.hora_inicio,
          horaInicioAtual: (tRow as { hora_inicio?: string | null } | null)?.hora_inicio ?? null,
          horaFimNova: wb.hora_fim,
          horaFimAtual: (tRow as { hora_fim?: string | null } | null)?.hora_fim ?? null,
        });
        if (aplica) {
          await sb.rpc("gestao_google_aplicar_inbound", {
            p_id_tarefa: idTarefa,
            p_prazo: wb.prazo,
            p_data_inicio: wb.data_inicio,
            p_hora_inicio: wb.hora_inicio,
            p_hora_fim: wb.hora_fim,
            p_etag: ev.etag ?? null,
            p_email: email,
          } as never);
          aplicados++;
        }

        // v301: evento que a pessoa criou na agenda → convidados viram/deixam de ser responsáveis.
        const mapa = mapRow as { etag?: string; origem?: string } | null;
        if (mapa?.origem === "google" && ev.etag !== mapa.etag) {
          await sb.rpc("gestao_google_sincronizar_convidados", {
            p_id_tarefa: idTarefa,
            p_email: email,
            p_convidados: convidadosDoEvento(ev),
          } as never);
        }
      }
    }

    if (page.nextPageToken) {
      pageToken = page.nextPageToken;
      continue;
    }
    nextSyncToken = page.nextSyncToken ?? null;
    break;
  }

  if (nextSyncToken) {
    await sb.rpc("gestao_google_salvar_sync_token", { p_email: email, p_token: nextSyncToken } as never);
  }
  return { aplicados, excluidos, importados };
}

/**
 * v301 — evento sem carimbo na agenda da pessoa. Se já virou tarefa (o mapa tem o event_id: o carimbo
 * falhou ou ainda não voltou do Google), devolve essa tarefa e tenta carimbar de novo. Senão, se é um
 * evento que a pessoa criou (deveImportarEvento), cria a tarefa no Meu Quadro dela, carimba o evento e
 * põe os convidados como responsáveis. null = evento que não é do Gestão (ignora).
 */
async function tarefaDoEventoDaAgenda(
  sb: Svc,
  email: string,
  ev: GoogleEventInbound,
  importarDesde: string | null,
  accessToken: string,
  encCal: string
): Promise<{ idTarefa: string; nova: boolean } | null> {
  if (!ev.id) return null;
  const { data: jaMapeado } = await sb
    .from("gestao_google_eventos")
    .select("id_tarefa")
    .eq("usuario_email", email)
    .eq("event_id", ev.id)
    .eq("origem", "google")
    .limit(1)
    .maybeSingle();
  const existente = (jaMapeado as { id_tarefa?: string } | null)?.id_tarefa;
  if (existente) {
    if (ev.status !== "cancelled") await carimbarEvento(sb, email, ev.id, existente, accessToken, encCal);
    return { idTarefa: existente, nova: false };
  }

  if (!deveImportarEvento(ev, importarDesde)) return null;

  const wb = writebackDoEvento(ev);
  const { data: idNovo } = await sb.rpc("gestao_google_tarefa_do_evento", {
    p_email: email,
    p_event_id: ev.id,
    p_etag: ev.etag ?? null,
    p_titulo: ev.summary ?? "",
    p_descricao: textoDaDescricao(ev.description),
    p_prazo: wb.prazo,
    p_data_inicio: wb.data_inicio,
    p_hora_inicio: wb.hora_inicio,
    p_hora_fim: wb.hora_fim,
  } as never);
  if (!idNovo || typeof idNovo !== "string") return null; // conta inativa / não é membro da Gestão

  await sb.rpc("gestao_google_sincronizar_convidados", {
    p_id_tarefa: idNovo,
    p_email: email,
    p_convidados: convidadosDoEvento(ev),
  } as never);
  await carimbarEvento(sb, email, ev.id, idNovo, accessToken, encCal);
  return { idTarefa: idNovo, nova: true };
}

/**
 * Grava gestao_id_tarefa no evento (só na cópia da pessoa — extendedProperties.private) e guarda o
 * etag novo no mapa: o eco desta escrita volta no próximo pull com etag igual → não reaplica.
 * sendUpdates=none: os convidados não recebem e-mail de "evento alterado". Best-effort: se falhar,
 * o mapa já liga o evento à tarefa e o próximo pull tenta de novo.
 */
async function carimbarEvento(
  sb: Svc,
  email: string,
  eventId: string,
  idTarefa: string,
  accessToken: string,
  encCal: string
): Promise<void> {
  const resp = await fetch(`${CAL_BASE}/${encCal}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ extendedProperties: { private: { gestao_id_tarefa: idTarefa } } }),
  });
  if (!resp.ok) return;
  const j = (await resp.json()) as { etag?: string };
  if (j.etag) {
    await sb
      .from("gestao_google_eventos")
      .update({ etag: j.etag, updated_at: new Date().toISOString() } as never)
      .eq("id_tarefa", idTarefa)
      .eq("usuario_email", email);
  }
}

/**
 * Registro/renovação do watch (events.watch, endpoint FIXO). O address é SEMPRE o nosso próprio
 * /webhook (derivado do appOrigin do app, nunca de dado externo → sem SSRF). Se o Google recusar
 * (domínio não verificado, sem HTTPS público, etc.) → false, e o sistema segue SÓ com polling.
 */
export async function registrarWatch(
  sb: Svc,
  conta: { usuario_email: string; calendar_id: string | null },
  cfg: InboundCfg
): Promise<boolean> {
  if (!cfg.appOrigin) return false;
  const email = conta.usuario_email;
  const encCal = encodeURIComponent(conta.calendar_id || "primary");

  const { data: refreshToken } = await sb.rpc("gestao_google_ler_token", { p_email: email, p_enc_key: cfg.encKey } as never);
  if (!refreshToken || typeof refreshToken !== "string") return false;
  const accessToken = await obterAccessToken(refreshToken, cfg.clientId, cfg.clientSecret);
  if (!accessToken) return false;

  const channelId = randomUUID();
  const channelToken = randomBytes(24).toString("base64url");
  const address = `${cfg.appOrigin}/api/gestao/google/webhook`;

  const resp = await fetch(`${CAL_BASE}/${encCal}/events/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: channelId, type: "web_hook", address, token: channelToken }),
  });
  if (!resp.ok) return false; // recusa → segue só com polling (neutro, sem logar corpo)

  const j = (await resp.json()) as { expiration?: string };
  const expira = j.expiration ? new Date(Number(j.expiration)).toISOString() : null;
  await sb.rpc("gestao_google_registrar_watch", {
    p_email: email,
    p_channel_id: channelId,
    p_channel_token: channelToken,
    p_expira: expira,
  } as never);
  return true;
}

/**
 * Pull inbound de TODAS as contas conectadas (chamado pelo /sync após drenar o outbound). Best-effort
 * por conta: uma conta com erro não derruba as outras. Renova o watch se estiver perto de expirar.
 */
export async function puxarInboundTodas(
  sb: Svc,
  cfg: InboundCfg
): Promise<{ contas: number } & Resultado> {
  const { data: contas } = await sb
    .from("gestao_google_contas")
    .select("usuario_email,calendar_id,sync_token,channel_expira,importar_desde")
    .eq("ativo", true);
  const lista = (contas ?? []) as ContaInbound[];

  let aplicados = 0;
  let excluidos = 0;
  let importados = 0;
  for (const conta of lista) {
    try {
      const r = await puxarInboundConta(sb, conta, cfg);
      aplicados += r.aplicados;
      excluidos += r.excluidos;
      importados += r.importados;
      if (cfg.appOrigin && precisaRenovarWatch(conta.channel_expira, Date.now())) {
        await registrarWatch(sb, { usuario_email: conta.usuario_email, calendar_id: conta.calendar_id }, cfg);
      }
    } catch {
      // best-effort por conta — não derruba as demais, não loga segredo.
    }
  }
  return { contas: lista.length, aplicados, excluidos, importados };
}
