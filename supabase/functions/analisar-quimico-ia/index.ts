// Edge Function — Análise de Agentes Químicos via Groq (Llama 3.3 70B-versatile).
//
// Recebe texto extraído de FDS/FISPQ (modo PDF) ou campos manuais e devolve:
//   {
//     resultado: <texto completo da análise>,
//     conclusao: <objeto estruturado parseado do bloco CONCLUSAO_RAPIDA>
//   }
//
// IMPORTANTE — modelo escolhido por exceção:
// As outras duas funções de IA (gerar-acao-ia, gerar-conclusao-drps-ia) usam
// o 8B-instant. ESTA usa 70B porque o 8B free tem TPM 6k que não cabe um
// PDF de FISPQ inteiro + system prompt + resposta longa. O 70B tem 12k TPM
// (cabe) e melhor qualidade técnica pra raciocínio regulatório, em troca
// de um limite diário menor (~100k TPD = ~8 análises/dia).
//
// Modelo SEM web search → instrução rígida de NÃO inventar códigos
// regulatórios (eSocial Tab.24, Decreto 3.048 Anexo IV, GFIP, IARC).
// Quando incerto, devolver "CONSULTAR_TABELA_OFICIAL".
//
// DEPLOY: supabase functions deploy analisar-quimico-ia

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

// Arquitetura otimizada: IA responde APENAS o bloco CONCLUSAO_RAPIDA
// (campos estruturados). O frontend monta o relatório/PDF a partir desses
// campos + dados do produto. Isso reduz drasticamente o consumo de tokens
// porque elimina a geração das 12 seções de prosa.
//
// Budget conservador por chamada no 70B (TPM 12.000):
//   - system prompt: ~1.800 tokens
//   - user prompt (até PDF_MAX_CHARS chars): ~5.500 tokens
//   - max_tokens reservados pra resposta: 1.500
//   - Total: ~8.800 (margem de ~3.200 abaixo do limite)
const PDF_MAX_CHARS = 22000;
const MAX_OUTPUT_TOKENS = 1500;

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
Se não tiver ABSOLUTA certeza de um código:
  - eSocial Tab.24: responder "CONSULTAR_TABELA_OFICIAL"
  - Decreto 3.048 Anexo IV: responder "CONSULTAR_DECRETO_VIGENTE"
  - Código GFIP: responder "CONSULTAR_TABELA_GFIP"
  - Classificação IARC: só citar se tiver certeza (substâncias muito conhecidas)
  - Limites NR-15 numéricos: só citar se for da NR-15 confirmada
É MUITO MELHOR responder "INCONCLUSIVO" do que inventar. Códigos inventados
geram risco previdenciário/trabalhista real.

=== REGRAS TÉCNICAS ===
- TLV/REL/PEL = apenas referência técnica de higiene ocupacional.
- NR-15 Anexo 13 NÃO possui limites numéricos. Avaliação é QUALITATIVA.
- Não confundir insalubridade com aposentadoria especial.
- GHS não implica automaticamente NR-16.
- Se a substância não constar na NR-15, declarar e avaliar por analogia.
- Considerar FORMA FÍSICA do agente e CONDIÇÕES DE EXPOSIÇÃO.
- Cancerogenicidade: IARC (1, 2A, 2B), ACGIH (A1-A5), NR-15 Anexo 13-A —
  só citar classificação se tiver certeza.

=== FORMATO OBRIGATÓRIO DA RESPOSTA ===
Responda APENAS o bloco abaixo. NADA antes, NADA depois. Sem markdown,
sem explicações fora do bloco. Cada campo em UMA linha. Use o texto exato
dos rótulos. O frontend vai montar o relatório técnico a partir desses
campos — então CADA CAMPO deve ser auto-explicativo e detalhado o
suficiente, em frase completa (não use bullets dentro de campos).

