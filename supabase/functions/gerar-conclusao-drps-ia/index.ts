// Edge Function — gera Conclusão técnica do DRPS (Diagnóstico de Riscos
// Psicossociais) via Groq (Llama 3.3 70B). Mesmo padrão de `gerar-acao-ia`.
//
// DEPLOY:
//   1. supabase secrets set GROQ_API_KEY=gsk_xxx  (já configurado se gerar-acao-ia funciona)
//   2. supabase functions deploy gerar-conclusao-drps-ia
//
// Cliente: supabase.functions.invoke('gerar-conclusao-drps-ia', { body })

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

interface TopicoCtx {
  nome: string;
  fonteGeradora?: string | null;
  gravidade?: string | null;
  probabilidade?: string | null;
  matriz?: string | null;
}

interface ContextoIA {
  empresa?: { nome?: string | null; cnpj?: string | null } | null;
  setor: {
    nome: string;
    funcoes?: string | null;
    totalRespondentes?: number | null;
  };
  ehConsolidado?: boolean;
  responsavelTecnico?: string | null;
  crp?: string | null;
  topicos: TopicoCtx[];
  agravos?: string | null;
  medidasExistentes?: string | null;
  textoAtual?: string | null;
}

const SYSTEM_PROMPT = `Você é um(a) psicólogo(a) do trabalho brasileiro(a), especialista em Saúde Mental Ocupacional e Riscos Psicossociais, com domínio da NR-01 (item 1.5 — GRO/PGR), NR-17 (ergonomia organizacional) e da metodologia do Diagnóstico de Riscos Psicossociais (DRPS).

Sua tarefa: redigir a CONCLUSÃO TÉCNICA do DRPS para um setor específico (ou consolidada para todos os setores), com base nos tópicos psicossociais avaliados (gravidade × probabilidade → matriz de risco), nos agravos potenciais à saúde mental identificados e nas medidas de controle recomendadas (medidas que a empresa deve adotar).

Responda APENAS com um JSON válido (sem markdown, sem cercas \`\`\`, sem texto fora do JSON) no formato:

{
  "conclusao": "Texto corrido em português brasileiro, 2 a 4 parágrafos, tom técnico-profissional, redação na 3ª pessoa, citando os tópicos de maior matriz de risco, articulando agravos potenciais com as medidas de controle recomendadas e indicando a necessidade (ou suficiência) de medidas adicionais. Não usar listas com bullets — somente parágrafos. Quando pertinente, citar NR-01 e NR-17."
}

Diretrizes:
- Português brasileiro formal, sem jargão excessivo
- 2 a 4 parágrafos, total entre 120 e 320 palavras
- Mencionar o nome do setor explicitamente
- Destacar tópicos com matriz "Crítico" ou "Alto" antes dos "Médio"/"Baixo"
- Se houver agravos listados, contextualizar como riscos potenciais (não como diagnósticos)
- Se houver medidas de controle recomendadas, articulá-las como ações que a empresa deve adotar para mitigar os riscos identificados
- Não inventar dados (nomes, datas, números) que não estejam no contexto
- Não recomendar ações específicas (isso vai em outro bloco) — foque em diagnóstico/parecer
- Se o usuário enviou "textoAtual" não vazio, REFINE preservando o sentido — não contradiga`;

/** Coage agravos/medidas para texto: aceita string, array ou mapa por setor
 *  (Record<setor, texto>) — a Conclusão Geral envia o mapa agravos_por_setor. */
function asText(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.filter(Boolean).map(String).join("\n");
  if (typeof v === "object") {
    return Object.values(v as Record<string, unknown>)
      .filter(Boolean)
      .map(String)
      .join("\n");
  }
  return String(v);
}

