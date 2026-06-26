// Helper server-side: busca os anexos de um laudo e mescla no PDF.
// Usado nas rotas /api/pdf/<modulo>/[id].

import type { createSupabaseServerClient } from "@/lib/supabase/client";
import { mesclarAnexos } from "@/lib/pdf/anexar";
import { assinarUmaMidiaPdf } from "@/lib/pdf/assinar-midia";
import type { Anexo, ModuloAnexo } from "./types";

type ServerClient = ReturnType<typeof createSupabaseServerClient>;

/**
 * Aplica os anexos marcados com incluir_no_pdf ao PDF do laudo.
 * Devolve os bytes finais (inalterados se não houver anexos).
 */
export async function aplicarAnexosNoPdf(
  supabase: ServerClient,
  modulo: ModuloAnexo,
  idReferencia: string,
  laudoPdf: Uint8Array | Buffer,
): Promise<Uint8Array<ArrayBuffer>> {
  const { data } = await supabase
    .from("anexos")
    .select("*")
    .eq("modulo", modulo)
    .eq("id_referencia", idReferencia)
    .eq("incluir_no_pdf", true)
    .order("ordem", { ascending: true });

  const anexos = (data ?? []) as unknown as Anexo[];
  // URL assinada (bucket privado-ready) p/ o fetch do mesclarAnexos; fallback p/ original.
  const itens = await Promise.all(
    anexos.map(async (a) => ({
      nome: a.nome,
      descricao: a.descricao,
      url: await assinarUmaMidiaPdf(supabase, a.url, "anexos"),
      mime: a.mime,
      tipo: a.tipo,
    })),
  );
  const merged = await mesclarAnexos(laudoPdf, itens);
  // Normaliza para Uint8Array<ArrayBuffer> (aceito por NextResponse / BodyInit).
  return new Uint8Array(merged);
}
