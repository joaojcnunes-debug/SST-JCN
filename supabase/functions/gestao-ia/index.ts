// Edge Function — IA da Gestão JCN Consultoria (Groq / Llama 3.1 8B).
// Ações:
//   "subtarefas" → { data: { subtarefas: string[] } }
//   "descricao"  → { data: { descricao: string } }
// Body: { acao, titulo, descricao? }. JWT validado (invocada por usuário logado).
//
// DEPLOY: supabase functions deploy gestao-ia   (usa o segredo GROQ_API_KEY já configurado)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const PROMPT_SUBTAREFAS = `Você ajuda equipes a planejar tarefas. A partir do título (e descrição, se houver) de uma tarefa, gere de 3 a 7 subtarefas objetivas e acionáveis — passos concretos para concluí-la.
Responda APENAS com JSON válido, sem markdown: {"subtarefas": ["...", "..."]}.
Regras: português do Brasil; cada item curto (até ~10 palavras); verbo no infinitivo; sem numeração; não invente dados específicos (nomes, valores) que não foram dados.`;

const PROMPT_DESCRICAO = `Você ajuda a redigir descrições de tarefas. A partir do título (e de uma descrição parcial, se houver), escreva uma descrição clara e objetiva.
Responda APENAS com JSON válido, sem markdown: {"descricao": "..."}.
Regras: português do Brasil; 2 a 4 frases; explique o objetivo e o que precisa ser feito; tom profissional; não invente dados específicos não fornecidos.`;

interface Body { acao?: string; titulo?: string; descricao?: string }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!GROQ_API_KEY) return json({ error: "GROQ_API_KEY não configurada." }, 500);

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const acao = body?.acao;
    const titulo = (body?.titulo ?? "").trim();
    if (!titulo) return json({ error: "Informe o título da tarefa." }, 400);
    if (acao !== "subtarefas" && acao !== "descricao") return json({ error: "Ação inválida." }, 400);

    const system = acao === "subtarefas" ? PROMPT_SUBTAREFAS : PROMPT_DESCRICAO;
    const userMsg = `Título: ${titulo}${body?.descricao ? `\nDescrição atual: ${body.descricao}` : ""}`;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 800,
      }),
    });
    if (!groqRes.ok) return json({ error: `Groq retornou ${groqRes.status}.` }, 502);

    const groqData = await groqRes.json();
    const content: string | undefined = groqData?.choices?.[0]?.message?.content;
    if (!content) return json({ error: "Resposta vazia do modelo." }, 502);

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(content); } catch { return json({ error: "Modelo retornou JSON inválido." }, 502); }

    if (acao === "subtarefas") {
      const arr = Array.isArray(parsed.subtarefas) ? parsed.subtarefas : [];
      const subtarefas = arr.map((x) => String(x).trim()).filter((x) => x).slice(0, 12);
      return json({ data: { subtarefas } });
    }
    return json({ data: { descricao: String(parsed.descricao ?? "").trim() } });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado." }, 500);
  }
});
