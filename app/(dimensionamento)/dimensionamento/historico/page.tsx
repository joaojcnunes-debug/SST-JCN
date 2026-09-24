"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Cabecalho, Carregando } from "@/components/dimensionamento/ui";

/**
 * Histórico — quem mudou o quê, e quando.
 *
 * Gravado pelo **banco**, por gatilho, não pela interface: não há caminho pelo app que
 * escreva aqui, e a tabela só dá `SELECT` para `authenticated` (a RLS ainda exige Admin).
 * Isso é o que torna o histórico confiável — ninguém edita o próprio rastro.
 *
 * Duas coisas que o leitor precisa saber ao olhar esta tela:
 *  • As 2.073 linhas mais antigas vieram do app do João na migração de 23/09. **77 delas
 *    não têm autor** — já vinham assim de lá (linhas antigas ou importadas), não foi perda
 *    da carga. Aparecem como "sem autor registrado".
 *  • Manutenção feita direto no banco (`psql`) grava com autor vazio de propósito: não
 *    houve usuário, houve manutenção.
 */

const POR_PAGINA = 50;

interface LinhaHistorico {
  id: number;
  quando: string;
  usuario_email: string | null;
  usuario_nome: string | null;
  tabela: string;
  operacao: string;
  registro_id: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}

const ROTULO_TABELA: Record<string, string> = {
  dim_unidades: "unidade",
  dim_funcoes: "função",
  dim_colaboradores: "colaborador",
  dim_colaborador_unidades: "alocação",
  dim_demanda_mensal: "lançamento mensal",
  dim_unidade_mes: "mês da unidade",
  dim_portes: "porte",
  dim_clientes_porte: "porte de cliente",
  dim_documentos: "documento",
  dim_parametros: "parâmetros",
  // linhas importadas da origem guardam o nome antigo, sem prefixo
  unidades: "unidade", funcoes: "função", colaboradores: "colaborador",
  colaborador_unidades: "alocação", demanda_mensal: "lançamento mensal",
  unidade_mes: "mês da unidade", portes: "porte", clientes_porte: "porte de cliente",
  documentos: "documento", parametros: "parâmetros",
};

const VERBO: Record<string, string> = {
  insert: "criou", update: "alterou", delete: "excluiu", importacao: "importou",
};

/** Descrição curta do registro: nome quando existe, senão a chave composta. */
function descrever(l: LinhaHistorico): string {
  const d = (l.depois ?? l.antes ?? {}) as Record<string, unknown>;
  const nome = d.nome ?? d.unidade_nome ?? d.colaborador_nome;
  if (nome) return String(nome);
  if (d.ano && d.mes) {
    const partes = [d.unidade_nome, `${String(d.mes).padStart(2, "0")}/${d.ano}`, d.condicao, d.porte]
      .filter(Boolean).map(String);
    return partes.join(" · ");
  }
  return l.registro_id ?? "—";
}

export default function HistoricoPage() {
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState("");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["dimensionamento", "historico", pagina],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sem tipos gerados para as dim_*
      const sb = createSupabaseBrowserClient() as any;
      const { data, error, count } = await sb
        .from("dim_historico")
        .select("*", { count: "exact" })
        .order("quando", { ascending: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
      if (error) throw new Error(error.message);
      return { linhas: (data ?? []) as LinhaHistorico[], total: count ?? 0 };
    },
    placeholderData: (anterior) => anterior,
  });

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return data?.linhas ?? [];
    return (data?.linhas ?? []).filter((l) =>
      [l.usuario_nome, l.usuario_email, ROTULO_TABELA[l.tabela] ?? l.tabela, descrever(l)]
        .filter(Boolean).join(" ").toLowerCase().includes(t));
  }, [data, busca]);

  if (isLoading) return <Carregando />;

  const total = data?.total ?? 0;
  const ultimaPagina = Math.max(0, Math.ceil(total / POR_PAGINA) - 1);

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Histórico"
        descricao="Toda alteração nos cadastros, gravada pelo próprio banco. Não há caminho pelo app que escreva aqui — nem para apagar."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5">
          <Search className="size-4 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar esta página por autor, tipo ou registro…"
            className="min-w-0 flex-1 text-sm outline-none"
          />
        </label>
        <span className="text-sm text-slate-500 tabular-nums">
          {total.toLocaleString("pt-BR")} evento{total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Quando</th>
              <th className="px-4 py-2 font-semibold">Quem</th>
              <th className="px-4 py-2 font-semibold">O quê</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-500">
                  {new Date(l.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {l.usuario_nome || l.usuario_email || (
                    <span className="text-slate-400">sem autor registrado</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  <span className="font-medium">{VERBO[l.operacao] ?? l.operacao}</span>{" "}
                  {ROTULO_TABELA[l.tabela] ?? l.tabela}{" "}
                  <span className="text-slate-500">— {descrever(l)}</span>
                </td>
              </tr>
            ))}
            {!linhas.length && (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                {busca ? "Nada nesta página com esse filtro." : "Nenhum evento."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPagina((p) => Math.max(0, p - 1))}
          disabled={pagina === 0 || isFetching}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          ← Mais recentes
        </button>
        <span className="text-sm text-slate-500 tabular-nums">
          página {pagina + 1} de {ultimaPagina + 1}
        </span>
        <button
          type="button"
          onClick={() => setPagina((p) => Math.min(ultimaPagina, p + 1))}
          disabled={pagina >= ultimaPagina || isFetching}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Mais antigas →
        </button>
      </div>

      <p className="text-xs text-slate-500">
        O filtro age sobre a página carregada — é um atalho visual, não uma busca no acervo
        inteiro. Para procurar em todo o histórico, use o banco.
      </p>
    </div>
  );
}
