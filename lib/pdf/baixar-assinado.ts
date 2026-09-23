/**
 * Baixa um PDF do bucket PRIVADO `pdfs-assinados` de forma À PROVA DE CACHE.
 *
 * Self-host: o bucket é privado e as creds do browser têm escopo `fotos` (público),
 * então NÃO dá pra presignar/baixar direto do storage pelo cliente. O download passa
 * pela rota server-side /api/pdf/assinado (mesma origem, com sessão), que baixa do
 * MinIO com as creds server e devolve os bytes. `?t=` + `no-store` evitam cache.
 */
export async function baixarPdfAssinado(
  pdfPath: string,
  downloadName: string,
): Promise<void> {
  const res = await fetch(
    `/api/pdf/assinado?path=${encodeURIComponent(pdfPath)}&t=${Date.now()}`,
    { cache: "no-store" },
  );
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
