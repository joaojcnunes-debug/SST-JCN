"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { gerarId } from "@/lib/utils";
import { atualizarKmVeiculo } from "@/lib/hooks/useFrotaVeiculos";
import type { FrotaManutencao } from "@/lib/frota/tipos";

/**
 * MANUTENÇÃO — o que está por trás do status (tabela `frota_manutencoes`, v178).
 *
 * A v177 já tinha a situação 'MANUTENCAO' no veículo e nada por trás dela: o
 * carro ficava marcado como parado e ninguém sabia do quê, desde quando, em
 * qual oficina, nem por quanto.
 *
 * O QUE ESTE MÓDULO NÃO FAZ DE PROPÓSITO: registrar manutenção NÃO muda a
 * situação do veículo sozinho. É a mesma disciplina do abastecimento, que não
 * soma litro com valor — no módulo Frota o sistema guarda o que a pessoa
 * afirma, e não deduz. Trocar a situação por conta própria daria dois donos ao
 * mesmo campo: quem abre a manutenção e quem administra a frota. O painel
 * aponta a divergência ("parado na oficina mas marcado como Ativo") e deixa a
 * correção com quem manda.
 */

const KEY = ["frota_manutencoes"] as const;
const KEY_VEICULO = (id: string | null | undefined) => [...KEY, "veiculo", id] as const;

export function useManutencoesDoVeiculo(idVeiculo: string | null | undefined) {
  return useQuery({
    queryKey: KEY_VEICULO(idVeiculo),
    enabled: !!idVeiculo,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_manutencoes")
        .select("*")
        .eq("id_veiculo", idVeiculo as string)
        .order("data_entrada", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaManutencao[];
    },
  });
}

/** Todas — alimenta o painel e a aba de manutenção da tela de movimentações. */
export function useManutencoes() {
  return useQuery({
    queryKey: [...KEY, "todas"] as const,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_manutencoes")
        .select("*")
        .order("data_entrada", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as FrotaManutencao[];
    },
  });
}

export type ManutencaoInput = Omit<
  FrotaManutencao,
  "id_manutencao" | "criado_por" | "criado_em" | "updated_at"
>;

/**
 * Insere ou atualiza, conforme venha id. Manutenção é o registro que mais muda
 * depois de criado — nasce agendada, vira em andamento, e só na saída da oficina
 * ganha data de saída, nota e valor. Um formulário só para os dois casos evita
 * duas telas que sempre teriam de mudar juntas.
 */
export function useSalvarManutencao() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { input: ManutencaoInput; id_manutencao?: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const id_manutencao = args.id_manutencao ?? gerarId("MAN");

      const { data, error } = args.id_manutencao
        ? await supabase
            .from("frota_manutencoes")
            .update({ ...args.input, updated_at: new Date().toISOString() } as never)
            .eq("id_manutencao", args.id_manutencao)
            .select("*")
            .single()
        : await supabase
            .from("frota_manutencoes")
            .insert({
              ...args.input,
              id_manutencao,
              criado_por: user?.email ?? null,
            } as never)
            .select("*")
            .single();
      if (error) throw error;

      // A oficina anota o odômetro na entrada, e essa leitura costuma ser mais
      // recente que a última saída. Só sobe, como todas as outras origens.
      if (args.input.km_odometro != null) {
        await atualizarKmVeiculo({
          id_veiculo: args.input.id_veiculo,
          km: args.input.km_odometro,
          origem: "MANUTENCAO",
          id_origem: id_manutencao,
        });
      }

      return data as unknown as FrotaManutencao;
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["frota_veiculos"] });
      qc.invalidateQueries({ queryKey: ["frota_veiculo", m.id_veiculo] });
      toast.success("Manutenção registrada.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível salvar a manutenção.")),
  });
}

/** Exclusão pela lixeira, como todo o módulo. Rótulo = a descrição. */
export function useExcluirManutencao() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id_manutencao: string; id_veiculo: string }) => {
      await excluirComLixeiraPorId({
        tabela: "frota_manutencoes",
        chave: "id_manutencao",
        id: args.id_manutencao,
        modulo: "frota",
        rotuloCol: "descricao",
      });
      return args;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: KEY_VEICULO(a.id_veiculo) });
      toast.success("Manutenção movida para a lixeira.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível excluir.")),
  });
}
