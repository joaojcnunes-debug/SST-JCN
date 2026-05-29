"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type {
  DrpsMonitoramento,
  DrpsPlanoMedidas,
  DrpsProbabilidade,
  DrpsRelatorio,
  DrpsRespondente,
  DrpsRevisao,
  DrpsTextoPadraoCapitulo,
  StatusRelatorio,
} from "@/lib/drps/types";
import type { LinhaParsed } from "@/lib/drps/calculos";

// ============================================================
// RELATÓRIOS
// ============================================================

export function useDrpsRelatorios(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["drps-relatorios", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_relatorios")
        .select("*")
        .eq("id_empresa", idEmpresa!)
        .neq("status", "DELETADO")
        .order("revisao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DrpsRelatorio[];
    },
  });
}

export function useDrpsRelatorio(idRelatorio: string | null | undefined) {
  return useQuery({
    queryKey: ["drps-relatorio", idRelatorio],
    enabled: !!idRelatorio,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_relatorios")
        .select("*")
        .eq("id_relatorio", idRelatorio!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DrpsRelatorio | null;
    },
  });
}

export interface CriarRelatorioArgs {
  id_empresa: string;
  data_elaboracao?: string | null;
  responsavel_tecnico?: string | null;
  crp?: string | null;
  usuario_email?: string | null;
}

