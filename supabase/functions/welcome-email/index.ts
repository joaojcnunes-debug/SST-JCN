// Edge Function — envia e-mail de boas-vindas a novos usuários do Painel SST.
//
// DEPLOY:
//   1. Instale a Supabase CLI: https://supabase.com/docs/guides/cli
//   2. supabase login
//   3. supabase link --project-ref vifatwpfqhhantordxlq
//   4. Crie conta gratuita em https://resend.com e gere uma API Key
//   5. supabase secrets set RESEND_API_KEY=re_xxxxx
//   6. supabase secrets set APP_URL=https://painel-sst-chabra.vercel.app
//   7. supabase secrets set FROM_EMAIL="Painel SST <onboarding@resend.dev>"
//   8. supabase functions deploy welcome-email --no-verify-jwt
//
// O cliente (Painel SST) invoca via supabase.functions.invoke('welcome-email', { body })
// Se RESEND_API_KEY não estiver setado, a função retorna 200 com sent:false
// e o fluxo de criação de usuário não é interrompido.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL =
  Deno.env.get("APP_URL") ?? "https://sst-jcn.vercel.app";
const FROM_EMAIL =
  Deno.env.get("FROM_EMAIL") ??
  "SST JCN Consultoria <onboarding@resend.dev>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  email: string;
  nome: string;
  perfil: string;
  senha?: string;
}

function template({ email, nome, perfil, senha }: Body): string {
  const linhaSenha = senha
    ? `<tr><td style="padding:6px 0;color:#374151;"><strong>Senha temporária:</strong></td><td style="padding:6px 0;font-family:monospace;color:#111827;">${senha}</td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SST JCN Consultoria</title>
</head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%);padding:32px 24px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.15);line-height:56px;font-size:28px;color:#ffffff;">🛡️</div>
              <h1 style="margin:12px 0 4px;color:#ffffff;font-size:24px;font-weight:700;">SST JCN Consultoria</h1>
              <p style="margin:0;color:rgba(255,255,255,.8);font-size:13px;">JCN Consultoria · Segurança e Saúde do Trabalho</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">Bem-vindo(a), ${nome}!</h2>
              <p style="margin:0 0 16px;color:#374151;line-height:1.55;">
                Sua conta no <strong>SST JCN Consultoria</strong> foi criada. Você já pode
                acessar o sistema com os dados abaixo:
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:0 0 20px;">
                <tr><td style="padding:6px 0;color:#374151;"><strong>E-mail:</strong></td><td style="padding:6px 0;color:#111827;">${email}</td></tr>
                ${linhaSenha}
                <tr><td style="padding:6px 0;color:#374151;"><strong>Perfil:</strong></td><td style="padding:6px 0;color:#111827;">${perfil}</td></tr>
              </table>
              <p style="margin:0 0 24px;color:#374151;line-height:1.55;">
                ${
                  senha
                    ? "Recomendamos trocar a senha após o primeiro acesso."
                    : "Use a senha que você recebeu separadamente."
                }
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:#1d4ed8;border-radius:8px;">
                    <a href="${APP_URL}/login"
                       style="display:inline-block;padding:12px 28px;font-weight:700;color:#ffffff;text-decoration:none;font-size:15px;">
                      Acessar o SST JCN →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:12px;">
                Se você não esperava este e-mail, ignore-o.<br>
                © JCN Consultoria · SST
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: CORS });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid json" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!body?.email || !body?.nome) {
    return new Response(
      JSON.stringify({ ok: false, error: "email e nome são obrigatórios" }),
      {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }

  // Sem provedor configurado: não falha — só registra que não enviou.
  if (!RESEND_API_KEY) {
    console.warn("[welcome-email] RESEND_API_KEY ausente, e-mail não enviado");
    return new Response(
      JSON.stringify({
        ok: true,
        sent: false,
        reason: "RESEND_API_KEY não configurado",
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const html = template(body);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: body.email,
      subject: "Bem-vindo ao SST JCN Consultoria",
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(
      JSON.stringify({ ok: false, sent: false, error: text }),
      {
        status: 502,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ ok: true, sent: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
