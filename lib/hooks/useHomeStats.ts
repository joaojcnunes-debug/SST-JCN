"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import type {
  Inspecao,
  RelatorioConformidade,
  RelatorioNaoConformidade,
  AnaliseQuimico,
  Maquina,
  ModuloPermitido,
} from "@/lib/supabase/types";
import type { DrpsRelatorio } from "@/lib/drps/types";

// ===================================================
// Tipos
// ===================================================

export interface ModuloStats {
  total: number;
  /** Em andamento / não finalizado (depende do módulo). */
  pendente: number;
  /** Criado/atualizado nos últimos 30 dias. */
  recente: number;
}

export interface AtividadeItem {
  modulo: ModuloPermitido;
  titulo: string;
  href: string;
  status?: string;
  data: string; // ISO
  /** Texto auxiliar (ex: nome da empresa, NR, etc.) */
  contexto?: string;
}

export interface HomeStatsData {
  painel?: ModuloStats;
  psicossocial?: ModuloStats;
  conformidade?: ModuloStats;
  nao_conformidade?: ModuloStats;
  analise_quimicos?: ModuloStats;
  inventario_maquinas?: ModuloStats;
  atividadeRecente: AtividadeItem[];
  isLoading: boolean;
}

// ===================================================
// Helpers
// ===================================================

const DIAS_RECENTE = 30;

function ehRecente(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const data = new Date(iso);
  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_RECENTE);
  return data >= limite;
}

function dataRow(r: { updated_at?: string | null; created_at?: string | null }): string {
  return r.updated_at || r.created_at || new Date().toISOString();
}

function ehPendenteStatus(s?: string | null): boolean {
  if (!s) return false;
  const upper = s.toUpperCase();
  return (
    upper === "RASCUNHO" ||
    upper === "EM_ANDAMENTO" ||
    upper === "ABERTA" ||
    upper === "EM_TRATAMENTO" ||
    upper === "PENDENTE"
  );
}

function calcStats(
  rows: Array<{ status?: string | null; updated_at?: string | null; created_at?: string | null }>
): ModuloStats {
  return {
    total: rows.length,
    pendente: rows.filter((r) => ehPendenteStatus(r.status)).length,
    recente: rows.filter((r) => ehRecente(dataRow(r))).length,
  };
}

// ===================================================
// Hook principal
// ===================================================

/**
 * Agrega estatísticas dos 5 módulos com listagem (Painel SST,
 * Psicossocial, Conformidade, RNC, Análise Químicos) + lista mesclada
 * dos últimos 8 registros pra exibir como "Atividade Recente" na home.
 *
 * Cada query respeita filtro por empresas_vinculadas quando o usuário
 * é Técnico — apenas dados das empresas que ele vê.
 */
