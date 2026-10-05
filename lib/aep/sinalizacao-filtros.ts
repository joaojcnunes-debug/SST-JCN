// Filtros da lista da Sinalização Psicossocial (2026-10-05). Puro, para testar
// sem tela: recebe as empresas montadas por `montarSinalizacao` e a situação do
// DRPS/Questionário de cada uma (`useSituacaoQuestionarioEmpresas`).

import { leituraQuestionario, type EmpresaSinalizada, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";

export type FiltroQuestionario = "" | "necessario" | "pendente" | "nao";
export type FiltroSimNao = "" | "sim" | "nao";
export type FiltroEntrega = "" | "com" | "sem";

export interface FiltrosSinalizacao {
  unidade: string; // id_unidade; "" = todas
  nivel: string; // nível AIHA mais grave; "altos" = Alto ou Muito Alto
  questionario: FiltroQuestionario;
  aet: FiltroSimNao;
  entrega: FiltroEntrega;
  realizadaPor: string;
  enviadaPor: string;
}

export const FILTROS_VAZIOS: FiltrosSinalizacao = {
  unidade: "",
  nivel: "",
  questionario: "",
  aet: "",
  entrega: "",
  realizadaPor: "",
  enviadaPor: "",
};

export function filtrosAtivos(f: FiltrosSinalizacao): number {
  return Object.values(f).filter(Boolean).length;
}

/**
 * Pendência de DRPS/Questionário: a AEP recomenda e ainda não está atendido —
 * nenhum feito, só em andamento, ou concluído ANTES da AEP (revisão).
 */
export function questionarioPendente(e: EmpresaSinalizada, s: SituacaoQuestionario | undefined): boolean {
  return leituraQuestionario(e.precisaQuestionario, s, e.ultimaData).pendente;
}

export function filtrarSinalizacao(
  empresas: EmpresaSinalizada[],
  f: FiltrosSinalizacao,
  questionarios: Record<string, SituacaoQuestionario> | undefined,
): EmpresaSinalizada[] {
  return empresas.filter((e) => {
    if (f.unidade && e.idUnidade !== f.unidade) return false;
    if (f.nivel === "altos") {
      if (e.pior !== "Alto" && e.pior !== "Muito Alto") return false;
    } else if (f.nivel && e.pior !== f.nivel) return false;
    if (f.questionario === "necessario" && !e.precisaQuestionario) return false;
    if (f.questionario === "nao" && e.precisaQuestionario) return false;
    if (f.questionario === "pendente" && !questionarioPendente(e, questionarios?.[e.idEmpresa])) return false;
    if (f.aet === "sim" && !e.precisaAet) return false;
    if (f.aet === "nao" && e.precisaAet) return false;
    if (f.entrega === "com" && !e.temInspecao) return false;
    if (f.entrega === "sem" && e.temInspecao) return false;
    if (f.realizadaPor && e.realizadaPor !== f.realizadaPor) return false;
    if (f.enviadaPor && e.enviadoPor !== f.enviadaPor) return false;
    return true;
  });
}

/** Nomes distintos (sem vazios), em ordem alfabética — para as listas dos filtros. */
export function opcoesDistintas(valores: (string | null | undefined)[]): string[] {
  return [...new Set(valores.map((v) => v?.trim()).filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}
