/**
 * "Voltar à lista" das inspeções (pedido de 06/11/2026): quem escolhe a pessoa e os filtros em Minhas
 * inspeções, abre o documento e volta precisa achar a tela como deixou. A lista vai junto no endereço do
 * documento (?volta=), com os filtros dela. Sem I/O: o hook que lê e guarda é useVoltaInspecao.
 */

/** Só caminho interno do painel: o parâmetro vem do endereço e não pode mandar a pessoa para fora. */
export function voltaSegura(v: string | null | undefined): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return null;
  return v;
}

/** O endereço do documento levando a lista de onde ele foi aberto. */
export function comVolta(href: string, volta: string | null | undefined): string {
  const v = voltaSegura(volta);
  if (!v) return href;
  return `${href}${href.includes("?") ? "&" : "?"}volta=${encodeURIComponent(v)}`;
}

/** O endereço atual de uma lista: caminho + filtros. */
export function enderecoDaLista(pathname: string, busca: string): string {
  return busca ? `${pathname}?${busca}` : pathname;
}

/** Texto do botão, conforme a lista de origem. */
export function rotuloVolta(v: string): string {
  const caminho = v.split("?")[0];
  if (caminho === "/inspecoes/minhas") return "Voltar para Minhas inspeções";
  if (caminho === "/inspecoes") return "Voltar para Inspeções";
  return "Voltar à lista";
}
