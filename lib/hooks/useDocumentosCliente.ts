"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentUser } from "./useUsuario";
import type { PortalDocumentoCliente, TipoDocumentoPortal, StatusDocumentoPortal } from "@/lib/supabase/types";

export function useDocumentosCliente(filtroStatus?: StatusDocumentoPortal | "todos") {
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? null;

  return useQuery({
    queryKey: ["portal", "documentos", empresaId, filtroStatus],
    enabled: !!empresaId,
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<PortalDocumentoCliente[]> => {
      const sb = createSupabaseBrowserClient();
      let q = sb
        .from("portal_documentos_cliente")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("criado_em", { ascending: false });

      if (filtroStatus && filtroStatus !== "todos") {
        q = q.eq("status", filtroStatus);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PortalDocumentoCliente[];
    },
  });
}

export function useDocumentoCliente(id: string | null) {
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? null;

  return useQuery({
    queryKey: ["portal", "documento", id],
    enabled: !!id && !!empresaId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PortalDocumentoCliente> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("portal_documentos_cliente")
        .select("*")
        .eq("id", id!)
        .eq("empresa_id", empresaId!)
        .single();
      if (error) throw error;
      return data as PortalDocumentoCliente;
    },
  });
}

// SST team: liberar documento para o portal
export function useLiberarDocumento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      empresa_id: string;
      titulo: string;
      tipo_documento: TipoDocumentoPortal;
      modulo_origem: string;
      arquivo_pdf_url?: string;
      data_emissao?: string;
      data_validade?: string;
      criado_por?: string;
      referencia_tipo?: string;
      referencia_id?: string;
    }) => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (sb as any)
        .from("portal_documentos_cliente")
        .insert({ ...payload, status: "liberado" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["portal", "documentos", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["portal", "stats"] });
      toast.success("Documento liberado para o portal do cliente.");
    },
    onError: () => toast.error("Erro ao liberar documento."),
  });
}

export function useAtualizarStatusDocumento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusDocumentoPortal; empresa_id: string }) => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb as any)
        .from("portal_documentos_cliente")
        .update({ status, atualizado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["portal", "documentos", vars.empresa_id] });
      qc.invalidateQueries({ queryKey: ["portal", "stats"] });
    },
    onError: () => toast.error("Erro ao atualizar status do documento."),
  });
}
