// Camada de resolução de mídia do Storage (preparação p/ privatizar fotos/anexos).
// Aceita tanto o PATH puro quanto uma URL pública/assinada legada e extrai o path,
// para então gerar URL assinada. Enquanto o bucket ainda é público, isto funciona
// igual; quando privatizar, continua funcionando (usuário autenticado tem SELECT).

/**
 * Extrai o path interno do bucket a partir de um valor armazenado, que pode ser:
 * - um path puro (ex.: "inspecoes/123/foto.jpg")
 * - uma URL pública (".../object/public/<bucket>/<path>?...")
 * - uma URL assinada (".../object/sign/<bucket>/<path>?token=...")
 * Retorna null se o valor for vazio ou claramente de outro bucket/origem.
 */
export function extrairPathStorage(
  stored: string | null | undefined,
  bucket: string,
): string | null {
  if (!stored) return null;
  const s = stored.trim();
  if (!s) return null;

  for (const marker of [`/object/public/${bucket}/`, `/object/sign/${bucket}/`]) {
    const i = s.indexOf(marker);
    if (i >= 0) {
      return decodeURIComponent(s.slice(i + marker.length).split("?")[0]);
    }
  }

  // URL absoluta do storage self-host (MinIO), na forma <endpoint>/<bucket>/<path>.
  // É o formato que `getPublicUrl` grava hoje. Sem este caso, todo valor legado
  // cai no `return null` abaixo, a leitura degrada para a URL crua, e num bucket
  // privado isso vira 403 em silêncio (foi o que quebrou o `anexos` no SEC-01).
  for (const base of [
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_ENDPOINT,
    process.env.NEXT_PUBLIC_STORAGE_ENDPOINT,
  ]) {
    if (!base) continue;
    const prefixo = `${base.replace(/\/+$/, "")}/${bucket}/`;
    if (s.startsWith(prefixo)) {
      return decodeURIComponent(s.slice(prefixo.length).split("?")[0]);
    }
  }

  // Origens que NÃO são objeto do bucket — não tentar assinar (senão o Supabase
  // responde "Object not found" e o toast global de erro dispara):
  //  - preview local em memória (data:/blob:);
  //  - asset estático do app servido pelo Next (/owas/1.svg, /logo.png, etc.);
  //  - URL de outra origem/bucket.
  if (/^(data:|blob:)/i.test(s)) return null;
  if (s.startsWith("/")) return null;
  if (/^https?:\/\//i.test(s)) return null;

  // Path puro — tolera prefixo "<bucket>/".
  return s.replace(new RegExp(`^${bucket}/`), "");
}

/** Heurística: o valor já é uma URL pública do bucket informado? */
export function ehUrlPublica(stored: string | null | undefined, bucket: string): boolean {
  return !!stored && stored.includes(`/object/public/${bucket}/`);
}
