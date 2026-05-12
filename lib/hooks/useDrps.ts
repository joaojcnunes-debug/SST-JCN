"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  DrpsEmpresaConfig,
  DrpsProbabilidade,
  DrpsRespondente,
} from "@/lib/drps/types";
import type { LinhaParsed } from "@/lib/drps/calculos";

export function useDrpsRespondentes(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["drps-respondentes", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_respondentes")
        .select("*")
        .eq("id_empresa", idEmpresa!)
        .order("importado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DrpsRespondente[];
    },
  });
}

export function useDrpsProbabilidades(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["drps-probabilidades", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_probabilidades")
        .select("*")
        .eq("id_empresa", idEmpresa!);
      if (error) throw error;
      return (data ?? []) as unknown as DrpsProbabilidade[];
    },
  });
}

export interface ImportarLote {
  id_empresa: string;
  linhas: LinhaParsed[];
}

export function useDrpsImportar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_empresa, linhas }: ImportarLote) => {
      if (linhas.length === 0) throw new Error("Nada para importar");
      const supabase = createSupabaseBrowserClient();
      // gen_random_uuid() no DB cuida do lote_importacao por linha, mas pra
      // manter agrupado, geramos um único lote no cliente e enviamos.
      const lote = crypto.randomUUID();
      const rows = linhas.map((l) => ({
        id_empresa,
        setor: l.setor,
        cargo: l.cargo,
        respostas: l.respostas,
        data_carimbo: l.data_carimbo,
        lote_importacao: lote,
      }));
      const { error } = await supabase
        .from("drps_respondentes")
        .insert(rows as never);
      if (error) throw error;
      return { lote, total: rows.length };
    },
    onSuccess: ({ total }, vars) => {
      qc.invalidateQueries({
        queryKey: ["drps-respondentes", vars.id_empresa],
      });
      toast.success(`${total} respondente(s) importado(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDrpsLimparTudo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idEmpresa: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("drps_respondentes")
        .delete()
        .eq("id_empresa", idEmpresa);
      if (error) throw error;
    },
    onSuccess: (_v, idEmpresa) => {
      qc.invalidateQueries({ queryKey: ["drps-respondentes", idEmpresa] });
      toast.success("Respondentes removidos");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface SalvarProbabilidadeArgs {
  id_empresa: string;
  setor: string;
  topico_idx: number;
  probabilidade: 1 | 2 | 3;
}

export function useDrpsEmpresaConfig(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["drps-empresa-config", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_empresa_config")
        .select("*")
        .eq("id_empresa", idEmpresa!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DrpsEmpresaConfig | null;
    },
  });
}

export function useDrpsSalvarEmpresaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: Partial<DrpsEmpresaConfig> & { id_empresa: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("drps_empresa_config")
        .upsert(
          {
            ...cfg,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "id_empresa" }
        );
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({
        queryKey: ["drps-empresa-config", vars.id_empresa],
      });
      toast.success("Configurações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDrpsSalvarProbabilidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: SalvarProbabilidadeArgs) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("drps_probabilidades")
        .upsert(
          {
            id_empresa: args.id_empresa,
            setor: args.setor,
            topico_idx: args.topico_idx,
            probabilidade: args.probabilidade,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "id_empresa,setor,topico_idx" }
        );
      if (error) throw error;
    },
    onSuccess: (_v, args) => {
      qc.invalidateQueries({
        queryKey: ["drps-probabilidades", args.id_empresa],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
