"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";

/**
 * Agrega, por UNIDADE (tabela `unidades` de acesso, via empresas.id_unidade),
 * as contagens de Empresas, Inspeções e Laudos para a tela "Visão geral".
 *
 * - Laudos = as 7 tabelas que geram PDF (conformidade, não-conformidade, AET,
 *   AEP, DRPS, análises químicas, apreciações NR-12).
 * - Inspeções = `inspecoes` (exclui DELETADA); DRPS exclui DELETADO.
 * - Respeita o escopo do usuário (Técnico com vínculos vê só as suas empresas);
 *   reusa a mesma regra do useHomeStats/useEmpresas. RLS reforça no servidor.
 * - Tudo client-side, sem migration/RPC. Caveat: cada SELECT traz id_empresa de
 *   todos os registros (coluna leve); em volumes muito altos o PostgREST pode
 *   capar em ~1000 linhas/tabela — suficiente para a escala atual.
 */

export interface UnidadeResumo {
  /** null = bucket "Sem unidade" (empresas/registros sem id_unidade). */
  id_unidade: string | null;
  nome: string;
  empresas: number;
  inspecoes: number;
  laudos: number;
}

export interface VisaoGeralData {
  unidades: UnidadeResumo[];
  totais: { unidades: number; empresas: number; inspecoes: number; laudos: number };
}

const SEM_UNIDADE = "Sem unidade";

export function useVisaoGeralUnidades() {
  const user = useUserStore((s) => s.user);
  const vinculos =
    user?.perfil === "Tecnico" &&
    user.empresas_vinculadas &&
    user.empresas_vinculadas.length > 0
      ? user.empresas_vinculadas
      : null;

  return useQuery<VisaoGeralData>({
    queryKey: ["visao-geral-unidades", vinculos],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();

      // Lista de id_empresa de uma tabela (coluna leve), com filtro opcional de
      // status (soft-delete) e do escopo do usuário.
      async function idsEmpresa(
        tabela: string,
        excluirStatus?: string,
      ): Promise<(string | null)[]> {
        let q = supabase.from(tabela).select("id_empresa");
        if (excluirStatus) q = q.neq("status", excluirStatus);
        if (vinculos) q = q.in("id_empresa", vinculos);
        const { data, error } = await q;
        if (error) throw error;
        return ((data ?? []) as { id_empresa: string | null }[]).map((r) => r.id_empresa);
      }

      const empresasQ = vinculos
        ? supabase.from("empresas").select("id_empresa, id_unidade").in("id_empresa", vinculos)
        : supabase.from("empresas").select("id_empresa, id_unidade");

      const [
        unidadesRes,
        empresasRes,
        inspIds,
        confIds,
        ncIds,
        aetIds,
        aepIds,
        drpsIds,
        quimIds,
        apreIds,
      ] = await Promise.all([
        supabase.from("unidades").select("id_unidade, nome").order("nome", { ascending: true }),
        empresasQ,
        idsEmpresa("inspecoes", "DELETADA"),
        idsEmpresa("relatorios_conformidade"),
        idsEmpresa("relatorios_nao_conformidade"),
        idsEmpresa("aet_relatorios"),
        idsEmpresa("aep_relatorios"),
        idsEmpresa("drps_relatorios", "DELETADO"),
        idsEmpresa("analises_quimicos"),
        idsEmpresa("apreciacoes_maquinas"),
      ]);

      if (unidadesRes.error) throw unidadesRes.error;
      if (empresasRes.error) throw empresasRes.error;

      const unidadesList = (unidadesRes.data ?? []) as { id_unidade: string; nome: string }[];
      const empresas = (empresasRes.data ?? []) as { id_empresa: string; id_unidade: string | null }[];

      // empresa → unidade
      const empUnidade = new Map<string, string | null>();
      for (const e of empresas) empUnidade.set(e.id_empresa, e.id_unidade ?? null);

      // resolve a unidade (string|null) de um id_empresa
      const uniDe = (idEmpresa: string | null): string | null =>
        idEmpresa ? empUnidade.get(idEmpresa) ?? null : null;

      function contarPorUnidade(ids: (string | null)[]): Map<string | null, number> {
        const m = new Map<string | null, number>();
        for (const id of ids) {
          const u = uniDe(id);
          m.set(u, (m.get(u) ?? 0) + 1);
        }
        return m;
      }

      const empresasPorUni = new Map<string | null, number>();
      for (const e of empresas) {
        const u = e.id_unidade ?? null;
        empresasPorUni.set(u, (empresasPorUni.get(u) ?? 0) + 1);
      }

      const inspPorUni = contarPorUnidade(inspIds);
      const laudoIds = [
        ...confIds, ...ncIds, ...aetIds, ...aepIds, ...drpsIds, ...quimIds, ...apreIds,
      ];
      const laudoPorUni = contarPorUnidade(laudoIds);

      const unidades: UnidadeResumo[] = unidadesList.map((u) => ({
        id_unidade: u.id_unidade,
        nome: u.nome,
        empresas: empresasPorUni.get(u.id_unidade) ?? 0,
        inspecoes: inspPorUni.get(u.id_unidade) ?? 0,
        laudos: laudoPorUni.get(u.id_unidade) ?? 0,
      }));

      // bucket "Sem unidade" (id_unidade null) só aparece se tiver algo
      const semEmp = empresasPorUni.get(null) ?? 0;
      const semInsp = inspPorUni.get(null) ?? 0;
      const semLaudo = laudoPorUni.get(null) ?? 0;
      if (semEmp || semInsp || semLaudo) {
        unidades.push({
          id_unidade: null,
          nome: SEM_UNIDADE,
          empresas: semEmp,
          inspecoes: semInsp,
          laudos: semLaudo,
        });
      }

      return {
        unidades,
        totais: {
          unidades: unidadesList.length,
          empresas: empresas.length,
          inspecoes: inspIds.length,
          laudos: laudoIds.length,
        },
      };
    },
  });
}
