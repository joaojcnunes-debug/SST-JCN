// Edge Function — gera Observações Gerais do Relatório de Conformidade
// analisando todos os itens auditados (situação + observações individuais)
// via Groq (Llama 3.1 8B Instant).
//
// DEPLOY:
//   supabase functions deploy gerar-obs-gerais-conformidade-ia
//
// Cliente: supabase.functions.invoke('gerar-obs-gerais-conformidade-ia', { body })

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

interface ItemResumo {
  codigo: string;
  titulo: string;
  situacao: "CONFORME" | "NAO_APLICAVEL" | "PENDENTE";
  observacao?: string | null;
}

interface Payload {
  empresa_nome?: string | null;
  setor?: string | null;
  nr_codigo: string;
  nr_titulo: string;
  itens: ItemResumo[];
  obs_atual?: string | null;
}

const SYSTEM_PROMPT = `Você é um(a) técnico(a)/engenheiro(a) de segurança do trabalho brasileiro(a), especialista em auditorias de conformidade com Normas Regulamentadoras (NRs) do MTE.

Sua tarefa: redigir as OBSERVAÇÕES GERAIS de um Relatório de Conformidade, sintetizando o quadro geral da auditoria com base nos itens avaliados, suas situações e as observações individuais registradas.

Responda APENAS com JSON válido (sem markdown, sem cercas, sem texto fora do JSON):
{ "observacoes_gerais": "Texto corrido em português brasileiro, 2 a 4 parágrafos, tom técnico, 3ª pessoa, entre 100 e 280 palavras." }

Diretrizes:
- Iniciar com um panorama geral da situação de conformidade (quantos conformes, pendentes, não aplicáveis)
- Destacar os pontos críticos (itens PENDENTES mais relevantes para a segurança)
- Mencionar os aspectos positivos identificados nos itens CONFORMES quando houver observações relevantes
- Integrar as observações individuais mais significativas na síntese (sem copiar textualmente)
- Concluir com uma orientação geral de encaminhamento
- NÃO listar todos os itens individualmente — sintetizar o quadro geral
- NÃO usar listas com bullets — apenas parágrafos corridos
- Não inventar dados que não estejam no contexto fornecido`;

function buildUserPrompt(p: Payload): string {
  const l: string[] = [];
  l.push(`Empresa: ${p.empresa_nome ?? "não informada"}`);
  if (p.setor) l.push(`Setor/Local: ${p.setor}`);
  l.push(`Norma auditada: ${p.nr_codigo} — ${p.nr_titulo}`);
  l.push("");

  const conformes = p.itens.filter((i) => i.situacao === "CONFORME");
  const pendentes = p.itens.filter((i) => i.situacao === "PENDENTE");
  const naoAplicaveis = p.itens.filter((i) => i.situacao === "NAO_APLICAVEL");

  l.push(
    `Resumo: ${p.itens.length} itens totais | ${conformes.length} conformes | ${pendentes.length} pendentes | ${naoAplicaveis.length} não aplicáveis`
  );
  l.push("");

  if (pendentes.length > 0) {
    l.push("ITENS PENDENTES (não conformes):");
    for (const it of pendentes.slice(0, 15)) {
      const obs = it.observacao?.trim()
        ? ` — ${it.observacao.slice(0, 120)}`
        : "";
      l.push(`  • ${it.codigo}: ${it.titulo}${obs}`);
    }
    if (pendentes.length > 15)
      l.push(`  ... e mais ${pendentes.length - 15} itens pendentes`);
    l.push("");
  }

  // Conformes com observação registrada (mais relevantes para a síntese)
  const conformesComObs = conformes
    .filter((i) => i.observacao?.trim())
    .slice(0, 8);
  if (conformesComObs.length > 0) {
    l.push("DESTAQUES CONFORMES (com observações):");
    for (const it of conformesComObs) {
      l.push(`  • ${it.codigo}: ${it.titulo} — ${it.observacao!.slice(0, 120)}`);
    }
    l.push("");
  }

  if (p.obs_atual?.trim()) {
    l.push(`Texto já redigido (refine, não contradiga):\n${p.obs_atual}`);
    l.push("");
  }

  l.push("Gere as observações gerais em JSON conforme o formato definido.");
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
    if (!body?.nr_codigo || !body?.itens?.length) {
      return new Response(
        JSON.stringify({
          error: "Payload inválido: nr_codigo e itens são obrigatórios",
        }),
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
        temperature: 0.5,
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
    const content: string | undefined =
      groqData?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do modelo" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let parsed: { observacoes_gerais?: unknown };
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

    const observacoes_gerais =
      typeof parsed?.observacoes_gerais === "string"
        ? parsed.observacoes_gerais.trim()
        : "";
    if (!observacoes_gerais) {
      return new Response(
        JSON.stringify({
          error: "Campo 'observacoes_gerais' ausente",
          raw: content.slice(0, 400),
        }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data: { observacoes_gerais } }), {
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
