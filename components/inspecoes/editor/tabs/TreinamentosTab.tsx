"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, LayoutList, Pencil, Plus, Rows3, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import TreinamentoForm from "../TreinamentoForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTipoIcone } from "@/lib/hooks/useV3";
import type {
  Cargo,
  Risco,
  Setor,
  TreinamentoCargoRel,
  TreinamentoNR,
  TreinamentoRiscoRel,
  TreinamentoSetorRel,
} from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  cargos: Cargo[];
  riscos: Risco[];
  treinamentos: TreinamentoNR[];
  treinamentosSetor: TreinamentoSetorRel[];
  treinamentosCargo: TreinamentoCargoRel[];
  treinamentosRisco: TreinamentoRiscoRel[];
  readOnly?: boolean;
}

export default function TreinamentosTab({
  idInspecao,
  idEmpresa,
  setores,
  cargos,
  riscos,
  treinamentos,
  treinamentosSetor,
  treinamentosCargo,
  treinamentosRisco,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const iconeDe = useTipoIcone();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TreinamentoNR | null>(null);
  const [confirm, setConfirm] = useState<TreinamentoNR | null>(null);
  const [view, setView] = useState<"lista" | "por-setor">("lista");

  const setorPorId = useMemo(
    () => new Map(setores.map((s) => [s.id_setor, s])),
    [setores]
  );
  const cargoPorId = useMemo(
    () => new Map(cargos.map((c) => [c.id_cargo, c])),
    [cargos]
  );
  const riscoPorId = useMemo(
    () => new Map(riscos.map((r) => [r.id_risco, r])),
    [riscos]
  );

  // Vínculos por treinamento
  const setoresPorTreina = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of treinamentosSetor) {
      const arr = m.get(r.id_treinamento) ?? [];
      arr.push(r.id_setor);
      m.set(r.id_treinamento, arr);
    }
    return m;
  }, [treinamentosSetor]);
  const cargosPorTreina = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of treinamentosCargo) {
      const arr = m.get(r.id_treinamento) ?? [];
      arr.push(r.id_cargo);
      m.set(r.id_treinamento, arr);
    }
    return m;
  }, [treinamentosCargo]);
  const riscosPorTreina = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of treinamentosRisco) {
      const arr = m.get(r.id_treinamento) ?? [];
      arr.push(r.id_risco);
      m.set(r.id_treinamento, arr);
    }
    return m;
  }, [treinamentosRisco]);

  // Agrupamento por setor (para a view "por-setor")
  const treinamentosPorSetorView = useMemo(() => {
    const treMap = new Map(treinamentos.map((t) => [t.id_treinamento, t]));
    const m = new Map<string, TreinamentoNR[]>();
    for (const rel of treinamentosSetor) {
      const t = treMap.get(rel.id_treinamento);
      if (!t) continue;
      const arr = m.get(rel.id_setor) ?? [];
      if (!arr.find((x) => x.id_treinamento === t.id_treinamento)) arr.push(t);
      m.set(rel.id_setor, arr);
    }
    return m;
  }, [treinamentos, treinamentosSetor]);

  // Treinamentos sem setor vinculado
  const treinamentosSemSetor = useMemo(() => {
    const comSetor = new Set(treinamentosSetor.map((r) => r.id_treinamento));
    return treinamentos.filter((t) => !comSetor.has(t.id_treinamento));
  }, [treinamentos, treinamentosSetor]);

  const del = useMutation({
    mutationFn: async (t: TreinamentoNR) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("treinamentos_nr")
        .delete()
        .eq("id_treinamento", t.id_treinamento);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Treinamento removido");
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setoresComTreinamentos = useMemo(
    () =>
      [...setores]
        .filter((s) => (treinamentosPorSetorView.get(s.id_setor) ?? []).length > 0)
        .sort((a, b) => a.setor_ghe.localeCompare(b.setor_ghe)),
    [setores, treinamentosPorSetorView]
  );

  function openEdit(t: TreinamentoNR) {
    setEditing(t);
    setFormOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-purple-200 bg-purple-50/40 p-3 text-xs text-purple-800">
        <strong>Treinamentos NR.</strong> Cadastre os treinamentos
        obrigatórios desta inspeção e direcione cada um pelos{" "}
        <strong>setores</strong>, <strong>cargos</strong> e/ou{" "}
        <strong>riscos</strong> a que se aplicam. Um treinamento pode cobrir
        qualquer combinação (ex: NR-35 só para Setor Manutenção + Cargo
        Eletricista + Riscos de altura).
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Toggle de visualização */}
        {treinamentos.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setView("lista")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === "lista"
                  ? "bg-white text-gray-900 shadow"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutList className="size-3.5" />
              Lista
            </button>
            <button
              type="button"
              onClick={() => setView("por-setor")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === "por-setor"
                  ? "bg-white text-gray-900 shadow"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Rows3 className="size-3.5" />
              Por Setor
            </button>
          </div>
        )}

        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Plus className="size-4" /> Novo Treinamento
          </button>
        )}
      </div>

      {treinamentos.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Nenhum treinamento cadastrado.
        </div>
      ) : view === "lista" ? (
        /* ── VISTA LISTA ──────────────────────────────────────────── */
        <ul className="space-y-2">
          {treinamentos.map((t) => {
            const idsSet = setoresPorTreina.get(t.id_treinamento) ?? [];
            const idsCar = cargosPorTreina.get(t.id_treinamento) ?? [];
            const idsRis = riscosPorTreina.get(t.id_treinamento) ?? [];
            return (
              <li
                key={t.id_treinamento}
                className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 rounded-md bg-purple-100 p-2 text-purple-700">
                    <GraduationCap className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">
                        {t.nr}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {t.titulo}
                      </h3>
                      {t.carga_horaria && (
                        <span className="text-xs text-gray-600">
                          · {t.carga_horaria}
                        </span>
                      )}
                      {t.periodicidade && (
                        <span className="text-xs text-gray-600">
                          · {t.periodicidade}
                        </span>
                      )}
                    </div>
                    {t.descricao && (
                      <p className="mt-1 text-xs text-gray-600">{t.descricao}</p>
                    )}

                    {(idsSet.length > 0 || idsCar.length > 0 || idsRis.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {idsSet.map((id) => {
                          const s = setorPorId.get(id);
                          if (!s) return null;
                          return (
                            <span
                              key={`set-${id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"
                              title="Setor"
                            >
                              🏢 {s.setor_ghe}
                            </span>
                          );
                        })}
                        {idsCar.map((id) => {
                          const c = cargoPorId.get(id);
                          if (!c) return null;
                          return (
                            <span
                              key={`car-${id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-800"
                              title="Cargo"
                            >
                              👤 {c.cargo}
                            </span>
                          );
                        })}
                        {idsRis.map((id) => {
                          const r = riscoPorId.get(id);
                          if (!r) return null;
                          return (
                            <span
                              key={`ris-${id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-800"
                              title="Risco"
                            >
                              {iconeDe(r.tipo_risco)} {r.agente ?? r.tipo_risco}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {idsSet.length === 0 &&
                      idsCar.length === 0 &&
                      idsRis.length === 0 && (
                        <p className="mt-2 text-[11px] italic text-gray-500">
                          Sem direcionamento — aplica-se a toda a inspeção.
                        </p>
                      )}

                    {t.observacoes && (
                      <p className="mt-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700">
                        <strong>Obs:</strong> {t.observacoes}
                      </p>
                    )}
                  </div>

                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                        title="Editar"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm(t)}
                        className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                        title="Remover"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        /* ── VISTA POR SETOR ──────────────────────────────────────── */
        <div className="space-y-3">
          {setoresComTreinamentos.length === 0 && treinamentosSemSetor.length === 0 && (
            <div className="rounded-md border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              Nenhum treinamento vinculado a setores.
            </div>
          )}

          {setoresComTreinamentos.map((setor) => {
            const tList = treinamentosPorSetorView.get(setor.id_setor) ?? [];
            return (
              <div
                key={setor.id_setor}
                className="overflow-hidden rounded-lg border border-amber-200"
              >
                <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="text-sm">🏢</span>
                  <h4 className="text-sm font-semibold text-amber-900">
                    {setor.setor_ghe}
                  </h4>
                  <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {tList.length} treinamento{tList.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <ul className="divide-y divide-amber-100 bg-white">
                  {tList.map((t) => (
                    <li key={t.id_treinamento} className="flex items-start gap-2 px-3 py-2">
                      <GraduationCap className="mt-0.5 size-4 shrink-0 text-purple-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                            {t.nr}
                          </span>
                          <span className="text-xs font-medium text-gray-900">
                            {t.titulo}
                          </span>
                          {t.carga_horaria && (
                            <span className="text-[11px] text-gray-500">
                              · {t.carga_horaria}
                            </span>
                          )}
                          {t.periodicidade && (
                            <span className="text-[11px] text-gray-500">
                              · {t.periodicidade}
                            </span>
                          )}
                        </div>
                        {t.descricao && (
                          <p className="mt-0.5 text-[11px] text-gray-600">
                            {t.descricao}
                          </p>
                        )}
                      </div>
                      {!readOnly && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="rounded p-1 text-gray-400 hover:bg-verde-light hover:text-verde-primary"
                            title="Editar"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm(t)}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert"
                            title="Remover"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* Treinamentos sem setor vinculado */}
          {treinamentosSemSetor.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm">🌐</span>
                <h4 className="text-sm font-semibold text-gray-700">
                  Sem setor específico
                </h4>
                <span className="ml-1 text-xs text-gray-500">
                  (aplica-se a toda a inspeção)
                </span>
                <span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                  {treinamentosSemSetor.length} treinamento
                  {treinamentosSemSetor.length !== 1 ? "s" : ""}
                </span>
              </div>
              <ul className="divide-y divide-gray-100 bg-white">
                {treinamentosSemSetor.map((t) => (
                  <li key={t.id_treinamento} className="flex items-start gap-2 px-3 py-2">
                    <GraduationCap className="mt-0.5 size-4 shrink-0 text-purple-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-1.5">
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                          {t.nr}
                        </span>
                        <span className="text-xs font-medium text-gray-900">
                          {t.titulo}
                        </span>
                        {t.carga_horaria && (
                          <span className="text-[11px] text-gray-500">
                            · {t.carga_horaria}
                          </span>
                        )}
                        {t.periodicidade && (
                          <span className="text-[11px] text-gray-500">
                            · {t.periodicidade}
                          </span>
                        )}
                      </div>
                      {t.descricao && (
                        <p className="mt-0.5 text-[11px] text-gray-600">{t.descricao}</p>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="rounded p-1 text-gray-400 hover:bg-verde-light hover:text-verde-primary"
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm(t)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert"
                          title="Remover"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <TreinamentoForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        idInspecao={idInspecao}
        idEmpresa={idEmpresa}
        editing={editing}
        setores={setores}
        cargos={cargos}
        riscos={riscos}
        vinculados={{
          setores: editing
            ? setoresPorTreina.get(editing.id_treinamento) ?? []
            : [],
          cargos: editing
            ? cargosPorTreina.get(editing.id_treinamento) ?? []
            : [],
          riscos: editing
            ? riscosPorTreina.get(editing.id_treinamento) ?? []
            : [],
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        title="Remover treinamento?"
        description={
          confirm
            ? `"${confirm.nr} — ${confirm.titulo}" será removido junto com seus vínculos a setores/cargos/riscos.`
            : ""
        }
        variant="danger"
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
