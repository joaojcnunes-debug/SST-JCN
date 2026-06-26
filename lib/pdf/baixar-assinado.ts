import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Baixa um PDF do bucket `pdfs-assinados` de forma À PROVA DE CACHE.
 *
 * O caminho do arquivo é o mesmo a cada (re)assinatura (sobrescrito via upsert),
 * então o CDN/navegador servia a versão ANTIGA do mesmo path — o laudo baixado
 * vinha defasado (empresa/assinatura de uma versão anterior). Usar uma URL
 * assinada (token único por chamada) + `fetch` com `no-store` força sempre a
 * versão atual do servidor.
 */
export async function baixarPdfAssinado(
  pdfPath: string,
  downloadName: string,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data: signed, error } = await supabase.storage
    .from("pdfs-assinados")
    .createSignedUrl(pdfPath, 120);
  if (error || !signed?.signedUrl) {
    throw new Error("Não foi possível gerar o link do PDF assinado.");
  }
  const res = await fetch(`${signed.signedUrl}&t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Não foi possível baixar o PDF assinado.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  a.click();
  // Firefox precisa que a URL exista quando processa o clique.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
