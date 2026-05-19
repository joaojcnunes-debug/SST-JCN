// Painel de Gestão DRPS — resumo consolidado das 3 frentes (Medidas, Monitoramento, Revisão).
// Centraliza constantes (ACOES_OBRIGATORIAS, EQUIPE_REVISAO) usadas em vários lugares
// e oferece uma função pura `calcularResumoGestao` que devolve os indicadores.

import { MEDIDAS_CONTROLE } from "@/lib/drps/topicos";
import type {
  DrpsMonitoramento,
  DrpsPlanoMedidas,
  DrpsRevisao,
  StatusMonitoramento,
} from "@/lib/drps/types";

export interface AcaoRevisao {
  id: string;
  texto: string;
}

export const ACOES_OBRIGATORIAS: AcaoRevisao[] = [
  {
    id: "reuniao_mensal",
    texto:
      "Reunião mensal com gestão e RH para análise dos indicadores psicossociais",
  },
  {
    id: "reaplicar_drps",
    texto: "Reaplicação do DRPS (conforme prazo definido no monitoramento)",
  },
  {
    id: "auditoria_interna",
    texto: "Auditoria interna do sistema de gestão psicossocial",
  },
  {
    id: "treinamento_lideres",
    texto:
      "Treinamento de líderes, gestores e RH sobre saúde mental no trabalho",
  },
  {
    id: "atualizar_pgr",
    texto: "Atualização do inventário de riscos psicossociais no PGR",
  },
];

export const EQUIPE_REVISAO: AcaoRevisao[] = [
  { id: "tst", texto: "Técnico de Segurança do Trabalho (TST)" },
  { id: "engseg", texto: "Engenheiro de Segurança" },
  { id: "medtrab", texto: "Médico do Trabalho" },
  { id: "enftrab", texto: "Enfermagem do Trabalho" },
  { id: "rh", texto: "Recursos Humanos (RH)" },
  { id: "compras", texto: "Compras (para recursos de programas)" },
  { id: "cipa", texto: "CIPA" },
  { id: "sipat", texto: "SIPAT" },
  { id: "ergonomista", texto: "Ergonomista" },
];

export interface ResumoMedidas {
  totalCatalogadas: number;
  totalConfiguradas: number;
  totalMarcacoes: number;
  acoesNoMesAtual: number;
  percentual: number;
}

export interface ResumoMonitoramento {
  total: number;
  pendentes: number;
  emAndamento: number;
  concluidos: number;
  cancelados: number;
  proximaAvaliacao: string | null;
  percentual: number;
}

export interface ResumoRevisao {
  checklistMarcados: number;
  checklistTotal: number;
  equipeMarcados: number;
  equipeTotal: number;
  ultimaEdicao: string | null;
  temAnotacoes: boolean;
  percentual: number;
}

export interface ResumoGestao {
  medidas: ResumoMedidas;
  monitoramento: ResumoMonitoramento;
  revisao: ResumoRevisao;
  /** Média ponderada (1/3 cada). 0-100. */
  saudeGeral: number;
}

/**
 * Calcula os 3 resumos + saúde geral do diagnóstico.
 * Aceita dados crus do Supabase (planoDB / monitoramentos / revisaoDB) — todos opcionais.
 */
export function calcularResumoGestao(args: {
  planoDB?: DrpsPlanoMedidas | null;
  monitoramentos?: DrpsMonitoramento[];
  revisaoDB?: DrpsRevisao | null;
  /** Mês corrente (0=Jan, 11=Dez). Default: agora. */
  mesAtual?: number;
}): ResumoGestao {
  const mesAtual = args.mesAtual ?? new Date().getMonth();

  // ---------- MEDIDAS ----------
  const plano = args.planoDB?.plano ?? {};
  const planoEntries = Object.entries(plano);
  const totalConfiguradas = planoEntries.filter(
    ([, p]) => p.meses.some((m) => m) || (p.responsavel ?? "").trim().length > 0
  ).length;
  const totalMarcacoes = planoEntries.reduce(
    (s, [, p]) => s + p.meses.filter(Boolean).length,
    0
  );
  const acoesNoMesAtual = planoEntries.filter(
    ([, p]) => p.meses[mesAtual]
  ).length;
  const totalCatalogadas = MEDIDAS_CONTROLE.length;
  const percMedidas =
    totalCatalogadas > 0
      ? Math.round((totalConfiguradas / totalCatalogadas) * 100)
      : 0;

  // ---------- MONITORAMENTO ----------
  const mons = args.monitoramentos ?? [];
  const contagens: Record<StatusMonitoramento, number> = {
    Pendente: 0,
    "Em Andamento": 0,
    Concluido: 0,
    Cancelado: 0,
  };
  for (const m of mons) {
    contagens[m.status as StatusMonitoramento] =
      (contagens[m.status as StatusMonitoramento] ?? 0) + 1;
  }
  const totalMon = mons.length;
  // Próxima avaliação futura (mínima data >= hoje)
  const hojeIso = new Date().toISOString().slice(0, 10);
  const proximas = mons
    .map((m) => m.proxima_avaliacao)
    .filter((d): d is string => !!d && d >= hojeIso)
    .sort();
  const proximaAvaliacao = proximas[0] ?? null;
  // % do monitoramento = concluído conta 100%, em andamento 50%, pendente/cancelado 0%
  const percMon =
    totalMon > 0
      ? Math.round(
          ((contagens.Concluido + 0.5 * contagens["Em Andamento"]) /
            totalMon) *
            100
        )
      : 0;

  // ---------- REVISÃO ----------
  const checklist = (args.revisaoDB?.checklist as Record<string, boolean>) ?? {};
  const equipe = (args.revisaoDB?.equipe as Record<string, boolean>) ?? {};
  const checklistTotal = ACOES_OBRIGATORIAS.length;
  const checklistMarcados = ACOES_OBRIGATORIAS.filter(
    (a) => !!checklist[a.id]
  ).length;
  const equipeTotal = EQUIPE_REVISAO.length;
  const equipeMarcados = EQUIPE_REVISAO.filter((e) => !!equipe[e.id]).length;
  const percRev =
    checklistTotal + equipeTotal > 0
      ? Math.round(
          ((checklistMarcados + equipeMarcados) /
            (checklistTotal + equipeTotal)) *
            100
        )
      : 0;

  // ---------- SAÚDE GERAL ----------
  const saudeGeral = Math.round((percMedidas + percMon + percRev) / 3);

  return {
    medidas: {
      totalCatalogadas,
      totalConfiguradas,
      totalMarcacoes,
      acoesNoMesAtual,
      percentual: percMedidas,
    },
    monitoramento: {
      total: totalMon,
      pendentes: contagens.Pendente,
      emAndamento: contagens["Em Andamento"],
      concluidos: contagens.Concluido,
      cancelados: contagens.Cancelado,
      proximaAvaliacao,
      percentual: percMon,
    },
    revisao: {
      checklistMarcados,
      checklistTotal,
      equipeMarcados,
      equipeTotal,
      ultimaEdicao: args.revisaoDB?.updated_at ?? null,
      temAnotacoes: !!(args.revisaoDB?.anotacoes ?? "").trim(),
      percentual: percRev,
    },
    saudeGeral,
  };
}

/** Cor pra usar em barras/badges conforme % (0-100). */
export function corPercentual(p: number): string {
  if (p >= 75) return "#16a34a"; // verde
  if (p >= 50) return "#65a30d"; // verde-amarelado
  if (p >= 25) return "#d97706"; // âmbar
  return "#dc2626"; // vermelho
}

export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}
