// Imagens nos cartões da Gestão (12/11/2026). Pedido do usuário: "conseguir inserir e colar imagens nos cartões que
// criamos" — escolheu "no cartão, abaixo da descrição" e "nos comentários".
//
// Sem tabela nova: a imagem é um anexo (gestao_anexos + bucket "anexos"), como os da aba Anexos. A do comentário vai
// numa pasta com o número dele — gestao/<tarefa>/comentario-<id>/<arquivo> — e é por ela que a tela sabe de qual
// comentário é. As demais imagens do cartão ficam DENTRO da descrição (lib/gestao/descricao-imagens.ts, desde o 2º
// pedido de 12/11: nada embaixo dela); todas continuam na aba Anexos.

export interface AnexoImagem {
  id: string;
  nome: string;
  storage_path: string;
  mime: string | null;
  created_by: string | null;
}

export const ehImagem = (mime: string | null | undefined): boolean => !!mime && mime.startsWith("image/");

/** Pasta (dentro da tarefa) das imagens de um comentário. */
export const pastaDoComentario = (idComentario: string): string => `comentario-${idComentario}`;

/** Comentário dono da imagem, pelo caminho no storage; null = imagem do cartão. */
export function comentarioDoCaminho(path: string): string | null {
  const m = /\/comentario-([^/]+)\//.exec(path);
  return m ? m[1] : null;
}

/** Imagens do cartão (sem comentário) e as de cada comentário. Anexo que não é imagem fica de fora (aba Anexos). */
export function separarImagens<T extends AnexoImagem>(anexos: T[]): { doCartao: T[]; porComentario: Map<string, T[]> } {
  const doCartao: T[] = [];
  const porComentario = new Map<string, T[]>();
  for (const a of anexos) {
    if (!ehImagem(a.mime)) continue;
    const c = comentarioDoCaminho(a.storage_path);
    if (!c) { doCartao.push(a); continue; }
    porComentario.set(c, [...(porComentario.get(c) ?? []), a]);
  }
  return { doCartao, porComentario };
}

/** Caminho no bucket "anexos": gestao/<tarefa>/[pasta/]<uuid>-<nome limpo>. */
export function caminhoDaImagem(idTarefa: string, nome: string, uuid: string, pasta?: string | null): string {
  const limpo = nome.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `gestao/${idTarefa}/${pasta ? `${pasta}/` : ""}${uuid}-${limpo}`;
}

/**
 * Imagem colada (print, "Copiar imagem") chega como "image.png": ganha um nome que diz o que é e não repete entre
 * colagens (o mesmo padrão dos formulários, 0.3.952). Arquivo copiado do Explorer mantém o nome.
 */
export function nomearColada(f: File, ordem: number, agora: Date = new Date()): File {
  if (f.name && !/^image\.\w+$/i.test(f.name)) return f;
  const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "png";
  const dois = (n: number) => String(n).padStart(2, "0");
  const carimbo = `${agora.getFullYear()}${dois(agora.getMonth() + 1)}${dois(agora.getDate())}-${dois(agora.getHours())}${dois(agora.getMinutes())}${dois(agora.getSeconds())}`;
  return new File([f], `imagem-colada-${carimbo}-${ordem}.${ext}`, { type: f.type || "image/png" });
}

/** Colar num campo de texto com TEXTO na área de transferência é colar texto (Word/Excel mandam uma imagem junto, e
 *  ela não deve virar anexo). Fora de campo de texto, ou só com imagem, a imagem vale. */
export function colarComoImagem(p: { emCampoDeTexto: boolean; texto: string; imagens: number }): boolean {
  if (p.imagens === 0) return false;
  return !(p.emCampoDeTexto && p.texto.trim() !== "");
}

/** Texto do comentário que só tem imagem (a coluna texto é obrigatória e vai nos avisos). */
export const TEXTO_SO_IMAGEM = "(imagem)";
