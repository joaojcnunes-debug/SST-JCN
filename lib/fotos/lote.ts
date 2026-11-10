/** Envio de várias imagens de uma vez em campos que têm limite de fotos. */

/** Separa o que cabe no limite, na ordem escolhida, do que fica de fora. */
export function dividirPeloLimite<T>(
  arquivos: T[],
  ocupadas: number,
  limite: number,
): { aceitas: T[]; recusadas: number } {
  const vagas = Math.max(0, limite - ocupadas);
  return { aceitas: arquivos.slice(0, vagas), recusadas: Math.max(0, arquivos.length - vagas) };
}

export function avisoForaDoLimite(recusadas: number, limite: number): string {
  const quantas = recusadas === 1 ? "1 imagem ficou" : `${recusadas} imagens ficaram`;
  return `${quantas} de fora: o limite é de ${limite} fotos.`;
}

export function avisoTamanho(recusadas: number, maximoMb: number): string {
  const quantas = recusadas === 1 ? "1 imagem ficou" : `${recusadas} imagens ficaram`;
  return `${quantas} de fora por ter mais de ${maximoMb} MB.`;
}

export function fotosEnviadas(quantidade: number): string {
  return quantidade === 1 ? "Foto enviada" : `${quantidade} fotos enviadas`;
}
