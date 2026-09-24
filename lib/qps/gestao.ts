// Gestão do questionário "igual ao DRPS" (v225) — o que as 4 telas (5W2H,
// Medidas, Monitoramento, Revisão) partilham com o DRPS vem de lá
// (`lib/drps/gestao.ts`, `lib/drps/topicos.ts`): catálogos, checklist e equipe
// são os mesmos, de propósito. O que muda aqui é só o NOME do instrumento nos
// textos: o DRPS escreve "DRPS" no corpo de duas frases, e o psicólogo não pode
// ler "reaplicação do DRPS" dentro de uma QAP.

import { ACOES_OBRIGATORIAS, EQUIPE_REVISAO, type AcaoRevisao } from "@/lib/drps/gestao";
import type { NivelMatriz } from "@/lib/drps/types";

/** Sigla e nome do questionário como os textos devem chamá-lo. */
export interface InstrumentoQps {
  sigla: string;
  nome: string;
}

export const INSTRUMENTO_QAP: InstrumentoQps = {
  sigla: "QAP",
  nome: "Questionário de Avaliação Psicossocial",
};

/** Troca a palavra isolada "DRPS" pela sigla do instrumento (só a palavra inteira). */
export function comInstrumento(texto: string, instrumento: InstrumentoQps = INSTRUMENTO_QAP): string {
  return texto.replace(/\bDRPS\b/g, instrumento.sigla);
}

/** Checklist de revisão do DRPS com o nome do instrumento; os ids são os mesmos (o jsonb é compatível). */
export function acoesObrigatoriasQps(instrumento: InstrumentoQps = INSTRUMENTO_QAP): AcaoRevisao[] {
  return ACOES_OBRIGATORIAS.map((a) => ({ ...a, texto: comInstrumento(a.texto, instrumento) }));
}

export { EQUIPE_REVISAO };

/** Cartões de recomendação por nível de risco (os mesmos 4 do Monitoramento do DRPS). */
export function recomendacoesMonitoramento(
  instrumento: InstrumentoQps = INSTRUMENTO_QAP,
): Record<NivelMatriz, { titulo: string; texto: string }> {
  return {
    Baixo: {
      titulo: "🟢 Risco Baixo",
      texto: "Implementar programas prevencionistas. Monitoramento trimestral. Reavaliação em até 12 meses.",
    },
    Médio: {
      titulo: "🟡 Risco Moderado",
      texto: "Implementar programas prevencionistas com reforço. Monitoramento bimestral. Reavaliação em até 9 meses.",
    },
    Alto: {
      titulo: "🔴 Risco Alto",
      texto: "Implementar programas interventivos urgentes. Monitoramento mensal. Reavaliação em até 6 meses.",
    },
    Crítico: {
      titulo: "⚫ Risco Crítico",
      texto: comInstrumento("Programas interventivos imediatos + reavaliação do DRPS em 90 dias.", instrumento),
    },
  };
}

// ── Painel de Gestão (v226) ──────────────────────────────────────────────────
// A conta é a do DRPS (`calcularResumoGestao`); os tipos da QAP têm os mesmos
// campos que ela lê (plano, status, proxima_avaliacao, checklist, equipe,
// anotacoes, updated_at) — o adaptador só troca a chave do registro.

import { calcularResumoGestao, type ResumoGestao } from "@/lib/drps/gestao";
import type { DrpsMonitoramento, DrpsPlanoMedidas, DrpsRevisao } from "@/lib/drps/types";
import type { QpsMonitoramento, QpsPlanoMedidas, QpsRevisao } from "@/lib/supabase/types";

export function resumoGestaoQps(args: {
  planoDB?: QpsPlanoMedidas | null;
  monitoramentos?: QpsMonitoramento[];
  revisaoDB?: QpsRevisao | null;
  mesAtual?: number;
}): ResumoGestao {
  const planoDB: DrpsPlanoMedidas | null = args.planoDB
    ? { id_relatorio: args.planoDB.id_aplicacao, id_empresa: "", ano: args.planoDB.ano, plano: args.planoDB.plano, updated_at: args.planoDB.updated_at }
    : null;
  const monitoramentos: DrpsMonitoramento[] = (args.monitoramentos ?? []).map((m, i) => ({
    id_relatorio: m.id_aplicacao,
    id_empresa: "",
    setor: m.setor,
    topico_idx: i,
    data_intervencao: m.data_intervencao,
    responsavel: m.responsavel,
    status: m.status,
    proxima_avaliacao: m.proxima_avaliacao,
    observacoes: m.observacoes,
    updated_at: m.updated_at,
  }));
  const revisaoDB: DrpsRevisao | null = args.revisaoDB
    ? { id_relatorio: args.revisaoDB.id_aplicacao, id_empresa: "", checklist: args.revisaoDB.checklist, equipe: args.revisaoDB.equipe, anotacoes: args.revisaoDB.anotacoes, updated_at: args.revisaoDB.updated_at }
    : null;
  return calcularResumoGestao({ planoDB, monitoramentos, revisaoDB, mesAtual: args.mesAtual });
}
