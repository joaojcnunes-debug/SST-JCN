import type { SupabaseClient } from "@supabase/supabase-js";
import { extrairPathStorage } from "@/lib/storage/signed-url";

/**
 * Resolve valores de mídia (URL pública/assinada legada OU path) em URLs ASSINADAS
 * para embutir no HTML do PDF (o Puppeteer baixa as imagens). Usa o client passado
 * (autenticado ou service role — ambos têm SELECT em fotos/anexos).
 *
 * SEGURO POR DESIGN: em qualquer falha (sem path, erro de assinatura), devolve o
 * valor ORIGINAL. Enquanto os buckets seguem públicos, isso degrada para o
 * comportamento atual — não quebra o PDF. Quando privatizar, as assinadas mandam.
 */
export async function assinarMidiaPdf(
  supabase: SupabaseClient,
  valores: (string | null | undefined)[],
  bucket = "fotos",
  expiresIn = 1800, // 30 min — cobre a renderização do PDF
): Promise<string[]> {
  return Promise.all(
    valores.map(async (v) => {
      if (!v) return "";
      const path = extrairPathStorage(v, bucket);
      if (!path) return v; // blob/data/origem externa → devolve como veio
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
        return !error && data?.signedUrl ? data.signedUrl : v;
      } catch {
        return v;
      }
    }),
  );
}

/**
 * Prepara os capítulos de texto padrão para o PDF: assina o `bg_imagem_url`
 * (imagem de fundo da capa) E as imagens inline (`<img>`) gravadas no HTML do
 * `conteudo` (rich text). Devolve novo array; campos sem mídia ficam intactos.
 */
export async function assinarCapitulos<
  T extends { bg_imagem_url?: string | null; conteudo?: string | null },
>(
  supabase: SupabaseClient,
  capitulos: T[],
  bucket = "fotos",
): Promise<T[]> {
  return Promise.all(
    capitulos.map(async (c) => {
      const bg_imagem_url = c.bg_imagem_url
        ? await assinarUmaMidiaPdf(supabase, c.bg_imagem_url, bucket)
        : c.bg_imagem_url;
      const conteudo = c.conteudo
        ? await assinarImagensHtml(supabase, c.conteudo, bucket)
        : c.conteudo;
      return { ...c, bg_imagem_url, conteudo };
    }),
  );
}

/** Versão p/ um único valor (ex.: assinatura, bg de capítulo). */
export async function assinarUmaMidiaPdf(
  supabase: SupabaseClient,
  valor: string | null | undefined,
  bucket = "fotos",
  expiresIn = 1800,
): Promise<string> {
  const [out] = await assinarMidiaPdf(supabase, [valor], bucket, expiresIn);
  return out ?? "";
}

/**
 * Assina TODAS as imagens inline (`<img src=...>`) de uma string HTML salva.
 * O RichTextEditor / TextoPadraoEditor grava `<img src="<url pública>">` dentro
 * de campos de texto rico (capítulos `conteudo`, conclusões DRPS). Cada `src` que
 * resolva para um path do bucket é trocada por URL ASSINADA; o resto fica intacto.
 *
 * SEGURO POR DESIGN (igual aos demais helpers): src de origem externa / `data:` /
 * `blob:` (que `extrairPathStorage` devolve como null) é mantida como veio, e
 * qualquer falha de assinatura preserva a src original. Enquanto o bucket é
 * público degrada para o comportamento atual; quando privatizar, as assinadas
 * mandam. Idempotente: re-assina URLs que já são assinadas (token novo).
 */
export async function assinarImagensHtml(
  supabase: SupabaseClient,
  html: string | null | undefined,
  bucket = "fotos",
  expiresIn = 1800,
): Promise<string> {
  if (!html) return html ?? "";

  // Captura o valor de cada atributo src de <img ...> (aspas simples ou duplas).
  const srcRe = /<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi;
  const originais = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = srcRe.exec(html)) !== null) originais.add(m[2]);
  if (originais.size === 0) return html;

  // Assina cada src única que aponte para este bucket.
  const mapa = new Map<string, string>();
  await Promise.all(
    [...originais].map(async (src) => {
      const path = extrairPathStorage(src, bucket);
      if (!path) return; // origem externa / data / blob → mantém
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
        if (!error && data?.signedUrl) mapa.set(src, data.signedUrl);
      } catch {
        /* mantém a src original */
      }
    }),
  );
  if (mapa.size === 0) return html;

  // Troca só dentro do src de <img> (não toca em texto que por acaso tenha a URL).
  return html.replace(srcRe, (full, _quote: string, src: string) => {
    const assinada = mapa.get(src);
    return assinada ? full.replace(src, assinada) : full;
  });
}
