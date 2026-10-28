/**
 * Prioridade, prazo e tempo de espera das inspeções (v306, 28/10/2026).
 *
 * Quem DECIDE é o banco: colunas calculadas `prioridade_auto`, `prioridade_efetiva` e
 * `dias_espera` (supabase/historico/v306_*), que a lista filtra e ordena. Este arquivo espelha os
 * mesmos limites para a tela EXPLICAR o porquê ("prazo vencido há 2 dias", "aguardando há 32
 * dias") e para os rótulos e cores. Mudou um limite? Muda nos dois lugares.
 *
 * - Espera: inspeção aberta (rascunho/em andamento) conta desde a visita; concluída com documento
 *   ainda não entregue conta desde a conclusão. Entregue = não espera.
 * - Automática: URGENTE (prazo vencido, documento vencido ou espera > 45 d) · ALTA (prazo em até
 *   3 d, validade em até 30 d ou espera > 30 d) · MÉDIA (prazo em até 7 d ou espera > 15 d) · BAIXA.
 * - Efetiva: a maior entre a manual (supervisor) e a automática — o automático só sobe.
 */

export type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export const PRIORIDADES: Prioridade[] = ["URGENTE", "ALTA", "MEDIA", "BAIXA"];

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = { URGENTE: "Urgente", ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };

export const COR_PRIORIDADE: Record<Prioridade, string> = {
  URGENTE: "bg-red-100 text-red-800 ring-red-200",
  ALTA: "bg-orange-100 text-orange-800 ring-orange-200",
  MEDIA: "bg-amber-50 text-amber-800 ring-amber-200",
  BAIXA: "bg-gray-100 text-gray-600 ring-gray-200",
};

export const LIMITES = {
  esperaUrgente: 45,
  esperaAlta: 30,
  esperaMedia: 15,
  prazoAlta: 3,
  prazoMedia: 7,
  validadeAlta: 30,
} as const;

const PESO: Record<Prioridade, number> = { BAIXA: 1, MEDIA: 2, ALTA: 3, URGENTE: 4 };
export const pesoPrioridade = (p: string | null | undefined) => (p && p in PESO ? PESO[p as Prioridade] : 0);

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

export interface LinhaPrioridade {
  prioridade?: string | null;
  prazo?: string | null;
  data_validade?: string | null;
  dias_espera?: number | null;
  prioridade_auto?: string | null;
  prioridade_efetiva?: string | null;
}

/**
 * Os motivos da prioridade, na ordem em que pesam — o texto do selo. Usa os mesmos limites do
 * banco; a prioridade em si vem pronta de `prioridade_efetiva`.
 */
export function motivosPrioridade(l: LinhaPrioridade, hoje = hojeSP()): string[] {
  const m: string[] = [];
  if (l.prioridade) m.push(`Marcada como ${ROTULO_PRIORIDADE[l.prioridade as Prioridade] ?? l.prioridade} pelo supervisor`);
  const espera = l.dias_espera;
  if (espera == null) return m; // nada esperando: só a marca manual, se houver
  if (l.prazo) {
    const d = diasEntre(hoje, l.prazo);
    if (d < 0) m.push(`Prazo vencido há ${-d} dia${-d === 1 ? "" : "s"}`);
    else if (d === 0) m.push("Prazo vence hoje");
    else if (d <= LIMITES.prazoMedia) m.push(`Prazo em ${d} dia${d === 1 ? "" : "s"}`);
  }
  if (l.data_validade) {
    const d = diasEntre(hoje, l.data_validade);
    if (d < 0) m.push(`Documento vencido há ${-d} dia${-d === 1 ? "" : "s"}`);
    else if (d <= LIMITES.validadeAlta) m.push(`Documento vence em ${d} dia${d === 1 ? "" : "s"}`);
  }
  if (espera > LIMITES.esperaMedia) m.push(`Aguardando há ${espera} dias`);
  return m;
}

/** "Aberta há 12 dias" / "Documento aguardando há 5 dias" / null. */
export function textoEspera(status: string, diasEspera: number | null | undefined): string | null {
  if (diasEspera == null) return null;
  const n = `${diasEspera} dia${diasEspera === 1 ? "" : "s"}`;
  if (status === "CONCLUIDA") return diasEspera === 0 ? "Documento aguardando desde hoje" : `Documento aguardando há ${n}`;
  return diasEspera === 0 ? "Aberta hoje" : `Aberta há ${n}`;
}
