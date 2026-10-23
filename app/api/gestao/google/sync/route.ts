import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServiceClient, createSupabaseServerClient } from "@/lib/supabase/client";
import { podeProcessar, montarEvento, origemPublica, planejarDestinatarios, tokenConfere, type TarefaEvento } from "@/lib/gestao/google/helpers";
import { puxarInboundTodas } from "@/lib/gestao/google/inbound";
import { enviarAvisosPendentes } from "@/lib/gestao/avisos-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Worker OUTBOUND (F3.A): drena gestao_google_fila e reflete cada tarefa como evento na agenda
 * de cada vinculado conectado (ativo=true). SEM pg_cron — disparado pelo client da Gestão e, desde a
 * Etapa 4, por um agendador a cada minuto (Bearer GESTAO_CRON_TOKEN); antes só rodava ao
 * abrir a Gestão; dedup POR MINUTO no server (padrão gestao_automacao_tick). Usa o service client.
 *
 * Segredos: GESTAO_GOOGLE_ENC_KEY e GOOGLE_OAUTH_CLIENT_SECRET vêm SÓ do env server-side; o
 * refresh_token é decifrado no banco pela RPC gestao_google_ler_token(email, ENC_KEY). O token
 * NUNCA é logado nem retornado.
 *
 * Helpers puros (podeProcessar/montarEvento/janelaMinuto) vivem em @/lib/gestao/google/helpers —
 * route.ts não pode exportar não-handler (next build rejeita).
 */
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars";
const MAX_TENTATIVAS = 5;

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

