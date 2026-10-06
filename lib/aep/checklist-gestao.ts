import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/**
 * Checklist de gestão da AEP (Fase 2, 2026-10-06; Anexo C do plano).
 *
 * Respondido UMA VEZ por AEP (vale para todos os setores), com o gestor/RH,
 * por observação ou por documento — não depende dos trabalhadores nem de a
 * empresa repassar indicadores. Gestor que afirma que existe mas não mostra
 * comprovação = `existe_sem_evidencia`.
 *
 * Regras:
 *   • `nao_existe` e `existe_sem_evidencia` = FONTE GERADORA presente para os
 *     fatores mapeados (lacuna de gestão);
 *   • `existe_evidenciado` = MEDIDA DE CONTROLE existente para esses fatores;
 *   • não altera a probabilidade AIHA: alimenta fontes geradoras, medidas de
 *     controle existentes, confiança da evidência (conta como origem
 *     "documental") e a IA.
 *
 * Gravado em `aep_relatorios.checklist_gestao` (jsonb, v272).
 * ⚠️ `codigo` (G01…) fica gravado: mudar `label` é livre, mudar código não.
 */

export type FatorOrg = keyof AepChecklistOrganizacional;

export type RespostaGestao = "existe_evidenciado" | "existe_sem_evidencia" | "nao_existe" | "na";
export type OrigemGestao = "documento" | "entrevista_gestor" | "observacao";

export const RESPOSTAS_GESTAO: { key: RespostaGestao; label: string; curto: string }[] = [
  { key: "existe_evidenciado", label: "Existe e foi evidenciado", curto: "Evidenciado" },
  { key: "existe_sem_evidencia", label: "Existe, mas sem evidência", curto: "Sem evidência" },
  { key: "nao_existe", label: "Não existe", curto: "Não existe" },
  { key: "na", label: "Não se aplica", curto: "N/A" },
];

export const ORIGENS_GESTAO: { key: OrigemGestao; label: string }[] = [
  { key: "documento", label: "Documento" },
  { key: "entrevista_gestor", label: "Entrevista com gestor/RH" },
  { key: "observacao", label: "Observação" },
];

export interface ItemGestao {
  codigo: string;
  label: string;
  fatores: FatorOrg[];
}

// Anexo C. Os números de fator do anexo (1…13) seguem a ordem dos 13 fatores
// do sistema (assedio = 1 … trabalho_remoto = 13).
export const ITENS_GESTAO: ItemGestao[] = [
  { codigo: "G01", label: "Política de prevenção e enfrentamento ao assédio e demais formas de violência", fatores: ["assedio"] },
  { codigo: "G02", label: "Canal de denúncia com sigilo e garantia de não retaliação", fatores: ["assedio", "justica_organizacional", "maus_relacionamentos"] },
  { codigo: "G03", label: "Procedimento de apuração de denúncias e aplicação de medidas", fatores: ["assedio", "justica_organizacional"] },
  { codigo: "G04", label: "Capacitação das lideranças em gestão de pessoas, feedback e comunicação", fatores: ["assedio", "falta_suporte", "baixo_controle", "justica_organizacional", "maus_relacionamentos"] },
  { codigo: "G05", label: "Código de conduta ou normas de convivência", fatores: ["assedio", "maus_relacionamentos"] },
  { codigo: "G06", label: "Rotina de acompanhamento líder–liderado (reuniões, conversas individuais)", fatores: ["falta_suporte", "recompensas"] },
  { codigo: "G07", label: "Programa de integração e acompanhamento de novos colaboradores", fatores: ["falta_suporte", "clareza_papel"] },
  { codigo: "G08", label: "Procedimento formal de gestão de mudanças", fatores: ["gestao_mudancas"] },
  { codigo: "G09", label: "Descrição formal de cargos entregue aos trabalhadores", fatores: ["clareza_papel"] },
  { codigo: "G10", label: "Organograma definido e divulgado", fatores: ["clareza_papel", "comunicacao_dificil"] },
  { codigo: "G11", label: "POPs/ITs das atividades", fatores: ["clareza_papel", "comunicacao_dificil"] },
  { codigo: "G12", label: "Plano de cargos, carreira e salários", fatores: ["recompensas"] },
  { codigo: "G13", label: "Avaliação de desempenho com feedback periódico", fatores: ["recompensas"] },
  { codigo: "G14", label: "Programa ou práticas de reconhecimento", fatores: ["recompensas"] },
  { codigo: "G15", label: "Alçadas de decisão e delegação definidas", fatores: ["baixo_controle"] },
  { codigo: "G16", label: "Critérios formais e divulgados para escalas, folgas, tarefas, promoções e punições", fatores: ["justica_organizacional"] },
  { codigo: "G17", label: "Procedimento de gestão de conflitos", fatores: ["justica_organizacional", "maus_relacionamentos"] },
  { codigo: "G18", label: "Protocolo de segurança e resposta a incidentes de violência", fatores: ["eventos_traumaticos"] },
  { codigo: "G19", label: "Treinamento em manejo de conflitos e situações de risco", fatores: ["eventos_traumaticos"] },
  { codigo: "G20", label: "Suporte psicológico ou programa de apoio ao trabalhador", fatores: ["eventos_traumaticos"] },
  { codigo: "G21", label: "Planejamento e distribuição de demandas / dimensionamento do quadro revisado", fatores: ["subcarga", "sobrecarga"] },
  { codigo: "G22", label: "Plano de cobertura de ausências (férias, afastamentos)", fatores: ["sobrecarga"] },
  { codigo: "G23", label: "Controle de jornada e de horas extras habituais", fatores: ["sobrecarga"] },
  { codigo: "G24", label: "Canais formais de comunicação e registro de passagem de turno", fatores: ["comunicacao_dificil"] },
  { codigo: "G25", label: "Política de teletrabalho com direito à desconexão", fatores: ["trabalho_remoto"] },
  { codigo: "G26", label: "Sistema de comunicação/monitoramento e protocolo de emergência para trabalho isolado", fatores: ["trabalho_remoto"] },
];

