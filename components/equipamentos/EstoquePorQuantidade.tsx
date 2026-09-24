"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Boxes, PackagePlus } from "lucide-react";
import {
  useEquipamentosCatalogo,
  useEquipamentosSaldo,
} from "@/lib/hooks/useEquipamentosEstoque";
import { buscar } from "@/lib/busca/texto";
import { grupoDoTipo } from "@/lib/equipamentos/tipos";

/**
 * Periféricos e itens por quantidade — o estoque que NÃO tem ficha.
 *
 * Nasceu em 21/09/2026 do relato: "os itens cadastrados em Dar entrada não
 * aparecem na Visão geral". Não apareciam porque a Visão geral só lista
 * `equipamentos` (uma ficha por aparelho) e a entrada de mouse/headset grava
 * SALDO em `equipamentos_movimentacoes`. Este bloco põe os dois no mesmo lugar,
 * mas sem misturar: aqui cada linha é "N unidades numa base", não um aparelho.
 *
 * O total da JCN Consultoria é a soma das bases; transferir entre bases não muda o
 * total. Quem estranhar o número deve olhar o extrato da Movimentação.
 */
export default function EstoquePorQuantidade({
  unidadeFiltro,
  tipoFiltro,
  busca,
  nomeUnidade,
}: {
  unidadeFiltro: string | null;
  tipoFiltro: string;
  busca: string;
  nomeUnidade: Map<string, string>;
}) {
  const { data: catalogo = [] } = useEquipamentosCatalogo();
  const { data: saldo } = useEquipamentosSaldo();

  const linhas = useMemo(() => {
    if (!saldo) return [];
    const out: {
      chave: string;
      id_catalogo: string;
      nome: string;
      tipo: string | null;
      unidade_medida: string | null;
      id_unidade: string;
      qtd: number;
      minimo: number;
      umAUm: boolean;
    }[] = [];
    const porId = new Map(catalogo.map((c) => [c.id_catalogo, c]));
    for (const [chave, qtd] of saldo) {
      if (qtd <= 0) continue;
      const [id_unidade, id_catalogo] = chave.split("|");
      const c = porId.get(id_catalogo);
      if (!c) continue;
      if (unidadeFiltro && id_unidade !== unidadeFiltro) continue;
      if (tipoFiltro !== "TODOS" && (c.tipo ?? "") !== tipoFiltro) continue;
      out.push({
        chave,
        id_catalogo,
        nome: c.nome,
        tipo: c.tipo,
        unidade_medida: c.unidade_medida,
        id_unidade,
        qtd,
        minimo: Number(c.estoque_minimo ?? 0),
        umAUm: !!c.controla_individual,
      });
    }
    out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.id_unidade.localeCompare(b.id_unidade));
    return buscar(out, busca, (l) => [l.nome, l.tipo, grupoDoTipo(l.tipo), nomeUnidade.get(l.id_unidade)], { manterOrdem: true }).itens;
  }, [catalogo, saldo, unidadeFiltro, tipoFiltro, busca, nomeUnidade]);

  if (linhas.length === 0) return null;

  const total = linhas.reduce((n, l) => n + l.qtd, 0);

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <Boxes className="size-4" />
          Periféricos e itens por quantidade
          <span className="font-normal text-emerald-800/80">
            · {total} unidade{total === 1 ? "" : "s"} em estoque, sem ficha própria
          </span>
        </h2>
        <Link
          href="/equipamentos/movimentacao"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"
        >
          <PackagePlus className="size-3.5" />
          Dar entrada / retirar
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-2 border-t border-emerald-100 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {linhas.map((l) => {
          const abaixo = l.minimo > 0 && l.qtd < l.minimo;
          return (
            <li
              key={l.chave}
              className="flex items-center justify-between gap-3 rounded-md border border-emerald-100 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{l.nome}</p>
                <p className="truncate text-xs text-gray-500">
                  {l.tipo ?? "sem tipo"}
                  {" · "}
                  {nomeUnidade.get(l.id_unidade) ?? "base"}
                  {l.umAUm ? " · um a um (vira ficha na retirada)" : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={abaixo ? "text-lg font-bold text-amber-700" : "text-lg font-bold text-emerald-800"}>
                  {l.qtd}
                  <span className="ml-1 text-xs font-normal text-gray-500">{l.unidade_medida ?? "un"}</span>
                </p>
                {abaixo && <p className="text-[10px] text-amber-700">abaixo do mínimo ({l.minimo})</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