export function useHomeStats(): HomeStatsData {
  const user = useUserStore((s) => s.user);
  const empresasVinculadas =
    user?.perfil === "Tecnico" &&
    user.empresas_vinculadas &&
    user.empresas_vinculadas.length > 0
      ? user.empresas_vinculadas
      : null;

  // === Inspeções (Painel SST) ===
  const inspecoesQ = useQuery({
    queryKey: ["home-stats-inspecoes", empresasVinculadas],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("inspecoes")
        .select("id_inspecao, id_empresa, status, created_at, updated_at, revisao")
        .neq("status", "DELETADA")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (empresasVinculadas) {
        q = q.in("id_empresa", empresasVinculadas);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Inspecao[];
    },
  });

  // === Relatórios de Conformidade NR ===
  const conformidadeQ = useQuery({
    queryKey: ["home-stats-conformidade", empresasVinculadas],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("relatorios_conformidade")
        .select("id_relatorio, id_empresa, status, nr_codigo, nr_titulo, created_at, updated_at")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (empresasVinculadas) {
        q = q.in("id_empresa", empresasVinculadas);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RelatorioConformidade[];
    },
  });

  // === Relatórios de Não Conformidade (RNC) ===
  const ncQ = useQuery({
    queryKey: ["home-stats-rnc", empresasVinculadas],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("relatorios_nao_conformidade")
        .select("id_relatorio, id_empresa, status, titulo, created_at, updated_at")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (empresasVinculadas) {
        q = q.in("id_empresa", empresasVinculadas);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RelatorioNaoConformidade[];
    },
  });

  // === Análises Químicas ===
  const quimicosQ = useQuery({
    queryKey: ["home-stats-quimicos", empresasVinculadas],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("analises_quimicos")
        .select("id_analise, id_empresa, titulo, nome_quimico, created_at, updated_at")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (empresasVinculadas) {
        // Análises sem empresa também aparecem (são "gerais")
        q = q.or(
          `id_empresa.in.(${empresasVinculadas.join(",")}),id_empresa.is.null`
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AnaliseQuimico[];
    },
  });

  // === Relatórios Psicossociais (DRPS) ===
  const psicoQ = useQuery({
    queryKey: ["home-stats-psicossocial", empresasVinculadas],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("drps_relatorios")
        .select("id_relatorio, id_empresa, status, revisao, created_at, updated_at")
        .neq("status", "DELETADO")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (empresasVinculadas) {
        q = q.in("id_empresa", empresasVinculadas);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DrpsRelatorio[];
    },
  });

  // === Inventário de Máquinas ===
  const maquinasQ = useQuery({
    queryKey: ["home-stats-inventario-maquinas", empresasVinculadas],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("inventario_maquinas")
        .select("id_maquina, id_empresa, nome, status, created_at, updated_at")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (empresasVinculadas) {
        // Inclui máquinas da empresa OU patrimônio Chabra (id_empresa null)
        q = q.or(
          `id_empresa.in.(${empresasVinculadas.join(",")}),id_empresa.is.null`
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Maquina[];
    },
  });

  const isLoading =
    inspecoesQ.isLoading ||
    conformidadeQ.isLoading ||
    ncQ.isLoading ||
    quimicosQ.isLoading ||
    psicoQ.isLoading ||
    maquinasQ.isLoading;

  // === Stats por módulo ===
  const painel = inspecoesQ.data ? calcStats(inspecoesQ.data) : undefined;
  const conformidade = conformidadeQ.data ? calcStats(conformidadeQ.data) : undefined;
  const nao_conformidade = ncQ.data ? calcStats(ncQ.data) : undefined;
  const analise_quimicos = quimicosQ.data ? calcStats(quimicosQ.data) : undefined;
  const psicossocial = psicoQ.data ? calcStats(psicoQ.data) : undefined;
  // Inventário: "pendente" = máquinas em manutenção (precisam de atenção)
  const inventario_maquinas: ModuloStats | undefined = maquinasQ.data
    ? {
        total: maquinasQ.data.length,
        pendente: maquinasQ.data.filter((m) => m.status === "MANUTENCAO").length,
        recente: maquinasQ.data.filter((m) => ehRecente(dataRow(m))).length,
      }
    : undefined;

  // === Atividade Recente (top 8 do agregado) ===
  const atividade: AtividadeItem[] = [];

  for (const r of inspecoesQ.data ?? []) {
    atividade.push({
      modulo: "painel",
      titulo: `Inspeção ${r.id_inspecao}${r.revisao ? ` (rev. ${r.revisao})` : ""}`,
      href: `/inspecoes/${r.id_inspecao}`,
      status: r.status,
      data: dataRow(r),
    });
  }
  for (const r of conformidadeQ.data ?? []) {
    atividade.push({
      modulo: "conformidade",
      titulo: r.nr_codigo
        ? `${r.nr_codigo}${r.nr_titulo ? ` — ${r.nr_titulo}` : ""}`
        : `Conformidade`,
      href: `/relatorio-conformidade/${r.id_relatorio}`,
      status: r.status,
      data: dataRow(r),
      contexto: r.nr_codigo ?? undefined,
    });
  }
  for (const r of ncQ.data ?? []) {
    atividade.push({
      modulo: "nao_conformidade",
      titulo: r.titulo || `RNC ${r.id_relatorio}`,
      href: `/relatorio-nao-conformidade/${r.id_relatorio}`,
      status: r.status,
      data: dataRow(r),
    });
  }
  for (const r of quimicosQ.data ?? []) {
    atividade.push({
      modulo: "analise_quimicos",
      titulo: r.titulo || r.nome_quimico || "Análise química",
      href: `/analise-quimicos/${r.id_analise}`,
      data: dataRow(r),
    });
  }
  for (const r of psicoQ.data ?? []) {
    atividade.push({
      modulo: "psicossocial",
      titulo: `DRPS rev. ${r.revisao}`,
      href: `/psicossocial/${r.id_relatorio}/analise`,
      status: r.status,
      data: dataRow(r),
    });
  }
  for (const r of maquinasQ.data ?? []) {
    atividade.push({
      modulo: "inventario_maquinas",
      titulo: r.nome,
      href: `/inventario-maquinas/${r.id_maquina}`,
      status: r.status,
      data: dataRow(r),
    });
  }

  atividade.sort((a, b) => b.data.localeCompare(a.data));
  const atividadeRecente = atividade.slice(0, 8);

  return {
    painel,
    psicossocial,
    conformidade,
    nao_conformidade,
    analise_quimicos,
    inventario_maquinas,
    atividadeRecente,
    isLoading,
  };
}
