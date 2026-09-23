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
}

export interface RegistrarPdfArgs extends RegistrarPdfOpts {
  pdfBuffer: ArrayBuffer;
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
      // Bucket privado: pdf_url aponta p/ a rota server-side same-origin (stream com
      // creds server). Registros antigos ("pdfs-gerados/") ficam no bucket publico
      // "fotos" e mantem a URL publica armazenada.
      const comUrls = rows.map((row) => {
        if (!row.pdf_storage_path || row.pdf_storage_path.startsWith("pdfs-gerados/")) {
          return row;
        }
        return {
          ...row,
          pdf_url: `/api/pdf/gerado?path=${encodeURIComponent(row.pdf_storage_path)}`,
        };
      });
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
      return rows.map((row) => {
        if (!row.pdf_storage_path || row.pdf_storage_path.startsWith("pdfs-gerados/")) return row;
        return { ...row, pdf_url: `/api/pdf/gerado?path=${encodeURIComponent(row.pdf_storage_path)}` };
      });
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
      return { ...row, pdf_url: `/api/pdf/gerado?path=${encodeURIComponent(row.pdf_storage_path)}` };
    },
  });
}

/**
 * Aprova/congela a versão atual do laudo: gera o PDF base (via rota vetorial,
 * já com anexos) no navegador e o envia à rota /api/pdf/congelar, que faz o
 * upload imutável, calcula o sha256 e grava em pdfs_gerados com
 * status='congelado' e versão incrementada. A assinatura usa esse arquivo.
 *
 * O upload/gravação roda no SERVIDOR de propósito: o bucket `pdfs-gerados` é
 * privado e as creds do browser só escrevem em `fotos` — subir direto do
 * cliente devolve AccessDenied do MinIO (mesmo motivo de /api/sign-pdf).
 */
export function useCongelarPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ apiPdfUrl, ...opts }: RegistrarPdfOpts & { apiPdfUrl: string }) => {
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

      const fd = new FormData();
      fd.append("pdf", new Blob([buffer], { type: "application/pdf" }), "base.pdf");
      fd.append("modulo", opts.modulo);
      fd.append("idRelatorio", opts.idRelatorio ?? "");
      if (opts.tipoDocumento) fd.append("tipoDocumento", opts.tipoDocumento);
      if (opts.empresaId) fd.append("empresaId", opts.empresaId);
      if (opts.empresaNome) fd.append("empresaNome", opts.empresaNome);
      if (opts.empresaCnpj) fd.append("empresaCnpj", opts.empresaCnpj);
      if (opts.setor) fd.append("setor", opts.setor);
      if (opts.responsavelTecnico) fd.append("responsavelTecnico", opts.responsavelTecnico);

      const salvo = await fetch("/api/pdf/congelar", { method: "POST", body: fd });
      const out = await salvo.json().catch(() => ({ error: "Falha ao congelar o documento" }));
      if (!salvo.ok) {
        throw new Error((out as { error?: string }).error ?? "Falha ao congelar o documento");
      }
      const { versao, hash } = out as { versao: number; hash: string };
      return { versao, hash, modulo: opts.modulo, idRelatorio: opts.idRelatorio ?? "" };
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
      // O upload vai pela ROTA DE SERVIDOR: `pdfs-gerados` e bucket PRIVADO e a
      // credencial do browser tem escopo `fotos`/`anexos`. Ate o cutover de
      // 2026-06-26 isto subia direto daqui e funcionava, porque o storage era o
      // Supabase; desde entao o MinIO devolve AccessDenied em 100% das chamadas
      // -- e ninguem viu, porque o onError abaixo e silencioso de proposito.
      // O hash e o nome do arquivo agora sao calculados no servidor.
      const form = new FormData();
      form.append("pdf", new Blob([pdfBuffer], { type: "application/pdf" }), "documento.pdf");
      form.append("modulo", opts.modulo);
      const opcional = (chave: string, valor?: string) => {
        if (valor) form.append(chave, valor);
      };
      opcional("tipoDocumento", opts.tipoDocumento);
      opcional("idRelatorio", opts.idRelatorio);
      opcional("empresaId", opts.empresaId);
      opcional("empresaNome", opts.empresaNome);
      opcional("empresaCnpj", opts.empresaCnpj);
      opcional("setor", opts.setor);
      opcional("responsavelTecnico", opts.responsavelTecnico);

      const res = await fetch("/api/pdf/registrar", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !json?.id) {
        throw new Error(json?.error ?? `registro falhou (${res.status})`);
      }
      return { id: json.id };
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
