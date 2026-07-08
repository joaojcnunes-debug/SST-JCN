"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, HardHat, AlertTriangle } from "lucide-react";
import EpiModal, { inputCls, labelCls } from "./EpiModal";
import {
  useEpiCatalogo,
  useSalvarEpiItem,
  useExcluirEpiItem,
  useEpiSaldo,
} from "@/lib/hooks/useEpi";
import type { EpiCatalogoItem } from "@/lib/epi/types";

type FormState = Partial<EpiCatalogoItem> & { empresa_id: string };

/** Situação da validade do CA. */
function statusCA(validade: string | null): {
  label: string;
  cls: string;
} | null {
  if (!validade) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dv = new Date(validade + "T00:00:00");
  const dias = Math.round((dv.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return { label: "CA vencido", cls: "bg-red-100 text-red-700" };
  if (dias <= 30)
    return { label: `Vence em ${dias}d`, cls: "bg-amber-100 text-amber-700" };
  return null;
}

function fmtDataBR(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function EpiCatalogoTab({
  empresaId,
  canEdit,
}: {
  empresaId: string;
  canEdit: boolean;
}) {
  const { data: itens = [], isLoading } = useEpiCatalogo(empresaId);
  const { data: saldos } = useEpiSaldo(empresaId);
  const salvar = useSalvarEpiItem();
  const excluir = useExcluirEpiItem();
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmar, setConfirmar] = useState<EpiCatalogoItem | null>(null);

  function novo() {
    setForm({
      empresa_id: empresaId,
      nome: "",
      tipo: "EPI",
      unidade: "un",
      estoque_minimo: 0,
      ativo: true,
    });
  }
  function submit() {
    if (!form?.nome?.trim()) return;
    salvar.mutate(
      {
        ...form,
        nome: form.nome!.trim(),
        estoque_minimo: Number(form.estoque_minimo) || 0,
      },
      { onSuccess: () => setForm(null) }
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <strong>{itens.length}</strong> item(ns) no catálogo
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={novo}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Plus className="size-4" /> Novo EPI
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-400">Carregando…</div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-gray-400">
            <HardHat className="size-6" />
            Nenhum EPI cadastrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">EPI</th>
                <th className="px-4 py-2.5 text-left font-medium">CA</th>
                <th className="px-4 py-2.5 text-left font-medium">Validade CA</th>
                <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                <th className="px-4 py-2.5 text-right font-medium">Mínimo</th>
                {canEdit && <th className="px-4 py-2.5 text-right font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itens.map((it) => {
                const saldo = saldos?.get(it.id) ?? 0;
                const abaixo = saldo < it.estoque_minimo;
                const ca = statusCA(it.ca_validade);
                return (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{it.nome}</div>
                      <div className="text-[11px] text-gray-500">
                        {it.tipo}
                        {it.fabricante ? ` · ${it.fabricante}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">
                      {it.ca_numero ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      <div className="flex items-center gap-1.5">
                        {fmtDataBR(it.ca_validade)}
                        {ca && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ca.cls}`}
                          >
                            {ca.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          abaixo ? "text-red-600" : "text-gray-900"
                        }`}
                      >
                        {abaixo && <AlertTriangle className="size-3.5" />}
                        {saldo} {it.unidade}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">
                      {it.estoque_minimo}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setForm({ ...it })}
                            aria-label="Editar"
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-verde-primary"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmar(it)}
                            aria-label="Excluir"
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <EpiModal
          titulo={form.id ? "Editar EPI" : "Novo EPI"}
          onClose={() => setForm(null)}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nome / descrição do EPI *</label>
              <input
                className={inputCls}
                value={form.nome ?? ""}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select
                className={inputCls}
                value={form.tipo ?? "EPI"}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value as "EPI" | "EPC" })
                }
              >
                <option value="EPI">EPI</option>
                <option value="EPC">EPC</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Fabricante</label>
              <input
                className={inputCls}
                value={form.fabricante ?? ""}
                onChange={(e) =>
                  setForm({ ...form, fabricante: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Nº do CA</label>
              <input
                className={inputCls}
                value={form.ca_numero ?? ""}
                onChange={(e) => setForm({ ...form, ca_numero: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Validade do CA</label>
              <input
                type="date"
                className={inputCls}
                value={form.ca_validade ?? ""}
                onChange={(e) =>
                  setForm({ ...form, ca_validade: e.target.value || null })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Unidade</label>
              <input
                className={inputCls}
                value={form.unidade ?? "un"}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Estoque mínimo</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.estoque_minimo ?? 0}
                onChange={(e) =>
                  setForm({ ...form, estoque_minimo: Number(e.target.value) })
                }
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Observações</label>
              <textarea
                className={inputCls}
                rows={2}
                value={form.descricao ?? ""}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={salvar.isPending || !form.nome?.trim()}
              className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
            >
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </EpiModal>
      )}

      {confirmar && (
        <EpiModal titulo="Remover EPI" onClose={() => setConfirmar(null)}>
          <p className="text-sm text-gray-600">
            Remover <strong>{confirmar.nome}</strong> do catálogo? As movimentações
            vinculadas também serão removidas.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmar(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() =>
                excluir.mutate(
                  { id: confirmar.id, empresa_id: empresaId },
                  { onSuccess: () => setConfirmar(null) }
                )
              }
              disabled={excluir.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {excluir.isPending ? "Removendo…" : "Remover"}
            </button>
          </div>
        </EpiModal>
      )}
    </div>
  );
}