---CONCLUSAO_RAPIDA---
INSALUBRIDADE_NR15: [SIM/NÃO/INCONCLUSIVO]
INSALUBRIDADE_GRAU: [Mínimo/Médio/Máximo/N/A]
INSALUBRIDADE_ANEXO: [Ex: Anexo 13 - Agentes Químicos / N/A]
INSALUBRIDADE_FUNDAMENTACAO: [2-4 frases técnicas justificando o enquadramento ou a não-aplicabilidade]
APOSENTADORIA_ESPECIAL: [SIM/NÃO/INCONCLUSIVO]
APOSENTADORIA_TEMPO: [15/20/25 anos ou N/A]
DECRETO_3048: [SIM/NÃO/INCONCLUSIVO] - [CONSULTAR_DECRETO_VIGENTE ou breve descrição]
CODIGO_GFIP: [CONSULTAR_TABELA_GFIP ou N/A]
ESOCIAL_TAB24: [SIM/NÃO/INCONCLUSIVO] - [CONSULTAR_TABELA_OFICIAL ou breve descrição]
OLEO_MINERAL: [N/A ou Refinado/Super-refinado/Não refinado - breve justificativa]
CARCINOGENICO: [SIM/NÃO/INCONCLUSIVO] - [Classificação IARC/ACGIH se houver certeza]
PERICULOSIDADE_NR16: [SIM/NÃO/INCONCLUSIVO] - [breve justificativa: inflamável, explosivo, etc.]
EPI_NECESSARIOS: [Lista separada por ponto-e-vírgula. Sem nº de CA se não tiver certeza.]
EPC_NECESSARIOS: [Lista separada por ponto-e-vírgula, ou N/A]
MEDIDAS_CONTROLE: [Medidas administrativas e de engenharia, separadas por ponto-e-vírgula]
EMERGENCIA_ACIDENTE: [Procedimentos para derramamento/vazamento + primeiros socorros]
MEDICAO_NECESSARIA: [SIM/NÃO] - [breve justificativa]
METODOLOGIA: [Método NIOSH/OSHA/Fundacentro/NHO específico, ou INCONCLUSIVO]
COMO_MEDIR: [Procedimento resumido e equipamento necessário, ou INCONCLUSIVO]
LIMITE_EXPOSICAO: [Valor ACGIH/NIOSH/OSHA com unidade e fonte, ou INCONCLUSIVO]
RESUMO_TECNICO: [3-5 frases que resumem todo o parecer técnico para inclusão no PPP/LTCAT]
---FIM_CONCLUSAO---

Seja técnico, preciso e CONSERVADOR. Quando não souber, INCONCLUSIVO em
vez de inventar.`;

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
    "Responda APENAS o bloco CONCLUSAO_RAPIDA (nada antes, nada depois). Seja CONSERVADOR — códigos regulatórios incertos devem ser CONSULTAR_TABELA_OFICIAL/INCONCLUSIVO."
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

function parseConclusaoRapida(text: string): ConclusaoRapidaParsed | null {
  const m = text.match(/---CONCLUSAO_RAPIDA---([\s\S]*?)---FIM_CONCLUSAO---/);
  if (!m) return null;
  const block = m[1];
  const get = (key: string): string | undefined => {
    const r = block.match(new RegExp(`${key}:\\s*(.+)`));
    return r ? r[1].trim() : undefined;
  };
  return {
    insalubridade_nr15: get("INSALUBRIDADE_NR15"),
    insalubridade_grau: get("INSALUBRIDADE_GRAU"),
    insalubridade_anexo: get("INSALUBRIDADE_ANEXO"),
    insalubridade_fundamentacao: get("INSALUBRIDADE_FUNDAMENTACAO"),
    aposentadoria_especial: get("APOSENTADORIA_ESPECIAL"),
    aposentadoria_tempo: get("APOSENTADORIA_TEMPO"),
    decreto_3048: get("DECRETO_3048"),
    codigo_gfip: get("CODIGO_GFIP"),
    esocial_tab24: get("ESOCIAL_TAB24"),
    oleo_mineral: get("OLEO_MINERAL"),
    carcinogenico: get("CARCINOGENICO"),
    periculosidade_nr16: get("PERICULOSIDADE_NR16"),
    epi_necessarios: get("EPI_NECESSARIOS"),
    epc_necessarios: get("EPC_NECESSARIOS"),
    medidas_controle: get("MEDIDAS_CONTROLE"),
    emergencia_acidente: get("EMERGENCIA_ACIDENTE"),
    medicao_necessaria: get("MEDICAO_NECESSARIA"),
    metodologia: get("METODOLOGIA"),
    como_medir: get("COMO_MEDIR"),
    limite_exposicao: get("LIMITE_EXPOSICAO"),
    resumo_tecnico: get("RESUMO_TECNICO"),
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
