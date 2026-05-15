// Edge Function — Análise de Agentes Químicos via Groq (Llama 3.1 8B-instant).
//
// Recebe texto extraído de FDS/FISPQ (modo PDF) ou campos manuais e devolve:
//   {
//     resultado: <texto completo da análise>,
//     conclusao: <objeto estruturado parseado do bloco CONCLUSAO_RAPIDA>
//   }
//
// MODELO: 8B-instant. Mesma quota das outras duas funções (gerar-acao-ia,
// gerar-conclusao-drps-ia), MAS a refatoração pra responder só CONCLUSAO_RAPIDA
// + truncagem agressiva do PDF (12k chars) + max_tokens 1000 deixou cada
// chamada em ~5.800 tokens, dentro do TPM 6.000 do 8B free.
//
// TPD do 8B: 500.000 (vs 100k do 70B) → comporta ~80 analises/dia.
//
// Trade-off: 8B tem qualidade técnica menor que 70B em raciocínio regulatório.
// O prompt anti-alucinação reforça "NÃO inventar códigos eSocial/Decreto/GFIP"
// — quando incerto, devolver "CONSULTAR_TABELA_OFICIAL". Revisão humana
// obrigatória antes de uso oficial (banner no UI).
//
// DEPLOY: supabase functions deploy analisar-quimico-ia

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

// Arquitetura otimizada: IA responde APENAS o bloco CONCLUSAO_RAPIDA
// (campos estruturados). O frontend monta o relatório/PDF a partir desses
// campos + dados do produto. Isso reduz drasticamente o consumo de tokens
// porque elimina a geração das 12 seções de prosa.
//
// Budget por chamada no 8B (TPM 6.000, TPD 500.000):
//   - system prompt: ~1.800 tokens
//   - user prompt (até PDF_MAX_CHARS chars): ~3.000 tokens
//   - max_tokens reservados pra resposta: 1.000
//   - Total: ~5.800 (margem ~200 abaixo do TPM 6.000)
//
// PDFs longos sao truncados em 12k chars (primeiras 3-4 paginas — geralmente
// cobrindo seções 1-4 da FISPQ: identificacao, GHS, composicao, perigos).
const PDF_MAX_CHARS = 12000;
const MAX_OUTPUT_TOKENS = 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CondicoesUso {
  atividade?: string | null;
  frequencia?: string | null;
  duracao?: string | null;
  ventilacao?: string | null;
  geracao_nevoa_vapor?: string | null;
  epis_utilizados?: string | null;
}

interface DadosManuais {
  nome_produto?: string | null;
  nome_quimico?: string | null;
  numero_cas?: string | null;
  formula_quimica?: string | null;
  forma_fisica?: string | null;
  concentracao?: string | null;
}

interface ContextoIA {
  modo: "PDF" | "Manual";
  texto_documento?: string | null; // texto extraído do PDF (modo PDF)
  dados_manuais?: DadosManuais | null; // modo Manual
  condicoes_uso?: CondicoesUso | null;
  empresa_nome?: string | null;
}

