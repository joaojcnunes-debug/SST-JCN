// Edge Function — Análise de Agentes Químicos via Groq (Llama 3.1 8B-instant).
//
// ARQUITETURA (Opção A — parser local + IA só pro raciocínio):
//   1. Front extrai texto do PDF via pdfjs-dist
//   2. Front parseia FISPQ via lib/fispq/parser.ts (regex local — sem IA):
//      - nome_produto, nome_quimico, CAS, fórmula, forma física, concentração
//      - frases H, pictogramas GHS
//      - snippets de seções 2/8/11 (perigos, exposição, toxicologia)
//   3. Usuário REVISA o que foi extraído (corrige erros do parser)
//   4. Esta Edge Function recebe dados_manuais + contexto_fispq compacto
//   5. IA responde JSON estruturado com 21 campos de conclusão
//
// Por que não mandamos o PDF inteiro pra IA?
//   - PDFs de FISPQ têm 15-50k chars (4-12k tokens)
//   - O 8B free tem TPM 6.000 — não cabe
//   - O parser local extrai só o que importa pra NR-15 → ~600 tokens
//   - Usuário tem chance de corrigir antes de mandar → reduz alucinação
//
// MODELO: 8B-instant. JSON mode (response_format) força resposta válida.
// Anti-alucinação no prompt: códigos eSocial/Decreto/GFIP incertos viram
// "Consultar tabela oficial" em vez de inventar.
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
// Budget no 8B free tier (TPM 6.000, TPD 500.000):
//   - system prompt: ~2.000 tokens (JSON schema completo)
//   - user prompt (dados_manuais + contexto_fispq compacto): ~600-1.500 tokens
//   - max_tokens reservados pra resposta: 800
//   - Total típico: ~3.500-4.500 tokens (folga MUITO confortável)
//
// O `contexto_fispq` é gerado client-side pelo parser FISPQ (lib/fispq/parser.ts)
// e contém só os snippets das seções 2/8/11 + frases H/GHS — tipicamente
// 1.500-2.000 chars (~400-600 tokens). MUITO mais leve que mandar o PDF
// inteiro pra IA.
const PDF_MAX_CHARS = 8000;
const MAX_OUTPUT_TOKENS = 800;

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

interface ComponenteQuimico {
  nome_quimico?: string | null;
  numero_cas?: string | null;
  formula_quimica?: string | null;
  concentracao?: string | null;
}

interface DadosBase {
  agente?: string | null;
  cas?: string | null;
  lt_mg_m3?: number | null;
  lt_ppm?: number | null;
  grau_nr15?: string | null;
  teto?: boolean | null;
  pele?: boolean | null;
  esocial_tab24?: string | null;
  iarc?: string | null;
  inflamavel?: boolean | null;
  cancerigeno_13a?: boolean | null;
  tlv_acgih?: string | null;
  decreto_3048?: string | null;
  cod_gfip?: string | null;
  anexo?: string | null;
  observacoes?: string | null;
}

interface ContextoIA {
  modo: "PDF" | "Manual";
  /** Dados do produto: vem sempre preenchido (no modo PDF, vem do parser FISPQ
   *  revisado pelo usuário; no modo Manual, vem do form direto). */
  dados_manuais?: DadosManuais | null;
  /** Snippets compactos da FISPQ (seções 2/8/11 + frases H/GHS).
   *  Só populado no modo PDF, depois que o parser extraiu. Tem ~1-2k tokens
   *  em vez dos 4-6k que o PDF inteiro consumiria. */
  contexto_fispq?: string | null;
  /** Dados regulatórios DETERMINÍSTICOS da base local de referência
   *  (lib/quimicos/base_referencia.ts). Quando presente, a IA usa esses
   *  valores como "ground truth" pros campos correspondentes e NÃO inventa. */
  dados_base?: DadosBase | null;
  /** Lista de componentes químicos (modo Manual com mistura). Quando
   *  presente, cada componente é mostrado à IA pra ela considerar todos
   *  no parecer técnico. */
  componentes?: ComponenteQuimico[] | null;
  /** [LEGADO] texto bruto extraído do PDF — não é mais usado pela IA, mas
   *  ainda aceito por compatibilidade. */
  texto_documento?: string | null;
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
  const linhas: string[] = [
    "Faça a análise de agente químico abaixo. Os dados do produto foram extraídos da FISPQ e revisados pelo usuário — confie neles.",
    "",
  ];

