/**
 * Texto grande colado no comentário vira arquivo .txt (0.3.295, 17/11/2026 — pedido do João, "igual ao Discord e às
 * IAs"). Ao COLAR na caixa de comentário um texto com mais de LIMITE_CARACTERES caracteres ou LIMITE_LINHAS linhas,
 * ele não entra na caixa: vira um cartão "Texto colado" que sobe como anexo .txt junto com o comentário (na pasta
 * dele, como as imagens). Digitar não é interrompido; só a colagem.
 */

export const LIMITE_CARACTERES = 2000;
export const LIMITE_LINHAS = 30;
export const PREFIXO_TEXTO_COLADO = "texto-colado-";

/** O texto colado é grande o bastante para virar arquivo. */
export function textoGrande(texto: string): boolean {
  if (!texto) return false;
  return texto.length > LIMITE_CARACTERES || texto.split(/\r\n|\r|\n/).length > LIMITE_LINHAS;
}

/** Nome do arquivo: texto-colado-AAAAMMDD-HHMM[-n].txt, no horário local. */
export function nomeTextoColado(agora: Date = new Date(), ordem = 1): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const carimbo = `${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}`;
  return `${PREFIXO_TEXTO_COLADO}${carimbo}${ordem > 1 ? `-${ordem}` : ""}.txt`;
}

/** O arquivo .txt (UTF-8) com o texto colado. */
export function arquivoDeTexto(texto: string, agora: Date = new Date(), ordem = 1): File {
  return new File([texto], nomeTextoColado(agora, ordem), { type: "text/plain;charset=utf-8" });
}

/** É um texto que vai na conversa como cartão (o .txt colado ou qualquer anexo de texto do comentário). */
export function ehTexto(p: { mime?: string | null; nome?: string | null; name?: string | null; type?: string | null }): boolean {
  const mime = (p.mime ?? p.type ?? "").toLowerCase();
  const nome = (p.nome ?? p.name ?? "").toLowerCase();
  return mime.startsWith("text/plain") || nome.endsWith(".txt");
}

/** "4.312 caracteres · 87 linhas" para o cartão. */
export function tamanhoDoTexto(texto: string): string {
  const linhas = texto.split(/\r\n|\r|\n/).length;
  return `${texto.length.toLocaleString("pt-BR")} caracteres · ${linhas.toLocaleString("pt-BR")} ${linhas === 1 ? "linha" : "linhas"}`;
}

/** As primeiras linhas não vazias, para a prévia do cartão. */
export function previaDoTexto(texto: string, linhas = 3, maxCaracteres = 240): string {
  const primeiras = texto.split(/\r\n|\r|\n/).filter((l) => l.trim()).slice(0, linhas).join("\n");
  return primeiras.length > maxCaracteres ? `${primeiras.slice(0, maxCaracteres).trimEnd()}…` : primeiras;
}
