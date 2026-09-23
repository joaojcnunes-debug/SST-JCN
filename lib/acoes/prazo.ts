/** Régua do "Quando (prazo)" das ações 5W2H da INVESTIGAÇÃO DE ACIDENTE.
 *
 *  Desde a v185 o campo é TEXTO LIVRE: o técnico escreve o prazo do jeito que ele
 *  é combinado em campo — "Imediato", "Na próxima parada de manutenção", "30 dias
 *  após a entrega do EPI". Antes era uma data fechada (`date`, v113), e era isso
 *  que não deixava registrar o prazo de verdade.
 *
 *  As ações gravadas ANTES da v185 guardam a data em ISO (`2026-08-26`). A própria
 *  v185 converte o que está na base para `26/08/2026`, mas esta régua cobre os
 *  dois casos — inclusive a janela entre o deploy e a migration. Data ISO pura sai
 *  em dd/mm/aaaa; qualquer outra coisa sai exatamente como foi escrita, sem
 *  interpretação (nada de `new Date()` em texto livre, que devolveria "Invalid Date").
 *
 *  Recorte em pedaços de string de propósito: `new Date("2026-08-26")` é UTC e
 *  volta um dia para trás no nosso fuso.
 */
export function formatarPrazoAcao(valor: string | null | undefined): string {
  const txt = (valor ?? "").trim();
  if (!txt) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : txt;
}
