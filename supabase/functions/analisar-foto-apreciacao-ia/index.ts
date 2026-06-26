// Edge Function — IA olha as fotos de um item NR-12 e propõe observação
// técnica + achados visuais estruturados (possíveis não conformidades).
//
// Modelo vision: Llama 4 Scout 17B (Groq). O llama-3.2-11b-vision-preview
// anterior foi descontinuado pelo Groq.
//
// DEPLOY:
//   1. supabase secrets set GROQ_API_KEY=gsk_xxx  (provavelmente já existe)
//   2. supabase functions deploy analisar-foto-apreciacao-ia
//
// Cliente: supabase.functions.invoke('analisar-foto-apreciacao-ia', { body })

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FOTOS = 4; // Limite para evitar payload gigante

interface PayloadIA {
  /** URLs públicas das fotos do item. */
  foto_urls: string[];
  /** Código do item NR-12 (ex: "12.38.1"). */
  item_codigo: string;
  /** Título do requisito (ex: "Botão de emergência tipo cogumelo..."). */
  item_titulo: string;
  /** Descrição detalhada do requisito (opcional). */
  item_descricao?: string | null;
  /** Categoria NR-12 (ex: "SISTEMAS_SEGURANCA"). */
  categoria?: string | null;
  /** Texto que o auditor já escreveu — refinar, não substituir. */
  textoAtual?: string | null;
}

const SYSTEM_PROMPT = `Você é um(a) engenheiro(a) de segurança do trabalho brasileiro(a), especialista em NR-12 (Segurança no Trabalho em Máquinas e Equipamentos).

Sua tarefa: analisar a(s) foto(s) anexada(s) de um item do checklist NR-12 e produzir uma observação técnica descritiva — o que está visível na imagem em relação ao requisito da norma. Foque em fatos observáveis, não em julgamentos absolutos.

Responda APENAS com um JSON válido (sem markdown, sem cercas \`\`\`, sem texto fora do JSON) no formato:

{
  "observacao": "Texto corrido em português brasileiro técnico, 2 a 5 frases. Descreva o que está visível na foto que se relaciona ao requisito. Mencione condições observadas (presença/ausência de proteções, sinalização, estado de conservação, distâncias, dispositivos visíveis). Não invente o que não está claramente visível. Quando a foto for inconclusiva ou ambígua, declare explicitamente (ex: 'A imagem não permite confirmar a presença do dispositivo X').",
  "achados": [
    {
      "titulo": "Achado visual curto e objetivo (ex: 'Partes móveis expostas sem proteção fixa')",
      "severidade": "ALTA | MEDIA | BAIXA",
      "recomendacao": "Recomendação técnica objetiva pra tratar o achado (1-2 frases)"
    }
  ]
}

Sobre "achados": liste APENAS possíveis não conformidades ou condições de risco CLARAMENTE visíveis nas fotos (ausência de proteção, proteção inadequada, partes móveis expostas, pontos de esmagamento/corte, ausência de sinalização, falta de botão de emergência visível, conservação precária, desorganização do entorno). Se nada de relevante for visível, retorne "achados": [] (array vazio). Não invente achados.

Diretrizes:
- Português brasileiro formal técnico, redação na 3ª pessoa
- observacao: 50-150 palavras
- Fatos observáveis primeiro — depois inferências razoáveis se aplicável
- Se múltiplas fotos forem fornecidas, sintetize o conjunto (não descreva uma a uma)
- Se a foto não tem relação clara com o requisito, escreva uma frase indicando isso
- Não classifique como CONFORME/NÃO CONFORME — só descreva (o auditor decide)
- Se textoAtual já preenchido, REFINE preservando o sentido — não contradiga`;

function buildUserPrompt(p: PayloadIA): string {
  const linhas: string[] = [
    "Analise a(s) foto(s) anexada(s) em relação ao requisito NR-12 abaixo:",
    "",
    `Item: ${p.item_codigo} — ${p.item_titulo}`,
  ];
  if (p.item_descricao) {
    linhas.push(`Detalhamento: ${p.item_descricao}`);
  }
  if (p.categoria) {
    linhas.push(`Categoria NR-12: ${p.categoria}`);
  }
  if (p.textoAtual && p.textoAtual.trim().length > 0) {
    linhas.push("");
    linhas.push("Texto já redigido pelo auditor (refine, não contradiga):");
    linhas.push(p.textoAtual.trim().slice(0, 600));
  }
  linhas.push("");
  linhas.push("Gere a observação técnica em JSON conforme o formato definido.");
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
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await req.json()) as PayloadIA;

    if (!Array.isArray(body?.foto_urls) || body.foto_urls.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Payload inválido: 'foto_urls[]' obrigatório e não vazio",
        }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    if (!body?.item_codigo || !body?.item_titulo) {
      return new Response(
        JSON.stringify({
          error: "Payload inválido: 'item_codigo' e 'item_titulo' obrigatórios",
        }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Limita N fotos pra evitar payload absurdo
    const urls = body.foto_urls.slice(0, MAX_FOTOS);

    // Monta a mensagem multimodal — texto + imagens
    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      { type: "text", text: buildUserPrompt(body) },
      ...urls.map(
        (url) =>
          ({
            type: "image_url" as const,
            image_url: { url },
          })
      ),
    ];

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
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 900,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return new Response(
        JSON.stringify({ error: `Groq retornou ${groqRes.status}: ${errText}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqRes.json();
    const content: string | undefined =
      groqData?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do modelo" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let parsed: { observacao?: unknown; achados?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Modelo retornou JSON inválido",
          raw: content.slice(0, 500),
        }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const observacao =
      typeof parsed?.observacao === "string" ? parsed.observacao.trim() : "";
    if (!observacao) {
      return new Response(
        JSON.stringify({
          error: "Modelo não retornou 'observacao'",
          raw: content.slice(0, 500),
        }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Sanitiza achados — array opcional de não conformidades visuais
    const SEVERIDADES = ["ALTA", "MEDIA", "BAIXA"];
    const achados = Array.isArray(parsed?.achados)
      ? (parsed.achados as Record<string, unknown>[])
          .filter((a) => a && typeof a.titulo === "string" && a.titulo.trim())
          .slice(0, 10)
          .map((a) => ({
            titulo: (a.titulo as string).trim(),
            severidade: SEVERIDADES.includes(String(a.severidade))
              ? (String(a.severidade) as "ALTA" | "MEDIA" | "BAIXA")
              : null,
            recomendacao:
              typeof a.recomendacao === "string" && a.recomendacao.trim()
                ? a.recomendacao.trim()
                : null,
          }))
      : [];

    return new Response(JSON.stringify({ data: { observacao, achados } }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
