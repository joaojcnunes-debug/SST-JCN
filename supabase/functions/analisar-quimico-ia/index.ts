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
// 700 tokens é suficiente com resumo_tecnico de 4-6 frases (não 8-14
// como antes) e fundamentações concisas. Economiza ~30% de output sem
// cortar campos. Total típico por call: ~2.5-3.5k tokens (vs 3.5-4.5k
// na versão anterior).
const MAX_OUTPUT_TOKENS = 700;

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
  /** Agente "representativo" — pior caso agregado da mistura. A IA usa
   *  esses valores como "ground truth" pros campos correspondentes e NÃO
   *  inventa. (Para 1 componente, é igual ao componente em si.) */
  dados_base?: DadosBase | null;
  /** Lista de TODOS os componentes catalogados na base de referência
   *  (com seus dados regulatórios). A IA recebe cada um pra fundamentar
   *  o parecer citando componente por componente. */
  dados_base_componentes?: DadosBase[] | null;
  /** Lista de componentes químicos submetidos (toda a mistura — catalogados
   *  ou não). Mostra a IA todos pra ela considerar no parecer técnico. */
  componentes?: ComponenteQuimico[] | null;
  /** [LEGADO] texto bruto extraído do PDF — não é mais usado pela IA, mas
   *  ainda aceito por compatibilidade. */
  texto_documento?: string | null;
  condicoes_uso?: CondicoesUso | null;
  empresa_nome?: string | null;
}

const SYSTEM_PROMPT = `Você é Engenheiro de Segurança do Trabalho e Higienista Ocupacional especialista em GHS (ABNT NBR 14725), NR-15, NR-16, IARC, eSocial e Previdência (Decreto 3.048).

REGRAS:
- NÃO invente códigos. Sem ABSOLUTA certeza: use "Consultar tabela oficial" / "Inconclusivo".
- NR-15 Anexo 13: avaliação qualitativa (sem limites numéricos).
- Carcinogenicidade: IARC (1, 2A, 2B), ACGIH (A1-A5), NR-15 Anexo 13-A.
- Insalubridade ≠ aposentadoria especial. GHS ≠ NR-16.
- Considere forma física + condições de exposição.

FORMATO: APENAS JSON válido (snake_case, sem markdown). Use "N/A" quando não aplicável (não null).

NÃO REPITA dados já listados nos campos estruturados. As fundamentações são RACIOCÍNIO técnico, não listagem de componentes — esses já estão nos cards.

Chaves (string):
- insalubridade_nr15: "SIM" | "NÃO" | "Inconclusivo"
- insalubridade_grau: "Mínimo" | "Médio" | "Máximo" | "N/A"
- insalubridade_anexo: ex. "Anexo 13 - Agentes Químicos" | "N/A"
- insalubridade_fundamentacao: 2 frases justificando o enquadramento (sem repetir componentes)
- aposentadoria_especial: "SIM" | "NÃO" | "Inconclusivo"
- aposentadoria_tempo: "15 anos" | "20 anos" | "25 anos" | "N/A"
- decreto_3048: breve descrição ou "Consultar decreto vigente"
- codigo_gfip: código se 100% certo, senão "Consultar tabela GFIP"
- esocial_tab24: breve descrição ou "Consultar tabela oficial"
- oleo_mineral: "N/A" | "Refinado" | "Super-refinado" | "Não refinado" + breve
- carcinogenico: "SIM/NÃO/Inconclusivo" + IARC/ACGIH se certo
- periculosidade_nr16: "SIM/NÃO/Inconclusivo" + breve justificativa
- epi_necessarios: lista por ";". Sem CA se incerto.
- epc_necessarios: lista por ";" | "N/A"
- medidas_controle: medidas adm/eng por ";"
- emergencia_acidente: vazamento + primeiros socorros (1 frase cada)
- medicao_necessaria: "SIM/NÃO" + breve
- metodologia: método NIOSH/OSHA/Fundacentro/NHO | "Inconclusivo"
- como_medir: procedimento + equipamento (1 frase) | "Inconclusivo"
- limite_exposicao: "valor + unidade - fonte" | "Inconclusivo"
- resumo_tecnico: PARECER técnico formal de 4-6 frases pra PPP/LTCAT. Estrutura: (1) enquadramento NR-15 (grau + anexo + LT do pior caso); (2) previdenciário (aposentadoria + Decreto + eSocial); (3) NR-16/carcinogenicidade se aplicar; (4) conclusão objetiva (monitoramento, EPIs prioritários). NÃO liste componentes — esses já estão nos campos estruturados. Foque em REASONING.

CONSERVADOR. Sem certeza → "Inconclusivo".`;

