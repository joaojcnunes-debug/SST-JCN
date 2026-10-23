// v295 — E-mail dos avisos da Gestão (atribuição, seguidor, status, comentário, menção).
// Os avisos nascem por gatilho no banco (gestao_notificacoes); o worker /api/gestao/google/sync
// (agendador, 1/min) chama enviarAvisosPendentes: reserva no banco (sem duplicar entre chamadas),
// envia pelo Resend e marca enviado/erro. Sem RESEND_API_KEY não reserva nada (nada se perde).

import type { createSupabaseServiceClient } from "@/lib/supabase/client";

type Svc = ReturnType<typeof createSupabaseServiceClient>;

export interface AvisoReservado {
  id: string;
  destinatario: string;
  nome: string | null;
  tipo: string;
  titulo: string;
  id_tarefa: string | null;
  id_quadro: string | null;
  tarefa_titulo: string | null;
  quadro_nome: string | null;
  prazo: string | null;
}

const ROTULO_TIPO: Record<string, string> = {
  atribuicao: "Você foi atribuído a uma tarefa",
  seguidor: "Você agora segue uma tarefa",
  status: "Uma tarefa sua mudou de status",
  comentario: "Novo comentário numa tarefa sua",
  mencao: "Você foi mencionado num comentário",
  quadro: "Nova tarefa num quadro seu",
  prazo: "Prazo de uma tarefa sua",
};

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function fmtData(iso: string | null): string | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : null;
}

/** Link direto para a tarefa (a página /gestao abre quadro + tarefa por query). */
export function linkTarefa(appUrl: string, a: Pick<AvisoReservado, "id_quadro" | "id_tarefa">): string {
  const qs = new URLSearchParams();
  if (a.id_quadro) qs.set("quadro", a.id_quadro);
  if (a.id_tarefa) qs.set("tarefa", a.id_tarefa);
  const q = qs.toString();
  return `${appUrl.replace(/\/+$/, "")}/gestao${q ? `?${q}` : ""}`;
}

/** Assunto + HTML do e-mail. Função pura (testada). */
export function montarEmailAviso(a: AvisoReservado, appUrl: string): { assunto: string; html: string } {
  const assunto = `[Gestão JCN Consultoria] ${a.titulo}`.slice(0, 200);
  const primeiro = (a.nome ?? "").trim().split(/\s+/)[0];
  const linhas: [string, string][] = [];
  if (a.tarefa_titulo) linhas.push(["Tarefa", a.tarefa_titulo]);
  if (a.quadro_nome) linhas.push(["Quadro", a.quadro_nome]);
  const prazo = fmtData(a.prazo);
  if (prazo) linhas.push(["Prazo", prazo]);
  const tabela = linhas
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">${esc(k)}</td><td style="padding:4px 0;color:#111827;font-weight:600;">${esc(v)}</td></tr>`)
    .join("");
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gestão JCN Consultoria</title></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px;">
    <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr><td style="background:#0284c7;padding:18px 24px;color:#ffffff;font-size:16px;font-weight:700;">Gestão JCN Consultoria</td></tr>
      <tr><td style="padding:24px;">
        <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">${esc(ROTULO_TIPO[a.tipo] ?? "Aviso da Gestão")}</p>
        <h2 style="margin:0 0 16px;font-size:18px;line-height:1.35;color:#111827;">${primeiro ? `${esc(primeiro)}, ` : ""}${esc(a.titulo)}</h2>
        ${tabela ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;font-size:14px;">${tabela}</table>` : ""}
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0284c7;border-radius:8px;">
          <a href="${esc(linkTarefa(appUrl, a))}" style="display:inline-block;padding:11px 24px;font-weight:700;color:#ffffff;text-decoration:none;font-size:14px;">Abrir no painel →</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
        Você recebe este e-mail porque é responsável, seguidor ou foi mencionado nesta tarefa.<br>© JCN Consultoria · SST JCN
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { assunto, html };
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Envia até `limite` avisos pendentes. Best-effort: nunca lança. */
export async function enviarAvisosPendentes(
  sb: Svc,
  cfg: { resendKey: string | undefined; from: string; appUrl: string; limite?: number }
): Promise<{ enviados: number; falhas: number }> {
  if (!cfg.resendKey) return { enviados: 0, falhas: 0 };
  const { data, error } = await sb.rpc("gestao_aviso_email_reservar", { p_limite: cfg.limite ?? 20 } as never);
  if (error || !Array.isArray(data)) return { enviados: 0, falhas: 0 };
  let enviados = 0;
  let falhas = 0;
  for (const a of data as AvisoReservado[]) {
    let ok = false;
    let erro: string | null = null;
    try {
      const { assunto, html } = montarEmailAviso(a, cfg.appUrl);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.resendKey}` },
        body: JSON.stringify({ from: cfg.from, to: a.destinatario, subject: assunto, html }),
        signal: AbortSignal.timeout(10_000),
      });
      ok = res.ok;
      if (!ok) erro = `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
    } catch (e) {
      erro = e instanceof Error ? e.name : "falha";
    }
    await sb.rpc("gestao_aviso_email_concluir", { p_id: a.id, p_ok: ok, p_erro: erro } as never);
    if (ok) enviados++; else falhas++;
    await pausa(550); // limite do Resend: 2 envios/segundo
  }
  return { enviados, falhas };
}
