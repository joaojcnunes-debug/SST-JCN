// lib/supabase/server-storage-creds.ts -- credenciais SERVER-ONLY do storage.
//
// Vive fora do client.ts de proposito, por dois motivos:
//
//  1. TESTABILIDADE -- o client.ts importa @supabase/ssr (CJS), que o
//     `node --test` nao consegue carregar por named import. Isolado aqui, o
//     contrato fica coberto por client-storage-creds.test.ts.
//  2. PREGUICA OBRIGATORIA -- o client.ts tambem e importado pelo BROWSER, e no
//     bundle client `process.env.STORAGE_*` NUNCA existe (o Next so inlina
//     NEXT_PUBLIC_*). Validar no topo do modulo derrubaria o frontend inteiro;
//     por isso a checagem so acontece quando um client de SERVIDOR e criado.
//
// Nao ha fallback para as creds publicas do bundle. O fallback antigo
// (`process.env.STORAGE_ACCESS_KEY_ID ?? pubKeyId`) era mudo: se a variavel
// sumisse do env, o servidor seguia de pe com a credencial do uploader --
// escopo `fotos`/`anexos` -- e perdia certificados e pdfs-* inteiros. O sintoma
// chegava como "o PDF nao abre", a quatro camadas da causa.

export interface ServerStorageCreds {
  accessKeyId: string;
  secretAccessKey: string;
}

export function requireServerStorageCreds(): ServerStorageCreds {
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY ?? "";

  const faltando: string[] = [];
  if (!accessKeyId) faltando.push("STORAGE_ACCESS_KEY_ID");
  if (!secretAccessKey) faltando.push("STORAGE_SECRET_ACCESS_KEY");

  if (faltando.length > 0) {
    throw new Error(
      `${faltando.join(" e ")} nao configurado no servidor -- sem essa credencial ` +
        "os buckets privados (certificados, pdfs-gerados, pdfs-assinados) ficam " +
        "inacessiveis. O fallback para as creds publicas do bundle foi removido."
    );
  }

  return { accessKeyId, secretAccessKey };
}
