// Geração client-side de Conclusão Rápida QUANDO todos os componentes
// estão catalogados na base Chabra. Substitui a chamada à IA pra produtos
// comuns (thinner, álcool, acetona, etc.), economizando ~100% dos tokens
// nesses casos. Mantém o mesmo formato de resposta da edge function
// `analisar-quimico-ia` pra UI não precisar mudar.
//
// Lógica:
//   1. Campos REGULATÓRIOS vêm 1:1 da base (anexo, grau, eSocial, etc.).
//      Mistura usa o "pior caso" agregado por `piorCasoMistura()`.
//   2. Campos NARRATIVOS são gerados por templates:
//      - epi_necessarios, epc_necessarios, medidas_controle, emergencia
//        variam por forma_fisica + flags (pele, inflamável, carcinogênico)
//      - metodologia / como_medir variam por NR-15 anexo
//      - insalubridade_fundamentacao / resumo_tecnico são prosa formal
//
// Se algum componente NÃO está catalogado, prefira a IA (que tem mais
// flexibilidade pra raciocinar por analogia).

import type { ConclusaoRapidaQuimico, CondicoesUsoQuimico } from "@/lib/supabase/types";
import type { AgenteReferencia } from "@/lib/quimicos/base_referencia";

// ============================================================
// EPI / EPC / Medidas / Emergência — variam por forma física
// ============================================================

const EPI_POR_FORMA: Record<string, string> = {
  "Líquido":
    "Luvas de nitrila/PVC (resistência química); óculos de segurança ampla visão; respirador purificador com filtro VO/VG para vapores orgânicos; avental ou macacão impermeável; calçado fechado",
  "Gás":
    "Respirador purificador com filtro específico para vapores (ou autônomo em emergência); óculos de segurança ampla visão; luvas impermeáveis; vestimenta antiestática quando inflamável",
  "Vapor":
    "Respirador purificador com filtro VO/VG; óculos de segurança ampla visão; luvas de proteção química; vestimenta de mangas longas",
  "Aerossol":
    "Respirador purificador com filtro P3 ou combinado VO/VG+P3; óculos ampla visão; luvas químicas; vestimenta de proteção integral",
  "Pó":
    "Respirador purificador com filtro P3 para particulados; óculos ampla visão; luvas; vestimenta de proteção contra poeiras finas",
  "Pasta":
    "Luvas de proteção química; óculos de segurança; avental impermeável; respirador se houver geração de vapor",
  "Sólido":
    "Luvas de proteção; óculos de segurança; máscara facial caso haja geração de poeira ou particulados",
  "Granulado":
    "Luvas de proteção; óculos de segurança; vestimenta de mangas longas; respirador P2 se houver poeira",
  "Cristalino":
    "Luvas de proteção química; óculos ampla visão; respirador P3 contra particulados",
};

const EPC_POR_FORMA: Record<string, string> = {
  "Líquido":
    "Ventilação geral diluidora; sistema de exaustão local (campana ou braço articulado) sobre o ponto de manuseio; chuveiro de emergência e lava-olhos próximos; sinalização de área restrita",
  "Gás":
    "Sistema de exaustão local com captação na fonte; ventilação geral diluidora; sensores de detecção contínua quando aplicável; sinalização e isolamento da área",
  "Vapor":
    "Exaustão local sobre o ponto de geração; ventilação geral diluidora; chuveiro/lava-olhos próximos",
  "Aerossol":
    "Cabine ou capela com exaustão local; sistema de filtragem na saída do ar; isolamento físico da operação",
  "Pó":
    "Aspiração na fonte; umedecimento do material quando possível; isolamento da operação; filtros HEPA no sistema de exaustão",
  "Pasta": "Ventilação geral; bandejas de contenção; chuveiro/lava-olhos próximos",
  "Sólido": "Ventilação geral; aspiração na fonte se gerar poeira",
  "Granulado": "Aspiração na fonte se gerar poeira; ventilação geral",
  "Cristalino": "Aspiração na fonte; ventilação geral",
};