export function useDrpsCriarRelatorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CriarRelatorioArgs) => {
      const supabase = createSupabaseBrowserClient();

      // Próxima revisão: max + 1 dentro da empresa (inclui DELETADOs pra
      // não reaproveitar número)
      const { data: existentes, error: errList } = await supabase
        .from("drps_relatorios")
        .select("revisao")
        .eq("id_empresa", args.id_empresa);
      if (errList) throw errList;
      const max = Math.max(
        0,
        ...((existentes ?? []) as { revisao: number }[]).map((r) => r.revisao ?? 0)
      );
      const proxima = max + 1;

      const idRelatorio = gerarId("DRPS");
      const row = {
        id_relatorio: idRelatorio,
        id_empresa: args.id_empresa,
        revisao: proxima,
        status: "EM_ANDAMENTO" as StatusRelatorio,
        data_elaboracao: args.data_elaboracao ?? null,
        responsavel_tecnico: args.responsavel_tecnico ?? null,
        crp: args.crp ?? null,
        usuario_email: args.usuario_email ?? null,
      };
      const { error } = await supabase
        .from("drps_relatorios")
        .insert(row as never);
      if (error) throw error;
      return idRelatorio;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["drps-relatorios", vars.id_empresa] });
      toast.success("Relatório criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDrpsSalvarRelatorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      r: Partial<DrpsRelatorio> & { id_relatorio: string }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { id_relatorio, ...rest } = r;
      const { error } = await supabase
        .from("drps_relatorios")
        .update({ ...rest, updated_at: new Date().toISOString() } as never)
        .eq("id_relatorio", id_relatorio);
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({
        queryKey: ["drps-relatorio", vars.id_relatorio],
      });
      if (vars.id_empresa) {
        qc.invalidateQueries({ queryKey: ["drps-relatorios", vars.id_empresa] });
      }
      toast.success("Relatório atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDrpsExcluirRelatorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id_relatorio: string; id_empresa: string }) => {
      const supabase = createSupabaseBrowserClient();
      // Soft-delete: marca como DELETADO em vez de apagar (preserva numeração
      // de revisão e auditoria)
      const { error } = await supabase
        .from("drps_relatorios")
        .update({
          status: "DELETADO",
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_relatorio", args.id_relatorio);
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ["drps-relatorios", vars.id_empresa] });
      toast.success("Relatório excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================
// RESPONDENTES (agora por relatório)
// ============================================================

export function useDrpsRespondentes(idRelatorio: string | null | undefined) {
  return useQuery({
    queryKey: ["drps-respondentes", idRelatorio],
    enabled: !!idRelatorio,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_respondentes")
        .select("*")
        .eq("id_relatorio", idRelatorio!)
        .order("importado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DrpsRespondente[];
    },
  });
}

export interface ImportarLote {
  id_relatorio: string;
  id_empresa: string;
  linhas: LinhaParsed[];
}

export function useDrpsImportar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_relatorio, id_empresa, linhas }: ImportarLote) => {
      if (linhas.length === 0) throw new Error("Nada para importar");
      const supabase = createSupabaseBrowserClient();
      const lote = crypto.randomUUID();
      const rows = linhas.map((l) => ({
        id_relatorio,
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
        queryKey: ["drps-respondentes", vars.id_relatorio],
      });
      toast.success(`${total} respondente(s) importado(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDrpsLimparTudo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idRelatorio: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("drps_respondentes")
        .delete()
        .eq("id_relatorio", idRelatorio);
      if (error) throw error;
    },
    onSuccess: (_v, idRelatorio) => {
      qc.invalidateQueries({ queryKey: ["drps-respondentes", idRelatorio] });
      toast.success("Respondentes removidos");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================
// PROBABILIDADES (agora por relatório)
// ============================================================

export function useDrpsProbabilidades(idRelatorio: string | null | undefined) {
  return useQuery({
    queryKey: ["drps-probabilidades", idRelatorio],
    enabled: !!idRelatorio,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_probabilidades")
        .select("*")
        .eq("id_relatorio", idRelatorio!);
      if (error) throw error;
      return (data ?? []) as unknown as DrpsProbabilidade[];
    },
  });
}

export interface SalvarProbabilidadeArgs {
  id_relatorio: string;
  id_empresa: string;
  setor: string;
  topico_idx: number;
  probabilidade: 1 | 2 | 3;
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
            id_relatorio: args.id_relatorio,
            id_empresa: args.id_empresa,
            setor: args.setor,
            topico_idx: args.topico_idx,
            probabilidade: args.probabilidade,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "id_relatorio,setor,topico_idx" }
        );
      if (error) throw error;
    },
    onSuccess: (_v, args) => {
      qc.invalidateQueries({
        queryKey: ["drps-probabilidades", args.id_relatorio],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================
// PLANO DE MEDIDAS (agora por relatório)
// ============================================================

export function useDrpsPlanoMedidas(
  idRelatorio: string | null | undefined,
  ano: number
) {
  return useQuery({
    queryKey: ["drps-plano-medidas", idRelatorio, ano],
    enabled: !!idRelatorio,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_plano_medidas")
        .select("*")
        .eq("id_relatorio", idRelatorio!)
        .eq("ano", ano)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DrpsPlanoMedidas | null;
    },
  });
}

export function useDrpsSalvarPlanoMedidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id_relatorio: string;
      id_empresa: string;
      ano: number;
      plano: DrpsPlanoMedidas["plano"];
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("drps_plano_medidas")
        .upsert(
          {
            id_relatorio: args.id_relatorio,
            id_empresa: args.id_empresa,
            ano: args.ano,
            plano: args.plano,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "id_relatorio,ano" }
        );
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({
        queryKey: ["drps-plano-medidas", vars.id_relatorio, vars.ano],
      });
      toast.success("Plano salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================
// MONITORAMENTO (agora por relatório)
// ============================================================

export function useDrpsMonitoramento(
  idRelatorio: string | null | undefined
) {
  return useQuery({
    queryKey: ["drps-monitoramento", idRelatorio],
    enabled: !!idRelatorio,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_monitoramento")
        .select("*")
        .eq("id_relatorio", idRelatorio!);
      if (error) throw error;
      return (data ?? []) as unknown as DrpsMonitoramento[];
    },
  });
}

export function useDrpsSalvarMonitoramento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      m: Partial<DrpsMonitoramento> & {
        id_relatorio: string;
        id_empresa: string;
        setor: string;
        topico_idx: number;
      }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("drps_monitoramento")
        .upsert(
          { ...m, updated_at: new Date().toISOString() } as never,
          { onConflict: "id_relatorio,setor,topico_idx" }
        );
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({
        queryKey: ["drps-monitoramento", vars.id_relatorio],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================
// REVISÃO (agora por relatório)
// ============================================================

export function useDrpsRevisao(idRelatorio: string | null | undefined) {
  return useQuery({
    queryKey: ["drps-revisao", idRelatorio],
    enabled: !!idRelatorio,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_revisao")
        .select("*")
        .eq("id_relatorio", idRelatorio!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DrpsRevisao | null;
    },
  });
}

export function useDrpsSalvarRevisao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id_relatorio: string;
      id_empresa: string;
      checklist?: DrpsRevisao["checklist"];
      equipe?: DrpsRevisao["equipe"];
      anotacoes?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("drps_revisao")
        .upsert(
          { ...args, updated_at: new Date().toISOString() } as never,
          { onConflict: "id_relatorio" }
        );
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({
        queryKey: ["drps-revisao", vars.id_relatorio],
      });
      toast.success("Revisão salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================
// TEXTO PADRAO (capitulos globais do PDF)
// ============================================================

export function useDrpsTextoPadrao() {
  return useQuery({
    queryKey: ["drps-texto-padrao"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_texto_padrao")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DrpsTextoPadraoCapitulo[];
    },
  });
}

export function useDrpsCriarCapitulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      titulo: string;
      conteudo?: string | null;
      ordem?: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const id = gerarId("TXT");
      const { error } = await supabase
        .from("drps_texto_padrao")
        .insert({
          id_capitulo: id,
          titulo: args.titulo,
          conteudo: args.conteudo ?? null,
          ordem: args.ordem ?? 0,
          ativo: true,
          created_at: new Date().toISOString(),
        } as never);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drps-texto-padrao"] });
      toast.success("Capítulo criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDrpsSalvarCapitulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id_capitulo: string;
      titulo?: string;
      conteudo?: string | null;
      ordem?: number;
      ativo?: boolean;
      bg_imagem_url?: string | null;
      caixas_texto?: import("@/lib/drps/types").CaixaTexto[] | null;
      posicao_pdf?: import("@/lib/drps/types").DrpsPosicaoPdf;
      orientacao?: string | null;
      quebra_pagina?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { id_capitulo, ...rest } = args;
      const { error } = await supabase
        .from("drps_texto_padrao")
        .update({ ...rest, updated_at: new Date().toISOString() } as never)
        .eq("id_capitulo", id_capitulo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drps-texto-padrao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDrpsExcluirCapitulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_capitulo: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("drps_texto_padrao")
        .delete()
        .eq("id_capitulo", id_capitulo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drps-texto-padrao"] });
      toast.success("Capítulo excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================
// DASHBOARD GERAL (todas as empresas)
// ============================================================

export interface DrpsRelatorioComEmpresa extends DrpsRelatorio {
  empresa_nome: string | null;
  empresa_cnpj: string | null;
}

export function useDrpsRelatoriosGeral() {
  return useQuery({
    queryKey: ["drps-relatorios-geral"],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("drps_relatorios")
        .select("*, empresas(id_empresa, nome_empresa, cnpj)")
        .neq("status", "DELETADO")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Row = DrpsRelatorio & {
        empresas:
          | { id_empresa: string; nome_empresa: string; cnpj: string | null }
          | null;
      };
      const rows = (data ?? []) as unknown as Row[];
      return rows.map<DrpsRelatorioComEmpresa>((r) => ({
        ...r,
        empresa_nome: r.empresas?.nome_empresa ?? null,
        empresa_cnpj: r.empresas?.cnpj ?? null,
      }));
    },
  });
}
