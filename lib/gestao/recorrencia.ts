// Recorrência das tarefas da Gestão: quando cai a próxima cópia (`proxima_geracao`).
// A rotina diária (gestao_cron_diario, 7h) cria uma cópia para cada data <= hoje e avança a data.

export type TipoRecorrencia = "diaria" | "semanal" | "mensal";
export interface Recorrencia { tipo: TipoRecorrencia; intervalo: number; proxima_geracao: string }

/** Soma um período a uma data "AAAA-MM-DD" (mensal fica no último dia do mês quando ele não existe, como o Postgres). */
export function somarPeriodo(data: string, tipo: TipoRecorrencia, intervalo: number): string {
  const [a, m, d] = data.slice(0, 10).split("-").map(Number);
  const n = Math.max(1, intervalo || 1);
  if (tipo === "mensal") {
    const alvo = new Date(Date.UTC(a, m - 1 + n, 1));
    const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    alvo.setUTCDate(Math.min(d, ultimo));
    return alvo.toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(a, m - 1, d + (tipo === "semanal" ? 7 * n : n))).toISOString().slice(0, 10);
}

/**
 * Próxima cópia ao salvar a tarefa. Mantém a data já agendada quando nada da recorrência mudou
 * (tipo, intervalo e data de término iguais); senão recalcula a partir da data de término (ou do
 * início, ou de hoje) + 1 período. Antes ela ficava presa à data de quando a recorrência foi criada:
 * corrigir um término digitado errado (2030 → 2026) não mudava a próxima cópia.
 */
export function proximaGeracao(
  anterior: { recorrencia: Recorrencia | null; prazo: string | null } | null | undefined,
  novo: { tipo: TipoRecorrencia; intervalo: number; prazo: string | null; dataInicio: string | null; hoje: string },
): string {
  const intervalo = Math.max(1, novo.intervalo || 1);
  const r = anterior?.recorrencia;
  if (r?.proxima_geracao && r.tipo === novo.tipo && Math.max(1, r.intervalo || 1) === intervalo && (anterior?.prazo ?? null) === (novo.prazo || null)) {
    return r.proxima_geracao;
  }
  const base = novo.prazo || novo.dataInicio || novo.hoje;
  return somarPeriodo(base, novo.tipo, intervalo);
}