  if (ctx.empresa_nome) linhas.push(`Empresa: ${ctx.empresa_nome}`);

  // Dados da BASE DETERMINÍSTICA — ground truth dos campos regulatórios.
  // Se isso veio populado, a IA é instruída a NÃO contradizer.
  if (ctx.dados_base) {
    const d = ctx.dados_base;
    linhas.push("");
    linhas.push(
      "=== DADOS REGULATÓRIOS OFICIAIS (BASE INTERNA — USE COMO VERDADE ABSOLUTA, NÃO CONTRADIGA) ==="
    );
    if (d.agente) linhas.push(`Agente catalogado: ${d.agente}`);
    if (d.cas) linhas.push(`CAS: ${d.cas}`);
    if (d.anexo) linhas.push(`Anexo NR-15: ${d.anexo}`);
    if (d.grau_nr15) linhas.push(`Grau de Insalubridade (NR-15): ${d.grau_nr15}`);
    if (d.lt_mg_m3 != null) linhas.push(`Limite de Tolerância: ${d.lt_mg_m3} mg/m³`);
    if (d.lt_ppm != null) linhas.push(`Limite de Tolerância: ${d.lt_ppm} ppm`);
    if (d.teto === true) linhas.push(`Valor TETO: SIM (não pode ser ultrapassado)`);
    if (d.pele === true) linhas.push(`Absorvido pela pele: SIM`);
    if (d.esocial_tab24) linhas.push(`Código eSocial Tab.24: ${d.esocial_tab24}`);
    if (d.iarc) linhas.push(`Classificação IARC: ${d.iarc}`);
    if (d.inflamavel != null) linhas.push(`Inflamável: ${d.inflamavel ? "SIM" : "NÃO"}`);
    if (d.cancerigeno_13a === true)
      linhas.push(`Cancerígeno (NR-15 Anexo 13-A): SIM`);
    if (d.tlv_acgih) linhas.push(`TLV-ACGIH: ${d.tlv_acgih}`);
    if (d.decreto_3048) linhas.push(`Decreto 3.048 (Anexo IV): ${d.decreto_3048}`);
    if (d.cod_gfip) linhas.push(`Código GFIP: ${d.cod_gfip}`);
    if (d.observacoes) linhas.push(`Observações: ${d.observacoes}`);
    linhas.push("=== FIM (dados regulatórios oficiais) ===");
    linhas.push("");
    linhas.push(
      "REGRA OBRIGATÓRIA: USE EXATAMENTE os valores acima nos campos correspondentes do JSON. Você ainda deve PREENCHER os campos que faltam (EPI, EPC, medidas, emergência, fundamentação, metodologia) com base no que sabe do agente — mas NUNCA contradiga os dados oficiais acima."
    );
  }

  // Dados do produto (sempre presente — vem do parser FISPQ revisado OU do
  // form manual).
  if (ctx.dados_manuais) {
    linhas.push("");
    linhas.push("=== DADOS DO PRODUTO (revisados) ===");
    const d = ctx.dados_manuais;
    if (d.nome_produto) linhas.push(`Nome do Produto: ${d.nome_produto}`);
    if (d.nome_quimico) linhas.push(`Nome Químico: ${d.nome_quimico}`);
    if (d.numero_cas) linhas.push(`Número CAS: ${d.numero_cas}`);
    if (d.formula_quimica) linhas.push(`Fórmula Química: ${d.formula_quimica}`);
    if (d.forma_fisica) linhas.push(`Forma Física: ${d.forma_fisica}`);
    if (d.concentracao) linhas.push(`Concentração: ${d.concentracao}`);
    linhas.push("=== FIM ===");
  }

