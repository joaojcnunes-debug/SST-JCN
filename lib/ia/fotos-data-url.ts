// lib/ia/fotos-data-url.ts -- fotos do bucket viram data: URL para a IA de visao.
//
// Por que existe: desde 10/09 (SEC-01) o bucket `fotos` nao aceita GetObject
// anonimo. As rotas de visao mandavam a URL publica gravada no banco para o
// Groq, e o Groq -- que nao tem sessao aqui -- passou a receber 403:
// "failed to retrieve media: received status code: 403" (medido 14/09).
// O servidor baixa a foto com a sessao do usuario (RLS) e embute a imagem em
// base64, como `/api/maquina/analisar-foto` ja fazia com o upload do navegador.
//
// Quem chama decide o teto de fotos: o plano gratuito do Groq da 8.000 tokens
// de entrada por minuto e cada foto custa ~1.870 (medido em 14/09 numa JPEG de
// 868 KB) -- 4 fotos encostam no teto, 3 cabem com folga.

import { extrairPathStorage } from "@/lib/storage/signed-url";
// O painel importa este tipo do wrapper S3 do self-host (MinIO). Aqui o storage
// e o do proprio Supabase, entao o tipo sai do cliente do supabase-js.
type StorageNamespace = ReturnType<
  typeof import("@supabase/supabase-js").createClient
>["storage"];

export interface FotosDataUrl {
  /** data: URLs prontas para `image_url`, na ordem recebida. */
  prontas: string[];
  /** Entradas que nao viraram imagem (path irreconhecivel ou download falhou). */
  falhas: string[];
}

const MIME_POR_EXTENSAO: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function mimePorExtensao(path: string): string {
  const ext = path.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return MIME_POR_EXTENSAO[ext] ?? "image/jpeg";
}

export async function fotosParaDataUrl(
  storage: Pick<StorageNamespace, "from">,
  urls: readonly string[],
  max: number,
  bucket = "fotos",
): Promise<FotosDataUrl> {
  const prontas: string[] = [];
  const falhas: string[] = [];

  for (const url of urls.filter(Boolean).slice(0, max)) {
    // Ja veio embutida (preview local, ou rota antiga que aceita base64).
    if (/^data:image\//i.test(url)) {
      prontas.push(url);
      continue;
    }

    const path = extrairPathStorage(url, bucket);
    if (!path) {
      falhas.push(url);
      continue;
    }

    const { data, error } = await storage.from(bucket).download(path);
    if (error || !data) {
      falhas.push(url);
      continue;
    }

    const bytes = Buffer.from(await data.arrayBuffer());
    const mime = data.type?.startsWith("image/") ? data.type : mimePorExtensao(path);
    prontas.push(`data:${mime};base64,${bytes.toString("base64")}`);
  }

  return { prontas, falhas };
}
