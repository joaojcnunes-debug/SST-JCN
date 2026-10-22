// Variáveis {{chave}} dos capítulos de Texto Padrão do laudo da QAP (v226).
// Base comum da empresa (`montarValoresEmpresa`) + o que a aplicação tem.
// Toda chave resolve (string vazia quando não há dado) — nunca vaza o token.

import type { Empresa, QpsAplicacao } from "@/lib/supabase/types";
import { montarValoresEmpresa, type ValoresDocExtras } from "@/lib/textos-padrao/variaveis";
import { formatarDataBR } from "@/lib/textos-padrao/formatters";

/**
 * Período da coleta como o laudo imprime (v263). Vale o que a equipe digitou
 * na aplicação (Período Início/Fim); o que faltar sai das respostas — a menor e
 * a maior data do "Carimbo de data/hora" do Forms, como no DRPS. Importação
 * antiga não tem o carimbo: aí só o digitado resolve.
 */
export function periodoDaColeta(
  ap: Pick<QpsAplicacao, "periodo_inicio" | "periodo_fim"> | null | undefined,
  carimbos: (string | null | undefined)[] = [],
): { inicio: string | null; fim: string | null } {
  const ms = carimbos
    .map((c) => (c ? new Date(c).getTime() : NaN))
    .filter((n) => !Number.isNaN(n));
  // Dia civil em Brasília: o carimbo das 22h do dia 10 é 01h UTC do dia 11.
  const dia = (n: number) =>
    new Date(n).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return {
    inicio: ap?.periodo_inicio ?? (ms.length ? dia(Math.min(...ms)) : null),
    fim: ap?.periodo_fim ?? (ms.length ? dia(Math.max(...ms)) : null),
  };
}

export function montarValoresVariaveisQps(args: {
  empresa: Empresa | null | undefined;
  aplicacao: QpsAplicacao | null | undefined;
  tipoNome?: string | null;
  totalRespondentes?: number;
  /** `data_carimbo` dos respondentes — completa o período que não foi digitado. */
  carimbos?: (string | null | undefined)[];
  extras?: ValoresDocExtras;
}): Record<string, string> {
  const { empresa, aplicacao: ap, extras } = args;
  const crp = (ap?.crp ?? "").trim();
  const periodo = periodoDaColeta(ap, args.carimbos);
  return {
    ...montarValoresEmpresa(empresa, extras),
    titulo_aplicacao: ap?.titulo ?? "",
    tipo_questionario: args.tipoNome ?? "",
    unidade_cliente: ap?.unidade_cliente ?? "",
    total_respondentes: args.totalRespondentes != null ? String(args.totalRespondentes) : "",
    responsavel_tecnico: ap?.responsavel ?? "",
    crp,
    carimbo: [ap?.responsavel, crp ? `CRP ${crp}` : ""].filter(Boolean).join("\n"),
    data_elaboracao: formatarDataBR(ap?.data_elaboracao),
    data_conclusao: formatarDataBR(ap?.data_conclusao),
    periodo_inicio: formatarDataBR(periodo.inicio),
    periodo_fim: formatarDataBR(periodo.fim),
    registro_profissional: extras?.registro_profissional ?? (crp ? `CRP ${crp}` : ""),
    unidade: extras?.unidade ?? ap?.unidade_cliente ?? "",
  };
}
