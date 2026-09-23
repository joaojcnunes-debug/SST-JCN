"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, ListChecks } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import {
  useModelos, useSalvarModelo, useExcluirModelo,
  type GestaoSubtarefaModelo, type ItemModelo,
} from "@/lib/hooks/useGestao";
import { confirmar } from "@/components/ui/confirm";

const inputCls = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none";

type Draft = Pick<GestaoSubtarefaModelo, "slug" | "titulo" | "itens">;

function draftDe(m: GestaoSubtarefaModelo): Draft {
  return { slug: m.slug, titulo: m.titulo, itens: m.itens ?? [] };
}

export default function ModelosManagerModal({
  open, onClose, idQuadro, podeEditar,
}: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  podeEditar: boolean;
}) {
  const { data: modelos = [] } = useModelos(idQuadro);
  const salvar = useSalvarModelo();
  const excluir = useExcluirModelo();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  function novo() {
    salvar.mutate(
      { id_quadro: idQuadro, slug: `modelo-${Date.now().toString(36)}`, titulo: "Novo modelo", itens: [] },
      { onSuccess: () => toast.success("Modelo criado") },
    );
  }

  function abrirEdicao(m: GestaoSubtarefaModelo) {
    setEditId(m.id);
    setDraft(draftDe(m));
  }

  function salvarEdicao() {
    if (!editId || !draft) return;
    const slug = draft.slug.trim();
    if (!slug) { toast.error("Informe um identificador (slug)."); return; }
    salvar.mutate(
      { id: editId, id_quadro: idQuadro, slug, titulo: draft.titulo.trim() || "Modelo", itens: draft.itens },
      { onSuccess: () => { toast.success("Modelo salvo"); setEditId(null); setDraft(null); } },
    );
  }

  const up = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const upItem = (i: number, patch: Partial<ItemModelo>) =>
    setDraft((d) => (d ? { ...d, itens: d.itens.map((x, j) => (j === i ? { ...x, ...patch } : x)) } : d));

  return (
    <Modal open={open} onClose={onClose} title="Modelos de checklist" size="lg">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Um modelo é uma lista de subtarefas reutilizável. A automação <span className="font-mono">criar_subtarefas_modelo</span> usa
          o identificador (slug) para materializar o checklist numa tarefa.
        </p>

        {modelos.map((m) => (
          <div key={m.id} className="rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 p-2.5">
              <ListChecks className="size-4 shrink-0 text-gray-400" />
              <span className="flex-1 truncate text-sm font-medium text-gray-800">{m.titulo}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">{m.slug}</span>
              <span className="text-xs text-gray-400">{(m.itens ?? []).length} itens</span>
              {podeEditar && (
                <>
                  <button type="button" onClick={() => (editId === m.id ? (setEditId(null), setDraft(null)) : abrirEdicao(m))} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Editar"><Pencil className="size-4" /></button>
                  <button type="button" onClick={async () => { if (await confirmar({ title: "Excluir modelo?", description: "Automações que apontam para este slug deixam de criar subtarefas." })) excluir.mutate(m.id); }} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600" title="Excluir"><Trash2 className="size-4" /></button>
                </>
              )}
            </div>

            {editId === m.id && draft && (
              <div className="space-y-3 border-t border-gray-100 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Título do modelo</label>
                    <input value={draft.titulo} onChange={(e) => up({ titulo: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Identificador (slug)</label>
                    <input value={draft.slug} onChange={(e) => up({ slug: e.target.value })} placeholder="ex.: pgr" className={`${inputCls} font-mono`} />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Itens do checklist</label>
                  <div className="space-y-1.5">
                    {draft.itens.map((it, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={it.texto} onChange={(e) => upItem(i, { texto: e.target.value })} placeholder="Texto da subtarefa" className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none" />
                        <input value={it.etapa ?? ""} onChange={(e) => upItem(i, { etapa: e.target.value || null })} placeholder="etapa (opc.)" className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none" />
                        <button type="button" onClick={() => up({ itens: draft.itens.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-600"><X className="size-4" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => up({ itens: [...draft.itens, { texto: "", etapa: null, tipo: null }] })} className="inline-flex items-center gap-1 text-xs font-medium text-verde-primary hover:underline">
                      <Plus className="size-3.5" /> Adicionar item
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => { setEditId(null); setDraft(null); }} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
                  <button type="button" onClick={salvarEdicao} disabled={salvar.isPending} className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-dark disabled:opacity-60">
                    <Check className="size-4" /> Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {modelos.length === 0 && <p className="text-sm text-gray-400">Nenhum modelo ainda.</p>}

        {podeEditar && (
          <button type="button" onClick={novo} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-verde-primary ring-1 ring-dashed ring-verde-primary/40 hover:bg-verde-light/40">
            <Plus className="size-4" /> Novo modelo
          </button>
        )}
      </div>
    </Modal>
  );
}
