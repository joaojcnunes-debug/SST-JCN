/**
 * Região e Produtos na tarefa de qualquer quadro (10/11/2026, pedido do usuário: "igual é no formulário do
 * comercial", "em todos os quadros").
 *
 *  - Região = a pergunta "Região" do formulário "Cadastro de empresa - Comercial": grava a ETIQUETA da unidade
 *    ("teresopolis", "nova friburgo"…), a mesma que o formulário grava (`normalizarEtiquetaForm`). É ela que as
 *    automações de roteamento leem e que o banco usa para a unidade da tarefa (`gestao_unidade_de_etiquetas`).
 *    Ler a região aceita os apelidos e a normalização do banco (`gestao_unidades.apelidos` + `gestao_norm_unidade`):
 *    há 637 tarefas com "nova-friburgo" e 5 com "campos dos goytacazes".
 *  - Produtos = o campo "Produtos" do quadro Comercial (id fixo, "global": as automações das unidades condicionam
 *    por ele e o importador do Runrun grava nele nas tarefas das unidades). Fora do Comercial as opções vêm da RPC
 *    `gestao_produtos_catalogo` (v348), porque o quadro Comercial é restrito.
 */

/** Campo "Produtos" do Comercial — o mesmo `CAMPO_PRODUTOS_ID` do importador (o teste confere). */
export const CAMPO_PRODUTOS_ID = "eb5d9daf-9b81-4903-bfd5-4fea654225e7";

export interface Regiao {
  /** Etiqueta gravada (a do formulário). */
  tag: string;
  label: string;
  /** Formas aceitas ao ler, já normalizadas como `normUnidade` (espelha `gestao_unidades.apelidos`). */
  apelidos: string[];
}

/** As 6 opções da pergunta "Região" do formulário do Comercial, na mesma ordem. */
export const REGIOES: Regiao[] = [
  { tag: "teresopolis", label: "Teresópolis", apelidos: ["teresopolis"] },
  { tag: "nova friburgo", label: "Nova Friburgo", apelidos: ["nova friburgo", "friburgo"] },
  { tag: "guapimirim", label: "Guapimirim", apelidos: ["guapimirim"] },
  { tag: "campos", label: "Campos", apelidos: ["campos", "campos dos goytacazes"] },
  { tag: "piabeta", label: "Piabetá", apelidos: ["piabeta"] },
  { tag: "petropolis", label: "Petrópolis", apelidos: ["petropolis"] },
];

/** Espelha `gestao_norm_unidade`: minúsculas, sem acento, "-"/"_" viram espaço, espaços colapsados. */
export function normUnidade(e: string): string {
  return (e ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function regiaoDe(etiqueta: string): Regiao | null {
  const n = normUnidade(etiqueta);
  return REGIOES.find((r) => r.apelidos.includes(n)) ?? null;
}

/** A região das etiquetas (a primeira que aparecer), como `tag`; null se não houver. */
export function regiaoDasEtiquetas(etiquetas: readonly string[] | null | undefined): string | null {
  for (const e of etiquetas ?? []) {
    const r = regiaoDe(e);
    if (r) return r.tag;
  }
  return null;
}

/**
 * Etiquetas com a região trocada: tira TODAS as etiquetas de região (em qualquer grafia) e põe a nova `tag` no
 * fim; `null` só tira. As outras etiquetas ficam como estão, na mesma ordem.
 */
export function comRegiao(etiquetas: readonly string[] | null | undefined, tag: string | null): string[] {
  const resto = (etiquetas ?? []).filter((e) => !regiaoDe(e));
  if (!tag) return resto;
  const r = REGIOES.find((x) => x.tag === tag);
  if (!r) throw new Error(`região desconhecida: ${tag}`);
  return [...resto, r.tag];
}

/** Opções de Produtos para a tela: o catálogo + o que a tarefa já tem fora dele (não some sem ser desmarcado). */
export function opcoesComMarcados(catalogo: readonly string[], marcados: readonly string[]): string[] {
  return [...catalogo, ...marcados.filter((m) => !catalogo.includes(m))];
}
