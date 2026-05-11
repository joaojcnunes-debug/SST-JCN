"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Cargo,
  Complemento,
  EpiEpc,
  Foto,
  Inspecao,
  PaeContato,
  Responsavel,
  Risco,
  Setor,
  TreinamentoNR,
  TreinamentoSetorRel,
  TreinamentoCargoRel,
  TreinamentoRiscoRel,
} from "@/lib/supabase/types";

export interface InspecaoFull {
  inspecao: Inspecao;
  setores: Setor[];
  cargos: Cargo[];
  riscos: Risco[];
  epis: EpiEpc[];
  fotos: Foto[];
  responsaveis: Responsavel[];
  complementos: Complemento[];
  paeContatos: PaeContato[];
  treinamentos: TreinamentoNR[];
  treinamentosSetor: TreinamentoSetorRel[];
  treinamentosCargo: TreinamentoCargoRel[];
  treinamentosRisco: TreinamentoRiscoRel[];
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
        compRes,
        paeRes,
        treinaRes,
      ] = await Promise.all([
        supabase.from("inspecoes").select("*").eq("id_inspecao", inspId).single(),
        supabase.from("setores").select("*").eq("id_inspecao", inspId).order("setor_ghe"),
        supabase.from("cargos").select("*").eq("id_inspecao", inspId).order("cargo"),
        supabase.from("riscos").select("*").eq("id_inspecao", inspId),
        supabase.from("epi_epc").select("*").eq("id_inspecao", inspId),
        supabase.from("fotos").select("*").eq("id_inspecao", inspId).order("data_upload"),
        supabase.from("responsaveis").select("*").eq("id_inspecao", inspId),
        supabase.from("complementos").select("*").eq("id_inspecao", inspId),
        supabase.from("pae_contatos").select("*").eq("id_inspecao", inspId).order("ordem"),
        supabase.from("treinamentos_nr").select("*").eq("id_inspecao", inspId).order("ordem"),
      ]);

      if (inspRes.error) throw inspRes.error;

      const treinamentos = (treinaRes.data ?? []) as unknown as TreinamentoNR[];
      const idsTreina = treinamentos.map((t) => t.id_treinamento);

      // Relações M:N só carregam se há treinamentos (evita query inútil)
      const [setRelRes, carRelRes, risRelRes] = idsTreina.length
        ? await Promise.all([
            supabase.from("treinamentos_setor").select("*").in("id_treinamento", idsTreina),
            supabase.from("treinamentos_cargo").select("*").in("id_treinamento", idsTreina),
            supabase.from("treinamentos_risco").select("*").in("id_treinamento", idsTreina),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }];

      return {
        inspecao: inspRes.data as unknown as Inspecao,
        setores: (setoresRes.data ?? []) as unknown as Setor[],
        cargos: (cargosRes.data ?? []) as unknown as Cargo[],
        riscos: (riscosRes.data ?? []) as unknown as Risco[],
        epis: (episRes.data ?? []) as unknown as EpiEpc[],
        fotos: (fotosRes.data ?? []) as unknown as Foto[],
        responsaveis: (respRes.data ?? []) as unknown as Responsavel[],
        complementos: (compRes.data ?? []) as unknown as Complemento[],
        paeContatos: (paeRes.data ?? []) as unknown as PaeContato[],
        treinamentos,
        treinamentosSetor: (setRelRes.data ?? []) as unknown as TreinamentoSetorRel[],
        treinamentosCargo: (carRelRes.data ?? []) as unknown as TreinamentoCargoRel[],
        treinamentosRisco: (risRelRes.data ?? []) as unknown as TreinamentoRiscoRel[],
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
