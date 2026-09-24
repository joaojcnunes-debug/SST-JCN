"use client";

import { useMemo } from "react";
import { Inbox, Loader2, Wrench } from "lucide-react";
import NovidadeItem from "@/components/novidades/NovidadeItem";
import { useNovidades } from "@/lib/hooks/useNovidades";
import { MELHORIAS_INTERNAS } from "@/lib/novidades/catalogo";
import type { ItemNovidade } from "@/lib/novidades/tipos";

/**
 * A ABA ATUALIZACOES — a lista completa, o lugar fixo.
 *
 * Vive dentro da Ajuda dos 11 modulos, mas o conteudo esta escrito UMA vez:
 * cada pagina de ajuda chama <AjudaComAbas>, que chama isto aqui. Se a lista
 * mudar, muda em um arquivo, nao em onze.
 *
 * Sem filtro por modulo, de proposito: a mesma lista em todos os lugares. Foi a
 * decisao do Sanmyo em 01/09 -- todo mundo ve tudo.
 */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-09" → "setembro de 2026" */
function mesPorExtenso(anoMes: string): string {
  const [ano, mes] = anoMes.split("-");
  const m = MESES[Number(mes) - 1];
  return m ? `${m} de ${ano}` : anoMes;
}

export default function AtualizacoesAba() {
  const { itens, isLoading } = useNovidades();

  /**
   * Agrupado por mes. Sem cabecalho de mes a lista vira um rolo continuo em que
   * "faz tempo" e "foi ontem" parecem a mesma coisa.
   */
  const porMes = useMemo(() => {
    const mapa = new Map<string, ItemNovidade[]>();
    for (const item of itens) {
      const chave = item.data.slice(0, 7);
      const lista = mapa.get(chave);
      if (lista) lista.push(item);
      else mapa.set(chave, [item]);
    }
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [itens]);

  const internasPorMes = useMemo(
    () => new Map(MELHORIAS_INTERNAS.map((m) => [m.mes, m])),
    [],
  );

  if (isLoading && itens.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" />
        Carregando atualizações…
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
        <Inbox className="mx-auto size-6 text-gray-400" />
        <p className="mt-2 text-sm font-medium text-gray-700">Nada por aqui ainda</p>
        <p className="mt-1 text-xs text-gray-500">
          Quando o painel receber uma mudança que você percebe, ela aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-gray-600">
        O que mudou no painel, do mais recente para o mais antigo. Esta lista é a mesma
        para todo mundo, em qualquer módulo.
      </p>

      {porMes.map(([mes, doMes]) => {
        const internas = internasPorMes.get(mes);
        return (
          <section key={mes} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {mesPorExtenso(mes)}
            </h2>

            {doMes.map((item) => (
              <NovidadeItem key={item.id} item={item} />
            ))}

            {/*
              O trabalho que ninguem ve, em uma linha. Nao entra no modal (modal
              comprido ninguem le) e nao vem detalhado: quem le isto nao ganha
              nada sabendo qual indice foi criado. Serve para que um mes inteiro
              de trabalho de base nao pareca um mes parado.
            */}
            {internas && (
              <p className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-500">
                <Wrench className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <strong className="font-semibold text-gray-600">
                    {internas.quantidade}{" "}
                    {internas.quantidade === 1 ? "melhoria interna" : "melhorias internas"}
                  </strong>{" "}
                  — {internas.resumo}
                </span>
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
