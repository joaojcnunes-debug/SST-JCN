/**
 * Checklist ergonômico do AET — como a configuração do banco se junta ao padrão.
 *
 * ⚠️ POR QUE ISTO EXISTE (11/09/2026)
 *
 * A tela "Config. OWAS › Checklist" dava **"Algo deu errado"** em todo Salvar.
 * Causa medida na produção, com a mensagem do próprio banco:
 *
 *     400 PGRST204 — Could not find the 'tipo' column
 *     of 'aet_checklist_perguntas' in the schema cache
 *
 * A tabela real tem **3 colunas — `slug`, `label`, `secao`** — e o app gravava
 * uma quarta, `tipo`. A tabela não é criada por nenhuma migration (nasceu fora
 * do versionamento, família de [[aet-schema-real-diverge-migrations]]), e
 * `tipo` é opcional no tipo TypeScript: por isso `tsc` nunca reclamou.
 *
 * Consequência em cadeia: "Restaurar padrões" falhava pelo mesmo motivo, então
 * a tabela **nunca foi populada** (0 linhas, medido em 11/09) e a tela sempre
 * mostrou o padrão do código. E a lixeira apagava uma linha que não existia:
 * zero linhas apagadas, sem erro, e a pergunta voltava.
 *
 * 🔑 A DECISÃO: `tipo` **não vai para o banco**. Ele não é dado do cliente — é
 * a forma de renderizar (texto corrido × Sim/Não/N.A.), e as perguntas de tipo
 * "texto" são fixas do código. O banco guarda só o que o técnico escreve.
 *
 * E a leitura passa a MESCLAR em vez de substituir: a tabela guarda apenas o
 * que foi ALTERADO. Antes, `data.length > 0 ? data : PADRAO` fazia a primeira
 * pergunta salva esconder as outras dez da tela de configuração.
 */

/** Forma mínima de uma linha de `aet_checklist_perguntas` (as colunas reais). */
export interface ChecklistLinhaBanco {
  slug: string;
  label: string;
  secao: string;
  /** v209: pergunta excluída pela tela de configuração. Ausente = visível. */
  oculta?: boolean | null;
}

export interface ChecklistPerguntaLike extends ChecklistLinhaBanco {
  tipo?: "tristate" | "texto";
}

/** O que pode ser gravado: exatamente as colunas que a tabela tem. */
export function paraOBanco(p: ChecklistPerguntaLike): ChecklistLinhaBanco {
  return { slug: p.slug, label: p.label, secao: p.secao, oculta: p.oculta === true };
}

/**
 * A pergunta foi EXCLUÍDA na tela de configuração?
 *
 * 🔑 Usada pelas TRÊS telas que desenham o checklist — tela de análise, prévia
 * do laudo e template do PDF. As 11 perguntas padrão são linhas escritas à mão
 * nesses três arquivos (e é de propósito: manter a ordem e o layout do
 * documento estáveis). Cada linha consulta esta função; quem some da tela some
 * do laudo e do PDF, e a seção sem nenhuma linha visível não imprime título.
 *
 * ⚠️ Ausência de linha significa VISÍVEL, nunca excluída. É a diferença que
 * evita uma gravação que não completou sumir com a pergunta de todos os laudos
 * em silêncio — ver o cabeçalho da v209.
 */
export function perguntaOculta(
  perguntas: Pick<ChecklistLinhaBanco, "slug" | "oculta">[],
  slug: string,
): boolean {
  return perguntas.find((p) => p.slug === slug)?.oculta === true;
}

/** Alguma das perguntas desta lista de slugs continua visível? */
export function algumaVisivel(
  perguntas: Pick<ChecklistLinhaBanco, "slug" | "oculta">[],
  slugs: string[],
): boolean {
  return slugs.some((s) => !perguntaOculta(perguntas, s));
}

/**
 * Junta o que está no banco com o padrão do código.
 *
 * - pergunta padrão com linha no banco: usa o `label` e a `secao` do banco e
 *   **mantém o `tipo` do padrão** (o banco não tem essa coluna);
 * - pergunta padrão sem linha: sai igual ao padrão;
 * - slug que só existe no banco (pergunta adicionada na tela): entra no fim
 *   como `tristate`, que é o único tipo que a tela sabe criar. Sem isto ela
 *   nasceria sem `tipo` e **desapareceria da tela de análise do AET**, que
 *   filtra as perguntas adicionadas por `tipo`.
 *
 * A ordem do padrão é preservada — é ela que a tela e o PDF seguem.
 */
export function mesclarChecklist<T extends ChecklistPerguntaLike>(
  padrao: T[],
  doBanco: ChecklistLinhaBanco[] | null | undefined,
): T[] {
  const linhas = doBanco ?? [];
  if (linhas.length === 0) return padrao;

  const porSlug = new Map(linhas.map((l) => [l.slug, l]));
  const mesclado = padrao.map((p) => {
    const b = porSlug.get(p.slug);
    return b ? ({ ...p, label: b.label, secao: b.secao, oculta: b.oculta === true } as T) : p;
  });

  const slugsPadrao = new Set(padrao.map((p) => p.slug));
  for (const l of linhas) {
    if (slugsPadrao.has(l.slug)) continue;
    mesclado.push({
      slug: l.slug, label: l.label, secao: l.secao,
      oculta: l.oculta === true, tipo: "tristate",
    } as unknown as T);
  }
  return mesclado;
}

/**
 * A pergunta padrão está com o texto original, ou alguém editou?
 *
 * É o que decide se o botão "Restaurar texto padrão" tem o que fazer — sem
 * isso ele prometeria uma ação inócua.
 */
export function textoEhOPadrao(
  padrao: ChecklistPerguntaLike[],
  slug: string,
  labelAtual: string,
): boolean {
  const p = padrao.find((x) => x.slug === slug);
  if (!p) return false;
  return p.label.trim() === labelAtual.trim();
}