function buildUserPrompt(ctx: ContextoIA): string {
  const linhas: string[] = [
    "Análise de agente químico. Dados do produto vêm da FISPQ revisada — confie.",
    "",
  ];

  if (ctx.empresa_nome) linhas.push(`Empresa: ${ctx.empresa_nome}`);

  const ehMistura =
    !!ctx.dados_base_componentes && ctx.dados_base_componentes.length > 1;
  const temBase = !!ctx.dados_base || !!ctx.dados_base_componentes;

  // === Bloco produto: identificação mínima (1 linha)
  if (ctx.dados_manuais) {
    const d = ctx.dados_manuais;
    const partes: string[] = [];
    if (d.nome_produto) partes.push(`produto="${d.nome_produto}"`);
    if (d.forma_fisica) partes.push(`forma=${d.forma_fisica}`);
    if (partes.length > 0) linhas.push(`Produto: ${partes.join(" · ")}`);
  }

  // === Componentes catalogados (uma linha por item, formato pipe-separated)
  // SUBSTITUI o bloco "MISTURA" — esses dados já cobrem nome+CAS+regulatorio.
  if (ctx.dados_base_componentes && ctx.dados_base_componentes.length > 0) {
    linhas.push("");
    linhas.push(`CATÁLOGO (${ctx.dados_base_componentes.length} componente(s) — ground truth, NÃO contradizer):`);
    ctx.dados_base_componentes.forEach((d) => {
      const p: string[] = [];
      if (d.agente && d.cas) p.push(`${d.agente} (${d.cas})`);
      else if (d.agente) p.push(d.agente);
      else if (d.cas) p.push(`CAS ${d.cas}`);
      if (d.anexo) p.push(d.anexo);
      if (d.grau_nr15) p.push(`grau ${d.grau_nr15}`);
      if (d.lt_ppm != null) p.push(`LT ${d.lt_ppm}ppm`);
      else if (d.lt_mg_m3 != null) p.push(`LT ${d.lt_mg_m3}mg/m³`);
      if (d.iarc) p.push(`IARC ${d.iarc}`);
      if (d.cancerigeno_13a) p.push("13-A");
      if (d.esocial_tab24) p.push(`eSoc ${d.esocial_tab24}`);
      if (d.decreto_3048) p.push(`Dec ${d.decreto_3048}`);
      if (d.cod_gfip) p.push(`GFIP ${d.cod_gfip}`);
      if (d.pele) p.push("pele");
      if (d.inflamavel) p.push("inflamável");
      linhas.push(`- ${p.join(" | ")}`);
    });
  }

  // === Componentes NÃO catalogados (modo Manual ou PDF com químicos fora da base)
  // Só lista se há componentes ALÉM dos catalogados — evita duplicação.
  if (ctx.componentes && ctx.componentes.length > 0) {
    const casCatalogados = new Set(
      (ctx.dados_base_componentes ?? [])
        .map((d) => d.cas)
        .filter((c): c is string => !!c)
    );
    const naoCatalogados = ctx.componentes.filter(
      (c) => !c.numero_cas || !casCatalogados.has(c.numero_cas)
    );
    if (naoCatalogados.length > 0) {
      linhas.push("");
      linhas.push(`NÃO CATALOGADOS (${naoCatalogados.length}) — analise por analogia:`);
      naoCatalogados.forEach((c) => {
        const p: string[] = [];
        if (c.nome_quimico) p.push(c.nome_quimico);
        if (c.numero_cas) p.push(`CAS ${c.numero_cas}`);
        if (c.concentracao) p.push(c.concentracao);
        linhas.push(`- ${p.join(" | ")}`);
      });
    }
  }

  // === Agregado pior caso — só campos que a IA precisa ativar nos cards.
  // Compactado: 1 linha. Os componentes individuais já estão no CATÁLOGO acima.
  if (ctx.dados_base) {
    const d = ctx.dados_base;
    const p: string[] = [];
    if (d.grau_nr15) p.push(`grau ${d.grau_nr15}`);
    if (d.anexo) p.push(d.anexo);
    if (d.lt_ppm != null) p.push(`LT ${d.lt_ppm}ppm`);
    else if (d.lt_mg_m3 != null) p.push(`LT ${d.lt_mg_m3}mg/m³`);
    if (d.iarc) p.push(`IARC ${d.iarc}`);
    if (d.cancerigeno_13a) p.push("13-A");
    if (d.inflamavel) p.push("inflamável");
    if (d.teto) p.push("TETO");
    if (d.pele) p.push("pele");
    if (p.length > 0) {
      linhas.push("");
      linhas.push(`PIOR CASO: ${p.join(" · ")}`);
    }
  }

  // === Contexto FISPQ (snippets seções 2/8/11). Encolhe MUITO quando há
  // base — a base já tem os dados regulatórios, só precisamos do contexto
  // toxicológico/exposição extra. Sem base: pode mandar até PDF_MAX_CHARS.
  if (ctx.contexto_fispq && ctx.contexto_fispq.trim().length > 0) {
    const maxChars = temBase ? 1500 : PDF_MAX_CHARS;
    linhas.push("");
    linhas.push("FISPQ snippets (perigos/exposição/toxicologia):");
    linhas.push(ctx.contexto_fispq.slice(0, maxChars));
  }

  // === Condições de uso
  if (ctx.condicoes_uso) {
    const c = ctx.condicoes_uso;
    const p: string[] = [];
    if (c.atividade) p.push(`atividade=${c.atividade}`);
    if (c.frequencia) p.push(`freq=${c.frequencia}`);
    if (c.duracao) p.push(`duração=${c.duracao}`);
    if (c.ventilacao) p.push(`vent=${c.ventilacao}`);
    if (c.geracao_nevoa_vapor) p.push(`névoa=${c.geracao_nevoa_vapor}`);
    if (c.epis_utilizados) p.push(`EPIs=${c.epis_utilizados}`);
    if (p.length > 0) {
      linhas.push("");
      linhas.push(`Uso: ${p.join(" · ")}`);
    }
  }

  linhas.push("");
  linhas.push(
    ehMistura
      ? "Mistura: enquadramento pelo pior caso. Foque em REASONING — não liste componentes (já estão no CATÁLOGO acima)."
      : "Use os valores do CATÁLOGO/PIOR CASO exatamente como vieram."
  );
  linhas.push("Responda APENAS JSON com as chaves especificadas. Conservador.");
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
    // campos catalogados). Strings que contém ":" são tratadas como já
    // formatadas pelo client (mistura — "Tolueno: 09.01.001; Xileno: ...").
    if (conclusao && body.dados_base) {
      const d = body.dados_base;
      const ehMisturaFmt = (s: string | null | undefined) =>
        !!s && s.includes(":");

      if (d.grau_nr15) {
        conclusao.insalubridade_nr15 =
          d.grau_nr15 === "Asfixiante simples" ? "Inconclusivo" : "SIM";
        conclusao.insalubridade_grau = d.grau_nr15;
      }
      if (d.anexo) conclusao.insalubridade_anexo = d.anexo;
      if (d.esocial_tab24) {
        conclusao.esocial_tab24 = ehMisturaFmt(d.esocial_tab24)
          ? d.esocial_tab24
          : `Código ${d.esocial_tab24}`;
      }
      if (d.decreto_3048) {
        conclusao.decreto_3048 = ehMisturaFmt(d.decreto_3048)
          ? d.decreto_3048
          : `Anexo IV código ${d.decreto_3048}`;
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
        if (ehMisturaFmt(d.tlv_acgih)) {
          conclusao.limite_exposicao = `ACGIH (por componente): ${d.tlv_acgih}`;
        } else {
          const lt =
            d.lt_ppm != null
              ? `${d.lt_ppm} ppm`
              : d.lt_mg_m3 != null
              ? `${d.lt_mg_m3} mg/m³`
              : null;
          conclusao.limite_exposicao = lt
            ? `LT NR-15: ${lt} · ACGIH: ${d.tlv_acgih}`
            : `ACGIH: ${d.tlv_acgih}`;
        }
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
