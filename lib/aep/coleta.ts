/**
 * Condições da coleta e motivo do N/I na triagem da AEP (Fase 1 do plano
 * "AEP com menos dependência de entrevistas", 2026-10-06).
 *
 * O problema: quando o trabalhador não fala (medo de represália), o técnico
 * marcava "Não" ou "N/I" e o fator sumia da matriz — o setor com mais medo
 * saía com menos risco. Aqui ficam:
 *   • o MOTIVO de cada N/I da Ergonomia Organizacional (obrigatório);
 *   • as CONDIÇÕES DA COLETA do setor (abordados, participantes, recusas,
 *     liderança presente, sinais de inibição);
 *   • as frases que o laudo e a IA usam;
 *   • a regra que faz o receio de manifestação recomendar DRPS/Questionário.
 *
 * Nada aqui mexe na matriz AIHA nem no "Necessita AET": N/I continua fora
 * deles. Módulo PURO (sem hook): roda na tela, no laudo e no PDF.
 *
 * ⚠️ As chaves (`receio_manifestacao`, `lideranca_olhar`…) ficam gravadas em
 * `aep_relatorios.setores` (jsonb). Mudar `label` é livre; mudar chave não.
 */

export type MotivoNi = "receio_manifestacao" | "ausencia_trabalhadores" | "atividade_nao_observada" | "outro";

export const MOTIVOS_NI: { key: MotivoNi; label: string }[] = [
  { key: "receio_manifestacao", label: "Receio dos trabalhadores em se manifestar" },
  { key: "ausencia_trabalhadores", label: "Trabalhadores ausentes no momento da avaliação" },
  { key: "atividade_nao_observada", label: "Atividade não realizada/observada durante a visita" },
  { key: "outro", label: "Outro" },
];

export interface MotivoNiFator {
  motivo: MotivoNi | "";
  /** Obrigatório quando o motivo é "outro"; opcional nos demais. */
  texto?: string;
}

export const SINAIS_INIBICAO: { key: string; label: string }[] = [
  { key: "respostas_padronizadas", label: "Respostas padronizadas/ensaiadas, sem exemplos concretos" },
  { key: "silencio_lideranca", label: "Silêncio ou mudança de comportamento com a aproximação da liderança" },
  { key: "lideranca_olhar", label: "Trabalhadores olham para a liderança antes de responder" },
  { key: "recusa_participar", label: "Recusa em participar ou pedido para “não se envolver”" },
];

export interface CondicoesColeta {
  trab_abordados?: number | null;
  trab_participantes?: number | null;
  /** Só o número — sem identificar ninguém. */
  recusas_evasivas?: number | null;
  lideranca_presente?: boolean | null;
  sinais_inibicao?: string[];
  obs_coleta?: string;
}

/** Sinais do fator Assédio que o aviso de inibição sugere (o técnico decide). */
export const SINAIS_SUGERIDOS_INIBICAO = ["sem_escuta", "tensao_silencio"] as const;

/**
 * Recomendar DRPS/Questionário também quando há receio de manifestação
 * (N/I com esse motivo) ou sinais de inibição na coleta, além dos 3+ "Sim".
 * Decisão do usuário em 2026-10-06 (aprovou a Fase 1 com esta regra).
 */
export const DRPS_POR_RECEIO = true;

const rotuloMotivo = (m: string) => MOTIVOS_NI.find((x) => x.key === m)?.label ?? null;

// ─── Normalização (lixo no jsonb não vira erro de tela) ──────────────────────

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

export function normalizarMotivoNi(raw: unknown): Record<string, MotivoNiFator> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, MotivoNiFator> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const m = (v as { motivo?: unknown }).motivo;
    const t = (v as { texto?: unknown }).texto;
    out[k] = {
      motivo: MOTIVOS_NI.some((x) => x.key === m) ? (m as MotivoNi) : "",
      ...(typeof t === "string" && t ? { texto: t } : {}),
    };
  }
  return out;
}

export function normalizarCondicoesColeta(raw: unknown): CondicoesColeta {
  if (typeof raw !== "object" || raw === null) return {};
  const c = raw as Record<string, unknown>;
  return {
    trab_abordados: num(c.trab_abordados),
    trab_participantes: num(c.trab_participantes),
    recusas_evasivas: num(c.recusas_evasivas),
    lideranca_presente: typeof c.lideranca_presente === "boolean" ? c.lideranca_presente : null,
    sinais_inibicao: Array.isArray(c.sinais_inibicao)
      ? c.sinais_inibicao.filter((x): x is string => typeof x === "string" && SINAIS_INIBICAO.some((s) => s.key === x))
      : [],
    obs_coleta: typeof c.obs_coleta === "string" ? c.obs_coleta : "",
  };
}

