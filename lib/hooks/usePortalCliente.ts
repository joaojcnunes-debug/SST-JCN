"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentUser } from "./useUsuario";
import type { Empresa } from "@/lib/supabase/types";

type NcItem = {
  id_item: string;
  descricao: string;
  norma_violada: string | null;
  criticidade: string | null;
  responsavel_tratativa: string | null;
  status_tratativa: string | null;
  prazo: string | null;
  foto_urls: string[] | null;
};

type NcComItens = {
  id_relatorio: string;
  titulo: string;
  data_inspecao: string | null;
  status: string;
  relatorios_nao_conformidade_itens: NcItem[];
};

type AcaoResumo = {
  id_acao: string;
  what_acao: string | null;
  why_justificativa: string | null;
  where_local: string | null;
  when_prazo: string | null;
  who_responsavel: string | null;
  how_metodo: string | null;
  how_much_custo: number | null;
  status: string | null;
  prioridade: string | null;
  data_conclusao: string | null;
  created_at: string;
};

export function usePortalEmpresa() {
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? null;

  return useQuery({
    queryKey: ["portal", "empresa", empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Pick<Empresa, "id_empresa" | "nome_empresa" | "cnpj" | "grau_risco">> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("empresas")
        .select("id_empresa, nome_empresa, cnpj, grau_risco")
        .eq("id_empresa", empresaId!)
        .single();
      if (error) throw error;
      return data as Pick<Empresa, "id_empresa" | "nome_empresa" | "cnpj" | "grau_risco">;
    },
  });
}

export function usePortalDashboardStats() {
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? null;

  return useQuery({
    queryKey: ["portal", "stats", empresaId],
    enabled: !!empresaId,
    staleTime: 60_000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const hoje = new Date().toISOString().slice(0, 10);
      const em7d = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anySb = sb as any;
      const [docs, pend, ncs, acoes] = await Promise.all([
        anySb.from("portal_documentos_cliente").select("id, status").eq("empresa_id", empresaId!),
        anySb.from("portal_pendencias_cliente").select("id, status").eq("empresa_id", empresaId!),
        anySb.from("relatorios_nao_conformidade").select("id_relatorio").eq("id_empresa", empresaId!),
        anySb
          .from("acoes_5w2h")
          .select("id_acao, status, when_prazo")
          .eq("id_empresa", empresaId!)
          .in("status", ["Aberta", "Em andamento"]),
      ]);

      const docsRows = (docs.data ?? []) as { id: string; status: string }[];
      const pendRows = (pend.data ?? []) as { id: string; status: string }[];
      const ncsRows = (ncs.data ?? []) as { id_relatorio: string }[];
      const acoesRows = (acoes.data ?? []) as { id_acao: string; status: string | null; when_prazo: string | null }[];

      const docsTotal = docsRows.length;
      const docsAssinados = docsRows.filter((d) => d.status === "assinado").length;
      const pendAberta = pendRows.filter((p) => p.status !== "resolvido").length;
      const ncsTotal = ncsRows.length;
      const acoesVencidas =
        acoesRows.filter((a) => a.when_prazo && a.when_prazo < hoje).length;
      const acoesProximas =
        acoesRows.filter(
          (a) => a.when_prazo && a.when_prazo >= hoje && a.when_prazo <= em7d
        ).length;

      return { docsTotal, docsAssinados, pendAberta, ncsTotal, acoesVencidas, acoesProximas };
    },
  });
}

export function usePortalNaoConformidades() {
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? null;

  return useQuery({
    queryKey: ["portal", "ncs", empresaId],
    enabled: !!empresaId,
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<NcComItens[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("relatorios_nao_conformidade")
        .select(
          `id_relatorio, titulo, data_inspecao, status,
           relatorios_nao_conformidade_itens(
             id_item, descricao, norma_violada,
             responsavel_tratativa, criticidade, status_tratativa, prazo, foto_urls
           )`
        )
        .eq("id_empresa", empresaId!)
        .order("data_inspecao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NcComItens[];
    },
  });
}

export function usePortalPlanoAcao() {
  const user = useCurrentUser();
  const empresaId = user?.empresas_vinculadas?.[0] ?? null;

  return useQuery({
    queryKey: ["portal", "plano-acao", empresaId],
    enabled: !!empresaId,
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<AcaoResumo[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("acoes_5w2h")
        .select(
          "id_acao, what_acao, why_justificativa, where_local, when_prazo, who_responsavel, how_metodo, how_much_custo, status, prioridade, data_conclusao, created_at"
        )
        .eq("id_empresa", empresaId!)
        .order("when_prazo", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as AcaoResumo[];
    },
  });
}
