// Imagem DENTRO da descrição do cartão (12/11/2026). Pedido do usuário depois da 0.3.953: "a imagem está aparecendo
// embaixo, preciso que a imagem vá para o quadro descrição".
//
// A descrição continua sendo TEXTO (gestao_tarefas.descricao): Google Agenda, dica do calendário, IA, formulários e a
// sincronização com o Runrun seguem lendo texto. Cada imagem vira uma linha própria no texto:
//     ![nome-do-arquivo.png](anexo:<id do anexo>)
// e a caixa da descrição (TipTap) mostra a imagem no lugar dessa linha. A imagem em si é um anexo (gestao_anexos +
// bucket "anexos"), como as da 0.3.953. Para quem lê o texto puro, a linha vira "[imagem]" (textoSemImagens).

/** Nó do documento do editor (o JSON do TipTap/ProseMirror), só o que a descrição usa. */
export interface NoDoc {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: NoDoc[];
}

const TOKEN = /!\[([^\]\n]*)\]\(anexo:([0-9a-fA-F-]{36})\)/;
const LINHA_IMAGEM = new RegExp(`^\\s*${TOKEN.source}\\s*$`);
const TOKEN_GLOBAL = new RegExp(TOKEN.source, "g");

/** A linha que representa a imagem no texto. O nome não pode ter colchete, parêntese nem quebra de linha. */
export function tokenImagem(id: string, nome: string): string {
  const alt = (nome ?? "").replace(/[[\]()\r\n]/g, " ").replace(/\s+/g, " ").trim() || "imagem";
  return `![${alt}](anexo:${id})`;
}

/** Texto da descrição → documento do editor. Só a linha que é INTEIRA uma imagem vira imagem; o resto é texto, linha a
 *  linha (texto que só menciona a marcação no meio da frase continua texto). */
export function textoParaDoc(texto: string | null | undefined): NoDoc {
  const linhas = (texto ?? "").replace(/\r\n?/g, "\n").split("\n");
  const content: NoDoc[] = linhas.map((linha) => {
    const m = LINHA_IMAGEM.exec(linha);
    if (m) return { type: "image", attrs: { anexo: m[2].toLowerCase(), alt: m[1] || "imagem" } };
    return linha ? { type: "paragraph", content: [{ type: "text", text: linha }] } : { type: "paragraph" };
  });
  return { type: "doc", content };
}

function textoDoNo(no: NoDoc): string {
  if (no.type === "text") return no.text ?? "";
  if (no.type === "hardBreak") return "\n";
  return (no.content ?? []).map(textoDoNo).join("");
}

/** Documento do editor → texto da descrição (o inverso de textoParaDoc). Imagem sem anexo (colada de site) não entra. */
export function docParaTexto(doc: NoDoc | null | undefined): string {
  const linhas: string[] = [];
  for (const no of doc?.content ?? []) {
    if (no.type === "image") {
      const id = typeof no.attrs?.anexo === "string" ? no.attrs.anexo : null;
      if (id) linhas.push(tokenImagem(id, String(no.attrs?.alt ?? no.attrs?.title ?? "imagem")));
      continue;
    }
    linhas.push(textoDoNo(no));
  }
  return linhas.join("\n");
}

/** Ids dos anexos que aparecem como imagem na descrição (na ordem). */
export function idsDasImagens(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => LINHA_IMAGEM.exec(l)?.[2]?.toLowerCase())
    .filter((id): id is string => !!id);
}

/** Imagem do cartão, como chega de gestao_anexos (só o que a descrição precisa). */
export interface ImagemDoCartao {
  id: string;
  nome: string;
}

/**
 * 12/11/2026, 2º pedido: "toda imagem colada ou inserida fique dentro do campo de descrição". A imagem do cartão que
 * não está no texto entra no FIM da descrição, uma por linha, na ordem em que chegou. Vale para:
 * - a colada numa aba aberta antes da 0.3.963, com o código antigo, que gravava a imagem fora do texto;
 * - a posta pela aba Anexos;
 * - a que a sincronização do Runrun tirou do texto ao regravar a descrição.
 * A que já está no texto fica onde está. Sem nada faltando, devolve o MESMO texto (o React não redesenha).
 */
export function completarComImagens(texto: string, imagens: ImagemDoCartao[]): string {
  const ja = new Set(idsDasImagens(texto));
  const linhas: string[] = [];
  for (const i of imagens) {
    const id = i.id.toLowerCase();
    if (ja.has(id)) continue;
    ja.add(id);
    linhas.push(tokenImagem(id, i.nome));
  }
  if (!linhas.length) return texto;
  const base = texto.replace(/\s+$/, "");
  return base ? `${base}\n${linhas.join("\n")}` : linhas.join("\n");
}

/** Imagens do cartão que NÃO estão no texto: ao salvar, são as que a pessoa tirou da descrição. */
export function imagensForaDoTexto<T extends ImagemDoCartao>(texto: string, imagens: T[]): T[] {
  const ja = new Set(idsDasImagens(texto));
  return imagens.filter((i) => !ja.has(i.id.toLowerCase()));
}

/** Para quem lê a descrição como texto (Google Agenda, dica do calendário, IA): a marcação vira "[imagem]". */
export function textoSemImagens(texto: string | null | undefined): string {
  return (texto ?? "").replace(TOKEN_GLOBAL, "[imagem]");
}
