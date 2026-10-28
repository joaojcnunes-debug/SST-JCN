/**
 * Prioridade da inspeção (v308, pedido de 22/10).
 *
 * Marcada DENTRO da inspeção (cabeçalho, ao lado de "Liberar para o
 * Comercial"); a lista de Inspeções só mostra e filtra. Nula = sem prioridade.
 * Os valores são os mesmos do CHECK do banco (inspecoes_prioridade_check).
 */

export type PrioridadeInspecao = "BAIXA" | "MEDIA" | "GRAVE" | "CRITICA";

/** Da mais leve para a mais séria — é a ordem do seletor e do filtro. */
export const PRIORIDADES: readonly PrioridadeInspecao[] = ["BAIXA", "MEDIA", "GRAVE", "CRITICA"];

export const PRIORIDADE_INFO: Record<PrioridadeInspecao, { label: string; classe: string }> = {
  BAIXA: { label: "Baixa", classe: "bg-gray-100 text-gray-700 border-gray-200" },
  MEDIA: { label: "Média", classe: "bg-amber-50 text-amber-800 border-amber-200" },
  // 22/10: o rótulo virou "Urgente" (pedido dele); o valor no banco segue GRAVE.
  GRAVE: { label: "Urgente", classe: "bg-orange-100 text-orange-800 border-orange-200" },
  CRITICA: { label: "Crítica", classe: "bg-red-100 text-red-800 border-red-200" },
};

/** Filtro da lista: uma prioridade, "SEM" (nula) ou "" (todas). */
export type FiltroPrioridade = PrioridadeInspecao | "SEM" | "";

export function ehPrioridade(v: unknown): v is PrioridadeInspecao {
  return typeof v === "string" && (PRIORIDADES as readonly string[]).includes(v);
}

// ── Espera, prazo e prioridade calculada (v318 no painel; v307 no JCN — 28/10/2026) ──────────
//
// Quem DECIDE é o banco: colunas calculadas `prioridade_auto`, `prioridade_efetiva` e
// `dias_espera`, que a lista filtra e ordena. Aqui ficam os mesmos limites, para a tela EXPLICAR
// o porquê ("prazo vencido há 2 dias", "aguardando há 32 dias"). Mudou um limite? Muda nos dois.
//
// - Espera: inspeção aberta (rascunho/em andamento) conta desde a visita; concluída com documento
//   ainda não entregue conta desde a conclusão. Entregue = não espera.
// - Calculada: CRÍTICA (prazo vencido, documento vencido ou espera > 45 d) · URGENTE/GRAVE (prazo
//   em até 3 d, validade em até 30 d ou espera > 30 d) · MÉDIA (prazo em até 7 d ou espera > 15 d) ·
//   BAIXA. Só existe enquanto algo espera.
// - Efetiva: a maior entre a marcada na lista e a calculada — a calculada só sobe a marcada.

/** Da mais séria para a mais leve — a ordem das pílulas e dos cartões. */
export const PRIORIDADES_DESC: readonly PrioridadeInspecao[] = ["CRITICA", "GRAVE", "MEDIA", "BAIXA"];

export const LIMITES = {
  esperaCritica: 45,
  esperaUrgente: 30,
  esperaMedia: 15,
  prazoUrgente: 3,
  prazoMedia: 7,
  validadeUrgente: 30,
} as const;

const PESO: Record<PrioridadeInspecao, number> = { BAIXA: 1, MEDIA: 2, GRAVE: 3, CRITICA: 4 };
export const pesoPrioridade = (p: string | null | undefined) => (ehPrioridade(p) ? PESO[p] : 0);

/** "AAAA-MM-DD" de hoje em São Paulo. */
export function hojeSP(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/** Dias de `de` até `ate` (datas "AAAA-MM-DD"); negativo se `ate` vem antes. */
export function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.slice(0, 10).split("-").map(Number);
  const [a2, m2, d2] = ate.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

export interface LinhaPrioridadeCalculada {
  prioridade?: string | null;
  prazo?: string | null;
  data_validade?: string | null;
  dias_espera?: number | null;
  prioridade_auto?: string | null;
  prioridade_efetiva?: string | null;
}

/** Os motivos da prioridade CALCULADA, na ordem em que pesam — o texto do balão. */
export function motivosPrioridade(l: LinhaPrioridadeCalculada, hoje = hojeSP()): string[] {
  const m: string[] = [];
  const espera = l.dias_espera;
  if (espera == null) return m; // nada esperando: não há prioridade calculada
  if (l.prazo) {
    const d = diasEntre(hoje, l.prazo);
    if (d < 0) m.push(`Prazo vencido há ${-d} dia${-d === 1 ? "" : "s"}`);
    else if (d === 0) m.push("Prazo vence hoje");
    else if (d <= LIMITES.prazoMedia) m.push(`Prazo em ${d} dia${d === 1 ? "" : "s"}`);
  }
  if (l.data_validade) {
    const d = diasEntre(hoje, l.data_validade);
    if (d < 0) m.push(`Documento vencido há ${-d} dia${-d === 1 ? "" : "s"}`);
    else if (d <= LIMITES.validadeUrgente) m.push(`Documento vence em ${d} dia${d === 1 ? "" : "s"}`);
  }
  if (espera > LIMITES.esperaMedia) m.push(`Aguardando há ${espera} dias`);
  return m;
}

/** A calculada passou a marcada? (é quando a tela mostra o selo "calculada" ao lado). */
export function calculadaSobe(l: LinhaPrioridadeCalculada): boolean {
  return pesoPrioridade(l.prioridade_auto) > pesoPrioridade(l.prioridade);
}

/** "Aberta há 12 dias" / "Documento aguardando há 5 dias" / null. */
export function textoEspera(status: string, diasEspera: number | null | undefined): string | null {
  if (diasEspera == null) return null;
  const n = `${diasEspera} dia${diasEspera === 1 ? "" : "s"}`;
  if (status === "CONCLUIDA") return diasEspera === 0 ? "Documento aguardando desde hoje" : `Documento aguardando há ${n}`;
  return diasEspera === 0 ? "Aberta hoje" : `Aberta há ${n}`;
}