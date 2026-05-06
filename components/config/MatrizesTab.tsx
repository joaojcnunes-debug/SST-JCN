"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  Copy as CopyIcon,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useMatrizes,
  useSaveMatriz,
  useAtivarMatriz,
  useDeleteMatriz,
} from "@/lib/hooks/useV3";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { matrizVazia, redimensionarLookup } from "@/lib/calc";
import { NIVEIS_RISCO, NIVEL_CONFIG } from "@/lib/constants";
import { gerarId, cn } from "@/lib/utils";
import type { MatrizRisco, NivelRisco } from "@/lib/supabase/types";

export default function MatrizesTab() {
  const { data: matrizes = [] } = useMatrizes();
  const ativar = useAtivarMatriz();
  const del = useDeleteMatriz();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MatrizRisco | null>(null);
  const [confirm, setConfirm] = useState<MatrizRisco | null>(null);

  function novaMatriz() {
    const padrao: MatrizRisco = {
      id_matriz: gerarId("MTZ"),
      nome: "",
      descricao: null,
      probabilidades: ["Baixa", "Média", "Alta"],
      severidades: ["Leve", "Moderada", "Grave"],
      lookup: matrizVazia(3, 3),
      ativa: false,
    };
    setEditing(padrao);
    setEditorOpen(true);
  }

  function duplicar(m: MatrizRisco) {
    setEditing({
      ...m,
      id_matriz: gerarId("MTZ"),
      nome: `${m.nome} (cópia)`,
      ativa: false,
    });
    setEditorOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Crie matrizes NxM customizadas. Apenas <strong>uma matriz</strong>{" "}
          fica ativa por vez — é ela que o sistema usa em todos os cálculos de
          nível de risco.
        </p>
        <button
          type="button"
          onClick={novaMatriz}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
        >
          <Plus className="size-4" /> Nova Matriz
        </button>
      </div>

      <ul className="space-y-2">
        {matrizes.map((m) => (
          <li
            key={m.id_matriz}
            className={cn(
              "rounded-lg border bg-white p-3",
              m.ativa
                ? "border-verde-primary ring-1 ring-verde-primary/20"
                : "border-gray-200"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  {m.nome}
                  {m.ativa && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2 py-0.5 text-[11px] font-medium text-verde-primary">
                      <Check className="size-3" /> Ativa
                    </span>
                  )}
                </p>
                {m.descricao && (
                  <p className="mt-0.5 text-xs text-gray-500">{m.descricao}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {m.probabilidades.length} probabilidades ×{" "}
                  {m.severidades.length} severidades ={" "}
                  {m.probabilidades.length * m.severidades.length} células
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!m.ativa && (
                  <button
                    type="button"
                    onClick={() => ativar.mutate(m.id_matriz)}
                    disabled={ativar.isPending}
                    className="rounded-md border border-verde-primary px-2.5 py-1 text-xs font-medium text-verde-primary hover:bg-verde-light disabled:opacity-50"
                    title="Tornar ativa"
                  >
                    Ativar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => duplicar(m)}
                  className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-700"
                  title="Duplicar"
                >
                  <CopyIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(m);
                    setEditorOpen(true);
                  }}
                  className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                  title="Editar"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(m)}
                  disabled={m.ativa}
                  className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert disabled:opacity-30"
                  title={m.ativa ? "Desative antes de excluir" : "Remover"}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <MatrizEditorModal
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        matriz={editing}
      />

      <ConfirmDialog
        open={!!confirm}
        title="Remover matriz?"
        description={`"${confirm?.nome}" será excluída. Riscos que usaram essa matriz mantêm o nível salvo, mas se você reabrir e recalcular, o nível pode mudar.`}
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm.id_matriz)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

// =========================================================================
// EDITOR DE MATRIZ NxM
// =========================================================================

function MatrizEditorModal({
  open,
  onClose,
  matriz,
}: {
  open: boolean;
  onClose: () => void;
  matriz: MatrizRisco | null;
}) {
  const save = useSaveMatriz();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [probs, setProbs] = useState<string[]>([]);
  const [sevs, setSevs] = useState<string[]>([]);
  const [lookup, setLookup] = useState<string[][]>([]);

  useEffect(() => {
    if (open && matriz) {
      setNome(matriz.nome);
      setDescricao(matriz.descricao ?? "");
      setProbs([...matriz.probabilidades]);
      setSevs([...matriz.severidades]);
      setLookup(matriz.lookup.map((row) => [...row]));
    }
  }, [open, matriz]);

  function addProb() {
    const novo = [...probs, `Probab. ${probs.length + 1}`];
    setProbs(novo);
    setLookup(redimensionarLookup(lookup, novo.length, sevs.length));
  }
  function removeProb(idx: number) {
    if (probs.length <= 1) return;
    const novo = probs.filter((_, i) => i !== idx);
    setProbs(novo);
    setLookup(lookup.filter((_, i) => i !== idx));
  }
  function renameProb(idx: number, val: string) {
    setProbs(probs.map((p, i) => (i === idx ? val : p)));
  }
  function addSev() {
    const novo = [...sevs, `Sever. ${sevs.length + 1}`];
    setSevs(novo);
    setLookup(redimensionarLookup(lookup, probs.length, novo.length));
  }
  function removeSev(idx: number) {
    if (sevs.length <= 1) return;
    const novo = sevs.filter((_, i) => i !== idx);
    setSevs(novo);
    setLookup(lookup.map((row) => row.filter((_, i) => i !== idx)));
  }
  function renameSev(idx: number, val: string) {
    setSevs(sevs.map((s, i) => (i === idx ? val : s)));
  }
  function setCelula(iP: number, iS: number, nivel: string) {
    setLookup(
      lookup.map((row, i) =>
        i === iP ? row.map((v, j) => (j === iS ? nivel : v)) : row
      )
    );
  }
  function preencherTudo(nivel: NivelRisco) {
    setLookup(probs.map(() => sevs.map(() => nivel)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome da matriz");
      return;
    }
    if (probs.some((p) => !p.trim()) || sevs.some((s) => !s.trim())) {
      toast.error("Todos os labels precisam estar preenchidos");
      return;
    }
    save.mutate(
      {
        id_matriz: matriz!.id_matriz,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        probabilidades: probs,
        severidades: sevs,
        lookup,
        ativa: matriz?.ativa ?? false,
      },
      { onSuccess: onClose }
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={matriz?.nome ? `Editar: ${matriz.nome}` : "Nova Matriz"}
      size="xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Nome *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: ABNT NBR 14280"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Descrição
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Editor da Matriz {probs.length}×{sevs.length}
            </p>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Preencher tudo com:</span>
              {NIVEIS_RISCO.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => preencherTudo(n)}
                  className="rounded px-1.5 py-0.5 text-xs font-medium hover:opacity-80"
                  style={{
                    backgroundColor: NIVEL_CONFIG[n].bg,
                    color: NIVEL_CONFIG[n].cor,
                    border: `1px solid ${NIVEL_CONFIG[n].borda}`,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="bg-gray-100 p-1.5 text-[10px] font-semibold uppercase text-gray-500">
                    P↓ / S→
                  </th>
                  {sevs.map((s, j) => (
                    <th key={j} className="bg-gray-100 p-1" style={{ minWidth: 110 }}>
                      <input
                        type="text"
                        value={s}
                        onChange={(e) => renameSev(j, e.target.value)}
                        className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-center text-xs font-medium hover:bg-white focus:bg-white focus:outline focus:outline-1 focus:outline-verde-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeSev(j)}
                        disabled={sevs.length <= 1}
                        className="mx-auto mt-0.5 block rounded px-1 text-[10px] text-gray-400 hover:bg-red-50 hover:text-red-alert disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </th>
                  ))}
                  <th className="bg-gray-50 p-1">
                    <button
                      type="button"
                      onClick={addSev}
                      className="rounded border border-dashed border-gray-400 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      <Plus className="inline size-3" /> Sev
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {probs.map((p, i) => (
                  <tr key={i}>
                    <th className="bg-gray-100 p-1" style={{ minWidth: 130 }}>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={p}
                          onChange={(e) => renameProb(i, e.target.value)}
                          className="flex-1 rounded border-0 bg-transparent px-1 py-0.5 text-left text-xs font-medium hover:bg-white focus:bg-white focus:outline focus:outline-1 focus:outline-verde-primary"
                        />
                        <button
                          type="button"
                          onClick={() => removeProb(i)}
                          disabled={probs.length <= 1}
                          className="rounded px-1 text-[10px] text-gray-400 hover:bg-red-50 hover:text-red-alert disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </div>
                    </th>
                    {sevs.map((_, j) => {
                      const nivel = (lookup[i]?.[j] ?? "Baixo") as NivelRisco;
                      const cfg =
                        NIVEL_CONFIG[nivel] ?? NIVEL_CONFIG.Baixo;
                      return (
                        <td key={j} className="p-0">
                          <select
                            value={nivel}
                            onChange={(e) =>
                              setCelula(i, j, e.target.value)
                            }
                            className="w-full cursor-pointer rounded border-0 px-1 py-2 text-center text-xs font-semibold focus:outline focus:outline-2 focus:outline-verde-primary"
                            style={{
                              backgroundColor: cfg.bg,
                              color: cfg.cor,
                              borderLeft: `3px solid ${cfg.borda}`,
                            }}
                          >
                            {NIVEIS_RISCO.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                ))}
                <tr>
                  <td className="p-1">
                    <button
                      type="button"
                      onClick={addProb}
                      className="rounded border border-dashed border-gray-400 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      <Plus className="inline size-3" /> Prob
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            <Save className="size-4" />
            {save.isPending ? "Salvando..." : "Salvar matriz"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
