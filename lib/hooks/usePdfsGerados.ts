"use client";

import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria/registrar";

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
  congelado_em: string | null;
  congelado_por: string | null;
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

      const rows = (data ?? []) as unknown as PdfGerado[];
      // Gera URLs assinadas (1h) para PDFs no bucket privado.
      // Registros antigos (path começa com "pdfs-gerados/") estão no bucket
      // público "fotos" e mantêm a URL pública armazenada.
      const comUrls = await Promise.all(
        rows.map(async (row) => {
          if (!row.pdf_storage_path || row.pdf_storage_path.startsWith("pdfs-gerados/")) {
            return row;
          }
          const { data: signed } = await supabase.storage
            .from("pdfs-gerados")
            .createSignedUrl(row.pdf_storage_path, 3600);
          return { ...row, pdf_url: signed?.signedUrl ?? null };
        })
      );
      return comUrls;
    },
  });
}

/** Documentos (PDFs) gerados de uma empresa específica — log unificado entre módulos. */
export function usePdfsPorEmpresa(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["pdfs-gerados-empresa", empresaId],
    enabled: !!empresaId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("pdfs_gerados")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("data_geracao", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as PdfGerado[];
      // URLs assinadas (1h) p/ PDFs no bucket privado; antigos ficam com a URL pública.
      return Promise.all(
        rows.map(async (row) => {
          if (!row.pdf_storage_path || row.pdf_storage_path.startsWith("pdfs-gerados/")) return row;
          const { data: signed } = await supabase.storage
            .from("pdfs-gerados")
            .createSignedUrl(row.pdf_storage_path, 3600);
          return { ...row, pdf_url: signed?.signedUrl ?? row.pdf_url };
        }),
      );
    },
  });
}

// ─── PDF Assinado ─────────────────────────────────────────────────────────────

export interface PdfAssinado {
  pdf_path: string;
  assinado_em: string;
  assinado_por: string;
  tipo_assinatura?: string | null;
}

/** Carrega e mantém atualizado o registro do PDF assinado para um documento. */
export function usePdfAssinado(tabelaNome?: string, docId?: string) {
  const queryClient = useQueryClient();
  const qk = ["pdf_assinado", tabelaNome ?? "", docId ?? ""];

  const { data: pdfAssinado = null } = useQuery({
    queryKey: qk,
    enabled: !!(tabelaNome && docId),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data } = await createSupabaseBrowserClient()
        .from("pdfs_assinados")
        .select("pdf_path, assinado_em, assinado_por, tipo_assinatura")
        .eq("tabela", tabelaNome!)
        .eq("doc_id", docId!)
        .single();
      return (data as PdfAssinado | null) ?? null;
    },
  });

  const recarregar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pdf_assinado", tabelaNome ?? "", docId ?? ""] });
  }, [queryClient, tabelaNome, docId]);

  // Recarrega quando BotaoGerarPdf sinaliza assinatura via evento customizado
  useEffect(() => {
    if (!tabelaNome || !docId) return;
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ tabelaNome: string; docId: string }>;
      if (ev.detail.tabelaNome === tabelaNome && ev.detail.docId === docId) {
        queryClient.invalidateQueries({ queryKey: ["pdf_assinado", tabelaNome, docId] });
      }
    };
    window.addEventListener("pdf:assinado", handler);
    return () => window.removeEventListener("pdf:assinado", handler);
  }, [tabelaNome, docId, queryClient]);

  return { pdfAssinado, recarregar };
}

// ─── Ciclo "base congelada + hash" (Fase 4) ─────────────────────────────────────

const KEY_CONGELADO = (modulo?: string, id?: string) =>
  ["pdf-congelado", modulo ?? "", id ?? ""];

/**
 * Versão congelada (aprovada) mais recente de um documento, com URL assinada
 * do arquivo imutável. É sobre este arquivo que a assinatura deve operar.
 */
export function usePdfCongelado(modulo?: string, idReferencia?: string) {
  return useQuery({
    queryKey: KEY_CONGELADO(modulo, idReferencia),
    enabled: !!(modulo && idReferencia),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("pdfs_gerados")
        .select("*")
        .eq("modulo", modulo!)
        .eq("id_relatorio", idReferencia!)
        .eq("status", "congelado")
        .order("versao", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = ((data ?? [])[0] ?? null) as PdfGerado | null;
      if (!row?.pdf_storage_path) return row;
      const { data: signed } = await supabase.storage
        .from("pdfs-gerados")
        .createSignedUrl(row.pdf_storage_path, 3600);
      return { ...row, pdf_url: signed?.signedUrl ?? row.pdf_url };
    },
  });
}

