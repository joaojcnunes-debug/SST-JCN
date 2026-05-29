"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PdfGerado {
  id: string;
  modulo: string;
  tipo_documento: string | null;
  id_relatorio: string | null;
  empresa_id: string | null;
  empresa_nome: string | null;
  empresa_cnpj: string | null;
  setor: string | null;
  responsavel_tecnico: string | null;
  usuario_email: string | null;
  data_geracao: string;
  status: string;
  versao: number;
  pdf_storage_path: string | null;
  pdf_url: string | null;
  pdf_assinado_url: string | null;
  assinado: boolean;
  data_assinatura: string | null;
  observacoes: string | null;
  hash_sha256: string | null;
  created_at: string;
}

export interface RegistrarPdfOpts {
  modulo: string;
  tipoDocumento?: string;
  idRelatorio?: string;
  empresaId?: string;
  empresaNome?: string;
  empresaCnpj?: string;
  setor?: string;
  responsavelTecnico?: string;
  usuarioEmail?: string;
}

export interface RegistrarPdfArgs extends RegistrarPdfOpts {
  pdfBuffer: ArrayBuffer;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

const KEY = (modulo?: string) =>
  modulo ? ["pdfs-gerados", modulo] : ["pdfs-gerados"];

export function usePdfsGerados(filtros?: { modulo?: string; limit?: number }) {
  return useQuery({
    queryKey: KEY(filtros?.modulo),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("pdfs_gerados")
        .select("*")
        .order("data_geracao", { ascending: false })
        .limit(filtros?.limit ?? 100);
      if (filtros?.modulo) q = q.eq("modulo", filtros.modulo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PdfGerado[];
    },
  });
}

export function useRegistrarPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pdfBuffer, ...opts }: RegistrarPdfArgs) => {
      const supabase = createSupabaseBrowserClient();

      // Compute SHA-256 fingerprint
      const hash = await computeSha256(pdfBuffer);

      // Upload ao bucket "fotos" em pdfs-gerados/
      const nomeArquivo = `${opts.modulo}-${Date.now()}-${hash.slice(0, 8)}.pdf`;
      const storagePath = `pdfs-gerados/${opts.modulo}/${nomeArquivo}`;
      const { error: upErr } = await supabase.storage
        .from("fotos")
        .upload(storagePath, new Uint8Array(pdfBuffer), {
          contentType: "application/pdf",
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(storagePath);
      const pdfUrl = pub?.publicUrl ?? null;

      // Inserir registro
      const { data, error } = await supabase
        .from("pdfs_gerados")
        .insert({
          modulo: opts.modulo,
          tipo_documento: opts.tipoDocumento ?? null,
          id_relatorio: opts.idRelatorio ?? null,
          empresa_id: opts.empresaId ?? null,
          empresa_nome: opts.empresaNome ?? null,
          empresa_cnpj: opts.empresaCnpj ?? null,
          setor: opts.setor ?? null,
          responsavel_tecnico: opts.responsavelTecnico ?? null,
          usuario_email: opts.usuarioEmail ?? null,
          pdf_storage_path: storagePath,
          pdf_url: pdfUrl,
          hash_sha256: hash,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY() });
    },
    // Erros são silenciosos — o download do usuário não deve ser bloqueado
    onError: (e: Error) => {
      console.warn("[usePdfsGerados] Falha ao registrar PDF:", e.message);
    },
  });
}
