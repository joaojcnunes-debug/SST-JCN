"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Agrega os laudos dos 7 módulos que têm `data_validade` informada e classifica
 * por vencimento: vencidos (data < hoje) e vencendo (hoje .. +HORIZONTE dias).
 * Usado na seção "Vencimentos" da Visão geral. Respeita o RLS do usuário.
 */

const HORIZONTE_DIAS = 60;

export interface VencimentoItem {
  tipo: string;
  empresaNome: string | null;
  data_validade: string;
  href: string;
  /** dias até vencer (negativo = já vencido). */
  dias: number;
}

export interface VencimentosData {
  vencidos: VencimentoItem[];
  vencendo: VencimentoItem[];
}

interface Fonte {
  tabela: string;
  idCol: string;
  tipo: string;
  href: (id: string) => string;
  excluirStatus?: string;
}

const FONTES: Fonte[] = [
  { tabela: "inspecoes", idCol: "id_inspecao", tipo: "Inspeção", href: (id) => `/inspecoes/${id}`, excluirStatus: "DELETADA" },
  { tabela: "relatorios_conformidade", idCol: "id_relatorio", tipo: "Conformidade", href: (id) => `/relatorio-conformidade/${id}` },
  { tabela: "relatorios_nao_conformidade", idCol: "id_relatorio", tipo: "Não Conformidade", href: (id) => `/relatorio-nao-conformidade/${id}` },
  { tabela: "aet_relatorios", idCol: "id_relatorio", tipo: "AET", href: (id) => `/aet/${id}` },
  { tabela: "aep_relatorios", idCol: "id_relatorio", tipo: "AEP", href: (id) => `/aep/${id}` },
  { tabela: "drps_relatorios", idCol: "id_relatorio", tipo: "DRPS", href: (id) => `/psicossocial/${id}/metadados`, excluirStatus: "DELETADO" },
  { tabela: "analises_quimicos", idCol: "id_analise", tipo: "Análise de Químicos", href: (id) => `/analise-quimicos/${id}` },
  { tabela: "apreciacoes_maquinas", idCol: "id_apreciacao", tipo: "Apreciação NR-12", href: (id) => `/apreciacao-maquinas/${id}` },
  { tabela: "investigacoes_acidente", idCol: "id_investigacao", tipo: "Investigação", href: (id) => `/investigacao-acidente/${id}`, excluirStatus: "DELETADA" },
];

function diasAte(dataIso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(dataIso + "T00:00:00");
  return Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
}

export function useVencimentos() {
  return useQuery<VencimentosData>({
    queryKey: ["vencimentos"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();

      // nome por empresa
      const empRes = await sb.from("empresas").select("id_empresa, nome_empresa");
      const nomePorEmpresa = new Map<string, string>();
      for (const e of (empRes.data ?? []) as { id_empresa: string; nome_empresa: string }[]) {
        nomePorEmpresa.set(e.id_empresa, e.nome_empresa);
      }

      // busca os documentos com validade informada em cada fonte
      const listas = await Promise.all(
        FONTES.map(async (f) => {
          let q = sb
            .from(f.tabela)
            .select(`${f.idCol}, id_empresa, data_validade`)
            .not("data_validade", "is", null);
          if (f.excluirStatus) q = q.neq("status", f.excluirStatus);
          const { data, error } = await q;
          if (error) return [] as VencimentoItem[]; // degrada por fonte (não quebra o painel)
          return ((data ?? []) as Record<string, string | null>[]).map((r) => {
            const id = r[f.idCol] as string;
            const idEmpresa = r.id_empresa;
            const data_validade = r.data_validade as string;
            return {
              tipo: f.tipo,
              empresaNome: idEmpresa ? nomePorEmpresa.get(idEmpresa) ?? null : null,
              data_validade,
              href: f.href(id),
              dias: diasAte(data_validade),
            };
          });
        }),
      );

      const todos = listas.flat();
      const vencidos = todos
        .filter((v) => v.dias < 0)
        .sort((a, b) => b.dias - a.dias); // mais recentes vencidos primeiro (-1 antes de -90)
      const vencendo = todos
        .filter((v) => v.dias >= 0 && v.dias <= HORIZONTE_DIAS)
        .sort((a, b) => a.dias - b.dias); // os que vencem antes primeiro

      return { vencidos, vencendo };
    },
  });
}