const EMERGENCIA_POR_FORMA: Record<string, string> = {
  "Líquido":
    "Vazamento: isolar a área, conter com material absorvente inerte (areia, vermiculita), recolher em recipiente apropriado e ventilar o local. Contato com pele/olhos: lavar com água em abundância por no mínimo 15 minutos e procurar atendimento médico",
  "Gás":
    "Vazamento: evacuar a área, ventilar, fechar o vazamento se seguro fazê-lo e usar autônomo para acessos. Inalação: remover a vítima para local ventilado e procurar atendimento médico imediato",
  "Vapor":
    "Vazamento: ventilar o local, evacuar pessoas não essenciais e isolar fontes de ignição. Inalação: remover para área ventilada e procurar atendimento médico",
  "Aerossol":
    "Vazamento: isolar área, evitar inalação, usar EPI completo na contenção. Inalação: remover para área ventilada, procurar atendimento médico",
  "Pó":
    "Derramamento: NÃO varrer a seco — aspirar com sistema P3 ou umedecer. Inalação: remover para área ventilada. Contato com olhos: lavar com água",
  "Pasta": "Derramamento: recolher com pá; lavar resíduos com água. Contato: lavar pele/olhos com água",
  "Sólido": "Recolher por aspiração ou pá. Contato com olhos/pele: lavar com água",
  "Granulado": "Recolher por aspiração ou pá; evitar dispersão",
  "Cristalino": "Aspirar com filtro adequado; evitar dispersão; contato com olhos: lavar com água",
};

/**
 * Sobrescrita do procedimento de emergência quando o agente é INFLAMÁVEL.
 * Procedimentos de combate ao fogo + segurança elétrica + extintores
 * específicos pra líquidos/gases inflamáveis (classe B).
 */
const EMERGENCIA_INFLAMAVEL: Record<string, string> = {
  "Líquido":
    "Vazamento (líquido inflamável): isolar área de fontes de ignição, desenergizar equipamentos elétricos próximos, conter com absorvente inerte não-combustível e recolher em recipiente metálico aterrado. Combate ao fogo: extintor de espuma (AFFF), pó químico ou CO₂ — NÃO usar água em jato direto. Ventilar exaustivamente. Contato com pele/olhos: lavar com água abundante por 15 min e atendimento médico",
  "Gás":
    "Vazamento (gás inflamável): evacuar imediatamente, isolar fontes de ignição, desenergizar área, ventilar com explosímetro acompanhando LIE. Combate ao fogo: NÃO apagar o fogo até cortar o vazamento (risco de explosão por reignição) — resfriar cilindros com água por proteção. Inalação: remover para local ventilado, atendimento médico",
  "Vapor":
    "Vazamento (vapor inflamável): ventilar imediatamente, eliminar fontes de ignição (chamas, faíscas, eletrostática), evacuar não-essenciais. Combate ao fogo: espuma ou pó químico — NÃO água direta. Atendimento médico em caso de exposição",
};

const METODOLOGIA_POR_ANEXO: Record<string, string> = {
  "Anexo 11":
    "NHO-08 (FUNDACENTRO) ou NIOSH série 1500 — coleta com cassete de carvão ativo + análise por cromatografia gasosa (GC-FID)",
  "Anexo 12":
    "NHO-08 (FUNDACENTRO) — coleta com filtro/impactor + análise gravimétrica/química conforme o particulado",
  "Anexo 13":
    "Avaliação qualitativa conforme NR-15 Anexo 13 — análise da atividade, frequência, intensidade e tempo de exposição (não há metodologia quantitativa)",
  "Anexo 13-A":
    "NHO-08 + análise específica do cancerígeno; avaliação qualitativa complementar pela natureza Anexo 13-A (carcinogênico)",
};

