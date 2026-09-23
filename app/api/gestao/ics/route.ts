import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * Feed iCalendar (.ics) público de um quadro da Gestão (porta gestao-ics p/ .107).
 * PÚBLICO, guardado por ics_token; lido por Google/Outlook. Precisa de CF Access
 * "Bypass" no path /api/gestao/* p/ os apps de calendário alcançarem.
 */
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

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return new Response("Token ausente.", { status: 400 });

  const sb = createSupabaseServiceClient();
  const { data: quadro } = await sb.from("gestao_quadros").select("id_quadro,nome").eq("ics_token", token).maybeSingle();
  const q = quadro as { id_quadro: string; nome: string } | null;
  if (!q) return new Response("Calendário indisponível.", { status: 404 });

  const { data: statusRows } = await sb.from("gestao_status").select("slug,tipo").eq("id_quadro", q.id_quadro);
  const concluidos = new Set(
    ((statusRows ?? []) as { slug: string; tipo: string }[]).filter((s) => s.tipo === "concluido").map((s) => s.slug)
  );

  const { data: tarefas } = await sb
    .from("gestao_tarefas")
    .select("id_tarefa,titulo,status,responsavel,prioridade,prazo")
    .eq("id_quadro", q.id_quadro)
    .not("prazo", "is", null);

  const now = stamp();
  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JCN Consultoria//Gestao SST//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escICS(q.nome)} · JCN Consultoria`,
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (tarefas ?? []) as any[]) {
    if (concluidos.has(t.status)) continue;
    const detalhe = [t.responsavel ? `Responsável: ${t.responsavel}` : "", `Prioridade: ${t.prioridade}`]
      .filter(Boolean)
      .join(" · ");
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${t.id_tarefa}@gestao.chabra`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${ymd(t.prazo as string)}`,
      `DTEND;VALUE=DATE:${maisUmDia(t.prazo as string)}`,
      `SUMMARY:${escICS(t.titulo)}`,
      `DESCRIPTION:${escICS(detalhe)}`,
      "END:VEVENT"
    );
  }
  linhas.push("END:VCALENDAR");

  return new Response(linhas.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="gestao.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
