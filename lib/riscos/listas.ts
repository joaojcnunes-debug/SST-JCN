/**
 * Opções das listas do formulário de risco (Meio de propagação, Situação, Tempo de exposição,
 * Técnica). Até a 0.3.229 o formulário usava só as listas fixas de lib/constants e a aba
 * Configurações › Listas auxiliares gravava sem efeito; decisão do João (04/11/2026): a lista
 * configurada passa a valer, e a fixa só entra quando a configurada está vazia.
 *
 * O valor já gravado no risco continua aparecendo mesmo que tenha saído da lista, para quem
 * abre um risco antigo não perder a escolha ao salvar.
 */
export function opcoesDaLista(
  configurada: readonly string[] | undefined,
  padrao: readonly string[],
  atuais: string | readonly string[] | null | undefined = [],
): string[] {
  const limpa = (configurada ?? []).map((v) => v.trim()).filter(Boolean);
  const base = limpa.length > 0 ? limpa : [...padrao];
  const gravados = (typeof atuais === "string" ? [atuais] : atuais ?? [])
    .map((v) => v.trim())
    .filter(Boolean);
  const extras = gravados.filter((v) => !base.includes(v));
  return [...new Set([...base, ...extras])];
}
