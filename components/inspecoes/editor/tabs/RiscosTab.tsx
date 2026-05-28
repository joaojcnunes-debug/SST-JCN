"use client";

import { useMemo, useState } from "react";
import { Plus, ChevronDown, LayoutList, LayoutGrid } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import RiscoForm from "../RiscoForm";
import RiscoRow from "@/components/riscos/RiscoRow";
import NivelBadge from "@/components/riscos/NivelBadge";
import CopiarRiscoModal from "../CopiarRiscoModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTipoIcone, useTiposRisco } from "@/lib/hooks/useV3";
import { cn } from "@/lib/utils";
import type { Cargo, NivelRisco, Risco, Setor, TipoRisco } from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  cargos: Cargo[];
  riscos: Risco[];
  readOnly?: boolean;
}

export default function RiscosTab({
  idInspecao,
  idEmpresa,
  setores,
  cargos,
  riscos,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const iconeDe = useTipoIcone();
  const { data: tiposCustom = [] } = useTiposRisco({ incluirInativos: true });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Risco | null>(null);
  const [confirm, setConfirm] = useState<Risco | null>(null);
  const [copiando, setCopiando] = useState<Risco | null>(null);
  const [openTipos, setOpenTipos] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"lista" | "quadro">("lista");

  const setorMap = useMemo(
    () => new Map(setores.map((s) => [s.id_setor, s.setor_ghe])),
    [setores]
  );

  const grupos = useMemo(() => {
    const acc = new Map<TipoRisco, Risco[]>();
    for (const r of riscos) {
      const arr = acc.get(r.tipo_risco) ?? [];
      arr.push(r);
      acc.set(r.tipo_risco, arr);
    }
    return acc;
  }, [riscos]);

  // Ordenação: respeita a ordem cadastrada na tabela `tipos_risco`.
  // Tipos órfãos (riscos antigos com nome não cadastrado) caem no fim
  // ordenados alfabeticamente — assim nada some da tela.
  const tiposOrdenados = useMemo<TipoRisco[]>(() => {
    const cadastrados = tiposCustom
      .map((t) => t.nome as TipoRisco)
      .filter((nome) => grupos.has(nome));
    const orfaos = Array.from(grupos.keys())
      .filter((nome) => !cadastrados.includes(nome))
      .sort((a, b) => a.localeCompare(b));
    return [...cadastrados, ...orfaos];
  }, [tiposCustom, grupos]);

  const del = useMutation({
    mutationFn: async (r: Risco) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("riscos")
        .delete()
        .eq("id_risco", r.id_risco);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Risco removido");
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (setores.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Adicione um setor antes de cadastrar riscos.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Barra de ações: botão adicionar + toggle de visualização */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("lista")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "lista"
                ? "bg-verde-primary text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <LayoutList className="size-3.5" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode("quadro")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "quadro"
                ? "bg-verde-primary text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <LayoutGrid className="size-3.5" /> Quadro
          </button>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Plus className="size-4" /> Adicionar Risco
          </button>
        )}
      </div>

      {riscos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Nenhum risco cadastrado nesta inspeção.
        </div>
      ) : viewMode === "quadro" ? (
        <QuadroRiscoSetor
          riscos={riscos}
          setores={setores}
          iconeDe={iconeDe}
        />
      ) : (
        tiposOrdenados.map((tipo) => {
          const lista = grupos.get(tipo) ?? [];
          const isOpen = openTipos[tipo] ?? true;
          return (
            <div
              key={tipo}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenTipos((m) => ({ ...m, [tipo]: !isOpen }))
                }
                className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 text-left hover:bg-gray-100"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ChevronDown
                    className={cn(
                      "size-4 text-gray-500 transition-transform",
                      !isOpen && "-rotate-90"
                    )}
                  />
                  <span className="text-base">{iconeDe(tipo)}</span>
                  {tipo}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                    {lista.length}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white text-xs uppercase text-gray-500 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Agente</th>
                        <th className="px-4 py-2 text-left font-medium">Setor</th>
                        <th className="px-4 py-2 text-left font-medium">Probabilidade</th>
                        <th className="px-4 py-2 text-left font-medium">Severidade</th>
                        <th className="px-4 py-2 text-left font-medium">Nível</th>
                        <th className="px-4 py-2 text-right font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lista.map((r) => (
                        <RiscoRow
                          key={r.id_risco}
                          risco={r}
                          setorNome={
                            r.id_setor ? setorMap.get(r.id_setor) : undefined
                          }
                          readOnly={readOnly}
                          onEdit={(risco) => {
                            setEditing(risco);
                            setFormOpen(true);
                          }}
                          onCopy={(risco) => setCopiando(risco)}
                          onDelete={(risco) => setConfirm(risco)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Modais compartilhados entre os dois modos */}
      <CopiarRiscoModal
        open={!!copiando}
        onClose={() => setCopiando(null)}
        risco={copiando}
        setoresAtual={setores}
        cargosAtual={cargos}
      />

      <RiscoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        idInspecao={idInspecao}
        idEmpresa={idEmpresa}
        setores={setores}
        cargos={cargos}
        risco={editing}
      />
      <ConfirmDialog
        open={!!confirm}
        title="Excluir risco?"
        description={`O risco "${confirm?.agente ?? confirm?.tipo_risco}" será removido.`}
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

// ─── Quadro por Setor ────────────────────────────────────────────────────────

function QuadroRiscoSetor({
  riscos,
  setores,
  iconeDe,
}: {
  riscos: Risco[];
  setores: Setor[];
  iconeDe: (tipo: string) => string;
}) {
  const [openSetores, setOpenSetores] = useState<Record<string, boolean>>({});

  // Riscos sem setor associado
  const semSetor = useMemo(
    () => riscos.filter((r) => !r.id_setor),
    [riscos]
  );

  return (
    <div className="space-y-3">
      {setores.map((setor) => {
        const lista = riscos.filter((r) => r.id_setor === setor.id_setor);
        if (lista.length === 0) return null;
        const isOpen = openSetores[setor.id_setor] ?? true;

        return (
          <div
            key={setor.id_setor}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <button
              type="button"
              onClick={() =>
                setOpenSetores((m) => ({ ...m, [setor.id_setor]: !isOpen }))
              }
              className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 text-left hover:bg-gray-100"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <ChevronDown
                  className={cn(
                    "size-4 text-gray-500 transition-transform",
                    !isOpen && "-rotate-90"
                  )}
                />
                {setor.setor_ghe}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                  {lista.length}
                </span>
              </span>
            </button>

            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white text-xs uppercase text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Agente</th>
                      <th className="px-4 py-2 text-left font-medium">Tipo</th>
                      <th className="px-4 py-2 text-left font-medium">Probabilidade</th>
                      <th className="px-4 py-2 text-left font-medium">Severidade</th>
                      <th className="px-4 py-2 text-left font-medium">Nível</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lista.map((r) => (
                      <tr key={r.id_risco} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {r.agente ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">
                          <span className="text-base mr-1">{iconeDe(r.tipo_risco)}</span>
                          {r.tipo_risco}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">{r.probabilidade ?? "—"}</td>
                        <td className="px-4 py-2.5 text-gray-500">{r.severidade ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {r.nivel_risco ? (
                            <NivelBadge nivel={r.nivel_risco} />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Riscos sem setor */}
      {semSetor.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-amber-800">
            Sem setor associado
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {semSetor.length}
            </span>
          </div>
          <div className="overflow-x-auto border-t border-amber-100">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 text-xs uppercase text-amber-600 border-b border-amber-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Agente</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">Nível</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {semSetor.map((r) => (
                  <tr key={r.id_risco} className="hover:bg-amber-50/70">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.agente ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      <span className="text-base mr-1">{iconeDe(r.tipo_risco)}</span>
                      {r.tipo_risco}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.nivel_risco ? <NivelBadge nivel={r.nivel_risco} /> : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
