"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useFrotaVeiculosLista } from "@/lib/hooks/useFrotaVeiculos";
import { useChecklists, useSaidasEmAberto } from "@/lib/hooks/useFrotaChecklists";
import { useManutencoes } from "@/lib/hooks/useFrotaManutencoes";
import { useLotacoes } from "@/lib/hooks/useFrotaLotacoes";
import type { FrotaAbastecimento, FrotaChecklist, FrotaSinistro } from "@/lib/frota/tipos";

/**
 * Os dados do painel da frota, todos de uma vez.
 *
 * POR QUE UM HOOK SÓ: o painel faz sete perguntas ao banco e as sete precisam
 * chegar para a tela fazer sentido — mostrar o quadro de "quem está na rua"
 * antes de saber quais veículos existem só produziria um piscar de conteúdo
 * errado. Reunir aqui deixa a página com um `isLoading` só e concentra num
 * lugar a decisão de QUANTO histórico carregar.
 *
 * `useAbastecimentosDaFrota` e `useSinistrosDaFrota` são consultas novas, com
 * chave própria (`frota_painel_*`): as que já existiam são por veículo, e
 * reaproveitar a chave delas faria a invalidação de um veículo derrubar o cache
 * da frota inteira, ou pior, o contrário — parecer atualizado sem estar.
 */

/** O 1º do mês anterior. É o passado mínimo para o painel comparar dois meses. */
function inicioDaJanela(hoje: Date): string {
  return new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString();
}

/**
 * Abastecimentos da frota inteira desde o mês anterior.
 *
 * A janela é curta de propósito: o painel compara mês corrente com o anterior e
 * nada mais. Trazer o ano inteiro para desenhar dois números seria pagar caro
 * por dado que ninguém lê — e o histórico completo continua na ficha do veículo,
 * onde ele é o assunto.
 */
export function useAbastecimentosDaFrota(desde: string) {
  return useQuery({
    queryKey: ["frota_painel_abastecimentos", desde] as const,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_abastecimentos")
        .select("*")
        .gte("data_hora", desde)
        .order("data_hora", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaAbastecimento[];
    },
  });
}

/**
 * As viagens FECHADAS na janela — a matéria-prima do km rodado.
 *
 * O recorte é por `data_retorno`, não por `data_saida`: uma viagem que saiu em
 * 30 de julho e voltou em 2 de agosto rodou em agosto tanto quanto em julho, e
 * contá-la pela saída deixaria agosto com quilometragem que ninguém consegue
 * explicar olhando a lista do mês.
 */
export function useSaidasFechadasDesde(desde: string) {
  return useQuery({
    queryKey: ["frota_painel_fechadas", desde] as const,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_checklists")
        .select("*")
        .not("data_retorno", "is", null)
        .gte("data_retorno", desde)
        .order("data_retorno", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaChecklist[];
    },
  });
}

/**
 * Sinistros da frota — TODOS, sem recorte de data.
 *
 * Diferente dos abastecimentos de propósito: sinistro velho e ainda aberto é
 * justamente o que o painel precisa denunciar. Uma janela de dois meses
 * esconderia o caso de março que ninguém encerrou, que é o pior deles.
 */
export function useSinistrosDaFrota() {
  return useQuery({
    queryKey: ["frota_painel_sinistros"] as const,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_sinistros")
        .select("*")
        .order("data_ocorrencia", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as FrotaSinistro[];
    },
  });
}

export function usePainelFrota(hoje: Date) {
  const desde = useMemo(() => inicioDaJanela(hoje), [hoje]);

  const veiculos = useFrotaVeiculosLista();
  const emAberto = useSaidasEmAberto();
  const fechadas = useSaidasFechadasDesde(desde);
  const rascunhos = useChecklists({ status: "RASCUNHO" });
  const abastecimentos = useAbastecimentosDaFrota(desde);
  const sinistros = useSinistrosDaFrota();
  const manutencoes = useManutencoes();
  const lotacoes = useLotacoes();

  return {
    veiculos: veiculos.data ?? [],
    saidasEmAberto: emAberto.data ?? [],
    saidasFechadas: fechadas.data ?? [],
    rascunhos: rascunhos.data ?? [],
    abastecimentos: abastecimentos.data ?? [],
    sinistros: sinistros.data ?? [],
    manutencoes: manutencoes.data ?? [],
    lotacoes: lotacoes.data ?? [],
    // Só o primeiro carregamento segura a tela. Um refetch em segundo plano não
    // devolve a página para o estado "Carregando…" — quem está lendo o painel
    // não deveria ver o conteúdo sumir porque a janela recuperou o foco.
    isLoading:
      veiculos.isLoading ||
      emAberto.isLoading ||
      fechadas.isLoading ||
      rascunhos.isLoading ||
      abastecimentos.isLoading ||
      sinistros.isLoading ||
      manutencoes.isLoading ||
      lotacoes.isLoading,
  };
}
