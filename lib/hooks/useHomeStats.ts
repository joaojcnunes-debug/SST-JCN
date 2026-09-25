"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import type {
  Inspecao,
  RelatorioConformidade,
  RelatorioNaoConformidade,
  AnaliseQuimico,
  ApreciacaoMaquina,
  ModuloPermitido,
} from "@/lib/supabase/types";
import type { DrpsRelatorio } from "@/lib/drps/types";
import { ehSemNR } from "@/lib/conformidade/checklists";
import { FILTRO_VISIVEL_NO_MODULO } from "@/lib/hooks/useAep";

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
  /** Empresa do registro (id) — usado para enriquecer com nome/técnico vinculado. */
  id_empresa?: string | null;
  /** Responsável gravado no registro (quem está trabalhando no documento). */
  responsavel?: string | null;
  /** Nome da empresa (preenchido pelo consumidor via id_empresa). */
  empresaNome?: string | null;
  /** Técnico(s) vinculado(s) à empresa (empresas_vinculadas) — preenchido pelo consumidor. */
  tecnicoVinculado?: string | null;
}

export interface HomeStatsData {
  painel?: ModuloStats;
  psicossocial?: ModuloStats;
  conformidade?: ModuloStats;
  nao_conformidade?: ModuloStats;
  analise_quimicos?: ModuloStats;
  apreciacao_maquinas?: ModuloStats;
  aet?: ModuloStats;
  aep?: ModuloStats;
  questionarios_psicossociais?: ModuloStats;
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

  // v0.3.634: só pergunta pelos módulos que a conta TEM. Antes as 9 consultas
  // saíam para todo mundo: o administrativo (2 módulos) abria o Início e lia
  // DRPS, AET, AEP, QPS… — 100 % do que a trava da v236 anotou em modo LOG
  // (175 tentativas de 11 contas em 1 dia) veio daqui e da página da Empresa.
  // Três efeitos: para de mostrar número de módulo que a pessoa não acessa;
  // o log de 21/10 passa a ser só quem bate mesmo na porta; e some o
  // desperdício de 9 consultas por abertura de tela.
  // A régua é a MESMA do hub de Módulos (`modulos_permitidos`, sem exceção
  // para Admin) — ver app/(hub)/modulos/page.tsx.
  const temModulo = (m: ModuloPermitido) =>
    !!user && (user.modulos_permitidos ?? []).includes(m);

