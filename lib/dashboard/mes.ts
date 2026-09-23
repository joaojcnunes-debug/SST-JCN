/**
 * Agrupamento por mês CANÔNICO no fuso de São Paulo (America/Sao_Paulo).
 *
 * Antes, o dashboard classificava cada registro pelo mês do FUSO DO NAVEGADOR
 * (`new Date(iso).getMonth()`). Para usuários no Brasil isso já dá o mês certo,
 * mas divergiria se o dashboard fosse aberto de outro fuso. Aqui o mês é sempre
 * o de São Paulo, independente de onde a página roda.
 *
 * A unidade é o "mês absoluto" = ano*12 + mês (0-based) — comparável e fácil de
 * subtrair para achar a posição na janela dos últimos N meses.
 */

const TZ = "America/Sao_Paulo";
const FMT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" });
const ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Mês absoluto (ano*12 + mês) de um instante, no fuso de São Paulo. */
export function mesAbsSP(iso: string | Date): number {
  const partes = FMT.formatToParts(typeof iso === "string" ? new Date(iso) : iso);
  const ano = Number(partes.find((p) => p.type === "year")!.value);
  const mes = Number(partes.find((p) => p.type === "month")!.value) - 1;
  return ano * 12 + mes;
}

/**
 * Mês absoluto de uma DATA PURA ("AAAA-MM-DD"), sem passar por fuso nenhum.
 *
 * `mesAbsSP` acima existe para INSTANTES (`timestamptz`), e converte para o
 * fuso de São Paulo. Data pura não é instante: `inspecoes.data_inspecao` é o
 * dia da visita, não um horário. Passá-la pelo `mesAbsSP` faria
 * `new Date("2026-07-01")` virar meia-noite UTC e, em São Paulo, retroceder
 * para 30/06 — jogando toda visita do dia 1º para o mês anterior. São 18
 * inspeções da base hoje (1 em abril, 8 em junho, 9 em julho).
 *
 * Aqui o ano e o mês são lidos direto do texto, que é o único jeito certo:
 * uma data de calendário não tem fuso.
 */
export function mesAbsDataSP(data: string | null | undefined): number | null {
  if (!data) return null;
  const m = /^(\d{4})-(\d{2})/.exec(data.trim());
  if (!m) return null;
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

/** Mês absoluto de "agora" em São Paulo. */
export function mesAbsAgoraSP(): number {
  return mesAbsSP(new Date());
}

/** Rótulo curto do mês absoluto: "Jan" ou, com `comAno`, "Jan/26". */
export function rotuloMesAbs(abs: number, comAno = false): string {
  const mes = ((abs % 12) + 12) % 12;
  const ano = Math.floor(abs / 12);
  return comAno ? `${ABREV[mes]}/${String(ano).slice(2)}` : ABREV[mes];
}