/**
 * Aprova/congela a versão atual do laudo: gera o PDF base (via rota vetorial,
 * já com anexos), faz upload imutável, calcula o sha256 e grava em pdfs_gerados
 * com status='congelado' e versão incrementada. A assinatura usa esse arquivo.
 */
export function useCongelarPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ apiPdfUrl, ...opts }: RegistrarPdfOpts & { apiPdfUrl: string }) => {
      const supabase = createSupabaseBrowserClient();

      // A base congelada é o arquivo que será ASSINADO. Por isso gera já com o
      // selo digital (assinado=1) — senão a base sai com a linha de assinatura
      // manual em branco e a re-assinatura (que assina a base) reproduz isso.
      // Rotas que não tratam o param simplesmente o ignoram (sem efeito colateral).
      const sep = apiPdfUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${apiPdfUrl}${sep}assinado=1`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Falha ao gerar o PDF base" }));
        throw new Error((err as { error?: string }).error ?? "Falha ao gerar o PDF base");
      }
      const buffer = await res.arrayBuffer();
      const hash = await computeSha256(buffer);

      const { data: ult } = await supabase
        .from("pdfs_gerados")
        .select("versao")
        .eq("modulo", opts.modulo)
        .eq("id_relatorio", opts.idRelatorio ?? "")
        .order("versao", { ascending: false })
        .limit(1);
      const proxVersao =
        (((ult ?? [])[0] as { versao?: number } | undefined)?.versao ?? 0) + 1;

      const storagePath = `${opts.modulo}/${opts.idRelatorio}-v${proxVersao}-${hash.slice(0, 8)}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("pdfs-gerados")
        .upload(storagePath, new Uint8Array(buffer), {
          contentType: "application/pdf",
          cacheControl: "3600",
          upsert: true,
        });
      if (upErr) throw upErr;

      const { data: { user } } = await supabase.auth.getUser();

      // Marca as versões congeladas anteriores deste documento como substituídas,
      // garantindo que só a nova permaneça vigente (status='congelado').
      await supabase
        .from("pdfs_gerados")
        .update({ status: "substituido" } as never)
        .eq("modulo", opts.modulo)
        .eq("id_relatorio", opts.idRelatorio ?? "")
        .eq("status", "congelado");

      const { error } = await supabase
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
          usuario_email: user?.email ?? null,
          pdf_storage_path: storagePath,
          pdf_url: null,
          hash_sha256: hash,
          status: "congelado",
          versao: proxVersao,
          congelado_em: new Date().toISOString(),
          congelado_por: user?.email ?? null,
        } as never);
      if (error) throw error;
      return { versao: proxVersao, hash, modulo: opts.modulo, idRelatorio: opts.idRelatorio ?? "" };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: KEY_CONGELADO(d.modulo, d.idRelatorio) });
      qc.invalidateQueries({ queryKey: KEY() });
      registrarAuditoria({
        modulo: d.modulo,
        id_referencia: d.idRelatorio,
        acao: "congelou_pdf",
        descricao: `Versão ${d.versao} aprovada e congelada (hash ${d.hash.slice(0, 12)}…)`,
      });
      toast.success(`Versão ${d.versao} aprovada e congelada`);
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useRegistrarPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pdfBuffer, ...opts }: RegistrarPdfArgs) => {
      const supabase = createSupabaseBrowserClient();

      // Compute SHA-256 fingerprint
      const hash = await computeSha256(pdfBuffer);

      // Upload ao bucket privado "pdfs-gerados"
      const nomeArquivo = `${opts.modulo}-${Date.now()}-${hash.slice(0, 8)}.pdf`;
      const storagePath = `${opts.modulo}/${nomeArquivo}`;
      const { error: upErr } = await supabase.storage
        .from("pdfs-gerados")
        .upload(storagePath, new Uint8Array(pdfBuffer), {
          contentType: "application/pdf",
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) throw upErr;

      // Inserir registro (pdf_url fica null — gerada sob demanda via signed URL)
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
          pdf_url: null,
          hash_sha256: hash,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEY() });
      registrarAuditoria({
        modulo: vars.modulo,
        id_referencia: vars.idRelatorio ?? null,
        acao: "gerou_pdf",
        descricao: vars.tipoDocumento ?? null,
        empresa_id: vars.empresaId ?? null,
      });
    },
    // Erros são silenciosos — o download do usuário não deve ser bloqueado
    onError: (e: Error) => {
      console.warn("[usePdfsGerados] Falha ao registrar PDF:", e.message);
    },
  });
}
