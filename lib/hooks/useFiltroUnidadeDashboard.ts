"use client";

/**
 * Filtro por unidade das telas de detalhe do Dashboard (pedido de 26/10/2026): Inspeções realizadas
 * por TST, Documentos concluídos (ADM), Documentos associados e a página da pessoa.
 *
 * - Começa na "Unidade ativa" do sistema (a do chip do topo), se houver — o mesmo da lista de
 *   inspeções. Escolher outra aqui NÃO muda a unidade ativa do resto do sistema.
 * - A escolha vale para as quatro telas enquanto se navega entre elas (clicar num nome leva para a
 *   página da pessoa já na mesma unidade). Recarregar volta para a unidade ativa.
 * - O recorte é por EMPRESA (`empresas.id_unidade`): cada linha da tela já traz o `id_empresa`, então
 *   as réguas de lib/dashboard/* não mudam — só recebem menos linhas.
 */

import { useMemo } from "react";
import { create } from "zustand";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { useUnidadeAtiva } from "@/lib/store";
import { useUnidades } from "@/lib/hooks/useUnidades";

/** null = segue a unidade ativa; "" = todas; id = aquela unidade. */
const useEscolha = create<{ id: string | null; set: (id: string) => void }>()((set) => ({
  id: null,
  set: (id) => set({ id }),
}));

export function useFiltroUnidadeDashboard() {
  const ativa = useUnidadeAtiva((s) => s.id);
  const escolha = useEscolha((s) => s.id);
  const setIdUnidade = useEscolha((s) => s.set);
  const idUnidade = escolha ?? ativa ?? "";
  const { data: unidades = [] } = useUnidades();

  const { data: unidadeDaEmpresa } = useQuery<Map<string, string | null>>({
    queryKey: ["dashboard-empresa-unidade"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const linhas = await fetchAllRows<{ id_empresa: string; id_unidade: string | null }>((de, ate) =>
        sb.from("empresas").select("id_empresa, id_unidade").order("id_empresa").range(de, ate),
      );
      return new Map(linhas.map((e) => [e.id_empresa, e.id_unidade]));
    },
  });

  const naUnidade = useMemo(
    () => (idEmpresa: string | null | undefined): boolean =>
      !idUnidade || (!!idEmpresa && unidadeDaEmpresa?.get(idEmpresa) === idUnidade),
    [idUnidade, unidadeDaEmpresa],
  );

  const nomeUnidade = idUnidade ? unidades.find((u) => u.id_unidade === idUnidade)?.nome ?? null : null;
  // Com unidade escolhida, a tela espera o mapa empresa → unidade (senão mostraria "zero" por um instante).
  const carregando = !!idUnidade && !unidadeDaEmpresa;

  return { idUnidade, setIdUnidade, unidades, nomeUnidade, naUnidade, carregando };
}
