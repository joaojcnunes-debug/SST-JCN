"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { acaoDeRisco, riscosElegiveis } from "@/lib/acoes/de-risco";
import { useUserStore } from "@/lib/store";
import type { Acao5W2H, Risco, Setor } from "@/lib/supabase/types";

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
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export interface ResultadoEnvioRiscos {
  enviadas: number;
  ignoradas: number;
}

/**
 * Envia os riscos Alto / Muito Alto de uma inspeção para o Plano de Ação
 * central, marcando a origem em `id_risco_origem` (v184). O índice único
 * parcial no banco impede duplicar — clicar duas vezes é seguro.
 *
 * Espelha `useEnviarAcoesParaPlanoAcao` da Apreciação NR-12, inclusive o
 * tratamento de 23505 (duas abas enviando ao mesmo tempo): em vez de mostrar
 * erro, reconsulta o que já entrou e insere só o restante.
 */
export function useEnviarRiscosParaPlanoAcao() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (params: {
      idInspecao: string;
      referenciaInspecao: string;
      riscos: Risco[];
      setores: Setor[];
    }): Promise<ResultadoEnvioRiscos> => {
      const supabase = createSupabaseBrowserClient();
      const candidatos = riscosElegiveis(params.riscos);
      if (candidatos.length === 0) return { enviadas: 0, ignoradas: 0 };

      // Quais já foram enviados antes? (dedupe pela origem)
      const { data: exist, error: exErr } = await supabase
        .from("acoes_5w2h")
        .select("id_risco_origem")
        .in("id_risco_origem", candidatos.map((r) => r.id_risco));
      if (exErr) throw exErr;
      const jaEnviados = new Set(
        ((exist ?? []) as { id_risco_origem: string | null }[])
          .map((r) => r.id_risco_origem)
          .filter(Boolean) as string[]
      );

      const montar = (rs: Risco[]) =>
        rs.map((r) =>
          acaoDeRisco(r, {
            idInspecao: params.idInspecao,
            referenciaInspecao: params.referenciaInspecao,
            setores: params.setores,
            createdBy: user?.email ?? null,
          })
        );

      const novas = montar(candidatos.filter((r) => !jaEnviados.has(r.id_risco)));

      if (novas.length > 0) {
        const { error } = await supabase
          .from("acoes_5w2h")
          .insert(novas as never);
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            const { data: ex2 } = await supabase
              .from("acoes_5w2h")
              .select("id_risco_origem")
              .in("id_risco_origem", novas.map((n) => n.id_risco_origem!));
            const jaForam = new Set(
              ((ex2 ?? []) as { id_risco_origem: string | null }[])
                .map((r) => r.id_risco_origem)
                .filter(Boolean) as string[]
            );
            const restantes = candidatos.filter(
              (r) => !jaEnviados.has(r.id_risco) && !jaForam.has(r.id_risco)
            );
            if (restantes.length > 0) {
              const { error: e2 } = await supabase
                .from("acoes_5w2h")
                .insert(montar(restantes) as never);
              if (e2) throw e2;
            }
            return {
              enviadas: restantes.length,
              ignoradas: candidatos.length - restantes.length,
            };
          }
          throw error;
        }
      }

      return {
        enviadas: novas.length,
        ignoradas: candidatos.length - novas.length,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acoes-5w2h"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
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
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}
