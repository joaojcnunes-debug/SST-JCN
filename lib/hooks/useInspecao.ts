"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Cargo,
  Complemento,
  EpiEpc,
  Extintor,
  Foto,
  Inspecao,
  InspecaoMaquina,
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
  maquinas: InspecaoMaquina[];
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
        maquinasRes,
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
        supabase.from("inspecao_maquinas").select("*").eq("id_inspecao", inspId).order("ordem").order("created_at"),
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
        maquinas: (maquinasRes.data ?? []) as unknown as InspecaoMaquina[],
      };
    },
  });
}

/**
 * Atualiza a elaboração do documento (etapa do ADM) numa inspeção.
 * "assumir" → EM_ELABORACAO com o nome do ADM; "concluir" → CONCLUIDO + data;
 * "limpar" → volta a PENDENTE.
 */
export function useSalvarElaboracao(idInspecao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: {
      elaboracao_status: "PENDENTE" | "EM_ELABORACAO" | "CONCLUIDO";
      elaboracao_responsavel?: string | null;
      elaboracao_concluida_em?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      // RPC SECURITY DEFINER: altera só os 3 campos de elaboração e libera
      // Visualizadores (que não têm pode_editar). Evita abrir o UPDATE da inspeção.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("set_elaboracao_documento", {
        p_id_inspecao: idInspecao,
        p_status: patch.elaboracao_status,
        p_responsavel: patch.elaboracao_responsavel ?? null,
        p_concluida_em: patch.elaboracao_concluida_em ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      qc.invalidateQueries({ queryKey: ["dashboard-documentos-adm"] });
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
  idUnidade?: string | null;
  dataIni?: string;
  dataFim?: string;
  filtro: FiltroInspecao;
  ordem: OrdemInspecao;
  page: number;
  pageSize: number;
}

interface FiltrosBase {
  idEmpresa: string | null;
  tecnico: string;
  idUnidade?: string | null;
  dataIni?: string;
  dataFim?: string;
}

// Aplica os filtros comuns (empresa, técnico, unidade, período) a uma query de inspeções.
// `select` muda quando há filtro por unidade (inner join em empresas).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros(q: any, { idEmpresa, tecnico, idUnidade, dataIni, dataFim }: FiltrosBase) {
  let query = q.neq("status", "DELETADA");
  if (idEmpresa) query = query.eq("id_empresa", idEmpresa);
  else if (tecnico.trim().length >= 2) query = query.ilike("responsavel", `%${tecnico.trim()}%`);
  if (idUnidade) query = query.eq("empresas.id_unidade", idUnidade);
  if (dataIni) query = query.gte("data_inspecao", dataIni);
  if (dataFim) query = query.lte("data_inspecao", dataFim);
  return query;
}

export function useInspecoesPaginadas({
  idEmpresa,
  tecnico,
  idUnidade,
  dataIni,
  dataFim,
  filtro,
  ordem,
  page,
  pageSize,
}: InspecoesPaginadasParams) {
  // Lista todas as inspeções por padrão (paginadas); filtros são opcionais.
  const base: FiltrosBase = { idEmpresa, tecnico, idUnidade, dataIni, dataFim };
  // Quando filtra por unidade, precisa de inner join em empresas para o eq funcionar.
  const selLista = idUnidade ? "*, empresas!inner(nome_empresa, id_unidade)" : "*, empresas(nome_empresa)";

  const lista = useQuery({
    queryKey: ["inspecoes-lista", idEmpresa, tecnico, idUnidade, dataIni, dataFim, filtro, ordem, page, pageSize],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = aplicarFiltros(supabase.from("inspecoes").select(selLista, { count: "exact" }), base);
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
  const selCounts = idUnidade ? "status, empresas!inner(id_unidade)" : "status";
  const counts = useQuery({
    queryKey: ["inspecoes-counts", idEmpresa, tecnico, idUnidade, dataIni, dataFim],
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const q = aplicarFiltros(supabase.from("inspecoes").select(selCounts), base);
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
