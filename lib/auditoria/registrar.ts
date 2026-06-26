"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface AuditLog {
  id: string;
  modulo: string;
  id_referencia: string | null;
  acao: string;
  descricao: string | null;
  empresa_id: string | null;
  usuario_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RegistrarAuditoriaArgs {
  modulo: string;
  id_referencia?: string | null;
  acao: string;
  descricao?: string | null;
  empresa_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Registra uma ação na trilha de auditoria (`document_audit_logs`).
 * Fire-and-forget: NUNCA bloqueia nem quebra a ação principal — falha é
 * apenas logada no console.
 */
export async function registrarAuditoria(args: RegistrarAuditoriaArgs): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("document_audit_logs").insert({
      modulo: args.modulo,
      id_referencia: args.id_referencia ?? null,
      acao: args.acao,
      descricao: args.descricao ?? null,
      empresa_id: args.empresa_id ?? null,
      usuario_email: user?.email ?? null,
      metadata: args.metadata ?? null,
    } as never);
  } catch (e) {
    console.warn("[auditoria] falha ao registrar (ignorado):", e);
  }
}

/** Lista a trilha de auditoria de um documento (mais recente primeiro). */
export function useAuditoria(modulo?: string, idReferencia?: string | null) {
  return useQuery({
    queryKey: ["auditoria", modulo ?? "", idReferencia ?? ""],
    enabled: !!modulo,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("document_audit_logs")
        .select("*")
        .eq("modulo", modulo!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (idReferencia) q = q.eq("id_referencia", idReferencia);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AuditLog[];
    },
  });
}
