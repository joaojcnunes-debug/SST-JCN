// Edge Function — Formulários de entrada da Gestão Chabra.
//
// Endpoint PÚBLICO (deploy com --no-verify-jwt). Usa service role para validar o
// token e criar a tarefa, sem expor dados internos.
//   GET  ?token=...           → devolve a definição pública do formulário (se ativo).
//   POST { token, titulo, descricao?, prazo?, prioridade?, respostas: string[] }
//                             → cria a tarefa na lista do formulário.
//
// DEPLOY: supabase functions deploy gestao-form-submit --no-verify-jwt
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function gerarIdTarefa(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `TRF-${hex}`;
}

interface Pergunta { label: string; obrigatorio: boolean }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  try {
    const url = new URL(req.url);
    const token = req.method === "GET" ? url.searchParams.get("token") : undefined;

    // ---- GET: definição pública do formulário ----
    if (req.method === "GET") {
      if (!token) return json({ error: "Token ausente." }, 400);
      const { data: form } = await sb.from("gestao_formularios").select("*").eq("token", token).maybeSingle();
      if (!form || !form.ativo) return json({ error: "Formulário indisponível." }, 404);
      return json({
        titulo: form.titulo,
        descricao: form.descricao,
        mostra_descricao: form.mostra_descricao,
        mostra_prazo: form.mostra_prazo,
        mostra_prioridade: form.mostra_prioridade,
        prioridade_padrao: form.prioridade_padrao,
        perguntas: form.perguntas ?? [],
      });
    }

    // ---- POST: cria a tarefa ----
    if (req.method === "POST") {
      const body = await req.json().catch(() => null) as
        | { token?: string; titulo?: string; descricao?: string; prazo?: string; prioridade?: string; respostas?: string[] }
        | null;
      if (!body?.token) return json({ error: "Token ausente." }, 400);

      const { data: form } = await sb.from("gestao_formularios").select("*").eq("token", body.token).maybeSingle();
      if (!form || !form.ativo) return json({ error: "Formulário indisponível." }, 404);

      const titulo = (body.titulo ?? "").trim();
      if (!titulo) return json({ error: "Informe o título da solicitação." }, 400);

      const perguntas = (form.perguntas ?? []) as Pergunta[];
      const respostas = Array.isArray(body.respostas) ? body.respostas : [];
      for (let i = 0; i < perguntas.length; i++) {
        if (perguntas[i].obrigatorio && !(respostas[i] ?? "").trim()) {
          return json({ error: `Responda: ${perguntas[i].label}` }, 400);
        }
      }

      // Status inicial: configurado, ou o primeiro status da lista, ou A_FAZER.
      let status = form.status_inicial as string | null;
      if (!status) {
        const { data: st } = await sb.from("gestao_status").select("slug").eq("id_quadro", form.id_quadro).order("ordem", { ascending: true }).limit(1).maybeSingle();
        status = st?.slug ?? "A_FAZER";
      }

      // Descrição: texto do solicitante (se permitido) + respostas das perguntas.
      const partes: string[] = [];
      if (form.mostra_descricao && (body.descricao ?? "").trim()) partes.push((body.descricao ?? "").trim());
      const linhas = perguntas.map((p, i) => ({ p, r: (respostas[i] ?? "").trim() })).filter((x) => x.r).map((x) => `${x.p.label}: ${x.r}`);
      if (linhas.length) partes.push(linhas.join("\n"));
      const descricao = partes.join("\n\n") || null;

      const prioridade = form.mostra_prioridade && body.prioridade ? body.prioridade : form.prioridade_padrao;
      const prazo = form.mostra_prazo && body.prazo ? body.prazo : null;
      const now = new Date().toISOString();

      // Responsável por E-MAIL (F1.3-D — paridade com app/api/gestao/form/route.ts).
      // Só usuário INTERNO ATIVO conta; match case-insensitive e literal. Resolveu →
      // created_by=<e-mail> + vínculo responsavel (trigger v187 espelha o nome).
      const emailForm = (form.responsavel_email ?? "").trim();
      let responsavelEmailResolvido: string | null = null;
      if (emailForm) {
        const { data: cands } = await sb.from("usuarios").select("email,nome,ativo_sistema").ilike("email", emailForm);
        const match = ((cands ?? []) as { email: string; nome: string; ativo_sistema: boolean }[])
          .find((c) => c.email.toLowerCase() === emailForm.toLowerCase() && c.ativo_sistema);
        if (match) responsavelEmailResolvido = match.email;
      }

      const idTarefa = gerarIdTarefa();
      const { error } = await sb.from("gestao_tarefas").insert({
        id_tarefa: idTarefa,
        id_quadro: form.id_quadro,
        titulo,
        descricao,
        status,
        prioridade,
        responsavel: responsavelEmailResolvido ? null : form.responsavel_padrao,
        prazo,
        data_inicio: null,
        ordem: 0,
        etiquetas: form.etiquetas_padrao ?? [],
        subtarefas: [],
        campos: {},
        recorrencia: null,
        pontos: null,
        created_by: responsavelEmailResolvido ?? "Formulário",
        created_at: now,
        updated_at: now,
      });
      if (error) return json({ error: "Não foi possível registrar a solicitação." }, 500);

      if (responsavelEmailResolvido) {
        const emailLc = responsavelEmailResolvido.toLowerCase();
        const { error: vErr } = await sb.from("gestao_tarefa_vinculados").insert({
          id_tarefa: idTarefa,
          usuario_email: emailLc,
          tipo: "responsavel",
          origem: "form",
        });
        if (!vErr) {
          await sb.from("gestao_vinculo_log").insert({
            ator_email: "Formulário",
            alvo_email: emailLc,
            acao: "vinculou",
            tipo: "responsavel",
            id_tarefa: idTarefa,
          });
        }
      }

      return json({ ok: true });
    }

    return json({ error: "Método não suportado." }, 405);
  } catch (_e) {
    return json({ error: "Erro inesperado." }, 500);
  }
});
