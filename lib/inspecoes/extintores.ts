// Conformidade de extintores (NR-23) — fonte única para o formulário, a aba do
// editor e o relatório.
//
// Até a v158 existia um campo só, `status`, de texto livre, que misturava
// conformidade ("Adequado") com não conformidade ("Vencido"). Um extintor
// vencido E com sinalização inadequada obrigava a escolher um dos dois. Agora
// são duas coisas: `situacao` e a lista `nao_conformidades`.

export type SituacaoExtintor = "CONFORME" | "NAO_CONFORME";

export const SITUACAO_EXTINTOR_LABELS: Record<SituacaoExtintor, string> = {
  CONFORME: "Conforme",
  NAO_CONFORME: "Não conforme",
};

/** Rótulo do estado, incluindo o caso "nunca avaliado" (situacao null). */
export function rotuloSituacao(situacao: string | null | undefined): string {
  if (situacao === "CONFORME" || situacao === "NAO_CONFORME") {
    return SITUACAO_EXTINTOR_LABELS[situacao];
  }
  return "Não avaliado";
}

/**
 * Causas sugeridas. `critico` mantém a régua que o painel já usava antes da
 * v158: vencido, danificado e lacre violado destacavam em vermelho; a vencer e
 * sinalização inadequada, em âmbar. A lista é sugestão — o técnico pode digitar
 * uma causa que não esteja aqui, e ela é preservada.
 */
export const NAO_CONFORMIDADES_EXTINTOR: { valor: string; critico: boolean }[] = [
  { valor: "Vencido", critico: true },
  { valor: "Danificado", critico: true },
  { valor: "Lacre violado", critico: true },
  { valor: "Sinalização inadequada", critico: false },
  { valor: "A vencer (próx. 3 meses)", critico: false },
  { valor: "Obstruído / sem acesso", critico: true },
  { valor: "Fora da altura de instalação", critico: false },
  { valor: "Sem inspeção periódica registrada", critico: false },
];

const CRITICAS = new Set(
  NAO_CONFORMIDADES_EXTINTOR.filter((n) => n.critico).map((n) => n.valor),
);

/** Uma causa desconhecida (digitada pelo técnico) NÃO é tratada como crítica. */
export function causaCritica(causa: string): boolean {
  return CRITICAS.has(causa.trim());
}

/** O extintor tem ao menos uma causa crítica? Governa o destaque vermelho. */
export function extintorCritico(
  situacao: string | null | undefined,
  causas: string[] | null | undefined,
): boolean {
  if (situacao !== "NAO_CONFORME") return false;
  return (causas ?? []).some(causaCritica);
}

/** Classe do badge: verde conforme, vermelho crítico, âmbar demais, cinza n/a. */
export function corSituacaoExtintor(
  situacao: string | null | undefined,
  causas: string[] | null | undefined,
): string {
  if (situacao === "CONFORME") {
    return "border-green-200 bg-green-50 text-green-800";
  }
  if (situacao === "NAO_CONFORME") {
    return extintorCritico(situacao, causas)
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-gray-200 bg-gray-50 text-gray-600";
}
