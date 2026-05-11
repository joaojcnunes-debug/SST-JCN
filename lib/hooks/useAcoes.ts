"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Acao5W2H } from "@/lib/supabase/types";

export function useAcoes(opts?: { idEmpresa?: string | null }) {
  return useQuery({
    queryKey: ["acoes-5w2h", opts?.idEmpresa ?? "todas"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("acoes_5w2h")
        .select("*")
        .order("when_prazo", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (opts?.idEmpresa) {
        q = q.eq("id_empresa", opts.idEmpresa);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Acao5W2H[];
    },
  });
}

export function useSaveAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<Acao5W2H> & { id_acao: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { id_acao, ...rest } = a;
      const payload = { ...rest, updated_at: new Date().toISOString() };
      // Patch parcial (sem campos obrigatórios id_empresa/what_acao) → UPDATE
      if (rest.id_empresa === undefined || rest.what_acao === undefined) {
        const { error } = await supabase
          .from("acoes_5w2h")
          .update(payload as never)
          .eq("id_acao", id_acao);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("acoes_5w2h")
        .upsert({ id_acao, ...payload } as never, { onConflict: "id_acao" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acoes-5w2h"] });
      toast.success("Ação salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idAcao: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("acoes_5w2h")
        .delete()
        .eq("id_acao", idAcao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acoes-5w2h"] });
      toast.success("Ação removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
