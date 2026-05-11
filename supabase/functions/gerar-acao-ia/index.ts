// Edge Function — gera Plano de Ação 5W2H via Groq (Llama 3.3 70B).
//
// DEPLOY:
//   1. Crie conta em https://console.groq.com e gere uma API Key
//   2. supabase secrets set GROQ_API_KEY=gsk_xxx
//   3. supabase functions deploy gerar-acao-ia
//
// O cliente invoca via supabase.functions.invoke('gerar-acao-ia', { body }).
// Apenas usuários autenticados podem chamar (JWT validado).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ContextoIA {
  empresa?: { nome?: string | null; cnpj?: string | null };
  setor?: { nome?: string | null; descricao?: string | null } | null;
  risco?: {
    tipo?: string | null;
    agente?: string | null;
    fonte?: string | null;
    severidade?: string | null;
    probabilidade?: string | null;
    nivel?: string | null;
    medidasRecomendadas?: string | null;
  } | null;
  /** Campos já preenchidos pelo usuário — IA refina sem contradizer */
  parcial?: Record<string, string | null>;
}

const SYSTEM_PROMPT = `Você é um especialista em SST (Segurança e Saúde do Trabalho) brasileiro, com conhecimento profundo das Normas Regulamentadoras (NR-01, NR-06, NR-07, NR-09, NR-15, NR-17, NR-35) e da metodologia 5W2H aplicada a Programas de Gerenciamento de Riscos (PGR).

Sua tarefa: gerar uma proposta de Plano de Ação 5W2H baseada no contexto fornecido (empresa, setor, risco identificado).

Responda APENAS com um JSON válido (sem markdown, sem explicações fora do JSON) no formato:

{
  "what_acao": "Descrição clara e imperativa da ação a ser executada (1-2 frases)",
  "why_justificativa": "Justificativa técnica citando a NR aplicável quando relevante",
  "where_local": "Local específico onde a ação deve ser implementada",
  "when_prazo_dias": 30,
  "who_responsavel": "Cargo/função do responsável típico para essa ação (ex: 'Gerente de Manutenção', 'Técnico de Segurança')",
  "how_metodo": "Método/procedimento detalhado em 1-2 frases técnicas",
  "how_much_custo": "Faixa estimada de custo em R$ (ex: 'R$ 5.000 a R$ 15.000') ou 'Sem custo direto'",
  "prioridade": "Media"
}

Diretrizes:
- Sempre em português brasileiro
- Tom profissional, técnico, aderente às NRs
- Prazo em dias inteiros entre 7 e 180, proporcional à severidade
- Prioridade: "Baixa" (Trivial/Baixo), "Media" (Moderado), "Alta" (Alto) ou "Critica" (Muito Alto / risco fatal)
- Não invente dados específicos não fornecidos (não invente nome de pessoa, telefones, endereços)
- Se o usuário já preencheu campos em "parcial", REFINE sem contradizer — só preencha o que estiver vazio`;

function buildUserPrompt(ctx: ContextoIA): string {
  const linhas: string[] = ["Contexto da ação a ser planejada:", ""];
  linhas.push(`Empresa: ${ctx.empresa?.nome ?? "—"}`);
  if (ctx.setor) {
    linhas.push(`Setor: ${ctx.setor.nome ?? "—"}`);
    if (ctx.setor.descricao) linhas.push(`  Descrição: ${ctx.setor.descricao}`);
  }
  if (ctx.risco) {
    linhas.push("");
    linhas.push("Risco identificado:");
    linhas.push(`  Tipo: ${ctx.risco.tipo ?? "—"}`);
    linhas.push(`  Agente: ${ctx.risco.agente ?? "—"}`);
    if (ctx.risco.fonte) linhas.push(`  Fonte geradora: ${ctx.risco.fonte}`);
    if (ctx.risco.severidade)
      linhas.push(`  Severidade: ${ctx.risco.severidade}`);
    if (ctx.risco.probabilidade)
      linhas.push(`  Probabilidade: ${ctx.risco.probabilidade}`);
    if (ctx.risco.nivel) linhas.push(`  Nível de risco: ${ctx.risco.nivel}`);
    if (ctx.risco.medidasRecomendadas)
      linhas.push(`  Medidas já recomendadas: ${ctx.risco.medidasRecomendadas}`);
  }
  // Campos parciais (pra IA não sobrescrever o que já foi digitado)
  if (ctx.parcial) {
    const preenchidos = Object.entries(ctx.parcial)
      .filter(([, v]) => v && String(v).trim().length > 0);
    if (preenchidos.length > 0) {
      linhas.push("");
      linhas.push("Campos já preenchidos pelo usuário (NÃO contradiga):");
      for (const [k, v] of preenchidos) linhas.push(`  ${k}: ${v}`);
    }
  }
  linhas.push("");
  linhas.push("Gere o plano de ação 5W2H apropriado em JSON.");
  return linhas.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (!GROQ_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "GROQ_API_KEY não configurada. Defina via `supabase secrets set GROQ_API_KEY=...`",
      }),
      {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = (await req.json()) as ContextoIA;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(body) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 1024,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return new Response(
        JSON.stringify({ error: `Groq retornou ${groqRes.status}: ${errText}` }),
        {
          status: 502,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }

    const groqData = await groqRes.json();
    const content: string | undefined =
      groqData?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do modelo" }),
        {
          status: 502,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Modelo retornou JSON inválido",
          raw: content.slice(0, 500),
        }),
        {
          status: 502,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ data: parsed }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }
});