const COMO_MEDIR_POR_ANEXO: Record<string, string> = {
  "Anexo 11":
    "Coletor pessoal sobre o trabalhador na altura da zona respiratória, tempo de amostragem cobrindo a jornada típica (NHO-08). Bomba de amostragem calibrada + cassete de carvão ativo. Análise laboratorial por GC-FID",
  "Anexo 12":
    "Bomba de amostragem pessoal calibrada com filtro/impactor apropriado ao tipo de particulado. Análise gravimétrica + específica conforme NHO-08",
  "Anexo 13":
    "Inspeção visual, entrevista com trabalhadores, análise do tempo de exposição efetiva e revisão de FISPQ. Não há equipamento de medição quantitativa",
  "Anexo 13-A":
    "Como Anexo 11 + protocolo específico para cancerígenos: bomba calibrada, cassete específico, análise por laboratório acreditado",
};

/**
 * Métodos NIOSH/OSHA específicos por CAS — usados quando o produto tem
 * 1 componente catalogado E o CAS bate na lista. Cobre os ~20 químicos
 * mais comuns em FISPQs do dia a dia (solventes, álcoois, ácidos).
 *
 * Pra mistura ou CAS fora da lista, cai no método genérico por anexo.
 */
const METODO_POR_CAS: Record<string, string> = {
  "71-43-2": "NIOSH 1500/1501 (benzeno) — cassete de carvão ativo + GC-FID",
  "108-88-3": "NIOSH 1500/1501 (tolueno) — cassete de carvão ativo + GC-FID",
  "1330-20-7": "NIOSH 1501 (xilenos) — cassete de carvão ativo + GC-FID",
  "100-41-4": "NIOSH 1501 (etilbenzeno) — cassete de carvão ativo + GC-FID",
  "67-64-1": "NIOSH 1300 (acetona/cetonas) — cassete de carvão ativo + GC-FID",
  "78-93-3": "NIOSH 2500 (MEK/butanona) — cassete + GC-FID",
  "64-17-5": "NIOSH 1400 (álcoois) — cassete de sílica + GC-FID",
  "67-56-1": "NIOSH 2000 (metanol) — cassete de sílica + GC-FID",
  "67-63-0": "NIOSH 1400 (isopropanol) — cassete + GC-FID",
  "141-78-6": "NIOSH 1450 (acetato de etila) — cassete + GC-FID",
  "75-09-2": "NIOSH 1005 (cloreto de metileno) — cassete + GC-FID",
  "127-18-4": "NIOSH 1003 (PERC/tetracloroetileno) — cassete + GC-FID",
  "79-01-6": "NIOSH 1022 (TCE/tricloroetileno) — cassete + GC-FID",
  "50-00-0": "NIOSH 2016 (formaldeído) — DNPH + HPLC-UV",
  "7664-93-9": "OSHA ID-113 (ác. sulfúrico) — filtro PTFE + IC",
  "7647-01-0": "OSHA ID-174 (HCl) — filtro tratado + IC",
  "1310-58-3": "NIOSH 7401 (NaOH/álcalis) — filtro + análise química",
  "7440-50-8": "NIOSH 7301 (cobre) — filtro celulose + ICP-MS",
  "7439-92-1": "NIOSH 7082 (chumbo) — filtro celulose + AAS/ICP-MS",
  "7439-97-6": "NIOSH 6009 (mercúrio) — tubo Hopcalite + AAS",
};

/**
 * EPC sugerido baseado em palavras-chave da atividade descrita pelo usuário.
 * Quando NÃO há condição de uso, cai no template por forma física.
 */
const EPC_POR_ATIVIDADE: Array<{ palavras: RegExp; texto: string }> = [
  {
    palavras: /pintura|pistola|aspersão|aerografia|spray/i,
    texto:
      "Cabine de pintura com exaustão local; ventilação dirigida; pressurização da área externa; sinalização de área restrita; chuveiro de emergência e lava-olhos próximos",
  },
  {
    palavras: /laboratório|laborat[oó]rio|bancada|analítico|pesagem/i,
    texto:
      "Capela de exaustão química; ventilação geral diluidora; chuveiro de emergência e lava-olhos na área; armário de armazenamento ventilado",
  },
  {
    palavras: /imersão|banho|mergulho|tanque/i,
    texto:
      "Enclausuramento do tanque com tampa; exaustão local sobre a borda; bandejas de contenção secundária; chuveiro/lava-olhos próximos; ventilação geral",
  },
  {
    palavras: /transferência|envase|trasfega|carga|descarga|caminhão/i,
    texto:
      "Sistema fechado de transferência (bomba + mangueira); aterramento equipotencial em líquidos inflamáveis; ventilação local; bandeja de contenção; chuveiro/lava-olhos",
  },
  {
    palavras: /limpeza|desengraxe|desincrustação/i,
    texto:
      "Ventilação local sobre a área de operação; isolamento da área; chuveiro/lava-olhos próximos; recipientes fechados quando não em uso",
  },
  {
    palavras: /soldagem|brasagem|corte/i,
    texto:
      "Exaustão local com captação na fonte (braço articulado ou mesa downdraft); cabine de soldagem quando aplicável; ventilação geral; sinalização",
  },
];

