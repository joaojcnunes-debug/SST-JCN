"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Calculo from "@/lib/dimensionamento/calculo";
import {
  montarCadastro,
  colaboradoresCompletos,
  unidadesDoAno,
  pesosPorte,
  anosDisponiveis,
} from "@/lib/dimensionamento/mapear";
import type { Cadastro } from "@/lib/dimensionamento/mapear";
import type { ResultadoHeadcount } from "@/lib/dimensionamento/calculo";

/**
 * Carrega o cadastro do Dimensionamento e deriva o cálculo (DIM-01).
 *
 * Uma consulta só para tudo: são 8 tabelas pequenas (cadastro de consultoria —
 * 3.165 linhas no total, medido na carga) e o motor precisa do conjunto inteiro
 * para calcular qualquer mês. Paginar ou buscar por tela daria mais requisição e
 * mais chance de a tela mostrar número calculado com cadastro pela metade.
 *
 * Quem barra o não-Admin é a RLS (`dim_admin` nas 12 tabelas): para ele estas
 * consultas voltam VAZIAS, não com erro. Por isso a tela trata "cadastro vazio"
 * como estado legítimo e não como falha.
 */

async function carregar(): Promise<Cadastro> {
  const sb = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = sb as any;

  const [funcoes, unidades, colaboradores, alocacoes, demanda, ativos, portes, parametros] =
    await Promise.all([
      any.from("dim_funcoes").select("*").order("ordem").order("nome"),
      any.from("dim_unidades").select("*").order("created_at").order("id"),
      any.from("dim_colaboradores").select("*").order("created_at").order("id"),
      any.from("dim_colaborador_unidades").select("colaborador_id, unidade_id, percentual"),
      any.from("dim_demanda_mensal").select("unidade_id, ano, mes, condicao, porte, quantidade"),
      any.from("dim_unidade_mes").select("unidade_id, ano, mes, clientes_ativos, atendidas, atendidas_porte"),
      any.from("dim_portes").select("*").order("ordem").order("codigo"),
      any.from("dim_parametros").select("*").eq("id", 1).maybeSingle(),
    ]);

  const erro = [funcoes, unidades, colaboradores, alocacoes, demanda, ativos, portes, parametros]
    .map((r) => r?.error)
    .find(Boolean);
  if (erro) throw new Error(erro.message ?? "Falha ao carregar o dimensionamento");

  return montarCadastro({
    funcoes: funcoes.data ?? [],
    unidades: unidades.data ?? [],
    colaboradores: colaboradores.data ?? [],
    alocacoes: alocacoes.data ?? [],
    demanda: demanda.data ?? [],
    ativos: ativos.data ?? [],
    portes: portes.data ?? [],
    parametros: parametros.data ?? null,
  });
}

export function useCadastroDimensionamento() {
  return useQuery<Cadastro>({
    queryKey: ["dimensionamento", "cadastro"],
    queryFn: carregar,
    staleTime: 60_000,
    // recarrega ao voltar para a aba: o cadastro é compartilhado e outra pessoa
    // pode ter lançado números enquanto esta janela estava parada
    refetchOnWindowFocus: true,
  });
}

/**
 * Deriva o Headcount de um (ano, mês, unidade). Tudo em memória, sobre o cadastro
 * já carregado — trocar mês ou prazo não vai ao banco.
 *
 * `unidadeId = null` significa "todas": o motor soma por unidade, porque a folga
 * de uma NÃO cobre a falta de outra.
 */
export function useHeadcount(opcoes: {
  ano: number;
  mes: number; // 0..11, como o motor conta
  unidadeId: string | null;
  prazos?: number[];
}) {
  const { data: cadastro, ...resto } = useCadastroDimensionamento();

  const headcount = useMemo<ResultadoHeadcount | null>(() => {
    if (!cadastro) return null;

    const unidades = unidadesDoAno(cadastro.unidades, opcoes.ano).filter(
      (u) => !opcoes.unidadeId || u.id === opcoes.unidadeId,
    );
    const colaboradores = colaboradoresCompletos(
      cadastro.colaboradores,
      cadastro.funcoes,
      cadastro.unidades,
    ).filter((c) =>
      !opcoes.unidadeId || (c.alocacoes ?? []).some((a) => a.unidadeId === opcoes.unidadeId),
    );

    const parametros = {
      ...cadastro.parametros,
      pesosPorte: pesosPorte(cadastro.portes),
    };

    const resultado = Calculo.calcular({
      unidades,
      colaboradores,
      parametros,
      janela: { de: 0, ate: 11 },
      ano: opcoes.ano,
    });

    // A fila de janeiro herda o que ficou em aberto nos anos ANTERIORES — é o que
    // faz "510 UEP, dos quais 88 de 2025" existir. Sem isto o acumulado zera a cada
    // 1º de janeiro e o número da tela fica menor que a realidade.
    const fluxo = Calculo.fluxo(resultado, {
      mesAtual: opcoes.mes,
      parametros,
      ano: opcoes.ano,
    });

    return Calculo.headcount(fluxo, {
      mes: opcoes.mes,
      prazos: opcoes.prazos ?? [1, 2, 3, 6, 12],
    });
  }, [cadastro, opcoes.ano, opcoes.mes, opcoes.unidadeId, opcoes.prazos]);

  const anos = useMemo(
    () => (cadastro ? anosDisponiveis(cadastro.unidades, opcoes.ano) : [opcoes.ano]),
    [cadastro, opcoes.ano],
  );

  return { ...resto, cadastro, headcount, anos };
}
