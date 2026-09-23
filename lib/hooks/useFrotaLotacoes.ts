"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { gerarId } from "@/lib/utils";
import { atualizarKmVeiculo } from "@/lib/hooks/useFrotaVeiculos";
import type { FrotaLotacao } from "@/lib/frota/tipos";

/**
 * LOTAÇÃO — em qual base o veículo está, e o extrato de como ele chegou lá
 * (tabela `frota_lotacoes`, v178).
 *
 * A diferença que importa, e que decidiu não reaproveitar a saída:
 *   • SAÍDA é viagem. O carro vai ao cliente e volta; a base dele não muda.
 *   • LOTAÇÃO é mudança de endereço do patrimônio. A partir dela, as saídas
 *     seguintes nascem carimbadas na base nova, e o carro passa a aparecer na
 *     lista de outra gente.
 *
 * QUEM MOVE O VEÍCULO É O BANCO. O `id_unidade` de `frota_veiculos` é atualizado
 * por trigger `after insert`, no mesmo statement do lançamento. Aqui NÃO há
 * insert-e-depois-update: essa sequência tem uma janela em que o extrato já diz
 * "foi para Lafaiete" e o veículo ainda diz "estou em Barbacena" — e um erro de
 * rede no meio deixaria as duas verdades divergentes para sempre.
 *
 * Pelo mesmo motivo `id_unidade_origem` NÃO é enviado daqui: o trigger lê a base
 * real e carimba. Mandar origem é convite a gravar um extrato que não aconteceu.
 */

const KEY = ["frota_lotacoes"] as const;
const KEY_VEICULO = (id: string | null | undefined) => [...KEY, "veiculo", id] as const;

/** O extrato de um veículo, do mais recente para o mais antigo. */
export function useLotacoesDoVeiculo(idVeiculo: string | null | undefined) {
  return useQuery({
    queryKey: KEY_VEICULO(idVeiculo),
    enabled: !!idVeiculo,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_lotacoes")
        .select("*")
        .eq("id_veiculo", idVeiculo as string)
        .order("data_movimentacao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaLotacao[];
    },
  });
}

/**
 * Todas as mudanças de base — alimenta a tela de Movimentações.
 *
 * Mesmo teto de 500 da lista de saídas, pelo mesmo motivo: a tela é um extrato
 * para ler, não um relatório para exportar. Mudança de base é evento raro (um
 * carro muda de base algumas vezes na vida), então 500 cobre anos de operação.
 */
export function useLotacoes() {
  return useQuery({
    queryKey: [...KEY, "todas"] as const,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_lotacoes")
        .select("*")
        .order("data_movimentacao", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as FrotaLotacao[];
    },
  });
}

export type LotacaoInput = {
  id_veiculo: string;
  id_unidade_destino: string;
  /** ISO. A tela manda o instante escolhido no campo de data e hora. */
  data_movimentacao: string;
  motivo?: string | null;
  responsavel_nome?: string | null;
  observacao?: string | null;
  /** O trecho rodado. Opcional — quem registra pode não ter feito a rota. */
  km_percorrido?: number | null;
  /** O odômetro na chegada. Opcional, e o único que mexe no km do veículo. */
  km_odometro?: number | null;
};

export function useRegistrarLotacao() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: LotacaoInput) => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("frota_lotacoes")
        .insert({
          ...input,
          id_lotacao: gerarId("LOT"),
          criado_por: user?.email ?? null,
        } as never)
        .select("*")
        .single();
      if (error) throw error;

      // Depois do insert, nunca antes: se o km falhar, a movimentação já está
      // registrada e o km é recuperável pelo próximo lançamento. O contrário
      // faria o odômetro andar sem nada que justificasse. Mesma ordem que
      // useFinalizarSaida usa desde a v177.
      if (input.km_odometro != null) {
        const linha = data as unknown as FrotaLotacao;
        await atualizarKmVeiculo({
          id_veiculo: input.id_veiculo,
          km: input.km_odometro,
          origem: "LOTACAO",
          id_origem: linha.id_lotacao,
        });
      }

      return data as unknown as FrotaLotacao;
    },
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: KEY });
      // A base do veículo mudou por trigger — sem invalidar, a lista continua
      // mostrando o carro na base antiga até alguém recarregar a página.
      qc.invalidateQueries({ queryKey: ["frota_veiculos"] });
      qc.invalidateQueries({ queryKey: ["frota_veiculo", l.id_veiculo] });
      toast.success("Movimentação registrada. O veículo já aparece na base nova.");
    },
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível registrar a movimentação.")),
  });
}