  // === Inspeções (Painel SST) ===
  const inspecoesQ = useQuery({
    queryKey: ["home-stats-inspecoes", empresasVinculadas],
    enabled: temModulo("painel"),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("inspecoes")
        .select("id_inspecao, id_empresa, status, created_at, updated_at, revisao, responsavel")
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
    enabled: temModulo("conformidade"),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("relatorios_conformidade")
        .select("id_relatorio, id_empresa, status, nr_codigo, nr_titulo, created_at, updated_at, responsavel")
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
    enabled: temModulo("nao_conformidade"),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("relatorios_nao_conformidade")
        .select("id_relatorio, id_empresa, status, titulo, created_at, updated_at, responsavel")
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
    enabled: temModulo("analise_quimicos"),
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
    enabled: temModulo("psicossocial"),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("drps_relatorios")
        .select("id_relatorio, id_empresa, status, revisao, created_at, updated_at, responsavel_tecnico")
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

  // === AET — Análise Ergonômica ===
  const aetQ = useQuery({
    queryKey: ["home-stats-aet", empresasVinculadas],
    enabled: temModulo("aet"),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("aet_relatorios")
        .select("id_relatorio, id_empresa, status, created_at, updated_at")
        .or(FILTRO_VISIVEL_NO_MODULO)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (empresasVinculadas) {
        q = q.in("id_empresa", empresasVinculadas);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { status?: string; updated_at?: string | null; created_at?: string | null }[];
    },
  });

  // === AEP — Análise Ergonômica Preliminar ===
  const aepQ = useQuery({
    queryKey: ["home-stats-aep", empresasVinculadas],
    enabled: temModulo("aep"),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("aep_relatorios")
        .select("id_relatorio, id_empresa, status, created_at, updated_at")
        .or(FILTRO_VISIVEL_NO_MODULO)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (empresasVinculadas) {
        q = q.in("id_empresa", empresasVinculadas);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { status?: string; updated_at?: string | null; created_at?: string | null }[];
    },
  });

  // === Questionários Psicossociais (QPS) ===
  // Nota: qps_aplicacoes usa criado_em/atualizado_em (não created_at/updated_at)
  const qpsQ = useQuery({
    queryKey: ["home-stats-qps", empresasVinculadas],
    enabled: temModulo("questionarios_psicossociais"),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createSupabaseBrowserClient() as any;
      let q = supabase
        .from("qps_aplicacoes")
        .select("id_aplicacao, id_empresa, status, criado_em, atualizado_em")
        .neq("status", "DELETADO")
        .order("atualizado_em", { ascending: false, nullsFirst: false })
        .limit(200);
      if (empresasVinculadas) {
        q = q.in("id_empresa", empresasVinculadas);
      }
      const { data, error } = await q;
      if (error) throw error;
      // Normaliza nomes de campo para compatibilidade com calcStats/dataRow
      return (data ?? []).map((r: { status?: string; criado_em?: string | null; atualizado_em?: string | null }) => ({
        status: r.status,
        created_at: r.criado_em,
        updated_at: r.atualizado_em,
      }));
    },
  });

  // === Apreciações NR-12 ===
  const apreciacoesQ = useQuery({
    queryKey: ["home-stats-apreciacao-maquinas", empresasVinculadas],
    enabled: temModulo("apreciacao_maquinas"),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("apreciacoes_maquinas")
        .select(
          "id_apreciacao, id_empresa, titulo, maquina_descricao, status, created_at, updated_at"
        )
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (empresasVinculadas) {
        q = q.in("id_empresa", empresasVinculadas);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ApreciacaoMaquina[];
    },
  });

  const isLoading =
    inspecoesQ.isLoading ||
    conformidadeQ.isLoading ||
    ncQ.isLoading ||
    quimicosQ.isLoading ||
    psicoQ.isLoading ||
    apreciacoesQ.isLoading ||
    aetQ.isLoading ||
    aepQ.isLoading ||
    qpsQ.isLoading;

  // === Stats por módulo ===
  const painel = inspecoesQ.data ? calcStats(inspecoesQ.data) : undefined;
  const conformidade = conformidadeQ.data ? calcStats(conformidadeQ.data) : undefined;
  const nao_conformidade = ncQ.data ? calcStats(ncQ.data) : undefined;
  const analise_quimicos = quimicosQ.data ? calcStats(quimicosQ.data) : undefined;
  const psicossocial = psicoQ.data ? calcStats(psicoQ.data) : undefined;
  const apreciacao_maquinas = apreciacoesQ.data
    ? calcStats(apreciacoesQ.data)
    : undefined;
  const aet = aetQ.data ? calcStats(aetQ.data) : undefined;
  const aep = aepQ.data ? calcStats(aepQ.data) : undefined;
  const questionarios_psicossociais = qpsQ.data ? calcStats(qpsQ.data) : undefined;

  // === Atividade Recente (top 8 do agregado) ===
  const atividade: AtividadeItem[] = [];

  for (const r of inspecoesQ.data ?? []) {
    atividade.push({
      modulo: "painel",
      titulo: `Inspeção${r.revisao ? ` (rev. ${r.revisao})` : ""}`,
      href: `/inspecoes/${r.id_inspecao}`,
      status: r.status,
      data: dataRow(r),
      id_empresa: r.id_empresa,
      responsavel: r.responsavel,
    });
  }
  for (const r of conformidadeQ.data ?? []) {
    atividade.push({
      modulo: "conformidade",
      // Sem NR o relatório se identifica pelo título livre, não pelo sentinela.
      titulo: ehSemNR(r.nr_codigo)
        ? r.nr_titulo || "Conformidade"
        : `${r.nr_codigo}${r.nr_titulo ? ` — ${r.nr_titulo}` : ""}`,
      href: `/relatorio-conformidade/${r.id_relatorio}`,
      status: r.status,
      data: dataRow(r),
      contexto: ehSemNR(r.nr_codigo) ? undefined : r.nr_codigo,
      id_empresa: r.id_empresa,
      responsavel: r.responsavel,
    });
  }
  for (const r of ncQ.data ?? []) {
    atividade.push({
      modulo: "nao_conformidade",
      titulo: r.titulo || "Não conformidade",
      href: `/relatorio-nao-conformidade/${r.id_relatorio}`,
      status: r.status,
      data: dataRow(r),
      id_empresa: r.id_empresa,
      responsavel: r.responsavel,
    });
  }
  for (const r of quimicosQ.data ?? []) {
    atividade.push({
      modulo: "analise_quimicos",
      titulo: r.titulo || r.nome_quimico || "Análise química",
      href: `/analise-quimicos/${r.id_analise}`,
      data: dataRow(r),
      id_empresa: r.id_empresa,
    });
  }
  for (const r of psicoQ.data ?? []) {
    atividade.push({
      modulo: "psicossocial",
      titulo: `DRPS rev. ${r.revisao}`,
      href: `/psicossocial/${r.id_relatorio}/analise`,
      status: r.status,
      data: dataRow(r),
      id_empresa: r.id_empresa,
      responsavel: r.responsavel_tecnico,
    });
  }
  for (const r of apreciacoesQ.data ?? []) {
    atividade.push({
      modulo: "apreciacao_maquinas",
      titulo: r.titulo || r.maquina_descricao || "Apreciação NR-12",
      href: `/apreciacao-maquinas/${r.id_apreciacao}`,
      status: r.status,
      data: dataRow(r),
      id_empresa: r.id_empresa,
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
    apreciacao_maquinas,
    aet,
    aep,
    questionarios_psicossociais,
    atividadeRecente,
    isLoading,
  };
}
