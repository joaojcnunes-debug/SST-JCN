import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServiceClient, createSupabaseServerClient } from "@/lib/supabase/client";
import { podeProcessar, montarEvento, type TarefaEvento } from "@/lib/gestao/google/helpers";
import { puxarInboundTodas } from "@/lib/gestao/google/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Worker OUTBOUND (F3.A): drena gestao_google_fila e reflete cada tarefa como evento na agenda
 * de cada vinculado conectado (ativo=true). SEM pg_cron — disparado best-effort pelo client ao
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
  // Gate de sessão: /api/gestao/* está sob o Bypass do CF Access (internet-alcançável), então sem
  // isto o worker seria disparável anonimamente. O call site (page.tsx, same-origin) manda o cookie
  // de sessão. Sem sessão → 401 (espelha connect/route.ts). Checa ANTES do dedup.
  const cookieStore = await cookies();
  const supabaseAuth = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!podeProcessar(Date.now())) {
    return NextResponse.json({ skipped: "dedup-minuto" });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const encKey = process.env.GESTAO_GOOGLE_ENC_KEY;
  if (!clientId || !clientSecret || !encKey) {
    return NextResponse.json({ error: "OAuth do Google não configurado." }, { status: 500 });
  }

  const sb = createSupabaseServiceClient();

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
  let inbound = { contas: 0, aplicados: 0, excluidos: 0 };
  try {
    inbound = await puxarInboundTodas(sb, { clientId, clientSecret, encKey, appOrigin: req.nextUrl.origin });
  } catch {
    // silencioso (sem segredo); o próximo tick tenta de novo
  }

  return NextResponse.json({ processados: ok, erros: erro, pendentes: fila.length, inbound });
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
    .select("id_tarefa,id_quadro,titulo,prazo,data_inicio,status")
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

  // Vinculados da tarefa que conectaram a conta (ativo=true). Junta e-mail↔conta.
  const { data: vinc } = await sb.from("gestao_tarefa_vinculados").select("usuario_email").eq("id_tarefa", idTarefa);
  const emails = Array.from(new Set(((vinc ?? []) as { usuario_email: string }[]).map((v) => v.usuario_email)));

  const { data: contas } = await sb
    .from("gestao_google_contas")
    .select("usuario_email,calendar_id,ativo")
    .in("usuario_email", emails.length ? emails : ["__none__"])
    .eq("ativo", true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conectados = (contas ?? []) as any[];

  const body = !ehDelete && tarefa ? montarEvento(tarefa as TarefaEvento) : null;

  for (const conta of conectados) {
    const email: string = conta.usuario_email;
    const calendarId: string = conta.calendar_id || "primary";

    // refresh_token decifrado no banco (chave por parâmetro; nunca sai em texto plano à toa).
    const { data: refreshToken } = await sb.rpc("gestao_google_ler_token", { p_email: email, p_enc_key: cfg.encKey } as never);
    if (!refreshToken || typeof refreshToken !== "string") continue;
    const accessToken = await obterAccessToken(refreshToken, cfg.clientId, cfg.clientSecret);
    if (!accessToken) throw new Error("token"); // sobe p/ backoff (mensagem neutra, sem segredo)

    const { data: mapRow } = await sb
      .from("gestao_google_eventos")
      .select("event_id,etag")
      .eq("id_tarefa", idTarefa)
      .eq("usuario_email", email)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapa = mapRow as any;

    const authH = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const encCal = encodeURIComponent(calendarId);

    if (ehDelete) {
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
    let resp: Response;
    if (mapa?.event_id) {
      resp = await fetch(`${CAL_BASE}/${encCal}/events/${encodeURIComponent(mapa.event_id)}`, {
        method: "PATCH",
        headers: authH,
        body: JSON.stringify(body),
      });
    } else {
      resp = await fetch(`${CAL_BASE}/${encCal}/events`, {
        method: "POST",
        headers: authH,
        body: JSON.stringify(body),
      });
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
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "id_tarefa,usuario_email" }
      );
    }
  }
}
