// Edge Function — feed ICS (iCalendar) de uma lista da Gestão Chabra.
// Endpoint PÚBLICO (--no-verify-jwt). Devolve as tarefas com prazo como eventos
// de dia inteiro, para assinatura no Google/Outlook. Token valida o acesso.
//   GET ?token=...  → text/calendar
// DEPLOY: supabase functions deploy gestao-ics --no-verify-jwt
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function escICS(s: string): string {
  return (s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function ymd(d: string): string { return d.replace(/-/g, ""); }
function maisUmDia(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10).replace(/-/g, "");
}
function stamp(): string { return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"); }

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Token ausente.", { status: 400 });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: quadro } = await sb.from("gestao_quadros").select("id_quadro,nome").eq("ics_token", token).maybeSingle();
  if (!quadro) return new Response("Calendário indisponível.", { status: 404 });

  const { data: statusRows } = await sb.from("gestao_status").select("slug,tipo").eq("id_quadro", quadro.id_quadro);
  const concluidos = new Set((statusRows ?? []).filter((s) => s.tipo === "concluido").map((s) => s.slug));

  const { data: tarefas } = await sb.from("gestao_tarefas").select("id_tarefa,titulo,status,responsavel,prioridade,prazo").eq("id_quadro", quadro.id_quadro).not("prazo", "is", null);

  const now = stamp();
  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chabra//Gestao SST//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escICS(quadro.nome)} · Chabra`,
  ];
  for (const t of (tarefas ?? [])) {
    if (concluidos.has(t.status)) continue;
    const detalhe = [t.responsavel ? `Responsável: ${t.responsavel}` : "", `Prioridade: ${t.prioridade}`].filter(Boolean).join(" · ");
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${t.id_tarefa}@gestao.chabra`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${ymd(t.prazo as string)}`,
      `DTEND;VALUE=DATE:${maisUmDia(t.prazo as string)}`,
      `SUMMARY:${escICS(t.titulo)}`,
      `DESCRIPTION:${escICS(detalhe)}`,
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR");

  return new Response(linhas.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="gestao.ics"',
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
