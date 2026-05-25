// Edge Function — gera Parecer Técnico, Recomendações ou Demais Condições
// para um setor da AET, via Groq (Llama 3.1 8B Instant).
//
// DEPLOY:
//   supabase functions deploy gerar-analise-setor-aet-ia
//
// Cliente: supabase.functions.invoke('gerar-analise-setor-aet-ia', { body })

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Campo = "parecer_tecnico" | "recomendacoes" | "demais_condicoes";

interface RiscoCtx {
  tipo: string;
  risco: string;
  classificacao: string;
  intensidade?: string | null;
}

interface ContextoIA {
  campo: Campo;
  empresa_nome?: string | null;
  setor_nome: string;
  cargos?: string[];
  descricao_atividade?: string | null;
  maquinas_equipamentos?: string | null;
  riscos?: RiscoCtx[];
  checklist?: Record<string, string>;
  textoAtual?: string | null;
}

const SYSTEM_PROMPT = `Você é um(a) ergonomista / técnico(a) de segurança do trabalho brasileiro(a), especialista em Análise Ergonômica do Trabalho (AET) e NR-17.

Sua tarefa: redigir texto técnico para o laudo AET de um setor específico.

Responda APENAS com JSON válido (sem markdown, sem cercas, sem texto fora do JSON):
{ "texto": "Texto em português brasileiro, tom técnico, 3ª pessoa, sem bullets — apenas parágrafos corridos." }

Comprimento esperado por campo:
- parecer_tecnico: 2 a 3 parágrafos (100–200 palavras)
- recomendacoes: 1 a 2 parágrafos com ações práticas (80–160 palavras)
- demais_condicoes: 1 a 2 parágrafos sobre condições ambientais/organizacionais complementares (60–120 palavras)

Diretrizes gerais:
- Mencionar o nome do setor e cargos quando relevante
- Basear-se nos riscos e checklist fornecidos; não inventar dados ausentes
- Referenciar NR-17 e normas pertinentes quando adequado
- Não usar listas com bullets — apenas parágrafos`;

const TITULO_CAMPO: Record<Campo, string> = {
  parecer_tecnico: "Parecer Técnico",
  recomendacoes: "Recomendações Ergonômicas",
  demais_condicoes: "Demais Condições Avaliadas",
};

function buildUserPrompt(ctx: ContextoIA): string {
  const l: string[] = [];
  if (ctx.empresa_nome) l.push(`Empresa: ${ctx.empresa_nome}`);
  l.push(`Setor: ${ctx.setor_nome}`);
  if (ctx.cargos?.length) l.push(`Cargos: ${ctx.cargos.join(", ")}`);
  if (ctx.descricao_atividade) l.push(`Descrição da atividade: ${ctx.descricao_atividade}`);
  if (ctx.maquinas_equipamentos) l.push(`Máquinas/Equipamentos: ${ctx.maquinas_equipamentos.replace(/\n+/g, ", ")}`);

  if (ctx.riscos?.length) {
    l.push("Agentes/Riscos identificados:");
    for (const r of ctx.riscos) {
      const partes = [`${r.tipo}: ${r.risco}`, `classificação ${r.classificacao}`];
      if (r.intensidade) partes.push(r.intensidade);
      l.push(`  - ${partes.join(" | ")}`);
    }
  }

  if (ctx.checklist && Object.keys(ctx.checklist).length > 0) {
    const respostas = Object.entries(ctx.checklist)
      .filter(([, v]) => v && v !== "nao_aplica")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    if (respostas) l.push(`Checklist ergonômico: ${respostas}`);
  }

  l.push(`\nCampo a redigir: ${TITULO_CAMPO[ctx.campo]}`);

  if (ctx.textoAtual?.trim()) {
    l.push(`\nTexto já redigido (refine, não contradiga):\n${ctx.textoAtual}`);
  }

  l.push("\nGere o texto em JSON conforme o formato definido.");
  return l.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY não configurada." }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await req.json()) as ContextoIA;
    if (!body?.setor_nome || !body?.campo) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: setor_nome e campo são obrigatórios" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(body) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.55,
        max_tokens: 700,
      }),
    });

    if (!groqRes.ok) {
      const txt = await groqRes.text();
      return new Response(
        JSON.stringify({ error: `Groq ${groqRes.status}: ${txt}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqRes.json();
    const content: string | undefined = groqData?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do modelo" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(content); }
    catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido do modelo", raw: content.slice(0, 400) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // aceita "texto", "text" ou o primeiro valor string do objeto
    const texto = (
      typeof parsed?.texto === "string" ? parsed.texto :
      typeof parsed?.text  === "string" ? parsed.text  :
      Object.values(parsed).find((v) => typeof v === "string") as string | undefined ?? ""
    ).trim();

    if (!texto) {
      return new Response(
        JSON.stringify({ error: "Campo 'texto' ausente", raw: content.slice(0, 400) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data: { texto } }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
