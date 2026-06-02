// Edge Function — analisa máquina via Groq (visão ou texto) e retorna
// avaliação NR-12: grau de risco, dispositivos de segurança e parecer técnico.
//
// DEPLOY:
//   supabase functions deploy analisar-maquina-ia
//
// Cliente: supabase.functions.invoke('analisar-maquina-ia', { body })

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_VISION = "llama-3.2-11b-vision-preview";
const MODEL_TEXT = "llama-3.1-8b-instant";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface MaquinaInput {
  nome: string;
  tipo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  potencia?: string | null;
  tensao?: string | null;
  observacoes?: string | null;
}

interface Payload {
  maquina: MaquinaInput;
  foto_urls?: string[];
}

interface AnaliseResult {
  grau_risco: "BAIXO" | "MEDIO" | "ALTO" | "CRITICO" | null;
  protecao_fixa: boolean | null;
  protecao_movel: boolean | null;
  intertravamento: boolean | null;
  botao_emergencia: boolean | null;
  sistema_bloqueio: boolean | null;
  aterramento: boolean | null;
  sinalizacao: boolean | null;
  necessita_adequacao_nr12: boolean;
  parecer: string;
  gaps: string[];
}

const SYSTEM_PROMPT = `Você é um(a) engenheiro(a) de segurança do trabalho especialista em NR-12 (Segurança no Trabalho em Máquinas e Equipamentos).

Analise a máquina descrita (e as fotos, se fornecidas) e retorne EXCLUSIVAMENTE um JSON válido com a seguinte estrutura — sem markdown, sem texto extra:

{
  "grau_risco": "BAIXO" | "MEDIO" | "ALTO" | "CRITICO",
  "protecao_fixa": true | false | null,
  "protecao_movel": true | false | null,
  "intertravamento": true | false | null,
  "botao_emergencia": true | false | null,
  "sistema_bloqueio": true | false | null,
  "aterramento": true | false | null,
  "sinalizacao": true | false | null,
  "necessita_adequacao_nr12": true | false,
  "parecer": "Parecer técnico detalhado (2 a 5 frases) conforme NR-12",
  "gaps": ["lista", "de", "não-conformidades", "identificadas"]
}

CRITÉRIOS DE GRAU DE RISCO NR-12:
- BAIXO: máquina leve, baixa potência, sem partes móveis expostas significativas, baixo risco de lesões
- MEDIO: risco moderado de acidentes, algumas proteções presentes, potência intermediária
- ALTO: máquinas com partes móveis perigosas (prensas, tornos, serras), risco elevado de amputação ou esmagamento
- CRITICO: equipamentos de alta periculosidade (caldeiras, equipamentos sob pressão, alta tensão, risco de explosão/morte)

DISPOSITIVOS DE SEGURANÇA — use null quando não for possível avaliar pelas informações disponíveis.

PARECER: cite a NR-12 e as exigências específicas aplicáveis. Mencione os requisitos mínimos de proteção para o tipo de máquina.`;

function buildTextPrompt(p: Payload): string {
  const m = p.maquina;
  const lines: string[] = ["MÁQUINA/EQUIPAMENTO PARA ANÁLISE NR-12:", ""];
  lines.push(`Nome: ${m.nome}`);
  if (m.tipo) lines.push(`Tipo: ${m.tipo}`);
  if (m.marca) lines.push(`Fabricante/Marca: ${m.marca}`);
  if (m.modelo) lines.push(`Modelo: ${m.modelo}`);
  if (m.potencia) lines.push(`Potência: ${m.potencia}`);
  if (m.tensao) lines.push(`Tensão: ${m.tensao}`);
  if (m.observacoes) lines.push(`Observações do inspetor: ${m.observacoes}`);
  if ((p.foto_urls ?? []).length > 0) {
    lines.push(`\nFotos disponíveis: ${p.foto_urls!.length} foto(s) — analise visualmente os dispositivos de segurança visíveis.`);
  }
  lines.push("\nForneça a avaliação NR-12 completa em JSON.");
  return lines.join("\n");
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
    const body = (await req.json()) as Payload;

    if (!body?.maquina?.nome) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: maquina.nome é obrigatório" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const fotos = (body.foto_urls ?? []).filter(Boolean);
    const useVision = fotos.length > 0;
    const model = useVision ? MODEL_VISION : MODEL_TEXT;
    const textPrompt = buildTextPrompt(body);

    // monta mensagem do usuário (vision ou texto puro)
    const userContent = useVision
      ? [
          { type: "text", text: textPrompt },
          ...fotos.slice(0, 3).map((url: string) => ({
            type: "image_url",
            image_url: { url, detail: "auto" },
          })),
        ]
      : textPrompt;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        // response_format não suportado em todos os modelos vision — usamos parsing manual
        temperature: 0.2,
        max_tokens: 1200,
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

    // extrai JSON do conteúdo (pode vir com markdown fence)
    let parsed: AnaliseResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON não encontrado na resposta");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido do modelo", raw: content.slice(0, 400) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // sanitiza grau_risco
    const GRAUS = ["BAIXO", "MEDIO", "ALTO", "CRITICO"];
    const grauRisco = GRAUS.includes(parsed.grau_risco ?? "")
      ? parsed.grau_risco
      : null;

    const result: AnaliseResult = {
      grau_risco: grauRisco as AnaliseResult["grau_risco"],
      protecao_fixa: parsed.protecao_fixa ?? null,
      protecao_movel: parsed.protecao_movel ?? null,
      intertravamento: parsed.intertravamento ?? null,
      botao_emergencia: parsed.botao_emergencia ?? null,
      sistema_bloqueio: parsed.sistema_bloqueio ?? null,
      aterramento: parsed.aterramento ?? null,
      sinalizacao: parsed.sinalizacao ?? null,
      necessita_adequacao_nr12: parsed.necessita_adequacao_nr12 ?? false,
      parecer: String(parsed.parecer ?? "").trim(),
      gaps: Array.isArray(parsed.gaps)
        ? parsed.gaps.map((g) => String(g)).filter(Boolean)
        : [],
    };

    return new Response(JSON.stringify({ data: result }), {
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
