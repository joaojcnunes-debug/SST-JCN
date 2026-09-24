"use client";

/**
 * A exclusão de qualquer item da inspeção, com offline embutido.
 *
 * As oito abas do editor apagavam do mesmo jeito, palavra por palavra: monta o
 * cliente, `delete().eq(chave, valor)`, invalida a query, avisa. Repetir isso
 * oito vezes com offline junto seria oito chances de esquecer a atualização
 * otimista — e, sem ela, o item apagado sem rede volta a aparecer assim que o
 * diálogo fecha.
 *
 * EXCLUIR ALGO QUE AINDA NÃO SUBIU: a fila fica com o insert e o delete, nesta
 * ordem, e os dois sobem. O item nasce e morre no servidor em segundos. É
 * desperdício, não erro — e a alternativa (procurar e cancelar o insert
 * pendente) só valeria a pena se isso acontecesse muito, o que a tela de
 * pendências vai mostrar.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { gravar } from "@/lib/offline/gravar";
import type { InspecaoFull } from "./useInspecao";

/** Só as chaves de `InspecaoFull` que guardam lista — `inspecao` não entra. */
type ColecaoDaInspecao = {
  [K in keyof InspecaoFull]: InspecaoFull[K] extends readonly unknown[] ? K : never;
}[keyof InspecaoFull];

export function useExcluirDaInspecao(opts: {
  idInspecao: string;
  /** Tabela no PostgREST. */
  tabela: string;
  /** Coluna da chave primária, usada no filtro e na remoção local. */
  chave: string;
  /** Qual lista de `InspecaoFull` perde o item quando não há rede. */
  colecao: ColecaoDaInspecao;
  /** O que o técnico lê ao dar certo: "Setor removido". */
  rotulo: string;
}) {
  const qc = useQueryClient();

  return useMutation({
    // `object` e não `Record<string, unknown>`: as linhas são interfaces
    // nomeadas (`Setor`, `Cargo`…), que o TypeScript não considera indexáveis
    // por string. A leitura da chave é feita com um cast, num ponto só.
    mutationFn: async (linha: object) => {
      const valor = String((linha as Record<string, unknown>)[opts.chave]);
      const resultado = await gravar({
        tabela: opts.tabela,
        tipo: "delete",
        linhas: null,
        filtro: { [opts.chave]: valor },
        modulo: "inspecoes",
        id_documento: opts.idInspecao,
      });
      return { resultado, valor };
    },

    onSuccess: ({ resultado, valor }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", opts.idInspecao] });
        toast.success(opts.rotulo);
        return;
      }

      // Sem rede não há o que revalidar: o item sai da lista à mão.
      qc.setQueryData<InspecaoFull>(["inspecao", opts.idInspecao], (antigo) => {
        if (!antigo) return antigo;
        const lista = antigo[opts.colecao] as unknown as Record<string, unknown>[];
        return {
          ...antigo,
          [opts.colecao]: lista.filter((x) => String(x[opts.chave]) !== valor),
        } as InspecaoFull;
      });
      toast.success(`${opts.rotulo} — guardado no aparelho`, { icon: "📵" });
    },

    onError: (e: Error) => toast.error(e.message),
  });
}
