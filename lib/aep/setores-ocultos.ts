// Setor oculto da AEP (2026-11-04): a marca `oculto` fica no próprio setor, no
// jsonb `aep_relatorios.setores`. O setor oculto sai de TUDO (laudo, PDF, listas,
// Sinalização, Comercial, Consolidação e cálculos) e os dados continuam guardados
// para quando alguém desocultar. Só o editor de Setores enxerga os ocultos.
//
// Funções puras: servem ao navegador e às rotas de PDF.

export function setorVisivel(setor: { oculto?: unknown } | null | undefined): boolean {
  return setor?.oculto !== true;
}

export function semSetoresOcultos<T extends { setores?: { oculto?: unknown }[] | null }>(rel: T): T {
  return { ...rel, setores: (rel.setores ?? []).filter(setorVisivel) };
}

/**
 * Devolve a lista completa com os visíveis na ordem nova e cada oculto na posição
 * em que estava. Reordenar a tela (que só mostra os visíveis) não mexe nos ocultos.
 *
 * Sempre usa a versão de `todos` de cada setor: o teclado salva com atraso, e
 * `ordem` pode ter ficado velha. Assim um setor ocultado nesse intervalo não
 * volta a aparecer, e um desocultado não some nem é duplicado.
 */
export function reinserirVisiveis<T extends { id: string; oculto?: unknown }>(todos: T[], ordem: T[]): T[] {
  const visiveis = todos.filter(setorVisivel);
  const porId = new Map(visiveis.map((s) => [s.id, s]));
  const naOrdem = ordem.flatMap((s) => {
    const atual = porId.get(s.id);
    return atual ? [atual] : [];
  });
  const idsNaOrdem = new Set(naOrdem.map((s) => s.id));
  const fila = [...naOrdem, ...visiveis.filter((s) => !idsNaOrdem.has(s.id))];
  let i = 0;
  return todos.map((s) => (setorVisivel(s) ? fila[i++] : s));
}
