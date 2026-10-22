/**
 * O período De/Até da lista de Inspeções — em qual data cada inspeção cai.
 *
 * Decisão de 07/10: inspeção CONCLUÍDA conta no mês em que foi concluída,
 * independente de quando a visita aconteceu. É a mesma régua do dashboard
 * (`mesDeConclusao` em lib/dashboard/inspecoes): a Sirlei tinha 9 concluídas
 * em set/26 no dashboard e 5 na lista, porque a lista filtrava as concluídas
 * pela data da VISITA — uma visita de agosto fechada em setembro sumia dos
 * dois meses.
 *
 * Quem ainda não foi concluída (Rascunho, Em andamento) não tem data de
 * conclusão e continua pela data da visita. A data de abertura (`created_at`)
 * e a da visita seguem gravadas; só muda o critério do filtro.
 *
 * Concluída sem `concluida_em` (registro anterior à v154) cai no `created_at`,
 * igual ao dashboard.
 */

/**
 * Brasília não tem horário de verão desde 2019, então o dia em São Paulo é
 * sempre de 03:00 UTC a 03:00 UTC do dia seguinte.
 */
const FUSO_SP = "-03:00";

function inicioDoDiaSP(data: string): string {
  return `${data}T00:00:00${FUSO_SP}`;
}

/** "AAAA-MM-DD" do dia seguinte, sem passar por fuso. */
function diaSeguinte(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

const DATA_PURA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Filtro `or` do PostgREST para o período, ou `null` sem período.
 *
 * Três ramos:
 *  1. concluída com data de conclusão → pela conclusão (dia de São Paulo);
 *  2. concluída sem data de conclusão → pela abertura (`created_at`);
 *  3. não concluída → pela data da visita (data pura, sem fuso).
 */
export function filtroPeriodo(dataIni?: string, dataFim?: string): string | null {
  const ini = dataIni && DATA_PURA.test(dataIni) ? dataIni : null;
  const fim = dataFim && DATA_PURA.test(dataFim) ? dataFim : null;
  if (!ini && !fim) return null;

  // Os instantes têm ":" e "-" — vão entre aspas para o PostgREST não os ler
  // como separador.
  const instante = (col: string) => {
    const partes: string[] = [];
    if (ini) partes.push(`${col}.gte."${inicioDoDiaSP(ini)}"`);
    if (fim) partes.push(`${col}.lt."${inicioDoDiaSP(diaSeguinte(fim))}"`);
    return partes;
  };
  const visita: string[] = [];
  if (ini) visita.push(`data_inspecao.gte.${ini}`);
  if (fim) visita.push(`data_inspecao.lte.${fim}`);

  return [
    `and(status.eq.CONCLUIDA,concluida_em.not.is.null,${instante("concluida_em").join(",")})`,
    `and(status.eq.CONCLUIDA,concluida_em.is.null,${instante("created_at").join(",")})`,
    `and(status.neq.CONCLUIDA,${visita.join(",")})`,
  ].join(",");
}
