"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import { useSalvarEtiqueta, useExcluirEtiqueta, type GestaoEtiqueta } from "@/lib/hooks/useGestao";

export default function EtiquetasManagerModal({
  open,
  onClose,
  idQuadro,
  etiquetas,
  podeEditar,
}: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  etiquetas: GestaoEtiqueta[];
  podeEditar: boolean;
}) {
  const salvar = useSalvarEtiqueta();
  const excluir = useExcluirEtiqueta();

  function adicionar() {
    const maxOrdem = etiquetas.reduce((m, e) => Math.max(m, e.ordem), -1);
    salvar.mutate({ id_quadro: idQuadro, nome: "nova etiqueta", cor: "#6366f1", ordem: maxOrdem + 1 });
  }

  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= etiquetas.length) return;
    const a = etiquetas[i], b = etiquetas[j];
    await salvar.mutateAsync({ id: a.id, id_quadro: idQuadro, ordem: b.ordem });
    await salvar.mutateAsync({ id: b.id, id_quadro: idQuadro, ordem: a.ordem });
  }

  return (
    <Modal open={open} onClose={onClose} title="Etiquetas" size="md">
      <div className="space-y-2">
        {etiquetas.map((e, i) => (
          <div key={e.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
            <input
              type="color"
              defaultValue={e.cor}
              disabled={!podeEditar}
              onBlur={(ev) => { if (ev.target.value !== e.cor) salvar.mutate({ id: e.id, id_quadro: idQuadro, cor: ev.target.value }); }}
              className="size-7 shrink-0 cursor-pointer rounded border border-gray-200 bg-transparent p-0.5"
              title="Cor"
            />
            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-white" style={{ background: e.cor }}>{e.nome}</span>
            <input
              defaultValue={e.nome}
              disabled={!podeEditar}
              onBlur={(ev) => { const v = ev.target.value.trim(); if (v && v !== e.nome) salvar.mutate({ id: e.id, id_quadro: idQuadro, nome: v }); }}
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none"
            />
            {podeEditar && (
              <div className="flex shrink-0 items-center">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ChevronUp className="size-4" /></button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === etiquetas.length - 1} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ChevronDown className="size-4" /></button>
                <button type="button" onClick={async () => { if (await confirmar({ title: `Excluir etiqueta "${e.nome}"?`, description: "Some do catálogo; as tarefas mantêm o nome (sem cor)." })) excluir.mutate(e.id); }} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600" title="Excluir"><Trash2 className="size-4" /></button>
              </div>
            )}
          </div>
        ))}
        {podeEditar && (
          <button type="button" onClick={adicionar} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-verde-primary ring-1 ring-dashed ring-verde-primary/40 hover:bg-verde-light/40">
            <Plus className="size-4" /> Adicionar etiqueta
          </button>
        )}
        {etiquetas.length === 0 && !podeEditar && <p className="text-sm text-gray-400">Nenhuma etiqueta no catálogo.</p>}
        <p className="pt-1 text-xs text-gray-400">Etiquetas fora do catálogo aparecem em cinza. Excluir do catálogo não remove o nome das tarefas — só tira a cor.</p>
      </div>
    </Modal>
  );
}
