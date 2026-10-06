// Edge Function — gera Parecer Técnico Preliminar ou Recomendações
// para um setor da AEP, via Groq.
//
// DEPLOY:
//   supabase functions deploy gerar-parecer-aep-ia
//
// Cliente: supabase.functions.invoke('gerar-parecer-aep-ia', { body })

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Em ordem de preferência. O Groq retira modelos do ar sem aviso (o
// llama-3.1-8b-instant sumiu em 2026-10 e a função passou a dar 502): se um
// modelo não existir mais, tenta o próximo.
const MODELOS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "moonshotai/kimi-k2-instruct",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CampoAep = "parecer_tecnico" | "recomendacoes";

interface ContextoAepIA {
  campo: CampoAep;
  empresa_nome?: string | null;
  setor_nome: string;
  cargos?: { cargo: string; descricao: string }[];
  jornada?: string | null;
  qtd_expostos?: number | null;
  checklist_fisica?: Record<string, string>;
  checklist_cognitiva?: Record<string, string>;
  checklist_organizacional?: Record<string, string>;
  observacoes?: Record<string, string>;
  textoAtual?: string | null;
  /** Fatores organizacionais na matriz AIHA (2026-10-05). */
  fatores_organizacionais?: {
    fator: string;
    nivel: string | null;
    probabilidade?: string | null;
    severidade?: string | null;
    sinais?: string[];
  }[];
  /** O setor tem indicação de AET completa (critério do sistema). */
  necessita_aet?: boolean;
  /** Fatores N/I com o motivo — "Limitações da avaliação" (2026-10-06). */
  limitacoes?: string[];
  /** Frase das condições da coleta (abordados, recusas, liderança, inibição). */
  condicoes_coleta?: string | null;
  /** N/I por receio de manifestação ou sinais de inibição na coleta. */
  receio_manifestacao?: boolean;
}

const TITULO: Record<CampoAep, string> = {
  parecer_tecnico: "Parecer Técnico Preliminar",
  recomendacoes: "Recomendações Ergonômicas",
};

const SYSTEM_PROMPT = `Você é um(a) ergonomista / técnico(a) de segurança do trabalho brasileiro(a), especialista em Análise Ergonômica Preliminar (AEP), NR-01 GRO/PGR e NR-17.

Sua tarefa: redigir texto técnico para o laudo AEP de um setor específico, com base no checklist ergonômico, nos fatores organizacionais classificados na matriz de risco AIHA e nas observações fornecidas.

Responda APENAS com JSON válido (sem markdown, sem cercas, sem texto fora do JSON):
{ "texto": "Texto em português brasileiro, tom técnico, 3ª pessoa, sem bullets — apenas parágrafos corridos." }

PREMISSAS DA AEP — o texto deve refletir estas premissas (definidas pelo Responsável Técnico):
1. A AEP constitui uma triagem preliminar, voltada à identificação e priorização de fatores e setores que demandam maior atenção. Seu resultado não substitui a AET e deve ser compreendido a partir das condições observadas no ambiente de trabalho.
2. O DRPS/Questionário Psicossocial possui caráter complementar, contribuindo para ampliar a compreensão dos riscos psicossociais a partir de uma perspectiva mais personalizada, considerando como os próprios trabalhadores percebem e vivenciam suas condições de trabalho.
3. Os resultados da AEP dependem da qualidade das observações registradas e devem ser revistos sempre que houver mudanças nas condições de trabalho, conforme previsto na NR-01 e na revisão do inventário de riscos.

Como aplicar as premissas:
- Trate os achados como resultado de TRIAGEM: use "identificou-se", "foram observados indícios", "indica a necessidade de aprofundamento"; nunca apresente a AEP como diagnóstico conclusivo nem como substituta da AET.
- Fatores organizacionais: cite o nível na matriz AIHA (Trivial, Baixo, Moderado, Alto, Muito Alto) e os sinais observados que o sustentam; priorize os de nível mais alto.
- Quando o setor tiver indicação de AET ("Necessita AET: sim"), registre que a análise ergonômica do trabalho (AET, NR-17 item 17.3.2) é o aprofundamento indicado; sem indicação, não recomende AET.
- Quando houver fatores organizacionais relevantes (3 ou mais alertas organizacionais, ou algum fator Alto/Muito Alto), apresente o DRPS/Questionário Psicossocial como instrumento COMPLEMENTAR, que agrega a percepção dos próprios trabalhadores — não como substituto da AEP nem da AET.
- Limitações da avaliação: fatores marcados N/I (não identificáveis) NÃO são achados — não os trate como presentes nem como ausentes. Quando houver, registre a limitação em uma frase, citando o motivo informado.
- Quando houver receio dos trabalhadores em se manifestar (N/I por esse motivo ou sinais de inibição na coleta), registre que a participação foi limitada e indique o DRPS/Questionário Psicossocial, que permite resposta sem exposição, como complemento — mesmo com menos de 3 alertas organizacionais.
- Lembre que a conclusão depende das observações registradas e deve ser revista se as condições de trabalho mudarem (NR-01, inventário de riscos) — uma frase curta, sem repetir as premissas por extenso.

Comprimento esperado:
- parecer_tecnico: 2 a 3 parágrafos (140–240 palavras). Descreva os fatores identificados (itens Sim), as categorias ergonômicas afetadas, os níveis AIHA dos fatores organizacionais, a prioridade do setor e as condições observadas; encerre com o encaminhamento (AET e/ou DRPS/Questionário quando cabíveis) e a ressalva de triagem/revisão. NÃO liste ações corretivas nem prazos (imediatas/preventivas/estruturais) no parecer — isso fica só nas Recomendações.
- recomendacoes: 1 a 2 parágrafos com ações práticas priorizadas (90–180 palavras). Classifique como imediatas (<30 dias), preventivas (30–90 dias) ou estruturais (>90 dias) quando pertinente. Não repita o diagnóstico do parecer; vá direto às ações. Inclua, quando cabíveis, a realização da AET para o setor, a aplicação do DRPS/Questionário Psicossocial como complemento e a revisão da AEP quando houver mudança nas condições de trabalho.

Diretrizes:
- Citar setor, cargos e jornada quando relevante
- Basear-se apenas nos itens marcados como Sim, nos níveis AIHA e nas observações fornecidas — não inventar dados, medições ou números
- Referenciar NR-17, NR-01 e normas pertinentes
- Sem bullets, apenas parágrafos corridos`;

function buildPrompt(ctx: ContextoAepIA): string {
  const l: string[] = [];
  if (ctx.empresa_nome) l.push(`Empresa: ${ctx.empresa_nome}`);
  l.push(`Setor: ${ctx.setor_nome}`);
  if (ctx.cargos?.length) {
    const lista = ctx.cargos
      .map((c) => (c.descricao ? `${c.cargo} (${c.descricao})` : c.cargo))
      .filter(Boolean);
    if (lista.length) l.push(`Cargos: ${lista.join("; ")}`);
  }
  if (ctx.jornada) l.push(`Jornada: ${ctx.jornada}`);
  if (ctx.qtd_expostos) l.push(`Trabalhadores expostos: ${ctx.qtd_expostos}`);

  const addChecklist = (nome: string, cl?: Record<string, string>) => {
    if (!cl) return;
    const sims = Object.entries(cl)
      .filter(([, v]) => v === "sim")
      .map(([k]) => k.replace(/_/g, " "));
    if (sims.length) l.push(`${nome} — alertas: ${sims.join(", ")}`);
  };
  addChecklist("Ergonomia Física", ctx.checklist_fisica);
  addChecklist("Ergonomia Cognitiva", ctx.checklist_cognitiva);
  addChecklist("Ergonomia Organizacional", ctx.checklist_organizacional);

  // Fatores organizacionais na matriz AIHA, do mais grave para o menos.
  const PESO: Record<string, number> = { "Muito Alto": 5, Alto: 4, Moderado: 3, Baixo: 2, Trivial: 1 };
  const fatores = [...(ctx.fatores_organizacionais ?? [])].sort((a, b) => (PESO[b.nivel ?? ""] ?? 0) - (PESO[a.nivel ?? ""] ?? 0));
  if (fatores.length) {
    l.push("Fatores organizacionais na matriz AIHA:");
    for (const f of fatores) {
      const pxs = [f.probabilidade, f.severidade].filter(Boolean).join(" × ");
      const sinais = (f.sinais ?? []).filter(Boolean);
      l.push(
        `  - ${f.fator}: ${f.nivel ?? "sem nível"}${pxs ? ` (${pxs})` : ""}${sinais.length ? ` — sinais: ${sinais.join("; ")}` : " — nenhum sinal observado marcado"}`,
      );
    }
  }
  if (ctx.condicoes_coleta) l.push(`Condições da coleta: ${ctx.condicoes_coleta}`);
  if (ctx.limitacoes?.length) {
    l.push(`Limitações da avaliação (fatores N/I):\n${ctx.limitacoes.map((x) => `  - ${x}`).join("\n")}`);
  }
  if (ctx.receio_manifestacao) l.push("Receio dos trabalhadores em se manifestar: sim");
  if (typeof ctx.necessita_aet === "boolean") {
    l.push(`Necessita AET (critério do sistema): ${ctx.necessita_aet ? "sim" : "não"}`);
  }

  if (ctx.observacoes) {
    const obs = Object.entries(ctx.observacoes)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
    if (obs.length) l.push(`Observações de campo:\n${obs.map((o) => `  - ${o}`).join("\n")}`);
  }

  l.push(`\nCampo a redigir: ${TITULO[ctx.campo]}`);
  if (ctx.textoAtual?.trim()) l.push(`\nTexto já redigido (refine se necessário):\n${ctx.textoAtual}`);
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
    const body = (await req.json()) as ContextoAepIA;
    if (!body?.setor_nome || !body?.campo) {
      return new Response(
        JSON.stringify({ error: "setor_nome e campo são obrigatórios" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let groqRes: Response | null = null;
    const falhas: string[] = [];
    for (const model of MODELOS) {
      groqRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(body) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.55,
          max_tokens: 2000,
        }),
      });
      if (groqRes.ok) break;
      // Modelo retirado, sem acesso ou JSON malformado: tenta o próximo.
      falhas.push(`${model}: ${groqRes.status} ${(await groqRes.text()).slice(0, 200)}`);
      if (groqRes.status === 401) break;
    }

    if (!groqRes || !groqRes.ok) {
      return new Response(
        JSON.stringify({ error: `Groq falhou em todos os modelos — ${falhas.join(" | ")}` }),
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
    try { parsed = JSON.parse(content); } catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido do modelo", raw: content.slice(0, 400) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

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