export interface RespostaItemGestao {
  resposta: RespostaGestao | "";
  origem?: OrigemGestao | "";
  /** Nome do documento, data, responsável… */
  evidencia?: string;
}

export interface ChecklistGestao {
  itens?: Record<string, RespostaItemGestao>;
  /** Com quem/como foi respondido (gestor, RH…). */
  respondido_com?: string;
  atualizado_em?: string | null;
  atualizado_por?: string | null;
}

export function normalizarChecklistGestao(raw: unknown): ChecklistGestao {
  if (typeof raw !== "object" || raw === null) return { itens: {} };
  const r = raw as Record<string, unknown>;
  const itens: Record<string, RespostaItemGestao> = {};
  if (typeof r.itens === "object" && r.itens !== null) {
    for (const [cod, v] of Object.entries(r.itens as Record<string, unknown>)) {
      if (!ITENS_GESTAO.some((i) => i.codigo === cod) || typeof v !== "object" || v === null) continue;
      const x = v as Record<string, unknown>;
      itens[cod] = {
        resposta: RESPOSTAS_GESTAO.some((o) => o.key === x.resposta) ? (x.resposta as RespostaGestao) : "",
        origem: ORIGENS_GESTAO.some((o) => o.key === x.origem) ? (x.origem as OrigemGestao) : "",
        evidencia: typeof x.evidencia === "string" ? x.evidencia : "",
      };
    }
  }
  return {
    itens,
    respondido_com: typeof r.respondido_com === "string" ? r.respondido_com : "",
    atualizado_em: typeof r.atualizado_em === "string" ? r.atualizado_em : null,
    atualizado_por: typeof r.atualizado_por === "string" ? r.atualizado_por : null,
  };
}

/** Itens do checklist mapeados ao fator. */
export const itensDoFator = (fator: string) => ITENS_GESTAO.filter((i) => i.fatores.includes(fator as FatorOrg));

/** Lacunas de gestão do fator: não existe / existe sem evidência = fonte geradora presente. */
export function lacunasDoFator(g: ChecklistGestao | null | undefined, fator: string): (ItemGestao & { resposta: RespostaGestao })[] {
  return itensDoFator(fator)
    .map((i) => ({ ...i, resposta: g?.itens?.[i.codigo]?.resposta ?? "" }))
    .filter((i): i is ItemGestao & { resposta: RespostaGestao } => i.resposta === "nao_existe" || i.resposta === "existe_sem_evidencia");
}

/** Medidas de controle existentes do fator: itens evidenciados. */
export function medidasExistentesDoFator(g: ChecklistGestao | null | undefined, fator: string): ItemGestao[] {
  return itensDoFator(fator).filter((i) => g?.itens?.[i.codigo]?.resposta === "existe_evidenciado");
}

export const SEM_MEDIDAS = "Não evidenciadas medidas de controle específicas";

/** Texto de uma lacuna para laudo/inventário: "G01 — Política… (não existe)". */
export function rotuloLacuna(i: ItemGestao & { resposta: RespostaGestao }): string {
  return `${i.codigo} — ${i.label} (${i.resposta === "nao_existe" ? "não existe" : "existe, sem evidência"})`;
}

/** Quantos itens já foram respondidos. */
export function respondidosGestao(g: ChecklistGestao | null | undefined): number {
  return Object.values(g?.itens ?? {}).filter((x) => x?.resposta).length;
}
