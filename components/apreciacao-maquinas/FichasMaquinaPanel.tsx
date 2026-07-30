"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Cog,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useFichasMaquina,
  useCriarFicha,
  useExcluirFicha,
  useReordenarFichas,
  type FichaMaquinaInput,
} from "@/lib/hooks/useFichasMaquina";
import { useApreciacaoEdicaoStore } from "@/lib/apreciacao-maquinas/store";
import { useInventarioMaquinas } from "@/lib/hooks/useInventarioMaquinas";
import type { FichaMaquina } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

function nomeFicha(f: FichaMaquina): string {
  return f.equipamento || f.maquina_descricao || `Máquina ${f.numero_ordem}`;
}

export default function FichasMaquinaPanel({
  idApreciacao,
  idEmpresa,
  disabled = false,
}: {
  idApreciacao: string;
  idEmpresa: string | null;
  disabled?: boolean;
}) {
  const { data: fichas = [], isLoading } = useFichasMaquina(idApreciacao);
  const criar = useCriarFicha(idApreciacao);
  const excluir = useExcluirFicha(idApreciacao);
  const reordenar = useReordenarFichas(idApreciacao);
  const fichaAtivaId = useApreciacaoEdicaoStore((s) => s.fichaAtivaId);
  const setFichaAtiva = useApreciacaoEdicaoStore((s) => s.setFichaAtiva);
  const { data: inventario = [] } = useInventarioMaquinas();

  const maquinasEmpresa = useMemo(
    () => inventario.filter((m) => !idEmpresa || m.id_empresa === idEmpresa),
    [inventario, idEmpresa]
  );

  // Auto-seleciona a 1ª ficha quando a ativa não pertence a este laudo.
  useEffect(() => {
    if (isLoading) return;
    if (fichas.length === 0) {
      if (fichaAtivaId !== null) setFichaAtiva(null);
      return;
    }
    if (!fichas.some((f) => f.id_ficha === fichaAtivaId)) {
      setFichaAtiva(fichas[0].id_ficha);
    }
  }, [fichas, isLoading, fichaAtivaId, setFichaAtiva]);

  const [addOpen, setAddOpen] = useState(false);
  const [modo, setModo] = useState<"inventario" | "descrever">("descrever");
  const [idMaquinaSel, setIdMaquinaSel] = useState("");
  const [descricao, setDescricao] = useState("");
  const [setorNovo, setSetorNovo] = useState("");
  const [confirmarExcluir, setConfirmarExcluir] = useState<string | null>(null);

  async function handleAdicionar() {
    let input: FichaMaquinaInput;
    if (modo === "inventario") {
      const m = maquinasEmpresa.find((x) => x.id_maquina === idMaquinaSel);
      if (!m) {
        toast.error("Selecione uma máquina do inventário.");
        return;
      }
      input = {
        id_maquina: m.id_maquina,
        equipamento: m.nome,
        tipo: m.tipo,
        modelo: m.modelo,
        fabricante: m.marca,
        serie: m.numero_serie,
        ano: m.ano_fabricacao != null ? String(m.ano_fabricacao) : null,
        capacidade: m.capacidade_operacional,
        setor: m.setor,
      };
    } else {
      if (!descricao.trim()) {
        toast.error("Descreva a máquina.");
        return;
      }
      input = {
        maquina_descricao: descricao.trim(),
        equipamento: descricao.trim(),
        setor: setorNovo.trim() || null,
      };
    }
    try {
      const nova = await criar.mutateAsync(input);
      setFichaAtiva(nova.id_ficha);
      setAddOpen(false);
      setDescricao("");
      setSetorNovo("");
      setIdMaquinaSel("");
      toast.success("Máquina adicionada");
    } catch {
      /* erro tratado no hook */
    }
  }

  function mover(index: number, dir: -1 | 1) {
    const alvo = index + dir;
    if (alvo < 0 || alvo >= fichas.length) return;
    const ids = fichas.map((f) => f.id_ficha);
    [ids[index], ids[alvo]] = [ids[alvo], ids[index]];
    reordenar.mutate(ids);
  }

  async function handleExcluir(id: string) {
    try {
      await excluir.mutateAsync(id);
      setConfirmarExcluir(null);
      if (fichaAtivaId === id) setFichaAtiva(null);
      toast.success("Máquina removida");
    } catch {
      /* erro tratado no hook */
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:hidden">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-700">
          <Cog className="size-4 text-orange-600" /> Máquinas do laudo
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
            {fichas.length}
          </span>
        </h2>
        {!disabled && (
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange-700"
          >
            <Plus className="size-3.5" /> Adicionar máquina
          </button>
        )}
      </div>

      {/* Form de adicionar */}
      {!disabled && addOpen && (
        <div className="mb-3 rounded-md border-2 border-dashed border-orange-200 bg-orange-50/30 p-3 space-y-2">
          <div className="flex gap-3 text-xs">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={modo === "descrever"}
                onChange={() => setModo("descrever")}
              />
              Descrever
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={modo === "inventario"}
                onChange={() => setModo("inventario")}
              />
              Vincular do inventário
            </label>
          </div>

          {modo === "inventario" ? (
            <select
              value={idMaquinaSel}
              onChange={(e) => setIdMaquinaSel(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione a máquina…</option>
              {maquinasEmpresa.map((m) => (
                <option key={m.id_maquina} value={m.id_maquina}>
                  {m.nome}
                  {m.setor ? ` — ${m.setor}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className={inputClass}
                placeholder="Equipamento / descrição da máquina"
              />
              <input
                type="text"
                value={setorNovo}
                onChange={(e) => setSetorNovo(e.target.value)}
                className={inputClass}
                placeholder="Setor (opcional)"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdicionar}
              disabled={criar.isPending}
              className="inline-flex items-center gap-1 rounded bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {criar.isPending ? <Loader2 className="size-3 animate-spin" /> : null}
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Lista de fichas */}
      {isLoading ? (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Loader2 className="size-3 animate-spin" /> Carregando máquinas…
        </div>
      ) : fichas.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500">
          Nenhuma máquina neste laudo ainda.
          {!disabled && ' Clique em "Adicionar máquina".'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {fichas.map((f, i) => {
            const ativa = f.id_ficha === fichaAtivaId;
            return (
              <li
                key={f.id_ficha}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2",
                  ativa
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                )}
              >
                <button
                  type="button"
                  onClick={() => setFichaAtiva(f.id_ficha)}
                  className="flex flex-1 items-center gap-2 text-left min-w-0"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      ativa
                        ? "bg-orange-600 text-white"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {f.numero_ordem}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-gray-800">
                      {nomeFicha(f)}
                    </span>
                    {f.setor && (
                      <span className="block truncate text-[10px] text-gray-500">
                        {f.setor}
                      </span>
                    )}
                  </span>
                  {f.prioridade_manual && (
                    <span className="ml-1 shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                      PRIORIDADE
                    </span>
                  )}
                </button>

                {!disabled && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0 || reordenar.isPending}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === fichas.length - 1 || reordenar.isPending}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                    {confirmarExcluir === f.id_ficha ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleExcluir(f.id_ficha)}
                          disabled={excluir.isPending}
                          className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {excluir.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            "Confirmar"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmarExcluir(null)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100"
                          aria-label="Cancelar"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmarExcluir(f.id_ficha)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remover máquina"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
