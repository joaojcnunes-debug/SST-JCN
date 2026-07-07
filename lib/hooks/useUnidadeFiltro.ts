"use client";

import { useMemo } from "react";
import { useUnidadeAtiva } from "@/lib/store";
import { useEmpresas } from "@/lib/hooks/useEmpresas";

/**
 * Escopo por "Unidade ativa" para os módulos. Devolve o id da unidade ativa e um
 * predicado `inUnidade(id_empresa)` que filtra registros às empresas da unidade.
 * Sem unidade ativa, `inUnidade` é sempre true (comportamento global, como antes).
 */
export function useUnidadeFiltro() {
  const unidadeId = useUnidadeAtiva((s) => s.id);
  const { data: empresas = [] } = useEmpresas();

  const empresaIds = useMemo(() => {
    if (!unidadeId) return null;
    return new Set(
      empresas.filter((e) => e.id_unidade === unidadeId).map((e) => e.id_empresa),
    );
  }, [unidadeId, empresas]);

  const inUnidade = useMemo(
    () => (idEmpresa: string | null | undefined): boolean =>
      !empresaIds || (idEmpresa != null && empresaIds.has(idEmpresa)),
    [empresaIds],
  );

  return { unidadeId, empresaIds, inUnidade };
}
