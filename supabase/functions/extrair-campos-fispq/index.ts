// Edge Function — Fallback de extração de campos de FISPQ via Groq.
//
// Uso: quando o parser regex local (lib/fispq/parser.ts) NÃO conseguiu
// extrair um ou mais campos-chave (nome_produto, fabricante, forma_fisica)
// e a base Chabra também não tem o CAS pra inferir, o front chama essa
// função passando só a Seção 1 (e/ou snippet relevante) + a lista dos
// campos faltantes. A IA devolve um JSON minimal só com esses campos.
//
// Por que função separada da analisar-quimico-ia?
//   - É uma chamada CIRÚRGICA — input ~500 tokens, output ~50 tokens.
//     Latência baixa, custo desprezível.
//   - Não substitui a análise principal; só preenche lacunas do parser.
//   - Roda 0-1 vez por upload (só se parser falhar).
//
// MODELO: llama-3.1-8b-instant (mesmo da análise principal). JSON mode.
//
// DEPLOY: supabase functions deploy extrair-campos-fispq

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Campo = "nome_produto" | "fabricante" | "forma_fisica";

interface ExtrairCamposBody {
  /** Trecho relevante da FISPQ — tipicamente seção 1 + 9 do parser, max ~3kb. */
  snippet: string;
  /** Quais campos a IA deve tentar extrair. */
  campos_faltantes: Campo[];
}

interface ExtrairCamposResponse {
  nome_produto?: string | null;
  fabricante?: string | null;
  forma_fisica?: string | null;
}

const SNIPPET_MAX = 4000;

const SYSTEM_PROMPT = `Você extrai dados estruturados de FISPQs (Fichas de Informações de Segurança de Produto Químico, formato ABNT NBR 14725).

Regras:
- Responda APENAS com JSON. Sem prosa, sem markdown, sem explicação.
- Use exatamente as chaves solicitadas. Se não conseguir extrair um campo com certeza, devolva null pra aquele campo.
- NUNCA invente. Se não está claramente no texto, devolva null.
- "nome_produto": o nome comercial/identificador do produto (Seção 1.1). Tipicamente uma string curta como "Solvente XYZ", "Tinta Acrílica Branca", "MC-2BK106". Não é uma descrição de uso — frases como "Principais usos recomendados para a..." NÃO são nome de produto.
- "fabricante": razão social da empresa fabricante/fornecedora (Seção 1.3). Não inclua endereço, telefone, CNPJ — só o nome da empresa.
- "forma_fisica": uma das opções: "Líquido", "Sólido", "Gás", "Vapor", "Aerossol", "Pó", "Pasta", "Granulado", "Cristalino". Vem da Seção 9 (Propriedades físico-químicas, campo Estado físico/Forma física/Aspecto). Normalize pra essas opções.`;

function buildUserPrompt(body: ExtrairCamposBody): string {
  const campos = body.campos_faltantes
    .map((c) => `- "${c}"`)
    .join("\n");
  const snippet = body.snippet.slice(0, SNIPPET_MAX);
  return `Extraia os seguintes campos da FISPQ abaixo:

${campos}

Devolva JSON com exatamente essas chaves (null se não conseguir).

=== TRECHO DA FISPQ ===
${snippet}
=== FIM ===`;
}

function parsearResposta(content: string): ExtrairCamposResponse {
  // Tenta parsear JSON direto; se falhar, procura bloco ```json ... ```
  let raw = content.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(raw);
  } catch {
    return {};
  }
  const limpar = (v: unknown): string | null | undefined => {
    if (v === null) return null;
    if (typeof v !== "string") return undefined;
    const s = v.trim();
    if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "none")
      return null;
    return s;
  };
  return {
    nome_produto: limpar(obj.nome_produto),
    fabricante: limpar(obj.fabricante),
    forma_fisica: limpar(obj.forma_fisica),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (!GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY não configurada no Supabase Secrets." }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await req.json()) as ExtrairCamposBody;

    if (!body?.snippet || typeof body.snippet !== "string") {
      return new Response(
        JSON.stringify({ error: "Payload inválido: 'snippet' obrigatório." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    if (
      !Array.isArray(body.campos_faltantes) ||
      body.campos_faltantes.length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: 'campos_faltantes' obrigatório." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

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
        temperature: 0.1,
        max_tokens: 200,
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
    const content: string | undefined = groqData?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do modelo" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const parsed = parsearResposta(content);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
