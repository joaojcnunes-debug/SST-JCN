"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import { useSalvarStatus, useExcluirStatus, type GestaoStatus, type TipoStatus } from "@/lib/hooks/useGestao";

const TIPOS: { value: TipoStatus; label: string }[] = [
  { value: "nao_iniciado", label: "Não iniciado" },
  { value: "ativo", label: "Ativo" },
  { value: "concluido", label: "Concluído" },
];

export default function StatusManagerModal({
  open,
  onClose,
  idQuadro,
  statuses,
  podeEditar,
}: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  statuses: GestaoStatus[];
  podeEditar: boolean;
}) {
  const salvar = useSalvarStatus();
  const excluir = useExcluirStatus();

  function adicionar() {
    const maxOrdem = statuses.reduce((m, s) => Math.max(m, s.ordem), -1);
    salvar.mutate({ id_quadro: idQuadro, nome: "Novo status", cor: "#94a3b8", ordem: maxOrdem + 1, tipo: "ativo" });
  }

  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= statuses.length) return;
    const a = statuses[i], b = statuses[j];
    await salvar.mutateAsync({ id: a.id, id_quadro: idQuadro, ordem: b.ordem });
    await salvar.mutateAsync({ id: b.id, id_quadro: idQuadro, ordem: a.ordem });
  }

  return (
    <Modal open={open} onClose={onClose} title="Gerenciar status" size="lg">
      <div className="space-y-2">
        {statuses.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
            <input
              type="color"
              defaultValue={s.cor}
              disabled={!podeEditar}
              onBlur={(e) => { if (e.target.value !== s.cor) salvar.mutate({ id: s.id, id_quadro: idQuadro, cor: e.target.value }); }}
              className="size-7 shrink-0 cursor-pointer rounded border border-gray-200 bg-transparent p-0.5"
              title="Cor"
            />
            <input
              defaultValue={s.nome}
              disabled={!podeEditar}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.nome) salvar.mutate({ id: s.id, id_quadro: idQuadro, nome: v }); }}
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none"
            />
            <select
              value={s.tipo}
              disabled={!podeEditar}
              onChange={(e) => salvar.mutate({ id: s.id, id_quadro: idQuadro, tipo: e.target.value as TipoStatus })}
              className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:border-verde-primary focus:outline-none"
              title="Tipo (semântica)"
            >
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {podeEditar && (
              <div className="flex shrink-0 items-center">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ChevronUp className="size-4" /></button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === statuses.length - 1} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ChevronDown className="size-4" /></button>
                <button type="button" onClick={async () => { if (await confirmar({ title: `Excluir status "${s.nome}"?` })) excluir.mutate({ id: s.id, id_quadro: idQuadro, slug: s.slug }); }} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600" title="Excluir"><Trash2 className="size-4" /></button>
              </div>
            )}
          </div>
        ))}
        {podeEditar && (
          <button type="button" onClick={adicionar} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-verde-primary ring-1 ring-dashed ring-verde-primary/40 hover:bg-verde-light/40">
            <Plus className="size-4" /> Adicionar status
          </button>
        )}
        <p className="pt-1 text-xs text-gray-400">O tipo define a semântica: <b>Concluído</b> risca a tarefa e ignora atraso; <b>Não iniciado</b> é o status inicial de novas tarefas. Um status só pode ser excluído quando não há tarefas nele.</p>
      </div>
    </Modal>
  );
}
