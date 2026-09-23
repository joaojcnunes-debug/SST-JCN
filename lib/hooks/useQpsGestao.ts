"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  QpsMonitoramento,
  QpsPlanoAcao5w2h,
  QpsPlanoMedidas,
  QpsRevisao,
  StatusQpsPlanoAcao5w2h,
} from "@/lib/supabase/types";

/**
 * Gestão do questionário "igual ao DRPS" (v225, decisão do Sanmyo em 17/09/2026):
 * Plano de Ação 5W2H, Plano Anual de Medidas, Monitoramento e Revisão. Cada
 * bloco espelha o hook correspondente de `useDrps.ts` / `useDrpsPlanoAcao.ts`,
 * trocando id_relatorio → id_aplicacao e topico_idx → id_categoria.
 */

// As qps_* não estão nos tipos gerados do Database (igual em useQuestionarios.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function qpsDb() { return createSupabaseBrowserClient() as any; }

// ============================================================
// PLANO DE AÇÃO 5W2H
// ============================================================

const KEY_5W2H = (idAplicacao: string | null | undefined) => ["qps-plano-acao-5w2h", idAplicacao];

export function useQpsPlanoAcao5w2h(idAplicacao: string | null | undefined) {
  return useQuery({
    queryKey: KEY_5W2H(idAplicacao),
    enabled: !!idAplicacao,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<QpsPlanoAcao5w2h[]> => {
      const { data, error } = await qpsDb()
        .from("qps_plano_acao_5w2h")
        .select("*")
        .eq("id_aplicacao", idAplicacao!)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface SalvarLinhaQpsPlanoAcaoArgs {
  /** Sem id → INSERT; com id → UPDATE. */
  id?: string;
  id_aplicacao: string;
  ordem: number;
  acao?: string | null;
  justificativa?: string | null;
  onde?: string | null;
  prazo?: string | null;
  responsavel?: string | null;
  como?: string | null;
  quanto_custa?: string | null;
  status?: StatusQpsPlanoAcao5w2h;
  /** Quando true, não dispara toast de sucesso (ex.: ao adicionar linha em branco). */
  _silent?: boolean;
}

export function useSalvarLinhaQpsPlanoAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: SalvarLinhaQpsPlanoAcaoArgs) => {
      const sb = qpsDb();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, _silent: _, ...campos } = args;
      const payload = { ...campos, updated_at: new Date().toISOString() };
      if (id) {
        const { error } = await sb.from("qps_plano_acao_5w2h").update(payload).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await sb
        .from("qps_plano_acao_5w2h")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: KEY_5W2H(vars.id_aplicacao) });
      if (!vars._silent) toast.success("Ação salva");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useRemoverLinhaQpsPlanoAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; id_aplicacao: string }) => {
      const { error } = await qpsDb().from("qps_plano_acao_5w2h").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: KEY_5W2H(vars.id_aplicacao) });
      toast.success("Ação removida");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ============================================================
// PLANO ANUAL DE MEDIDAS
// ============================================================

export function useQpsPlanoMedidas(idAplicacao: string | null | undefined, ano: number) {
  return useQuery({
    queryKey: ["qps-plano-medidas", idAplicacao, ano],
    enabled: !!idAplicacao,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<QpsPlanoMedidas | null> => {
      const { data, error } = await qpsDb()
        .from("qps_plano_medidas")
        .select("*")
        .eq("id_aplicacao", idAplicacao!)
        .eq("ano", ano)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useQpsSalvarPlanoMedidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id_aplicacao: string; ano: number; plano: QpsPlanoMedidas["plano"] }) => {
      const { error } = await qpsDb()
        .from("qps_plano_medidas")
        .upsert(
          { ...args, updated_at: new Date().toISOString() },
          { onConflict: "id_aplicacao,ano" },
        );
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ["qps-plano-medidas", vars.id_aplicacao, vars.ano] });
      toast.success("Plano salvo");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ============================================================
// MONITORAMENTO (setor × categoria)
// ============================================================

export function useQpsMonitoramento(idAplicacao: string | null | undefined) {
  return useQuery({
    queryKey: ["qps-monitoramento", idAplicacao],
    enabled: !!idAplicacao,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<QpsMonitoramento[]> => {
      const { data, error } = await qpsDb()
        .from("qps_monitoramento")
        .select("*")
        .eq("id_aplicacao", idAplicacao!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useQpsSalvarMonitoramento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      m: Partial<QpsMonitoramento> & { id_aplicacao: string; setor: string; id_categoria: string },
    ) => {
      const { error } = await qpsDb()
        .from("qps_monitoramento")
        .upsert(
          { ...m, updated_at: new Date().toISOString() },
          { onConflict: "id_aplicacao,setor,id_categoria" },
        );
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ["qps-monitoramento", vars.id_aplicacao] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ============================================================
// REVISÃO E MELHORIA
// ============================================================

export function useQpsRevisao(idAplicacao: string | null | undefined) {
  return useQuery({
    queryKey: ["qps-revisao", idAplicacao],
    enabled: !!idAplicacao,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<QpsRevisao | null> => {
      const { data, error } = await qpsDb()
        .from("qps_revisao")
        .select("*")
        .eq("id_aplicacao", idAplicacao!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useQpsSalvarRevisao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id_aplicacao: string;
      checklist?: QpsRevisao["checklist"];
      equipe?: QpsRevisao["equipe"];
      anotacoes?: string | null;
    }) => {
      const { error } = await qpsDb()
        .from("qps_revisao")
        .upsert({ ...args, updated_at: new Date().toISOString() }, { onConflict: "id_aplicacao" });
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ["qps-revisao", vars.id_aplicacao] });
      toast.success("Revisão salva");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}