// Conclusão POR SETOR: texto corrido (conclusão técnica em parágrafos).
const SYSTEM_PROMPT_SETOR = `Você é um(a) psicólogo(a) do trabalho brasileiro(a), especialista em Saúde Mental Ocupacional e Riscos Psicossociais, com domínio da NR-01 (item 1.5 — GRO/PGR) e da NR-17 (ergonomia organizacional).

Sua tarefa: redigir a CONCLUSÃO TÉCNICA do setor em TEXTO CORRIDO (parágrafos), com base na Classificação de Risco Psicossocial — Fatores de Risco identificados, suas Fontes Geradoras, Gravidade, Probabilidade e respectiva Matriz de Risco.

Responda APENAS com JSON válido (sem markdown, sem cercas \`\`\`, sem texto fora do JSON):
{
  "conclusao": "Texto corrido em parágrafos (HTML simples com <p>), SEM tabelas e SEM listas com bullets."
}

A conclusão deve, de forma fluida e articulada (NÃO em tabela, NÃO em tópicos):
- Abrir com um panorama do risco psicossocial do setor, destacando os fatores de maior criticidade primeiro (Crítico > Alto > Médio > Baixo) e citando a respectiva matriz.
- Para os fatores relevantes, relacionar os POSSÍVEIS AGRAVOS à saúde mental como riscos potenciais (ex.: ansiedade, estresse ocupacional, síndrome de burnout, depressão, distúrbios do sono, transtornos psicossomáticos, queda de desempenho cognitivo), proporcionais ao nível da matriz — sem diagnosticar pessoas.
- Indicar as MEDIDAS DE CONTROLE RECOMENDADAS que a empresa deve adotar, atacando diretamente as Fontes Geradoras descritas e seguindo a hierarquia de controle (eliminação > controles organizacionais > medidas administrativas/individuais), com mais ênfase/urgência nos fatores Crítico/Alto.
- Fechar com o encaminhamento técnico (necessidade ou suficiência de medidas adicionais), citando NR-01 e NR-17 quando pertinente.

Regras:
- 2 a 5 parágrafos, entre 140 e 360 palavras, em português do Brasil formal e técnico.
- Mencionar explicitamente o nome do setor.
- NÃO inventar fatores fora dos listados na classificação fornecida.
- NÃO usar tabelas, NÃO usar listas com bullets — somente parágrafos <p>.
- Se houver "textoAtual" não vazio, REFINE preservando o sentido — não contradiga.`;

function buildUserPrompt(ctx: ContextoIA): string {
  const linhas: string[] = ["Contexto do Diagnóstico de Riscos Psicossociais:", ""];

  linhas.push(`Empresa: ${ctx.empresa?.nome ?? "—"}`);
  if (ctx.empresa?.cnpj) linhas.push(`CNPJ: ${ctx.empresa.cnpj}`);
  if (ctx.responsavelTecnico)
    linhas.push(`Psicólogo(a) responsável: ${ctx.responsavelTecnico}${ctx.crp ? ` (CRP ${ctx.crp})` : ""}`);

  linhas.push("");
  linhas.push(
    ctx.ehConsolidado
      ? `Setor: ${ctx.setor.nome} (CONSOLIDADO — todos os setores)`
      : `Setor: ${ctx.setor.nome}`
  );
  if (ctx.setor.funcoes) linhas.push(`Funções: ${ctx.setor.funcoes}`);
  if (typeof ctx.setor.totalRespondentes === "number")
    linhas.push(`Respondentes considerados: ${ctx.setor.totalRespondentes}`);

  linhas.push("");
  linhas.push("Tópicos avaliados (gravidade × probabilidade → matriz):");
  for (const t of ctx.topicos) {
    const partes = [
      `- ${t.nome}`,
      t.gravidade ? `gravidade ${t.gravidade}` : null,
      t.probabilidade ? `probabilidade ${t.probabilidade}` : null,
      t.matriz ? `matriz ${t.matriz}` : null,
    ].filter(Boolean);
    linhas.push(partes.join(" · "));
    if (t.fonteGeradora) linhas.push(`    Fonte geradora: ${t.fonteGeradora}`);
  }

  const agravosTxt = asText(ctx.agravos);
  if (agravosTxt.trim().length > 0) {
    linhas.push("");
    linhas.push("Possíveis agravos à saúde mental (já apontados pelo psicólogo, use como apoio):");
    linhas.push(agravosTxt);
  }

  const medidasTxt = asText(ctx.medidasExistentes);
  if (medidasTxt.trim().length > 0) {
    linhas.push("");
    linhas.push("Medidas de controle já indicadas (use como apoio):");
    linhas.push(medidasTxt);
  }

  if (ctx.textoAtual && ctx.textoAtual.trim().length > 0) {
    linhas.push("");
    linhas.push("Texto já redigido pelo psicólogo (refine, não contradiga):");
    linhas.push(ctx.textoAtual);
  }

  linhas.push("");
  linhas.push(
    ctx.ehConsolidado
      ? "Gere a conclusão técnica consolidada (texto corrido) em JSON conforme o formato definido."
      : "Gere a conclusão técnica do setor (texto corrido, em parágrafos) em JSON conforme o formato definido."
  );
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
    const body = (await req.json()) as ContextoIA;

    if (!body?.setor?.nome || !Array.isArray(body?.topicos)) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: 'setor.nome' e 'topicos[]' são obrigatórios" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Conclusão por setor → tabela (Fator × Agravos × Medidas).
    // Conclusão geral (consolidada) → texto corrido em parágrafos.
    const systemPrompt = body.ehConsolidado ? SYSTEM_PROMPT : SYSTEM_PROMPT_SETOR;
    const maxTokens = 1200;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserPrompt(body) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: maxTokens,
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

    let parsed: { conclusao?: unknown };
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

    const conclusao =
      typeof parsed?.conclusao === "string" ? parsed.conclusao.trim() : "";

    if (!conclusao) {
      return new Response(
        JSON.stringify({
          error: "Modelo não retornou o campo 'conclusao'",
          raw: content.slice(0, 500),
        }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data: { conclusao } }), {
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
