"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Cargo,
  Complemento,
  EpiEpc,
  Extintor,
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
  extintores: Extintor[];
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
        extintoresRes,
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
        supabase.from("extintores").select("*").eq("id_inspecao", inspId).order("ordem"),
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
        extintores: (extintoresRes.data ?? []) as unknown as Extintor[],
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
        .select("*, empresas(nome_empresa)")
        .eq("id_empresa", idEmpresa!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Inspecao[];
    },
  });
}

export function useInspecoesByTecnico(tecnico: string) {
  const termo = tecnico.trim();
  return useQuery({
    queryKey: ["inspecoes-tecnico", termo],
    enabled: termo.length >= 2,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("inspecoes")
        .select("*, empresas(nome_empresa)")
        .ilike("responsavel", `%${termo}%`)
        .neq("status", "DELETADA")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Inspecao[];
    },
  });
}

// ─── Paginação server-side para a listagem principal ────────────────────────

export type FiltroInspecao = "Todos" | "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDA";
export type OrdemInspecao = "recentes" | "antigas" | "revisao";

interface InspecoesPaginadasParams {
  idEmpresa: string | null;
  tecnico: string;
  filtro: FiltroInspecao;
  ordem: OrdemInspecao;
  page: number;
  pageSize: number;
}

function buildBaseQuery(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  idEmpresa: string | null,
  tecnico: string
) {
  let q = supabase
    .from("inspecoes")
    .select("*, empresas(nome_empresa)", { count: "exact" })
    .neq("status", "DELETADA");
  if (idEmpresa) {
    q = q.eq("id_empresa", idEmpresa);
  } else if (tecnico.trim().length >= 2) {
    q = q.ilike("responsavel", `%${tecnico.trim()}%`);
  }
  return q;
}

export function useInspecoesPaginadas({
  idEmpresa,
  tecnico,
  filtro,
  ordem,
  page,
  pageSize,
}: InspecoesPaginadasParams) {
  const enabled = !!idEmpresa || tecnico.trim().length >= 2;

  const lista = useQuery({
    queryKey: ["inspecoes-lista", idEmpresa, tecnico, filtro, ordem, page, pageSize],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = buildBaseQuery(supabase, idEmpresa, tecnico);
      if (filtro !== "Todos") q = q.eq("status", filtro);
      if (ordem === "recentes") q = q.order("created_at", { ascending: false });
      else if (ordem === "antigas") q = q.order("created_at", { ascending: true });
      else q = q.order("revisao", { ascending: false }).order("created_at", { ascending: false });
      const from = (page - 1) * pageSize;
      q = q.range(from, from + pageSize - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { items: (data ?? []) as unknown as Inspecao[], total: count ?? 0 };
    },
  });

  // Contagens por status — busca só a coluna status (leve) para os filtros.
  const counts = useQuery({
    queryKey: ["inspecoes-counts", idEmpresa, tecnico],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("inspecoes")
        .select("status")
        .neq("status", "DELETADA");
      if (idEmpresa) q = q.eq("id_empresa", idEmpresa);
      else if (tecnico.trim().length >= 2) q = q.ilike("responsavel", `%${tecnico.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      const acc: Record<FiltroInspecao, number> = {
        Todos: 0, RASCUNHO: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0,
      };
      for (const row of (data ?? []) as Array<{ status: string }>) {
        acc.Todos++;
        const s = row.status as FiltroInspecao;
        if (s === "RASCUNHO" || s === "EM_ANDAMENTO" || s === "CONCLUIDA") acc[s]++;
      }
      return acc;
    },
  });

  return { lista, counts };
}
