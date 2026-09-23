/**
 * Utilitários de texto rico (HTML do editor TipTap) para campos que ANTES eram
 * `<textarea>` de texto puro e passaram a aceitar formatação.
 *
 * O ponto delicado é a base viva: as linhas já gravadas continuam em texto
 * puro. Nada é migrado no banco — a conversão acontece na leitura, e a linha
 * só passa a guardar HTML quando o usuário salva aquele registro de novo.
 */

/** Heurística: a string já veio do editor (tem tag) ou é texto puro legado? */
export function pareceHtml(valor: string | null | undefined): boolean {
  return !!valor && /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(valor);
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Devolve HTML pronto para o editor / para o `dangerouslySetInnerHTML`.
 * Texto puro vira parágrafos (linha em branco separa `<p>`, quebra simples
 * vira `<br>`); HTML já formatado passa intacto.
 */
export function textoParaHtml(valor: string | null | undefined): string {
  const v = (valor ?? "").trim();
  if (!v) return "";
  if (pareceHtml(v)) return v;
  return v
    .split(/\n{2,}/)
    .map((bloco) => `<p>${escaparHtml(bloco.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Extrai o texto legível do HTML (para prompt de IA, buscas e resumos). */
export function htmlParaTexto(valor: string | null | undefined): string {
  return (valor ?? "")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * O editor devolve `<p></p>` quando o usuário apaga tudo — string truthy que
 * não imprime nada. Quem decide "tem conteúdo?" precisa perguntar aqui, não
 * ao `if (valor)`.
 */
export function htmlVazio(valor: string | null | undefined): boolean {
  if (!valor) return true;
  if (/<img\b/i.test(valor)) return false;
  return htmlParaTexto(valor) === "";
}