export async function GET(req: NextRequest) {
  // Gate: /api/gestao/* está sob o Bypass do CF Access (internet-alcançável), então sem isto o
  // worker seria disparável anonimamente. Duas portas, checadas ANTES do dedup:
  //  • sessão — o call site da Gestão (useSyncGoogleAgenda, same-origin) manda o cookie;
  //  • Etapa 4: "Authorization: Bearer <GESTAO_CRON_TOKEN>" — o agendador que roda a cada minuto,
  //    para a agenda andar sem ninguém com a Gestão aberta. Sem a variável, essa porta fica fechada.
  //    Comparação em tempo constante (tokenConfere).
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const viaCron = !!bearer && tokenConfere(process.env.GESTAO_CRON_TOKEN, bearer);
  let emailAtor: string | null = null;
  if (!viaCron) {
    const cookieStore = await cookies();
    const supabaseAuth = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    emailAtor = user.email;
  }

  if (!podeProcessar(Date.now())) {
    return NextResponse.json({ skipped: "dedup-minuto" });
  }

  const sb = createSupabaseServiceClient({
    email: emailAtor,
    origem: viaCron ? "google-agenda/agendador" : "google-agenda/sincronizar",
  });

  // v297: rotina diária (recorrência + avisos de prazo + automações por prazo). O banco decide se é
  // hora (a partir das 7h de Brasília, 1x/dia, com trava) — aqui só chama. Antes do e-mail, para os
  // avisos que ela cria saírem já neste tick. Best-effort.
  let rotina: unknown = null;
  try {
    const { data } = await sb.rpc("gestao_rotina_diaria");
    rotina = data ?? null;
  } catch {
    // silencioso; o próximo tick tenta de novo
  }

  // v296: e-mail dos avisos da Gestão — independe do Google (vai antes da checagem do OAuth).
  // Best-effort: nunca derruba o worker.
  let emails = { enviados: 0, falhas: 0 };
  try {
    emails = await enviarAvisosPendentes(sb, {
      resendKey: process.env.RESEND_API_KEY,
      from: process.env.FROM_EMAIL ?? "SST JCN Consultoria <onboarding@resend.dev>",
      appUrl: origemPublica(process.env.APP_URL, req.nextUrl.origin),
    });
  } catch {
    // silencioso; o próximo tick tenta de novo
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const encKey = process.env.GESTAO_GOOGLE_ENC_KEY;
  if (!clientId || !clientSecret || !encKey) {
    return NextResponse.json({ error: "OAuth do Google não configurado.", emails, rotina }, { status: 500 });
  }

  // Drena a fila pendente (limite defensivo por chamada).
  const { data: pend } = await sb
    .from("gestao_google_fila")
    .select("id,id_tarefa,operacao,tentativas")
    .is("processado_em", null)
    .lt("tentativas", MAX_TENTATIVAS)
    .order("created_at", { ascending: true })
    .limit(50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fila = (pend ?? []) as any[];
  let ok = 0;
  let erro = 0;

  for (const item of fila) {
    try {
      await processarItem(sb, item, { clientId, clientSecret, encKey });
      await sb.from("gestao_google_fila").update({ processado_em: new Date().toISOString() } as never).eq("id", item.id);
      ok++;
    } catch {
      // Backoff: incrementa tentativas; não loga a exceção (pode carregar dado sensível).
      await sb.from("gestao_google_fila").update({ tentativas: (item.tentativas ?? 0) + 1 } as never).eq("id", item.id);
      erro++;
    }
  }

  // ── INBOUND (F3.B): depois de drenar o outbound, puxa Google → painel ──────────
  // Pull incremental por syncToken + writeback guardado por GUC (anti-loop) + renovação do watch.
  // Best-effort: falha aqui NÃO desfaz o outbound já processado e não vaza segredo no log.
  let inbound = { contas: 0, aplicados: 0, excluidos: 0, importados: 0 };
  try {
    // Endereço do webhook do watch: pelo agendador a chamada vem de dentro do servidor (127.0.0.1),
    // que o Google não alcança; pelo navegador, a origem dentro do container é https://0.0.0.0:3000.
    // Nos dois casos o endereço público é o APP_URL.
    const appOrigin = origemPublica(process.env.APP_URL, req.nextUrl.origin);
    inbound = await puxarInboundTodas(sb, { clientId, clientSecret, encKey, appOrigin });
  } catch {
    // silencioso (sem segredo); o próximo tick tenta de novo
  }

  return NextResponse.json({ processados: ok, erros: erro, pendentes: fila.length, inbound, emails, rotina });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarItem(
  sb: ReturnType<typeof createSupabaseServiceClient>,
  item: { id_tarefa: string; operacao: string },
  cfg: { clientId: string; clientSecret: string; encKey: string }
): Promise<void> {
  const idTarefa = item.id_tarefa;

  // Descobre a tarefa e se o status é "concluido" (tipo do status no quadro).
  const { data: tRow } = await sb
    .from("gestao_tarefas")
    .select("id_tarefa,id_quadro,titulo,prazo,data_inicio,hora_inicio,hora_fim,status")
    .eq("id_tarefa", idTarefa)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tarefa = tRow as any;

  let ehDelete = item.operacao === "delete" || !tarefa;
  if (tarefa) {
    if (!tarefa.prazo) ehDelete = true; // sem prazo → nada a agendar
    const { data: st } = await sb.from("gestao_status").select("slug,tipo").eq("id_quadro", tarefa.id_quadro);
    const concluidos = new Set(
      ((st ?? []) as { slug: string; tipo: string }[]).filter((s) => s.tipo === "concluido").map((s) => s.slug)
    );
    if (concluidos.has(tarefa.status)) ehDelete = true;
  }

  // Vinculados atuais + quem JÁ TEM evento desta tarefa (o mapa): tarefa apagada leva os
  // vinculados em cascata, e quem saiu da tarefa não está mais na lista — sem o mapa, o evento
  // dessas pessoas ficava esquecido na agenda. Ver planejarDestinatarios.
  const { data: vinc } = await sb.from("gestao_tarefa_vinculados").select("usuario_email,origem").eq("id_tarefa", idTarefa);
  const vinculados = ((vinc ?? []) as { usuario_email: string }[]).map((v) => v.usuario_email);
  // v301: responsável que veio do convidado do evento criado na agenda — ele já tem o evento pelo
  // convite; uma cópia do painel na agenda dele seria duplicata.
  const convidadosGoogle = new Set(
    ((vinc ?? []) as { usuario_email: string; origem?: string }[])
      .filter((v) => v.origem === "google-convidado")
      .map((v) => v.usuario_email)
  );
  const { data: mapeados } = await sb.from("gestao_google_eventos").select("usuario_email").eq("id_tarefa", idTarefa);
  const comEvento = ((mapeados ?? []) as { usuario_email: string }[]).map((m) => m.usuario_email);
  const emails = Array.from(new Set([...vinculados, ...comEvento]));

  const { data: contas } = await sb
    .from("gestao_google_contas")
    .select("usuario_email,calendar_id,ativo")
    .in("usuario_email", emails.length ? emails : ["__none__"])
    .eq("ativo", true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conectados = (contas ?? []) as any[];
  const calendarioDe = new Map(conectados.map((c) => [c.usuario_email as string, (c.calendar_id as string) || "primary"]));

  const plano = planejarDestinatarios({
    vinculados,
    comEvento,
    conectados: conectados.map((c) => c.usuario_email as string),
    ehDelete,
  });
  const body = !ehDelete && tarefa ? montarEvento(tarefa as TarefaEvento) : null;

  for (const { email, acao } of plano) {
    if (convidadosGoogle.has(email) && !comEvento.includes(email)) continue;
    const calendarId: string = calendarioDe.get(email) ?? "primary";

    // refresh_token decifrado no banco (chave por parâmetro; nunca sai em texto plano à toa).
    const { data: refreshToken } = await sb.rpc("gestao_google_ler_token", { p_email: email, p_enc_key: cfg.encKey } as never);
    if (!refreshToken || typeof refreshToken !== "string") continue;
    const accessToken = await obterAccessToken(refreshToken, cfg.clientId, cfg.clientSecret);
    if (!accessToken) throw new Error("token"); // sobe p/ backoff (mensagem neutra, sem segredo)

    const { data: mapRow } = await sb
      .from("gestao_google_eventos")
      .select("event_id,etag,origem")
      .eq("id_tarefa", idTarefa)
      .eq("usuario_email", email)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapa = mapRow as any;
    // v301: o evento que a pessoa criou na agenda (e virou a tarefa) é DELA — pode ter convidados de
    // fora e lembretes próprios. Nunca é apagado: tarefa concluída/sem prazo deixa o evento como está;
    // tarefa apagada só solta o vínculo. Na atualização, não troca os lembretes dela.
    const eventoDaPessoa = mapa?.origem === "google";

    const authH = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const encCal = encodeURIComponent(calendarId);

    if (acao === "delete" && eventoDaPessoa) {
      if (!tarefa) await sb.from("gestao_google_eventos").delete().eq("id_tarefa", idTarefa).eq("usuario_email", email);
      continue;
    }
    if (acao === "delete") {
      if (mapa?.event_id) {
        await fetch(`${CAL_BASE}/${encCal}/events/${encodeURIComponent(mapa.event_id)}`, {
          method: "DELETE",
          headers: authH,
        });
        await sb.from("gestao_google_eventos").delete().eq("id_tarefa", idTarefa).eq("usuario_email", email);
      }
      continue;
    }

    // upsert: patch se já existe evento; senão insert.
    let resp: Response | null = null;
    let criado = false;
    if (mapa?.event_id) {
      const patch = eventoDaPessoa && body ? { ...body, reminders: undefined } : body;
      resp = await fetch(`${CAL_BASE}/${encCal}/events/${encodeURIComponent(mapa.event_id)}`, {
        method: "PATCH",
        headers: authH,
        body: JSON.stringify(patch),
      });
      // 404/410: o evento não existe mais na agenda (apagado por lá) — cria de novo em vez de
      // falhar para sempre no backoff.
      if (resp.status === 404 || resp.status === 410) resp = null;
    }
    if (!resp) {
      resp = await fetch(`${CAL_BASE}/${encCal}/events`, {
        method: "POST",
        headers: authH,
        body: JSON.stringify(body),
      });
      criado = true;
    }
    if (!resp.ok) throw new Error("calendar"); // backoff
    const ev = (await resp.json()) as { id?: string; etag?: string };
    if (ev.id) {
      await sb.from("gestao_google_eventos").upsert(
        {
          id_tarefa: idTarefa,
          usuario_email: email,
          event_id: ev.id,
          etag: ev.etag ?? null,
          // Recriado pelo painel (o da pessoa sumiu) → passa a ser evento do painel.
          origem: criado ? "painel" : (mapa?.origem ?? "painel"),
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "id_tarefa,usuario_email" }
      );
    }
  }
}