  // Componentes da mistura (modo Manual com 2+ químicos). Lista cada
  // componente individualmente pra IA considerar todos no parecer.
  if (ctx.componentes && ctx.componentes.length > 1) {
    linhas.push("");
    linhas.push(
      `=== MISTURA — ${ctx.componentes.length} COMPONENTES QUÍMICOS ===`
    );
    linhas.push(
      "O produto é uma mistura. Analise considerando o conjunto e destaque o pior caso (componente de maior risco)."
    );
    ctx.componentes.forEach((c, i) => {
      const partes: string[] = [];
      if (c.nome_quimico) partes.push(`nome: ${c.nome_quimico}`);
      if (c.numero_cas) partes.push(`CAS: ${c.numero_cas}`);
      if (c.formula_quimica) partes.push(`fórmula: ${c.formula_quimica}`);
      if (c.concentracao) partes.push(`concentração: ${c.concentracao}`);
      linhas.push(`Componente ${i + 1}: ${partes.join(" · ")}`);
    });
    linhas.push("=== FIM (mistura) ===");
  }

  // Contexto FISPQ compacto (só presente no modo PDF). Contém:
  // - Frases H, pictogramas GHS, CAS de componentes adicionais
  // - Snippets curtos das seções 2 (perigos), 8 (exposição), 11 (toxicologia)
  // Tipicamente 1-2k tokens — muito menor que o PDF inteiro.
  if (ctx.contexto_fispq && ctx.contexto_fispq.trim().length > 0) {
    linhas.push("");
    linhas.push("=== CONTEXTO ADICIONAL EXTRAÍDO DA FISPQ ===");
    linhas.push(ctx.contexto_fispq.slice(0, PDF_MAX_CHARS));
    linhas.push("=== FIM ===");
  }

  if (ctx.condicoes_uso) {
    const c = ctx.condicoes_uso;
    const temAlgo = !!(
      c.atividade ||
      c.frequencia ||
      c.duracao ||
      c.ventilacao ||
      c.geracao_nevoa_vapor ||
      c.epis_utilizados
    );
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

    // Tanto PDF quanto Manual agora exigem dados_manuais preenchidos
    // (no modo PDF, vem do parser FISPQ revisado pelo usuário).
    if (
      !body.dados_manuais?.nome_produto?.trim() &&
      !body.dados_manuais?.nome_quimico?.trim()
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Dados do produto vazios. Informe pelo menos 'nome_produto' ou 'nome_quimico'.",
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

    // Camada de defesa: se a base local tem dados regulatórios, eles
    // SEMPRE prevalecem sobre o que a IA respondeu (zero alucinação nos
    // campos catalogados).
    if (conclusao && body.dados_base) {
      const d = body.dados_base;
      if (d.grau_nr15) {
        conclusao.insalubridade_nr15 =
          d.grau_nr15 === "Asfixiante simples" ? "Inconclusivo" : "SIM";
        conclusao.insalubridade_grau = d.grau_nr15;
      }
      if (d.anexo) conclusao.insalubridade_anexo = d.anexo;
      if (d.esocial_tab24) {
        conclusao.esocial_tab24 = `Código ${d.esocial_tab24}`;
      }
      if (d.decreto_3048) {
        conclusao.decreto_3048 = `Anexo IV código ${d.decreto_3048}`;
      }
      if (d.cod_gfip) conclusao.codigo_gfip = d.cod_gfip;
      if (d.iarc) {
        conclusao.carcinogenico = `SIM - IARC ${d.iarc}${
          d.cancerigeno_13a ? " (NR-15 Anexo 13-A)" : ""
        }`;
      } else if (d.cancerigeno_13a) {
        conclusao.carcinogenico = "SIM - NR-15 Anexo 13-A";
      }
      if (d.inflamavel === true && !conclusao.periculosidade_nr16) {
        conclusao.periculosidade_nr16 = "SIM - inflamável (NR-16 Anexo 2)";
      }
      if (d.tlv_acgih) {
        const lt = d.lt_ppm != null
          ? `${d.lt_ppm} ppm`
          : d.lt_mg_m3 != null
          ? `${d.lt_mg_m3} mg/m³`
          : null;
        conclusao.limite_exposicao = lt
          ? `LT NR-15: ${lt} · ACGIH: ${d.tlv_acgih}`
          : `ACGIH: ${d.tlv_acgih}`;
      }
    }

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
