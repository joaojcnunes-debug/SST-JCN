// Edge Function — sugere treinamentos obrigatórios por setor via Groq
// com base nos riscos identificados e NRs aplicáveis.
//
// DEPLOY:
//   supabase functions deploy gerar-treinamentos-inspecao-ia
//
// Cliente: supabase.functions.invoke('gerar-treinamentos-inspecao-ia', { body })

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

interface RiscoInput {
  tipo: string;
  agente?: string;
  nivel?: string;
}

interface SetorInput {
  id_setor: string;
  nome: string;
  descricao?: string;
  riscos: RiscoInput[];
  treinamentos_cadastrados?: TreinamentoExistente[];
}

interface TreinamentoExistente {
  nr: string;
  titulo: string;
}

interface Payload {
  setores: SetorInput[];
  treinamentos_existentes: TreinamentoExistente[];
}

interface TreinamentoSugerido {
  nr: string;
  titulo: string;
  descricao: string;
  carga_horaria: string;
  periodicidade: string;
  setores_ids: string[];
  justificativa: string;
}

const SYSTEM_PROMPT = `Você é um(a) técnico(a)/engenheiro(a) de segurança do trabalho brasileiro(a), especialista em programas de treinamento conforme as Normas Regulamentadoras (NRs) do MTE.

Sua tarefa: analisar os riscos identificados em cada setor de uma inspeção e recomendar os treinamentos NR obrigatórios pendentes.

Responda APENAS com JSON válido (sem markdown, sem cercas de código, sem texto fora do JSON):
{
  "treinamentos": [
    {
      "nr": "NR-XX",
      "titulo": "Nome do Treinamento",
      "descricao": "Breve descrição do conteúdo (1 a 2 frases)",
      "carga_horaria": "Xh",
      "periodicidade": "Inicial | Reciclagem anual | Reciclagem bienal | Eventual",
      "setores_ids": ["id_setor_1"],
      "justificativa": "Por que é obrigatório — cite a NR e o risco que o origina (1 frase)"
    }
  ]
}

REGRAS DE MAPEAMENTO RISCO → TREINAMENTO (referência normativa):
- Qualquer risco identificado → NR-01 (Disposições Gerais e GRO) — obrigatório para todos os setores com riscos
- Riscos que exijam EPI → NR-06 (Equipamentos de Proteção Individual) — 2h, Inicial
- Risco elétrico → NR-10 (Segurança em Instalações Elétricas) — 40h básico, Reciclagem bienal
- Risco de queda em altura (>2m) → NR-35 (Trabalho em Altura) — 8h mínimo, Reciclagem bienal
- Espaço confinado → NR-33 (Espaço Confinado) — 16h mínimo, Reciclagem anual
- Máquinas/equipamentos → NR-12 (Segurança em Máquinas) — 8h, Inicial
- Risco ergonômico → NR-17 (Ergonomia) — 4h, Inicial
- Risco de incêndio / combate a incêndio → NR-23 (Proteção contra Incêndios) + Brigada de Emergência — 8h
- Risco químico → NR-09 (PGR) + treinamento de manuseio de produtos químicos — 8h, Reciclagem anual
- Construção civil → NR-18 (Condições Sanitárias na Construção) — 6h, Inicial
- Serviços em altura com soldagem → NR-34 (Construção Naval) — se aplicável
- Ambulância / primeiros socorros → quando riscos moderados/altos — 16h, Reciclagem anual

DIRETRIZES OBRIGATÓRIAS:
- NÃO inclua treinamentos já cadastrados (listados como "Treinamentos já cadastrados")
- Um mesmo treinamento pode e deve cobrir múltiplos setores (quando o risco é comum a vários setores)
- Consolide: prefira 1 treinamento para 3 setores a 3 treinamentos iguais separados
- Carga horária baseada no mínimo exigido pela NR
- Retorne entre 1 e 12 sugestões realmente aplicáveis — não exagere
- NUNCA invente dados — baseie-se exclusivamente nos riscos e setores fornecidos
- Se um setor não tem riscos, ele ainda pode precisar de NR-01 se houver riscos gerais na inspeção`;

function buildUserPrompt(p: Payload): string {
  const l: string[] = [];

  if (p.setores.length === 0) {
    return "Nenhum setor informado.";
  }

  l.push("SETORES E RISCOS IDENTIFICADOS NA INSPEÇÃO:");
  l.push("");

  for (const s of p.setores) {
    l.push(`Setor: "${s.nome}" (id: ${s.id_setor})`);
    if (s.descricao) l.push(`  Descrição da atividade: ${s.descricao}`);
    if (s.riscos.length === 0) {
      l.push("  Riscos: nenhum identificado");
    } else {
      l.push(`  Riscos identificados (${s.riscos.length}):`);
      for (const r of s.riscos) {
        const partes = [`[${r.tipo}]`];
        if (r.agente) partes.push(r.agente);
        if (r.nivel) partes.push(`— Nível: ${r.nivel}`);
        l.push(`    • ${partes.join(" ")}`);
      }
    }
    if (s.treinamentos_cadastrados && s.treinamentos_cadastrados.length > 0) {
      l.push(`  Treinamentos JÁ CADASTRADOS neste setor (NÃO repita para este setor):`);
      for (const t of s.treinamentos_cadastrados) {
        l.push(`    • ${t.nr} — ${t.titulo}`);
      }
    }
    l.push("");
  }

  if (p.treinamentos_existentes.length > 0) {
    l.push("Treinamentos já cadastrados nesta inspeção (NÃO repita):");
    for (const t of p.treinamentos_existentes) {
      l.push(`  • ${t.nr} — ${t.titulo}`);
    }
    l.push("");
  }

  l.push(
    "Com base nos riscos acima e nas NRs aplicáveis, sugira os treinamentos obrigatórios pendentes em JSON."
  );
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
    const body = (await req.json()) as Payload;

    if (!body?.setores || body.setores.length === 0) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: setores é obrigatório" }),
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
        temperature: 0.3,
        max_tokens: 1500,
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
    const content: string | undefined =
      groqData?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do modelo" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let parsed: { treinamentos?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({
          error: "JSON inválido do modelo",
          raw: content.slice(0, 400),
        }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(parsed?.treinamentos)) {
      return new Response(
        JSON.stringify({
          error: "Campo 'treinamentos' ausente ou inválido",
          raw: content.slice(0, 400),
        }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Sanitiza — garante campos mínimos e setores_ids válidos
    const setoresValidos = new Set(body.setores.map((s) => s.id_setor));
    const treinamentos = (parsed.treinamentos as TreinamentoSugerido[])
      .filter((t) => t?.nr && t?.titulo)
      .map((t) => ({
        nr: String(t.nr).trim(),
        titulo: String(t.titulo).trim(),
        descricao: String(t.descricao ?? "").trim(),
        carga_horaria: String(t.carga_horaria ?? "").trim(),
        periodicidade: String(t.periodicidade ?? "").trim(),
        setores_ids: (Array.isArray(t.setores_ids) ? t.setores_ids : []).filter(
          (id) => setoresValidos.has(id)
        ),
        justificativa: String(t.justificativa ?? "").trim(),
      }));

    return new Response(JSON.stringify({ data: { treinamentos } }), {
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
