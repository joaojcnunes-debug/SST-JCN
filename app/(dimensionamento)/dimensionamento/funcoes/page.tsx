"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCadastroDimensionamento } from "@/lib/hooks/useDimensionamento";
import { useMutacoesDimensionamento } from "@/lib/hooks/useDimensionamentoMutacoes";
import { COORDENA, TIPOS_PRODUCAO } from "@/lib/dimensionamento/mapear";
import type { Funcao } from "@/lib/dimensionamento/mapear";
import { BotoesModal, Cabecalho, Campo, Carregando, Modal, Vazio } from "@/components/dimensionamento/ui";

/**
 * Funções — o que define se alguém entra no cálculo, e como.
 *
 * O **tipo de produção** é a decisão que mais pesa: `nenhuma` tira a pessoa das contas
 * (supervisores), `tecnico` a coloca nas inspeções e relatórios, `administrativo` nas
 * empresas finalizadas. Mudar o tipo de uma função muda o número de todo mundo que a tem.
 *
 * **Chefia** não produz: aparece como responsável nas unidades onde está alocada e
 * monta o organograma pela hierarquia (`responde_para`). Ciclos são barrados no formulário
 * — e a FK é adiável (v251), então a hierarquia pode ser gravada em qualquer ordem.
 *
 * Função em uso não pode ser excluída (FK `restrict` em `dim_colaboradores`).
 */
export default function FuncoesPage() {
  const { data: cadastro, isLoading } = useCadastroDimensionamento();
  const { salvarFuncao, excluirFuncao } = useMutacoesDimensionamento();
  const [editando, setEditando] = useState<Partial<Funcao> | null>(null);

  if (isLoading) return <Carregando />;

  const funcoes = cadastro?.funcoes ?? [];
  const emUso = (id: string) => (cadastro?.colaboradores ?? []).filter((c) => c.funcaoId === id).length;
  const nomeDe = (id: string | null) => funcoes.find((f) => f.id === id)?.nome ?? "—";

  /** Quem pode ser chefe de quem: só chefias, e nunca criando ciclo. */
  const chefiasValidas = (alvo?: string) =>
    funcoes.filter((f) => {
      if (!f.chefia || f.id === alvo) return false;
      // sobe a cadeia do candidato: se encontrar o alvo, apontar para ele fecharia um ciclo
      let atual: string | null = f.respondeParaId;
      const vistos = new Set<string>();
      while (atual && !vistos.has(atual)) {
        if (atual === alvo) return false;
        vistos.add(atual);
        atual = funcoes.find((x) => x.id === atual)?.respondeParaId ?? null;
      }
      return true;
    });

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Funções"
        descricao="O tipo de produção decide quem entra no cálculo: sem produção, a pessoa não é contada. Chefia não produz — coordena, e monta o organograma."
        acao={
          <button
            type="button"
            onClick={() => setEditando({ nome: "", tipoProducao: "tecnico", chefia: false, coordena: "todos", ordem: funcoes.length, custoMensal: 0 })}
            className="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            <Plus className="size-4" /> Nova função
          </button>
        }
      />

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Função</th>
              <th className="px-4 py-2 font-semibold">Tipo de produção</th>
              <th className="px-4 py-2 font-semibold">Chefia</th>
              <th className="px-4 py-2 text-right font-semibold">Custo mensal</th>
              <th className="px-4 py-2 text-right font-semibold">Pessoas</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {funcoes.map((f) => {
              const n = emUso(f.id);
              return (
                <tr key={f.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{f.nome}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {TIPOS_PRODUCAO.find((t) => t.id === f.tipoProducao)?.rotulo ?? f.tipoProducao}
                    {f.tipoProducao === "nenhuma" && <span className="ml-2 text-xs text-slate-400">(fora do cálculo)</span>}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {f.chefia
                      ? `${COORDENA.find((c) => c.id === f.coordena)?.rotulo} · responde a ${nomeDe(f.respondeParaId)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                    {f.custoMensal > 0 ? f.custoMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{n}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditando(f)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Editar">
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={n > 0}
                        title={n > 0 ? `${n} colaborador(es) usam esta função` : "Excluir"}
                        onClick={() => confirm(`Excluir a função "${f.nome}"?`) && excluirFuncao.mutate(f.id)}
                        className="rounded p-1.5 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!funcoes.length && <Vazio colSpan={6} texto="Nenhuma função cadastrada." />}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal titulo={editando.id ? "Editar função" : "Nova função"} aoFechar={() => setEditando(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editando.nome?.trim()) return;
              salvarFuncao.mutate(editando as Funcao & { nome: string }, { onSuccess: () => setEditando(null) });
            }}
            className="space-y-4"
          >
            <Campo rotulo="Nome">
              <input
                autoFocus
                value={editando.nome ?? ""}
                onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Campo>

            <Campo rotulo="Tipo de produção" ajuda={TIPOS_PRODUCAO.find((t) => t.id === editando.tipoProducao)?.descricao}>
              <select
                value={editando.tipoProducao ?? "tecnico"}
                onChange={(e) => setEditando({ ...editando, tipoProducao: e.target.value as Funcao["tipoProducao"] })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {TIPOS_PRODUCAO.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
              </select>
            </Campo>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!editando.chefia}
                onChange={(e) => setEditando({ ...editando, chefia: e.target.checked })}
                className="size-4 rounded border-slate-300"
              />
              É chefia de equipe
            </label>

            {editando.chefia && (
              <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
                <Campo rotulo="Coordena">
                  <select
                    value={editando.coordena ?? "todos"}
                    onChange={(e) => setEditando({ ...editando, coordena: e.target.value as Funcao["coordena"] })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {COORDENA.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Responde para" ajuda="Vazio = topo da hierarquia.">
                  <select
                    value={editando.respondeParaId ?? ""}
                    onChange={(e) => setEditando({ ...editando, respondeParaId: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">— topo —</option>
                    {chefiasValidas(editando.id).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </Campo>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Custo mensal por pessoa" ajuda="Alimenta os valores em R$ do Headcount.">
                <input
                  type="number" min={0} step="0.01"
                  value={editando.custoMensal ?? 0}
                  onChange={(e) => setEditando({ ...editando, custoMensal: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Campo>
              <Campo rotulo="Ordem de exibição">
                <input
                  type="number" step={1}
                  value={editando.ordem ?? 0}
                  onChange={(e) => setEditando({ ...editando, ordem: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Campo>
            </div>

            <BotoesModal aoCancelar={() => setEditando(null)} salvando={salvarFuncao.isPending} />
          </form>
        </Modal>
      )}
    </div>
  );
}
