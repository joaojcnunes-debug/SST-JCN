"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import EpiModal, { inputCls, labelCls } from "./EpiModal";
import {
  useEpiColaboradores,
  useSalvarColaborador,
  useExcluirColaborador,
} from "@/lib/hooks/useEpi";
import { formatCPF } from "@/lib/utils";
import type { EpiColaborador } from "@/lib/epi/types";

type FormState = Partial<EpiColaborador> & { empresa_id: string };

export default function EpiColaboradoresTab({
  empresaId,
  canEdit,
}: {
  empresaId: string;
  canEdit: boolean;
}) {
  const { data: colaboradores = [], isLoading } = useEpiColaboradores(empresaId);
  const salvar = useSalvarColaborador();
  const excluir = useExcluirColaborador();
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmar, setConfirmar] = useState<EpiColaborador | null>(null);

  function novo() {
    setForm({ empresa_id: empresaId, nome: "", ativo: true });
  }
  function editar(c: EpiColaborador) {
    setForm({ ...c });
  }
  function submit() {
    if (!form?.nome?.trim()) return;
    salvar.mutate(
      { ...form, nome: form.nome!.trim() },
      { onSuccess: () => setForm(null) }
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <strong>{colaboradores.length}</strong> colaborador(es)
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={novo}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Plus className="size-4" /> Novo colaborador
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-400">Carregando…</div>
        ) : colaboradores.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-gray-400">
            <Users className="size-6" />
            Nenhum colaborador cadastrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                <th className="px-4 py-2.5 text-left font-medium">CPF</th>
                <th className="px-4 py-2.5 text-left font-medium">Matrícula</th>
                <th className="px-4 py-2.5 text-left font-medium">Cargo / Setor</th>
                <th className="px-4 py-2.5 text-left font-medium">Situação</th>
                {canEdit && <th className="px-4 py-2.5 text-right font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {colaboradores.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{c.nome}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-700">
                    {c.cpf ? formatCPF(c.cpf) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{c.matricula ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {[c.cargo, c.setor].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        c.ativo
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => editar(c)}
                          aria-label="Editar"
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-verde-primary"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmar(c)}
                          aria-label="Excluir"
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <EpiModal
          titulo={form.id ? "Editar colaborador" : "Novo colaborador"}
          onClose={() => setForm(null)}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nome *</label>
              <input
                className={inputCls}
                value={form.nome ?? ""}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>CPF</label>
              <input
                className={inputCls}
                value={form.cpf ?? ""}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Matrícula</label>
              <input
                className={inputCls}
                value={form.matricula ?? ""}
                onChange={(e) => setForm({ ...form, matricula: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Cargo</label>
              <input
                className={inputCls}
                value={form.cargo ?? ""}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Setor</label>
              <input
                className={inputCls}
                value={form.setor ?? ""}
                onChange={(e) => setForm({ ...form, setor: e.target.value })}
              />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.ativo ?? true}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Colaborador ativo
            </label>
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
        <EpiModal titulo="Remover colaborador" onClose={() => setConfirmar(null)}>
          <p className="text-sm text-gray-600">
            Remover <strong>{confirmar.nome}</strong>? Esta ação não pode ser
            desfeita.
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
