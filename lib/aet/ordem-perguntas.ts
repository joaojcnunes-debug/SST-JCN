/**
 * A `ordem` das perguntas QPS do AET é CHAVE, não posição (04/11/2026).
 *
 * As respostas (`aet_laudo_qps_respostas`) apontam para a pergunta por
 * `(codigo_fator, pergunta_ordem)` — ver `mediaFatorDeLinhas` em
 * consolidar-psi.ts. Até aqui o Salvar da Config. 13 Fatores regravava
 * `ordem: i + 1`: excluir ou inserir uma pergunta deslocava todas as de baixo,
 * e as respostas de TODOS os laudos (inclusive concluídos) passavam a contar
 * para a pergunta vizinha — com outra lógica, outra média, outra zona.
 *
 * A regra agora:
 * - pergunta que já tem ordem mantém a sua, sempre;
 * - pergunta nova recebe a próxima livre (maior conhecida + 1);
 * - excluir deixa buraco — o buraco é de propósito.
 *
 * "Maior conhecida" inclui a maior `pergunta_ordem` já respondida em qualquer
 * laudo: sem isso, apagar a última pergunta e criar outra reaproveitaria o
 * número, e as respostas antigas grudariam na pergunta nova.
 */

export interface PerguntaComOrdem {
  /** Ordem já gravada. Ausente, zero ou negativa = pergunta nova. */
  ordem?: number | null;
}

/**
 * Devolve as perguntas com a `ordem` definitiva para gravar.
 *
 * Mantém a ordem de quem já tem; numera as novas a partir de
 * `max(ordens da lista, maiorOrdemUsada) + 1`, na ordem em que aparecem.
 * Ordem repetida na lista (não deveria acontecer) fica com a PRIMEIRA
 * pergunta que a usa; a seguinte vira nova — duas perguntas com a mesma chave
 * somariam as mesmas respostas duas vezes.
 */
export function ordensParaSalvar<T extends PerguntaComOrdem>(
  perguntas: T[],
  maiorOrdemUsada = 0,
): (T & { ordem: number })[] {
  const valida = (o: number | null | undefined): o is number =>
    typeof o === "number" && Number.isInteger(o) && o > 0;

  let proxima = Math.max(
    0,
    maiorOrdemUsada,
    ...perguntas.map((p) => (valida(p.ordem) ? p.ordem : 0)),
  ) + 1;

  const usadas = new Set<number>();
  return perguntas.map((p) => {
    if (valida(p.ordem) && !usadas.has(p.ordem)) {
      usadas.add(p.ordem);
      return { ...p, ordem: p.ordem };
    }
    const ordem = proxima++;
    usadas.add(ordem);
    return { ...p, ordem };
  });
}