// ─── Regras ───────────────────────────────────────────────────────────────────

/** Recorte do setor que estas regras leem (casa com AepSetor e AepSetorLocal). */
export interface SetorColeta {
  nome_setor?: string | null;
  checklist_organizacional?: Record<string, string | null | undefined> | object | null;
  motivo_ni?: Record<string, MotivoNiFator> | null;
  condicoes_coleta?: CondicoesColeta | null;
}

const checklistOrg = (s: SetorColeta) => (s.checklist_organizacional ?? {}) as Record<string, string | null | undefined>;

/** Fatores marcados N/I sem motivo válido (ou "outro" sem texto). */
export function niSemMotivo(s: SetorColeta): string[] {
  return Object.entries(checklistOrg(s))
    .filter(([, v]) => v === "nao_identificado")
    .map(([k]) => k)
    .filter((k) => {
      const m = s.motivo_ni?.[k];
      if (!m?.motivo) return true;
      return m.motivo === "outro" && !(m.texto ?? "").trim();
    });
}

/** Participantes acima dos abordados — o editor avisa. */
export function participantesExcedem(c: CondicoesColeta | null | undefined): boolean {
  const a = c?.trab_abordados;
  const p = c?.trab_participantes;
  return typeof a === "number" && typeof p === "number" && p > a;
}

/** Algum N/I por receio de manifestação ou sinal de inibição na coleta. */
export function temReceioManifestacao(s: SetorColeta): boolean {
  const org = checklistOrg(s);
  const niReceio = Object.entries(s.motivo_ni ?? {}).some(
    ([k, m]) => org[k] === "nao_identificado" && m?.motivo === "receio_manifestacao",
  );
  return niReceio || (s.condicoes_coleta?.sinais_inibicao?.length ?? 0) > 0;
}

/**
 * Linhas "Limitações da avaliação" do setor: um item por fator N/I, com o
 * motivo. `rotuloFator` traduz a chave do fator para o nome do fator.
 */
export function limitacoesDaAvaliacao(s: SetorColeta, rotuloFator: (k: string) => string): string[] {
  return Object.entries(checklistOrg(s))
    .filter(([, v]) => v === "nao_identificado")
    .map(([k]) => {
      const m = s.motivo_ni?.[k];
      const motivo = m?.motivo === "outro" ? (m.texto ?? "").trim() || "Outro" : (m?.motivo && rotuloMotivo(m.motivo)) || "motivo não informado";
      const extra = m?.motivo && m.motivo !== "outro" && (m.texto ?? "").trim() ? ` (${(m.texto ?? "").trim()})` : "";
      return `${rotuloFator(k)}: não identificável — ${motivo}${extra}`;
    });
}

/**
 * Frase agregada das condições da coleta para o laudo. Sem nada preenchido,
 * devolve null (a linha não aparece).
 */
export function fraseCondicoesColeta(c: CondicoesColeta | null | undefined): string | null {
  if (!c) return null;
  const partes: string[] = [];
  const a = c.trab_abordados;
  const p = c.trab_participantes;
  if (typeof a === "number" && a > 0) {
    partes.push(
      typeof p === "number"
        ? `Foram abordados ${a} trabalhador${a === 1 ? "" : "es"}, dos quais ${p} participa${p === 1 ? "ou" : "ram"} da coleta`
        : `Foram abordados ${a} trabalhador${a === 1 ? "" : "es"}`,
    );
  } else if (typeof p === "number" && p > 0) {
    partes.push(`Participaram da coleta ${p} trabalhador${p === 1 ? "" : "es"}`);
  }
  const r = c.recusas_evasivas;
  if (typeof r === "number" && r > 0) {
    partes.push(`${r} recusa${r === 1 ? "" : "s"} ou resposta${r === 1 ? "" : "s"} evasiva${r === 1 ? "" : "s"}`);
  }
  if (c.lideranca_presente === true) partes.push("a coleta ocorreu com a liderança presente");

  const frases: string[] = [];
  if (partes.length) {
    const [primeira, ...resto] = partes;
    frases.push(`${resto.length ? `${primeira}; ${resto.join("; ")}` : primeira}.`);
  }
  if ((c.sinais_inibicao?.length ?? 0) > 0) {
    const sinais = SINAIS_INIBICAO.filter((s) => c.sinais_inibicao!.includes(s.key)).map((s) => s.label.toLowerCase());
    frases.push(
      `Durante a coleta, observou-se receio dos trabalhadores em se manifestar${
        c.lideranca_presente ? " na presença da liderança" : ""
      } (${sinais.join("; ")}).`,
    );
  }
  if ((c.obs_coleta ?? "").trim()) frases.push((c.obs_coleta ?? "").trim());
  return frases.length ? frases.join(" ") : null;
}
