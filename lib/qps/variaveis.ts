// Variáveis {{chave}} dos capítulos de Texto Padrão do laudo da QAP (v226).
// Base comum da empresa (`montarValoresEmpresa`) + o que a aplicação tem.
// Toda chave resolve (string vazia quando não há dado) — nunca vaza o token.

import type { Empresa, QpsAplicacao } from "@/lib/supabase/types";
import { montarValoresEmpresa, type ValoresDocExtras } from "@/lib/textos-padrao/variaveis";
import { formatarDataBR } from "@/lib/textos-padrao/formatters";

export function montarValoresVariaveisQps(args: {
  empresa: Empresa | null | undefined;
  aplicacao: QpsAplicacao | null | undefined;
  tipoNome?: string | null;
  totalRespondentes?: number;
  extras?: ValoresDocExtras;
}): Record<string, string> {
  const { empresa, aplicacao: ap, extras } = args;
  const crp = (ap?.crp ?? "").trim();
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
    periodo_inicio: formatarDataBR(ap?.periodo_inicio),
    periodo_fim: formatarDataBR(ap?.periodo_fim),
    registro_profissional: extras?.registro_profissional ?? (crp ? `CRP ${crp}` : ""),
    unidade: extras?.unidade ?? ap?.unidade_cliente ?? "",
  };
}