const SYSTEM_PROMPT = `Você é um Engenheiro de Segurança do Trabalho e Higienista Ocupacional especialista em Toxicologia Ocupacional, GHS (ABNT NBR 14725), NR-01, NR-06, NR-07, NR-09, NR-15 (Anexos 11, 12, 13 e 13-A), NR-16, ACGIH TLV/BEI, NIOSH REL/Pocket Guide, OSHA PEL, IARC Monographs, Fundacentro (NHO-01 a NHO-10), eSocial, GFIP e Previdência Social (Lei 8.213/91 e Decreto 3.048/99).

=== REGRA ANTI-ALUCINAÇÃO CRÍTICA ===
Você NÃO tem acesso a busca web. NUNCA invente códigos numéricos.
Se não tiver ABSOLUTA certeza:
  - eSocial Tab.24 → "Consultar tabela oficial"
  - Decreto 3.048 Anexo IV → "Consultar decreto vigente"
  - GFIP → "Consultar tabela GFIP"
  - Classificação IARC → só citar se tiver certeza
  - Limites NR-15 numéricos → só citar se for da NR-15 confirmada
MELHOR responder "Inconclusivo" do que inventar. Códigos inventados
geram risco previdenciário/trabalhista real.

=== REGRAS TÉCNICAS ===
- TLV/REL/PEL = apenas referência técnica.
- NR-15 Anexo 13 NÃO possui limites numéricos (avaliação qualitativa).
- Não confundir insalubridade com aposentadoria especial.
- GHS não implica automaticamente NR-16.
- Substância fora da NR-15 → avaliar por analogia.
- Considerar FORMA FÍSICA e CONDIÇÕES DE EXPOSIÇÃO.
- Carcinogenicidade: IARC (1, 2A, 2B), ACGIH (A1-A5), NR-15 Anexo 13-A.

=== FORMATO DE RESPOSTA ===
Responda APENAS um objeto JSON válido com EXATAMENTE estas chaves
(em minúsculas e snake_case). Sem markdown, sem texto fora do JSON.
Cada valor é uma string em frase completa (não use null, use a string "N/A"
quando não se aplicar).

{
  "insalubridade_nr15": "SIM | NÃO | Inconclusivo",
  "insalubridade_grau": "Mínimo | Médio | Máximo | N/A",
  "insalubridade_anexo": "Ex: Anexo 13 - Agentes Químicos | N/A",
  "insalubridade_fundamentacao": "2-4 frases técnicas justificando o enquadramento ou a não-aplicabilidade",
  "aposentadoria_especial": "SIM | NÃO | Inconclusivo",
  "aposentadoria_tempo": "15 anos | 20 anos | 25 anos | N/A",
  "decreto_3048": "SIM/NÃO/Inconclusivo - breve descrição (use 'Consultar decreto vigente' se incerto)",
  "codigo_gfip": "código numérico SOMENTE se 100% certo, senão 'Consultar tabela GFIP' ou 'N/A'",
  "esocial_tab24": "SIM/NÃO/Inconclusivo - breve descrição (use 'Consultar tabela oficial' se incerto)",
  "oleo_mineral": "N/A | Refinado | Super-refinado | Não refinado - breve justificativa",
  "carcinogenico": "SIM/NÃO/Inconclusivo - classificação IARC/ACGIH se houver certeza",
  "periculosidade_nr16": "SIM/NÃO/Inconclusivo - breve justificativa (inflamável, explosivo, etc.)",
  "epi_necessarios": "Lista separada por ponto-e-vírgula. Sem nº de CA se não tiver certeza.",
  "epc_necessarios": "Lista separada por ponto-e-vírgula | N/A",
  "medidas_controle": "Medidas administrativas e de engenharia, separadas por ponto-e-vírgula",
  "emergencia_acidente": "Procedimentos de derramamento/vazamento + primeiros socorros",
  "medicao_necessaria": "SIM/NÃO - breve justificativa",
  "metodologia": "Método NIOSH/OSHA/Fundacentro/NHO específico | Inconclusivo",
  "como_medir": "Procedimento resumido e equipamento necessário | Inconclusivo",
  "limite_exposicao": "Valor com unidade e fonte (ex: '50 ppm - ACGIH TLV-TWA') | Inconclusivo",
  "resumo_tecnico": "3-5 frases que resumem todo o parecer para inclusão no PPP/LTCAT"
}

Seja técnico, preciso e CONSERVADOR. Quando não souber, "Inconclusivo".`;

function buildUserPrompt(ctx: ContextoIA): string {
  const linhas: string[] = ["Faça a análise de agente químico do material abaixo:", ""];

  if (ctx.empresa_nome) linhas.push(`Empresa: ${ctx.empresa_nome}`);

  if (ctx.modo === "PDF" && ctx.texto_documento) {
    linhas.push("");
    linhas.push("=== TEXTO EXTRAÍDO DA FDS/FISPQ ===");
    // Limita texto pra caber em TPM do 70B free tier (12k tokens/min).
    // FISPQs grandes (>30k chars) são truncadas — IA recebe o início que
    // tipicamente cobre seções 1-9 (identificação, hazards, composição,
    // primeiros socorros, controles de exposição, propriedades).
    const texto = ctx.texto_documento.slice(0, PDF_MAX_CHARS);
    linhas.push(texto);
    if (ctx.texto_documento.length > PDF_MAX_CHARS) {
      linhas.push("");
      linhas.push(
        `[NOTA: Documento truncado em ${PDF_MAX_CHARS} caracteres (de ${ctx.texto_documento.length}). Analise com base no que foi enviado e indique se faltar informação crítica.]`
      );
    }
    linhas.push("=== FIM DO DOCUMENTO ===");
  } else if (ctx.modo === "Manual" && ctx.dados_manuais) {
    linhas.push("");
    linhas.push("=== DADOS INFORMADOS MANUALMENTE ===");
    const d = ctx.dados_manuais;
    if (d.nome_produto) linhas.push(`Nome do Produto: ${d.nome_produto}`);
    if (d.nome_quimico) linhas.push(`Nome Químico: ${d.nome_quimico}`);
    if (d.numero_cas) linhas.push(`Número CAS: ${d.numero_cas}`);
    if (d.formula_quimica) linhas.push(`Fórmula Química: ${d.formula_quimica}`);
    if (d.forma_fisica) linhas.push(`Forma Física: ${d.forma_fisica}`);
    if (d.concentracao) linhas.push(`Concentração: ${d.concentracao}`);
    linhas.push("=== FIM DOS DADOS ===");
  }

  if (ctx.condicoes_uso) {
    const c = ctx.condicoes_uso;
    const temAlgo = !!(c.atividade || c.frequencia || c.duracao || c.ventilacao || c.geracao_nevoa_vapor || c.epis_utilizados);
    if (temAlgo) {
      linhas.push("");
      linhas.push("=== CONDIÇÕES DE USO ===");
      if (c.atividade) linhas.push(`Atividade/Processo: ${c.atividade}`);
      if (c.frequencia) linhas.push(`Frequência de exposição: ${c.frequencia}`);
      if (c.duracao) linhas.push(`Duração por turno: ${c.duracao}`);
      if (c.ventilacao) linhas.push(`Tipo de ventilação: ${c.ventilacao}`);
      if (c.geracao_nevoa_vapor) linhas.push(`Geração de névoa/vapor: ${c.geracao_nevoa_vapor}`);
      if (c.epis_utilizados) linhas.push(`EPIs já utilizados: ${c.epis_utilizados}`);
      linhas.push("=== FIM ===");
    }
  }

  linhas.push("");
  linhas.push(
    "Responda APENAS um objeto JSON válido com as chaves especificadas. Sem markdown, sem texto fora do JSON. Seja CONSERVADOR — códigos regulatórios incertos devem ser 'Consultar tabela oficial' ou 'Inconclusivo'."
  );
  return linhas.join("\n");
}

