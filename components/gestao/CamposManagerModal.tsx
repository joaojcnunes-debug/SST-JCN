"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import Modal from "@/components/ui/Modal";
import MultiChipInput from "@/components/ui/MultiChipInput";
import { confirmar } from "@/components/ui/confirm";
import { useSalvarCampo, useExcluirCampo, type GestaoCampo, type TipoCampo } from "@/lib/hooks/useGestao";

const TIPOS: { value: TipoCampo; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "data", label: "Data" },
  { value: "selecao", label: "Seleção única" },
  { value: "multi", label: "Seleção múltipla" },
  { value: "checkbox", label: "Checkbox" },
  { value: "moeda", label: "Moeda" },
  { value: "url", label: "URL" },
];

export default function CamposManagerModal({
  open,
  onClose,
  idQuadro,
  campos,
  podeEditar,
}: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  campos: GestaoCampo[];
  podeEditar: boolean;
}) {
  const salvar = useSalvarCampo();
  const excluir = useExcluirCampo();

  function adicionar() {
    const maxOrdem = campos.reduce((m, c) => Math.max(m, c.ordem), -1);
    salvar.mutate({ id_quadro: idQuadro, nome: "Novo campo", tipo: "texto", ordem: maxOrdem + 1 });
  }

  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= campos.length) return;
    const a = campos[i], b = campos[j];
    await salvar.mutateAsync({ id: a.id, id_quadro: idQuadro, ordem: b.ordem });
    await salvar.mutateAsync({ id: b.id, id_quadro: idQuadro, ordem: a.ordem });
  }

  return (
    <Modal open={open} onClose={onClose} title="Campos personalizados" size="lg">
      <div className="space-y-2">
        {campos.map((c, i) => (
          <div key={c.id} className="rounded-lg border border-gray-200 p-2.5">
            <div className="flex items-center gap-2">
              <input
                defaultValue={c.nome}
                disabled={!podeEditar}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.nome) salvar.mutate({ id: c.id, id_quadro: idQuadro, nome: v }); }}
                className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none"
              />
              <select
                value={c.tipo}
                disabled={!podeEditar}
                onChange={(e) => salvar.mutate({ id: c.id, id_quadro: idQuadro, tipo: e.target.value as TipoCampo })}
                className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:border-verde-primary focus:outline-none"
              >
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {podeEditar && (
                <div className="flex shrink-0 items-center">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ChevronUp className="size-4" /></button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === campos.length - 1} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"><ChevronDown className="size-4" /></button>
                  <button type="button" onClick={async () => { if (await confirmar({ title: `Excluir campo "${c.nome}"?`, description: "O valor desse campo nas tarefas deixa de aparecer." })) excluir.mutate(c.id); }} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600" title="Excluir campo"><Trash2 className="size-4" /></button>
                </div>
              )}
            </div>
            {(c.tipo === "selecao" || c.tipo === "multi") && (
              <div className="mt-2">
                <label className="mb-1 block text-[11px] font-medium text-gray-500">Opções</label>
                <MultiChipInput value={c.opcoes} onChange={(v) => salvar.mutate({ id: c.id, id_quadro: idQuadro, opcoes: v })} placeholder="Adicionar opção…" ro={!podeEditar} />
              </div>
            )}
            <label className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gray-500">
              <input type="checkbox" disabled={!podeEditar} checked={c.visivel_cliente} onChange={(e) => salvar.mutate({ id: c.id, id_quadro: idQuadro, visivel_cliente: e.target.checked })} className="size-3.5 rounded accent-verde-primary" />
              Visível ao cliente (Portal)
            </label>
          </div>
        ))}
        {podeEditar && (
          <button type="button" onClick={adicionar} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-verde-primary ring-1 ring-dashed ring-verde-primary/40 hover:bg-verde-light/40">
            <Plus className="size-4" /> Adicionar campo
          </button>
        )}
        {campos.length === 0 && !podeEditar && <p className="text-sm text-gray-400">Nenhum campo personalizado.</p>}
      </div>
    </Modal>
  );
}
