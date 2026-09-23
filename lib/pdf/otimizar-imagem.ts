/**
 * Encolhe as fotos ANTES de o Puppeteer embutir no PDF.
 *
 * O problema medido em 2026-08-07 no laudo da Green Fruit: as fotos entram como
 * saem do celular (1536×2048, ~850 KB cada) para serem exibidas em 120×90 no
 * papel. Resultado: **98% do arquivo eram imagens** — 30 MB num laudo cujo
 * texto, tabelas e estrutura somam 0,57 MB.
 *
 * A saída usa o otimizador que o próprio Next já expõe (`/_next/image`), com o
 * `sharp` presente na imagem de produção e o storage já autorizado em
 * `next.config.ts` (`images.remotePatterns`). Nada novo para instalar.
 *
 * ⚠️ POR QUE PEDIR JPEG EXPLICITAMENTE: por padrão o Chrome anuncia que aceita
 * WebP e o otimizador devolve WebP. Como PDF não tem WebP, o Chrome **regrava a
 * imagem sem compressão** (FlateDecode) — a foto encolhe e o arquivo não. Medido:
 * 30,07 MB → 27,17 MB (WebP) contra 30,07 MB → 2,72 MB (JPEG).
 *
 * ⚠️ POR QUE EMBUTIR COMO data: URI, e não apontar a `src` para o otimizador:
 * assim o download acontece AQUI, onde dá para tratar falha. Se o otimizador
 * responder erro, devolvemos a URL original e o laudo sai como sempre saiu —
 * uma `src` quebrada significaria laudo entregue SEM a foto da não conformidade.
 * Mesma filosofia de `assinar-midia.ts`: em qualquer falha, degrada para o
 * comportamento atual.
 *
 * Não toca no arquivo do storage: o original continua lá, em tamanho cheio.
 */

/** A app fala consigo mesma dentro do container. */
const BASE = process.env.PDF_IMG_BASE_URL ?? "http://127.0.0.1:3000";

/** Precisa ser um valor de `images.deviceSizes` do Next, senão volta HTTP 400. */
const LARGURA = 640;

/** 640 px para um espaço de 120 px no papel = 5× o que a impressão usa. */
const QUALIDADE = 70;

/** Se o otimizador travar, o laudo não pode travar junto. */
const TIMEOUT_MS = 20_000;

/**
 * Devolve a foto como data: URI reduzida, ou a URL original se algo falhar.
 * `data:` e vazio passam direto.
 */
export async function otimizarFotoPdf(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;

  try {
    const alvo =
      `${BASE}/_next/image?url=${encodeURIComponent(url)}` +
      `&w=${LARGURA}&q=${QUALIDADE}`;

    const resp = await fetch(alvo, {
      headers: { Accept: "image/jpeg,image/png;q=0.9" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) return url;

    const tipo = resp.headers.get("content-type") ?? "";
    if (!tipo.startsWith("image/")) return url;

    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0) return url;

    return `data:${tipo};base64,${buf.toString("base64")}`;
  } catch {
    return url; // rede, timeout, otimizador fora do ar → original
  }
}

/** Versão em lote, preservando a ordem. */
export async function otimizarFotosPdf(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map(otimizarFotoPdf));
}