interface ConclusaoRapidaParsed {
  insalubridade_nr15?: string;
  insalubridade_grau?: string;
  insalubridade_anexo?: string;
  insalubridade_fundamentacao?: string;
  aposentadoria_especial?: string;
  aposentadoria_tempo?: string;
  decreto_3048?: string;
  codigo_gfip?: string;
  esocial_tab24?: string;
  oleo_mineral?: string;
  carcinogenico?: string;
  periculosidade_nr16?: string;
  epi_necessarios?: string;
  epc_necessarios?: string;
  medidas_controle?: string;
  emergencia_acidente?: string;
  medicao_necessaria?: string;
  metodologia?: string;
  como_medir?: string;
  limite_exposicao?: string;
  resumo_tecnico?: string;
}

/**
 * Parseia a resposta da IA (que agora vem em JSON puro graças ao
 * response_format: { type: 'json_object' }). Tolerante a chaves UPPERCASE
 * ou snake_case minúsculo — caso algum modelo devolva uma variação.
 */
function parseConclusaoRapida(text: string): ConclusaoRapidaParsed | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    // Fallback: tenta extrair um bloco JSON dentro de markdown ```json...```
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!m) return null;
    try {
      raw = JSON.parse(m[1].trim());
    } catch {
      return null;
    }
  }

  const get = (k: string): string | undefined => {
    const v = raw[k] ?? raw[k.toUpperCase()] ?? raw[k.toLowerCase()];
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
  };

  return {
    insalubridade_nr15: get("insalubridade_nr15"),
    insalubridade_grau: get("insalubridade_grau"),
    insalubridade_anexo: get("insalubridade_anexo"),
    insalubridade_fundamentacao: get("insalubridade_fundamentacao"),
    aposentadoria_especial: get("aposentadoria_especial"),
    aposentadoria_tempo: get("aposentadoria_tempo"),
    decreto_3048: get("decreto_3048"),
    codigo_gfip: get("codigo_gfip"),
    esocial_tab24: get("esocial_tab24"),
    oleo_mineral: get("oleo_mineral"),
    carcinogenico: get("carcinogenico"),
    periculosidade_nr16: get("periculosidade_nr16"),
    epi_necessarios: get("epi_necessarios"),
    epc_necessarios: get("epc_necessarios"),
    medidas_controle: get("medidas_controle"),
    emergencia_acidente: get("emergencia_acidente"),
    medicao_necessaria: get("medicao_necessaria"),
    metodologia: get("metodologia"),
    como_medir: get("como_medir"),
    limite_exposicao: get("limite_exposicao"),
    resumo_tecnico: get("resumo_tecnico"),
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
    const body = (await req.json()) as ContextoIA;

    if (!body?.modo || (body.modo !== "PDF" && body.modo !== "Manual")) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: 'modo' deve ser 'PDF' ou 'Manual'" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (body.modo === "PDF" && !body.texto_documento?.trim()) {
      return new Response(
        JSON.stringify({ error: "Modo PDF requer 'texto_documento' não vazio" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (body.modo === "Manual" && (!body.dados_manuais?.nome_produto && !body.dados_manuais?.nome_quimico)) {
      return new Response(
        JSON.stringify({ error: "Modo Manual requer pelo menos 'nome_produto' ou 'nome_quimico'" }),
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
        // JSON mode: força o modelo a devolver JSON válido. Indispensável
        // pro 8B-instant — sem isso, ele invariavelmente quebra o formato
        // estruturado. Mesmo padrão usado nas outras 2 funções de IA.
        response_format: { type: "json_object" },
        // Baixa temperatura pra reduzir invenção de códigos
        temperature: 0.2,
        max_tokens: MAX_OUTPUT_TOKENS,
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

    const conclusao = parseConclusaoRapida(content);

    return new Response(
      JSON.stringify({
        data: {
          resultado: content,
          conclusao: conclusao,
        },
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
