"use client";

import { useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCadastroDimensionamento } from "@/lib/hooks/useDimensionamento";
import { useMutacoesDimensionamento } from "@/lib/hooks/useDimensionamentoMutacoes";
import type { UnidadeCadastro } from "@/lib/dimensionamento/mapear";
import { BotoesModal, Cabecalho, Campo, Carregando, Modal, Vazio } from "@/components/dimensionamento/ui";

/**
 * Unidades (filiais) do dimensionamento.
 *
 * NÃO são as `unidades` do painel SST — são outra dimensão, com outro significado, e é
 * por isso que a tabela se chama `dim_unidades`. O `codigo_api` é o que casa esta unidade
 * com a base do SGG na sincronização; sem ele, a unidade é ignorada pela API.
 *
 * Excluir apaga em cascata os lançamentos mensais e as alocações de colaboradores nela —
 * por isso a confirmação diz o que vai junto.
 */
export default function UnidadesPage() {
  const { data: cadastro, isLoading } = useCadastroDimensionamento();
  const { salvarUnidade, excluirUnidade } = useMutacoesDimensionamento();
  const [editando, setEditando] = useState<Partial<UnidadeCadastro> | null>(null);

  if (isLoading) return <Carregando />;

  const unidades = cadastro?.unidades ?? [];
  const lancamentos = (u: UnidadeCadastro) =>
    Object.values(u.mesesPorAno ?? {}).reduce((s, meses) => s + Object.keys(meses ?? {}).length, 0);
  const alocados = (id: string) =>
    (cadastro?.colaboradores ?? []).filter((c) => c.alocacoes.some((a) => a.unidadeId === id)).length;

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Unidades"
        descricao="As filiais que entram no dimensionamento. O código da API é o que liga esta unidade à base do SGG na sincronização."
        acao={
          <button
            type="button"
            onClick={() => setEditando({ nome: "", codigoApi: "" })}
            className="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            <Plus className="size-4" /> Nova unidade
          </button>
        }
      />

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Unidade</th>
              <th className="px-4 py-2 font-semibold">Código na API</th>
              <th className="px-4 py-2 text-right font-semibold">Meses com lançamento</th>
              <th className="px-4 py-2 text-right font-semibold">Colaboradores</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {unidades.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-medium text-slate-900">
                  <span className="flex items-center gap-2">
                    <Building2 className="size-4 text-slate-400" /> {u.nome}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {u.codigoApi ?? <span className="text-amber-700">sem código — fora da sincronização</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{lancamentos(u)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{alocados(u.id)}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => setEditando(u)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Editar">
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const n = lancamentos(u);
                        const c = alocados(u.id);
                        const aviso = [n && `${n} mês(es) de lançamento`, c && `${c} alocação(ões) de colaborador`]
                          .filter(Boolean).join(" e ");
                        if (confirm(`Excluir "${u.nome}"?${aviso ? `\n\nIsso apaga junto: ${aviso}.` : ""}`)) {
                          excluirUnidade.mutate(u.id);
                        }
                      }}
                      className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!unidades.length && <Vazio colSpan={5} texto="Nenhuma unidade cadastrada." />}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal titulo={editando.id ? "Editar unidade" : "Nova unidade"} aoFechar={() => setEditando(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editando.nome?.trim()) return;
              salvarUnidade.mutate(
                { id: editando.id, nome: editando.nome, codigoApi: editando.codigoApi },
                { onSuccess: () => setEditando(null) },
              );
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
            <Campo rotulo="Código na API (base do SGG)" ajuda="Deixe vazio se esta unidade não deve receber dados da sincronização.">
              <input
                value={editando.codigoApi ?? ""}
                onChange={(e) => setEditando({ ...editando, codigoApi: e.target.value })}
                placeholder="ex.: teresopolis"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Campo>
            <BotoesModal aoCancelar={() => setEditando(null)} salvando={salvarUnidade.isPending} />
          </form>
        </Modal>
      )}
    </div>
  );
}