// ============================================================
// Helpers
// ============================================================

const ehMisturaFmt = (s: string | null | undefined): boolean =>
  !!s && s.includes(":");

function aposentadoria(grau: string | null | undefined, cancerigeno: boolean | null | undefined) {
  if (cancerigeno) return { especial: "SIM", tempo: "15 anos" };
  switch (grau) {
    case "Máximo":
      return { especial: "SIM", tempo: "15 anos" };
    case "Médio":
      return { especial: "SIM", tempo: "20 anos" };
    case "Mínimo":
      return { especial: "SIM", tempo: "25 anos" };
    case "Asfixiante simples":
      return { especial: "Inconclusivo", tempo: "N/A" };
    default:
      return { especial: "NÃO", tempo: "N/A" };
  }
}

function carcinogenico(d: AgenteReferencia): string {
  if (d.iarc) {
    return `SIM - IARC ${d.iarc}${d.cancerigeno_13a ? " (NR-15 Anexo 13-A)" : ""}`;
  }
  if (d.cancerigeno_13a) return "SIM - NR-15 Anexo 13-A";
  return "NÃO";
}

function limiteExposicaoTexto(d: AgenteReferencia): string {
  const lt =
    d.lt_ppm != null ? `${d.lt_ppm} ppm` : d.lt_mg_m3 != null ? `${d.lt_mg_m3} mg/m³` : null;
  if (d.tlv_acgih) {
    if (ehMisturaFmt(d.tlv_acgih)) return `ACGIH (por componente): ${d.tlv_acgih}`;
    return lt ? `LT NR-15: ${lt} · ACGIH: ${d.tlv_acgih}` : `ACGIH: ${d.tlv_acgih}`;
  }
  if (lt) return `${lt} - NR-15`;
  return "Inconclusivo";
}

function ajustarEpiPorFlags(epiBase: string, pele: boolean | null | undefined, carcinog: boolean): string {
  const extras: string[] = [];
  if (pele) {
    extras.push("luvas impermeáveis com proteção contra absorção dérmica (substituir conforme degradação)");
  }
  if (carcinog) {
    extras.push("proteção respiratória reforçada com filtro P3 e troca conforme protocolo (substância carcinogênica)");
  }
  return extras.length > 0 ? `${epiBase}; ${extras.join("; ")}` : epiBase;
}

// ============================================================
// Função principal
// ============================================================

export interface GerarTemplateInput {
  /** Agregado pior caso da mistura (ou dado único pra 1 componente). */
  dadosBase: AgenteReferencia;
  /** Lista de componentes catalogados (pode ter 1 só). */
  componentes: AgenteReferencia[];
  /** Forma física do produto (Líquido/Sólido/etc.). */
  formaFisica?: string | null;
  /** Condições de uso opcionais. */
  condicoesUso?: CondicoesUsoQuimico | null;
}

/**
 * Gera ConclusaoRapidaQuimico 100% client-side, sem chamar IA.
 *
 * Pré-requisito: TODOS os componentes do produto estão catalogados na base
 * Chabra. Pra produtos com componentes fora da base, use a IA — ela tem
 * mais flexibilidade pra raciocinar por analogia.
 */
