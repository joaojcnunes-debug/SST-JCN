"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Registro nativo normalizado de qualquer módulo, vinculado a uma empresa. */
export interface RegistroModulo {
  id: string;
  data: string | null;
  status: string | null;
  titulo: string | null;
}

export interface GrupoRegistros {
  modulo: string;
  label: string;
  rota: (id: string) => string;
  registros: RegistroModulo[];
}

interface ModuloCfg {
  modulo: string;
  label: string;
  tabela: string;
  pk: string;
  dataCol: string;
  statusCol?: string;
  tituloCol?: string;
  excluirStatus?: string[];
  rota: (id: string) => string;
}

// Config das tabelas por módulo (todas têm id_empresa direto). Rotas /<modulo>/<id>.
const MODULOS: ModuloCfg[] = [
  { modulo: "conformidade", label: "Conformidade", tabela: "relatorios_conformidade", pk: "id_relatorio", dataCol: "created_at", statusCol: "status", tituloCol: "nr_titulo", rota: (id) => `/relatorio-conformidade/${id}` },
  { modulo: "nao_conformidade", label: "Não Conformidade", tabela: "relatorios_nao_conformidade", pk: "id_relatorio", dataCol: "created_at", statusCol: "status", tituloCol: "titulo", rota: (id) => `/relatorio-nao-conformidade/${id}` },
  { modulo: "analise_quimicos", label: "Análise de Químicos", tabela: "analises_quimicos", pk: "id_analise", dataCol: "created_at", tituloCol: "titulo", rota: (id) => `/analise-quimicos/${id}` },
  { modulo: "apreciacao_maquinas", label: "Apreciação NR-12", tabela: "apreciacoes_maquinas", pk: "id_apreciacao", dataCol: "created_at", statusCol: "status", tituloCol: "titulo", rota: (id) => `/apreciacao-maquinas/${id}` },
  { modulo: "aet", label: "AET — Ergonomia", tabela: "aet_relatorios", pk: "id_relatorio", dataCol: "created_at", statusCol: "status", rota: (id) => `/aet/${id}` },
  { modulo: "aep", label: "AEP — Ergonomia", tabela: "aep_relatorios", pk: "id_relatorio", dataCol: "created_at", statusCol: "status", rota: (id) => `/aep/${id}` },
  { modulo: "psicossocial", label: "DRPS — Psicossocial", tabela: "drps_relatorios", pk: "id_relatorio", dataCol: "created_at", statusCol: "status", excluirStatus: ["DELETADO", "DELETADA"], rota: (id) => `/psicossocial/${id}` },
  { modulo: "questionarios", label: "Questionários", tabela: "qps_aplicacoes", pk: "id_aplicacao", dataCol: "criado_em", statusCol: "status", tituloCol: "titulo", excluirStatus: ["DELETADO", "DELETADA"], rota: (id) => `/questionarios-psicossociais/${id}` },
  { modulo: "inventario_maquinas", label: "Inventário de Máquinas", tabela: "inventario_maquinas", pk: "id_maquina", dataCol: "created_at", tituloCol: "nome", rota: () => `/inventario-maquinas` },
];

/**
 * Lê os registros nativos de TODOS os módulos para uma empresa (consultas
 * paralelas, uma por tabela). Erros por módulo (RLS/tabela) caem para vazio,
 * sem derrubar a página. Retorna na mesma ordem de MODULOS.
 */
export function useRegistrosEmpresa(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["registros-empresa", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<GrupoRegistros[]> => {
      const supabase = createSupabaseBrowserClient();
      const grupos = await Promise.all(
        MODULOS.map(async (cfg): Promise<GrupoRegistros> => {
          const cols = [cfg.pk, cfg.dataCol, cfg.statusCol, cfg.tituloCol].filter(Boolean).join(", ");
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any)
              .from(cfg.tabela)
              .select(cols)
              .eq("id_empresa", idEmpresa!)
              .order(cfg.dataCol, { ascending: false });
            if (error) throw error;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const registros: RegistroModulo[] = (data ?? [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((row: any) => ({
                id: String(row[cfg.pk]),
                data: cfg.dataCol ? (row[cfg.dataCol] ?? null) : null,
                status: cfg.statusCol ? (row[cfg.statusCol] ?? null) : null,
                titulo: cfg.tituloCol ? (row[cfg.tituloCol] ?? null) : null,
              }))
              .filter((r: RegistroModulo) => !(cfg.excluirStatus && r.status && cfg.excluirStatus.includes(r.status)));
            return { modulo: cfg.modulo, label: cfg.label, rota: cfg.rota, registros };
          } catch {
            return { modulo: cfg.modulo, label: cfg.label, rota: cfg.rota, registros: [] };
          }
        }),
      );
      return grupos;
    },
  });
}
