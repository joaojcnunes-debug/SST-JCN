// Edge Function — gera parecer técnico da Apreciação NR-12 via Groq.
// Lê o checklist preenchido (itens com situação + observação + recomendação),
// agrupa por status e devolve JSON com 3 campos pra preencher a Conclusão
// Técnica: conclusao_tecnica + recomendacoes_finais + risco_residual_sugerido.
//
// DEPLOY:
//   1. supabase secrets set GROQ_API_KEY=gsk_xxx  (provavelmente já existe)
//   2. supabase functions deploy gerar-parecer-apreciacao-ia
//
// Cliente: supabase.functions.invoke('gerar-parecer-apreciacao-ia', { body })

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

/** Trunca string longa preservando o início (relevante pro contexto). */
function trunc(s: string | null | undefined, max: number): string {
  if (!s) return "";
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

interface ItemCtx {
  codigo: string;
  categoria: string;
  titulo: string;
  situacao: "CONFORME" | "NAO_CONFORME" | "NAO_APLICAVEL" | "PENDENTE";
  observacao?: string | null;
  recomendacao?: string | null;
  livre?: boolean;
}

interface ContextoIA {
  empresa?: { nome?: string | null } | null;
  maquina?: { nome?: string | null; descricao?: string | null } | null;
  setor?: string | null;
  responsavel?: string | null;
  itens: ItemCtx[];
  /** Texto que o auditor já escreveu — refinar, não contradizer. */
  textoAtual?: string | null;
}

const SYSTEM_PROMPT = `Você é um(a) engenheiro(a) de segurança do trabalho brasileiro(a), especialista em NR-12 (Segurança no Trabalho em Máquinas e Equipamentos), com domínio das ISOs 12100 (princípios gerais de projeto), 13849 (segurança em sistemas de comando) e NBR NM 272 (distâncias de segurança).

Sua tarefa: redigir o PARECER TÉCNICO de uma Apreciação de Máquina NR-12, com base no checklist preenchido pelo auditor (cada item avaliado como CONFORME, NÃO CONFORME ou NÃO APLICÁVEL, com observações de campo e recomendações específicas).

Responda APENAS com um JSON válido (sem markdown, sem cercas \`\`\`, sem texto fora do JSON) no formato:

{
  "conclusao_tecnica": "Texto corrido em português brasileiro, 2 a 4 parágrafos. Diagnóstico geral da máquina, destacando categorias da NR-12 com maior número de não conformidades e o impacto pra segurança operacional. Citar ISO 12100 quando pertinente. Não usar listas com bullets — somente parágrafos.",
  "recomendacoes_finais": "Texto corrido OU lista numerada (use \\n\\n entre itens) com recomendações priorizadas. Foque nos NÃO CONFORME mais críticos. Inclua prazos sugeridos quando fizer sentido (imediato / 30 dias / 90 dias). Quando o item já tem recomendação do auditor, consolide e refine — não duplique.",
  "risco_residual_sugerido": "BAIXO | MEDIO | ALTO | CRITICO — escolha um valor único baseado na quantidade e gravidade das não conformidades. Sem não conformidades = BAIXO. Não conformidades em sistemas de segurança/proteções/parada de emergência = ALTO ou CRITICO."
}

Diretrizes:
- Português brasileiro formal técnico, redação na 3ª pessoa
- conclusao_tecnica: 100-250 palavras
- recomendacoes_finais: 80-200 palavras, priorizadas
- risco_residual_sugerido: EXATAMENTE um dos 4 valores (case sensitive maiúsculo)
- Mencionar máquina e empresa quando informados
- Destacar não conformidades em categorias críticas (SISTEMAS_SEGURANCA, DISPOSITIVOS, PRESSURIZADOS) antes das demais
- Não inventar dados (números de série, datas, normas específicas) que não estejam no contexto
- Itens NAO_APLICAVEL devem ser ignorados ou mencionados brevemente como "fora do escopo"
- Itens PENDENTE não devem aparecer (não foram avaliados)
- Se textoAtual está preenchido, REFINE preservando sentido — não contradiga`;

const CATEGORIA_LABELS: Record<string, string> = {
  INSTALACOES: "Instalações e áreas de trabalho",
  DISPOSITIVOS: "Dispositivos de partida, acionamento e parada",
  SISTEMAS_SEGURANCA: "Sistemas de segurança",
  PRESSURIZADOS: "Componentes pressurizados",
  TRANSPORTADORES: "Transportadores",
  ERGONOMIA: "Ergonomia",
  RISCOS_ADICIONAIS: "Riscos adicionais",
  MANUTENCAO: "Manutenção e LOTO",
  SINALIZACAO: "Sinalização",
  CAPACITACAO: "Capacitação",
  PROCEDIMENTOS: "Procedimentos de trabalho",
};

function buildUserPrompt(ctx: ContextoIA): string {
  const linhas: string[] = ["Contexto da Apreciação NR-12:", ""];

  if (ctx.empresa?.nome) linhas.push(`Empresa: ${ctx.empresa.nome}`);
  if (ctx.maquina?.nome) linhas.push(`Máquina: ${ctx.maquina.nome}`);
  if (ctx.maquina?.descricao && !ctx.maquina?.nome) {
    linhas.push(`Máquina: ${ctx.maquina.descricao}`);
  }
  if (ctx.setor) linhas.push(`Setor: ${ctx.setor}`);
  if (ctx.responsavel)
    linhas.push(`Responsável técnico: ${ctx.responsavel}`);

  // Resumo numérico
  const naoConforme = ctx.itens.filter((i) => i.situacao === "NAO_CONFORME");
  const conforme = ctx.itens.filter((i) => i.situacao === "CONFORME");
  const naoAplicavel = ctx.itens.filter((i) => i.situacao === "NAO_APLICAVEL");

  linhas.push("");
  linhas.push(
    `Total avaliado: ${ctx.itens.length} itens — ${conforme.length} conforme · ${naoConforme.length} não conforme · ${naoAplicavel.length} não aplicável.`
  );

  // Listar NAO_CONFORME agrupados por categoria (priorizado, com obs/rec)
  if (naoConforme.length > 0) {
    linhas.push("");
    linhas.push("=== NÃO CONFORMIDADES (priorizar no parecer) ===");
    const porCategoria = new Map<string, ItemCtx[]>();
    naoConforme.forEach((i) => {
      const arr = porCategoria.get(i.categoria) ?? [];
      arr.push(i);
      porCategoria.set(i.categoria, arr);
    });
    for (const [cat, items] of porCategoria) {
      linhas.push(`\n${CATEGORIA_LABELS[cat] ?? cat}:`);
      for (const it of items) {
        const prefixo = it.livre ? "[LIVRE]" : it.codigo;
        linhas.push(`- ${prefixo} ${it.titulo}`);
        const obs = trunc(it.observacao, 240);
        if (obs) linhas.push(`    Observação: ${obs}`);
        const rec = trunc(it.recomendacao, 240);
        if (rec) linhas.push(`    Recomendação do auditor: ${rec}`);
      }
    }
  }

  // CONFORME apenas listar contagem por categoria (não precisa detalhar)
  if (conforme.length > 0) {
    linhas.push("");
    linhas.push("=== CONFORMES (resumo) ===");
    const porCat = new Map<string, number>();
    conforme.forEach((i) => porCat.set(i.categoria, (porCat.get(i.categoria) ?? 0) + 1));
    for (const [cat, n] of porCat) {
      linhas.push(`- ${CATEGORIA_LABELS[cat] ?? cat}: ${n} item(ns)`);
    }
  }

  if (naoAplicavel.length > 0) {
    linhas.push("");
    linhas.push(`Itens marcados como NÃO APLICÁVEL: ${naoAplicavel.length}`);
  }

  if (ctx.textoAtual && ctx.textoAtual.trim().length > 0) {
    linhas.push("");
    linhas.push("Texto já redigido pelo auditor (refine, não contradiga):");
    linhas.push(trunc(ctx.textoAtual, 800));
  }

  linhas.push("");
  linhas.push("Gere o parecer técnico em JSON conforme o formato definido.");
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

    if (!Array.isArray(body?.itens) || body.itens.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Payload inválido: 'itens[]' obrigatório e não vazio",
        }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Filtra itens pendentes — não devem ir pra IA
    const itensAvaliados = body.itens.filter((i) => i.situacao !== "PENDENTE");
    if (itensAvaliados.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Nenhum item avaliado. Avalie ao menos 1 item antes de gerar o parecer.",
        }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const ctxFiltrado: ContextoIA = { ...body, itens: itensAvaliados };

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
          { role: "user", content: buildUserPrompt(ctxFiltrado) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 1100,
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

    let parsed: {
      conclusao_tecnica?: unknown;
      recomendacoes_finais?: unknown;
      risco_residual_sugerido?: unknown;
    };
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

    const conclusao_tecnica =
      typeof parsed?.conclusao_tecnica === "string"
        ? parsed.conclusao_tecnica.trim()
        : "";
    const recomendacoes_finais =
      typeof parsed?.recomendacoes_finais === "string"
        ? parsed.recomendacoes_finais.trim()
        : "";
    const riscoRaw =
      typeof parsed?.risco_residual_sugerido === "string"
        ? parsed.risco_residual_sugerido.trim().toUpperCase()
        : "";
    const riscosValidos = ["BAIXO", "MEDIO", "ALTO", "CRITICO"];
    const risco_residual_sugerido = riscosValidos.includes(riscoRaw)
      ? (riscoRaw as "BAIXO" | "MEDIO" | "ALTO" | "CRITICO")
      : null;

    if (!conclusao_tecnica) {
      return new Response(
        JSON.stringify({
          error: "Modelo não retornou 'conclusao_tecnica'",
          raw: content.slice(0, 500),
        }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        data: {
          conclusao_tecnica,
          recomendacoes_finais,
          risco_residual_sugerido,
        },
      }),
      {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
