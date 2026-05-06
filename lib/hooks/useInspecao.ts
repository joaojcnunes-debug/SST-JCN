"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Cargo,
  EpiEpc,
  Foto,
  Inspecao,
  Responsavel,
  Risco,
  Setor,
} from "@/lib/supabase/types";

export interface InspecaoFull {
  inspecao: Inspecao;
  setores: Setor[];
  cargos: Cargo[];
  riscos: Risco[];
  epis: EpiEpc[];
  fotos: Foto[];
  responsaveis: Responsavel[];
}

export function useInspecao(id: string | null | undefined) {
  return useQuery({
    queryKey: ["inspecao", id],
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<InspecaoFull> => {
      const supabase = createSupabaseBrowserClient();
      const inspId = id!;

      const [
        inspRes,
        setoresRes,
        cargosRes,
        riscosRes,
        episRes,
        fotosRes,
        respRes,
      ] = await Promise.all([
        supabase.from("inspecoes").select("*").eq("id_inspecao", inspId).single(),
        supabase.from("setores").select("*").eq("id_inspecao", inspId).order("setor_ghe"),
        supabase.from("cargos").select("*").eq("id_inspecao", inspId).order("cargo"),
        supabase.from("riscos").select("*").eq("id_inspecao", inspId),
        supabase.from("epi_epc").select("*").eq("id_inspecao", inspId),
        supabase.from("fotos").select("*").eq("id_inspecao", inspId).order("data_upload"),
        supabase.from("responsaveis").select("*").eq("id_inspecao", inspId),
      ]);

      if (inspRes.error) throw inspRes.error;

      return {
        inspecao: inspRes.data as unknown as Inspecao,
        setores: (setoresRes.data ?? []) as unknown as Setor[],
        cargos: (cargosRes.data ?? []) as unknown as Cargo[],
        riscos: (riscosRes.data ?? []) as unknown as Risco[],
        epis: (episRes.data ?? []) as unknown as EpiEpc[],
        fotos: (fotosRes.data ?? []) as unknown as Foto[],
        responsaveis: (respRes.data ?? []) as unknown as Responsavel[],
      };
    },
  });
}

export function useInspecoesByEmpresa(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["inspecoes", idEmpresa],
    enabled: !!idEmpresa,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("inspecoes")
        .select("*")
        .eq("id_empresa", idEmpresa!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Inspecao[];
    },
  });
}