export function gerarConclusaoTemplate(
  input: GerarTemplateInput
): ConclusaoRapidaQuimico {
  const d = input.dadosBase;
  const ehMistura = input.componentes.length > 1;
  const forma = (input.formaFisica || "").trim() || "Líquido"; // default seguro
  const carcinog = !!(d.iarc || d.cancerigeno_13a);

  const apos = aposentadoria(d.grau_nr15, d.cancerigeno_13a);

  // --- Campos regulatórios (vêm direto da base) ---
  const insalubridade_nr15 = d.grau_nr15
    ? d.grau_nr15 === "Asfixiante simples"
      ? "Inconclusivo"
      : "SIM"
    : "Inconclusivo";
  const insalubridade_grau = d.grau_nr15 ?? "N/A";
  const insalubridade_anexo = d.anexo ?? "N/A";

  const decreto_3048 = d.decreto_3048
    ? ehMisturaFmt(d.decreto_3048)
      ? d.decreto_3048
      : `Anexo IV código ${d.decreto_3048}`
    : "Consultar decreto vigente";

  const codigo_gfip = d.cod_gfip ?? "Consultar tabela GFIP";

  const esocial_tab24 = d.esocial_tab24
    ? ehMisturaFmt(d.esocial_tab24)
      ? d.esocial_tab24
      : `Código ${d.esocial_tab24}`
    : "Consultar tabela oficial";

  const carcinogenico_str = carcinogenico(d);

  const periculosidade_nr16 = d.inflamavel
    ? "SIM - inflamável (NR-16 Anexo 2)"
    : "NÃO";

  const oleo_mineral = "N/A"; // template não infere tipo de óleo — UI mostra N/A
  const medicao_necessaria =
    d.grau_nr15 && d.grau_nr15 !== "Asfixiante simples"
      ? "SIM"
      : "Inconclusivo";
  const limite_exposicao = limiteExposicaoTexto(d);

  // --- Campos narrativos (templates por forma física + flags + contexto) ---
  const epiBase = EPI_POR_FORMA[forma] || EPI_POR_FORMA["Líquido"];
  const epi_necessarios = ajustarEpiPorFlags(epiBase, d.pele, carcinog);

  // EPC: prioriza atividade descrita nas condições de uso; senão cai no
  // template por forma física.
  const atividadeStr = input.condicoesUso?.atividade?.trim() ?? "";
  const epcPorAtividade = atividadeStr
    ? EPC_POR_ATIVIDADE.find((r) => r.palavras.test(atividadeStr))?.texto
    : undefined;
  const epc_necessarios =
    epcPorAtividade || EPC_POR_FORMA[forma] || EPC_POR_FORMA["Líquido"];

  // Emergência: variante específica pra inflamáveis (procedimento contra
  // fogo, extintores classe B, segurança elétrica).
  const emergencia_acidente =
    d.inflamavel && EMERGENCIA_INFLAMAVEL[forma]
      ? EMERGENCIA_INFLAMAVEL[forma]
      : EMERGENCIA_POR_FORMA[forma] || EMERGENCIA_POR_FORMA["Líquido"];

  // Medidas: lista base + medidas extras por flags/contexto.
  const ventilacaoStr = input.condicoesUso?.ventilacao?.trim().toLowerCase() ?? "";
  const ventilacaoFraca = /natural|inadequad|insuficien|nenhum/i.test(ventilacaoStr);
  const medidas_controle = [
    "Substituição do agente por alternativa menos nociva quando viável",
    "Enclausuramento e/ou exaustão local",
    "Sinalização e isolamento da área de manuseio",
    "Treinamento periódico em manuseio seguro",
    "Programa de proteção respiratória conforme NR-06",
    d.pele ? "Procedimento para evitar contato dérmico (luvas + lavagem)" : null,
    carcinog ? "Programa específico de controle de exposição a carcinogênicos" : null,
    d.inflamavel
      ? "Controle de fontes de ignição + aterramento equipotencial em transferência de líquido inflamável"
      : null,
    d.teto
      ? "Monitoramento contínuo com alarme para garantir que o valor TETO nunca seja ultrapassado"
      : null,
    ventilacaoFraca
      ? "Instalar exaustão local na fonte — ventilação atual reportada é insuficiente"
      : null,
  ]
    .filter(Boolean)
    .join("; ");

  // Metodologia / como_medir: CAS-specific quando produto puro com CAS na
  // lista; caso contrário cai no template por anexo.
  const anexoSimples = (d.anexo || "").match(/Anexo\s+(\d+(?:-?[A-Z])?)/i)?.[0] || d.anexo;
  const chaveAnexo = anexoSimples || "Anexo 11";
  const metodoCasEspecifico =
    !ehMistura && d.cas ? METODO_POR_CAS[d.cas] : undefined;
  const metodologia =
    metodoCasEspecifico ||
    METODOLOGIA_POR_ANEXO[chaveAnexo] ||
    METODOLOGIA_POR_ANEXO["Anexo 11"];
  const como_medir =
    COMO_MEDIR_POR_ANEXO[chaveAnexo] || COMO_MEDIR_POR_ANEXO["Anexo 11"];

  // Pra misturas: identifica até 2 componentes "destaque" pelo grau NR-15
  // (Máximo > Médio > Mínimo). Usado em fundamentação + resumo_tecnico
  // pra dar contexto sem listar TODOS os componentes (lista já está nos cards).
  const RANK_GRAU: Record<string, number> = {
    Máximo: 3,
    Médio: 2,
    Mínimo: 1,
    "Asfixiante simples": 0,
  };
  const componentesDestaque = ehMistura
    ? [...input.componentes]
        .sort(
          (a, b) =>
            (b.grau_nr15 ? RANK_GRAU[b.grau_nr15] ?? -1 : -1) -
            (a.grau_nr15 ? RANK_GRAU[a.grau_nr15] ?? -1 : -1)
        )
        .slice(0, 2)
        .map((c) => c.agente)
        .filter(Boolean)
    : [];

  // --- Fundamentação (2 frases — racional do enquadramento) ---
  const fundParts: string[] = [];
  if (d.grau_nr15 && d.anexo) {
    fundParts.push(
      `Agente${ehMistura ? " (mistura)" : ""} enquadrado na NR-15 ${d.anexo} com grau de insalubridade ${d.grau_nr15.toLowerCase()}${
        d.lt_ppm != null
          ? `, limite de tolerância ${d.lt_ppm} ppm`
          : d.lt_mg_m3 != null
            ? `, limite de tolerância ${d.lt_mg_m3} mg/m³`
            : ""
      }.`
    );
  } else if (d.grau_nr15 === "Asfixiante simples") {
    fundParts.push(
      "Agente classificado como asfixiante simples (deslocamento de oxigênio). Risco depende da concentração ambiental e da ventilação."
    );
  } else {
    fundParts.push(
      "Agente sem enquadramento direto na NR-15 nos dados oficiais. Recomenda-se avaliação qualitativa específica."
    );
  }
  if (ehMistura && componentesDestaque.length > 0) {
    fundParts.push(
      `O enquadramento segue o pior caso da mistura — destacam-se ${componentesDestaque.join(" e ")} como agente(s) determinante(s) do grau aplicado.`
    );
  } else if (ehMistura) {
    fundParts.push(
      "O enquadramento segue o pior caso da mistura — todos os componentes catalogados foram avaliados individualmente."
    );
  } else if (carcinog) {
    fundParts.push(
      d.cancerigeno_13a
        ? "Classificado como carcinogênico pela NR-15 Anexo 13-A — exposição deve ser eliminada/minimizada ao máximo tecnicamente viável."
        : `Carcinogenicidade IARC ${d.iarc} exige protocolo rigoroso de controle e monitoramento.`
    );
  }
  const insalubridade_fundamentacao = fundParts.join(" ");

  // --- Resumo técnico (4-6 frases — parecer formal pra PPP/LTCAT) ---
  const resumoParts: string[] = [];

  // 1) Enquadramento NR-15
  if (d.grau_nr15 && d.anexo) {
    const ehMisturaTxt =
      ehMistura && componentesDestaque.length > 0
        ? ` (mistura, com destaque para ${componentesDestaque.join(" e ")} no pior caso)`
        : ehMistura
          ? " (mistura)"
          : "";
    resumoParts.push(
      `Conforme NR-15 ${d.anexo}, o agente${ehMisturaTxt} está classificado com grau ${d.grau_nr15.toLowerCase()} de insalubridade${
        d.lt_ppm != null
          ? `, com limite de tolerância de ${d.lt_ppm} ppm`
          : d.lt_mg_m3 != null
            ? `, com limite de tolerância de ${d.lt_mg_m3} mg/m³`
            : " (avaliação qualitativa)"
      }${d.teto ? " (valor TETO — não pode ser ultrapassado)" : ""}.`
    );
  }

  // 2) Previdenciário
  if (apos.especial === "SIM") {
    const partes: string[] = [];
    if (d.decreto_3048) {
      partes.push(
        ehMisturaFmt(d.decreto_3048)
          ? `Decreto 3.048 Anexo IV: ${d.decreto_3048}`
          : `Decreto 3.048 Anexo IV código ${d.decreto_3048}`
      );
    }
    if (d.esocial_tab24) {
      partes.push(
        ehMisturaFmt(d.esocial_tab24)
          ? `eSocial S-2240 Tab.24: ${d.esocial_tab24}`
          : `eSocial S-2240 Tab.24 código ${d.esocial_tab24}`
      );
    }
    if (d.cod_gfip) partes.push(`GFIP código ${d.cod_gfip}`);
    resumoParts.push(
      `Para fins previdenciários, há direito à aposentadoria especial após ${apos.tempo} de exposição efetiva${partes.length > 0 ? ` (${partes.join("; ")})` : ""}.`
    );
  } else {
    resumoParts.push(
      "Sem direito a aposentadoria especial nos dados oficiais — confirmar via tabela vigente para cada componente."
    );
  }

  // 3) NR-16 (periculosidade)
  if (d.inflamavel) {
    resumoParts.push(
      "Aplicável adicional de periculosidade conforme NR-16 Anexo 2 pela classificação como inflamável."
    );
  }

  // 4) Carcinogenicidade
  if (carcinog) {
    resumoParts.push(
      `${d.iarc ? `Classificação IARC ${d.iarc}` : "Classificação NR-15 Anexo 13-A"}${
        d.cancerigeno_13a && d.iarc ? " e NR-15 Anexo 13-A" : ""
      } — controle de exposição deve ser rigoroso, com priorização de eliminação/substituição quando viável.`
    );
  }

  // 5) Conclusão objetiva (considera condições de uso quando informadas)
  const conclusao: string[] = [];
  if (medicao_necessaria === "SIM") {
    conclusao.push(
      d.teto
        ? "monitoramento contínuo (valor TETO obrigatório)"
        : "monitoramento quantitativo periódico"
    );
  }
  conclusao.push(
    epcPorAtividade
      ? `EPC específico para a atividade descrita${atividadeStr ? ` ("${atividadeStr}")` : ""}`
      : `EPIs adequados à forma física ${forma.toLowerCase()}`
  );
  if (d.pele) conclusao.push("proteção dérmica obrigatória");
  if (ventilacaoFraca)
    conclusao.push(
      "reforço urgente da ventilação local (atual reportada como insuficiente)"
    );
  resumoParts.push(`Para controle: ${conclusao.join(", ")}.`);

  const resumo_tecnico = resumoParts.join(" ");

  return {
    insalubridade_nr15,
    insalubridade_grau,
    insalubridade_anexo,
    insalubridade_fundamentacao,
    aposentadoria_especial: apos.especial,
    aposentadoria_tempo: apos.tempo,
    decreto_3048,
    codigo_gfip,
    esocial_tab24,
    oleo_mineral,
    carcinogenico: carcinogenico_str,
    periculosidade_nr16,
    epi_necessarios,
    epc_necessarios,
    medidas_controle,
    emergencia_acidente,
    medicao_necessaria,
    metodologia,
    como_medir,
    limite_exposicao,
    resumo_tecnico,
  };
}
