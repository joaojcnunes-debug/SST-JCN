import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { extrairPathStorage } from "@/lib/storage/signed-url";

/**
 * Abre uma mídia do Storage numa nova aba via URL ASSINADA (telas autenticadas).
 * Usado em "clique para ampliar" / "abrir anexo", onde não dá para usar o
 * componente <StorageImg>. Mantém o padrão fallback-seguro: valor de origem
 * externa / sem path do bucket abre direto; falha de assinatura abre o original.
 */
export async function abrirMidiaAssinada(
  stored: string | null | undefined,
  bucket = "fotos",
): Promise<void> {
  if (!stored) return;
  const path = extrairPathStorage(stored, bucket);
  if (!path) {
    window.open(stored, "_blank", "noopener");
    return;
  }
  try {
    const sb = createSupabaseBrowserClient();
    const { data } = await sb.storage.from(bucket).createSignedUrl(path, 120);
    window.open(data?.signedUrl ?? stored, "_blank", "noopener");
  } catch {
    window.open(stored, "_blank", "noopener");
  }
}
