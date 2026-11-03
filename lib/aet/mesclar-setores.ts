/**
 * Mescla de três vias do jsonb `setores` do laudo AET (correção de 0.3.215).
 *
 * As telas Setores e Análise gravam o array inteiro. Com as duas abertas, a última a salvar
 * apagava o que a outra tinha gravado. Agora, ao salvar, a tela busca a versão do banco e aplica
 * por cima dela só o que ELA mudou desde que carregou (a `base`):
 *  - campo de um setor que mudou na tela → vale o da tela; o resto vem do banco;
 *  - setor criado na tela → entra; setor apagado na tela → sai;
 *  - setor criado por outra tela (está no banco e não na base) → continua;
 *  - ordem: a da tela; os setores que só o banco tem vão para o fim.
 */
type ComId = { id: string };

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function mesclarSetores<T extends ComId>(base: readonly T[], local: readonly T[], servidor: readonly T[]): T[] {
  const naBase = new Map(base.map((s) => [s.id, s]));
  const noServidor = new Map(servidor.map((s) => [s.id, s]));
  const naTela = new Set(local.map((s) => s.id));

  const resultado: T[] = [];
  for (const meu of local) {
    const original = naBase.get(meu.id);
    const atual = noServidor.get(meu.id);
    if (!original) {
      // Criado nesta tela.
      resultado.push(meu);
      continue;
    }
    if (!atual) {
      // Outra tela apagou. Só volta se esta tela mexeu nele.
      if (!igual(meu, original)) resultado.push(meu);
      continue;
    }
    const mesclado = { ...atual } as Record<string, unknown>;
    const chaves = new Set([...Object.keys(meu), ...Object.keys(original)]);
    for (const k of chaves) {
      const v = (meu as Record<string, unknown>)[k];
      if (!igual(v, (original as Record<string, unknown>)[k])) {
        if (v === undefined) delete mesclado[k];
        else mesclado[k] = v;
      }
    }
    resultado.push(mesclado as T);
  }
  // Setores que só existem no banco: criados por outra tela depois que esta carregou.
  for (const s of servidor) {
    if (!naTela.has(s.id) && !naBase.has(s.id)) resultado.push(s);
  }
  return resultado;
}

/**
 * A versão SALVA, só que na ordem nova (auto-save do arrasto da AEP, 0.3.215). Antes o arrasto
 * gravava o array da tela inteiro, com edições ainda não salvas — pulando a trava do N/I e a
 * auditoria da origem da evidência do botão Salvar. Setor que ainda não foi salvo fica de fora
 * (espera o Salvar); setor salvo que não está na tela vai para o fim.
 */
export function reordenarComo<T extends ComId>(salvos: readonly T[], ordemDaTela: readonly string[]): T[] {
  const pos = new Map(ordemDaTela.map((id, i) => [id, i]));
  return salvos
    .map((s, i) => ({ s, chave: pos.get(s.id) ?? ordemDaTela.length + i }))
    .sort((a, b) => a.chave - b.chave)
    .map((x) => x.s);
}
