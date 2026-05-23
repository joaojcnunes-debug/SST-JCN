// Edge Function — gera parágrafo introdutório de um capítulo fixo do laudo AET
// via Groq (Llama 3.1 8B Instant). Mesmo padrão de gerar-observacao-psi-ia.
//
// DEPLOY:
//   supabase functions deploy gerar-intro-capitulo-aet-ia
//
// Cliente: supabase.functions.invoke('gerar-intro-capitulo-aet-ia', { body })

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ContextoIA {
  slug_fixo: string;
  empresa_nome?: string | null;
  textoAtual?: string | null;
}

const SYSTEM_PROMPT = `Você é um(a) engenheiro(a)/técnico(a) de segurança do trabalho brasileiro(a), especialista em Análise Ergonômica do Trabalho (AET), com domínio da NR-17 e legislação complementar.

Sua tarefa: redigir o parágrafo introdutório de uma seção específica do Laudo AET.

Responda APENAS com JSON válido (sem markdown, sem cercas, sem texto fora do JSON):
{ "intro": "Texto corrido em português brasileiro, 1 a 2 parágrafos, tom técnico, 3ª pessoa, entre 60 e 150 palavras." }

Diretrizes:
- Tom formal e técnico, como documento oficial
- 3ª pessoa do singular
- Sem listas com bullets — apenas parágrafos corridos
- Referenciar a NR-17 e normas pertinentes quando adequado
- NÃO inventar dados — apenas contextualizar a seção`;

const PROMPTS: Record<string, string> = {
  aet_agentes_ambientais: `Seção: Agentes Ambientais para as Áreas Operacionais
Objetivo da seção: apresentar a tabela de agentes físicos, químicos, biológicos, ergonômicos e mecânicos identificados em cada setor da empresa, com intensidade/concentração, EPIs utilizados e classificação de risco.
Redija o parágrafo introdutório desta seção, contextualizando a identificação e avaliação dos agentes ambientais no âmbito da AET/NR-17 e do PGR/NR-01.`,

  aet_analise_ergonomica: `Seção: Análise Ergonômica do Trabalho por Setor
Objetivo da seção: apresentar, para cada setor, a análise ergonômica detalhada contendo: análise postural OWAS, checklist ergonômico NR-17, registros fotográficos, parecer técnico e recomendações.
Redija o parágrafo introdutório desta seção, contextualizando a metodologia de análise ergonômica (OWAS, checklist NR-17, análise da tarefa) utilizada para avaliar os postos de trabalho.`,

  aet_psicossocial: `Seção: Avaliação dos Fatores Psicossociais — QPS Nordic
Objetivo da seção: apresentar os resultados da aplicação do instrumento QPS Nordic (13 fatores psicossociais) com análise por setor, zona de risco e nível PGR.
Redija o parágrafo introdutório desta seção, contextualizando a avaliação de fatores psicossociais no âmbito da NR-01 (GRO) e a metodologia QPS Nordic aplicada.`,

  aet_consideracoes_finais: `Seção: Considerações Finais
Objetivo da seção: apresentar as conclusões técnicas da Análise Ergonômica do Trabalho, com síntese dos achados e encaminhamentos para adequação dos postos de trabalho à NR-17.
Redija o parágrafo introdutório desta seção, contextualizando a síntese dos achados ergonômicos e a importância das recomendações para a saúde e segurança dos trabalhadores.`,
};

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
    const slugPrompt = PROMPTS[body.slug_fixo];
    if (!slugPrompt) {
      return new Response(
        JSON.stringify({ error: `slug_fixo não suportado: ${body.slug_fixo}` }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const userLines: string[] = [];
    if (body.empresa_nome) userLines.push(`Empresa: ${body.empresa_nome}`);
    userLines.push(slugPrompt);
    if (body.textoAtual?.trim()) {
      userLines.push("");
      userLines.push(`Texto já redigido (refine, não contradiga):\n${body.textoAtual}`);
    }
    userLines.push("");
    userLines.push("Gere o parágrafo introdutório em JSON conforme o formato definido.");

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userLines.join("\n") },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 500,
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

    let parsed: { intro?: unknown };
    try { parsed = JSON.parse(content); }
    catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido do modelo", raw: content.slice(0, 400) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const intro = typeof parsed?.intro === "string" ? parsed.intro.trim() : "";
    if (!intro) {
      return new Response(
        JSON.stringify({ error: "Campo 'intro' ausente", raw: content.slice(0, 400) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data: { intro } }), {
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
