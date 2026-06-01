"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flame, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import ExtintorForm from "../ExtintorForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Extintor, Setor } from "@/lib/supabase/types";

interface Props {
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  extintores: Extintor[];
  readOnly?: boolean;
}

const STATUS_COR: Record<string, string> = {
  "Adequado": "border-green-200 bg-green-50 text-green-800",
  "Vencido": "border-red-200 bg-red-50 text-red-700",
  "A vencer (próx. 3 meses)": "border-amber-200 bg-amber-50 text-amber-800",
  "Danificado": "border-red-200 bg-red-50 text-red-700",
  "Sinalização inadequada": "border-orange-200 bg-orange-50 text-orange-800",
  "Lacre violado": "border-orange-200 bg-orange-50 text-orange-800",
};

export default function ExtintoresTab({
  idInspecao,
  idEmpresa,
  setores,
  extintores,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Extintor | null>(null);
  const [confirm, setConfirm] = useState<Extintor | null>(null);

  // Agrupa por setor — setores com extintor primeiro, depois "sem setor"
  const grupos = useMemo(() => {
    const mapa = new Map<string | null, Extintor[]>();
    for (const e of extintores) {
      const key = e.id_setor ?? null;
      const arr = mapa.get(key) ?? [];
      arr.push(e);
      mapa.set(key, arr);
    }
    return mapa;
  }, [extintores]);

  const setoresComExtintor = useMemo(
    () =>
      setores.filter(
        (s) => (grupos.get(s.id_setor) ?? []).length > 0
      ),
    [setores, grupos]
  );
  const semSetor = grupos.get(null) ?? [];

  const del = useMutation({
    mutationFn: async (e: Extintor) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("extintores")
        .delete()
        .eq("id_extintor", e.id_extintor);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Extintor removido");
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-red-200 bg-red-50/40 p-3 text-xs text-red-800">
        <strong>Extintores — NR-23.</strong> Registre os extintores de incêndio
        por setor: tipo de agente, capacidade, validade e localização. Itens com
        status <strong>Vencido</strong> ou <strong>Danificado</strong> são
        destacados automaticamente.
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Plus className="size-4" /> Novo Extintor
          </button>
        </div>
      )}

      {extintores.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Nenhum extintor cadastrado.
        </div>
      ) : (
        <div className="space-y-4">
          {setoresComExtintor.map((setor) => {
            const lista = grupos.get(setor.id_setor) ?? [];
            return (
              <GrupoExtintores
                key={setor.id_setor}
                titulo={setor.setor_ghe}
                lista={lista}
                readOnly={readOnly}
                onEdit={(e) => { setEditing(e); setFormOpen(true); }}
                onDelete={(e) => setConfirm(e)}
              />
            );
          })}

          {semSetor.length > 0 && (
            <GrupoExtintores
              titulo="Geral / sem setor específico"
              lista={semSetor}
              readOnly={readOnly}
              onEdit={(e) => { setEditing(e); setFormOpen(true); }}
              onDelete={(e) => setConfirm(e)}
              amber
            />
          )}
        </div>
      )}

      <ExtintorForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        idInspecao={idInspecao}
        idEmpresa={idEmpresa}
        editing={editing}
        setores={setores}
      />

      <ConfirmDialog
        open={!!confirm}
        title="Remover extintor?"
        description={
          confirm
            ? `O extintor "${confirm.tipo_agente}${confirm.numero_identificacao ? ` — ${confirm.numero_identificacao}` : ""}" será removido.`
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

function GrupoExtintores({
  titulo,
  lista,
  readOnly,
  onEdit,
  onDelete,
  amber,
}: {
  titulo: string;
  lista: Extintor[];
  readOnly?: boolean;
  onEdit: (e: Extintor) => void;
  onDelete: (e: Extintor) => void;
  amber?: boolean;
}) {
  return (
    <div>
      <h3 className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${amber ? "text-amber-700" : "text-gray-600"}`}>
        🏢 {titulo}
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${amber ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
          {lista.length}
        </span>
      </h3>
      <ul className="space-y-2">
        {lista.map((ext) => (
          <ExtintorCard
            key={ext.id_extintor}
            extintor={ext}
            readOnly={readOnly}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}

function ExtintorCard({
  extintor: e,
  readOnly,
  onEdit,
  onDelete,
}: {
  extintor: Extintor;
  readOnly?: boolean;
  onEdit: (e: Extintor) => void;
  onDelete: (e: Extintor) => void;
}) {
  const statusCor =
    e.status ? (STATUS_COR[e.status] ?? "border-gray-200 bg-gray-50 text-gray-700") : null;
  const vencidoOuDanificado =
    e.status === "Vencido" || e.status === "Danificado" || e.status === "Lacre violado";

  return (
    <li
      className={`rounded-lg border bg-white p-3 shadow-sm ${
        vencidoOuDanificado ? "border-red-300" : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 rounded-md p-2 ${
            vencidoOuDanificado
              ? "bg-red-100 text-red-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          <Flame className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {e.tipo_agente}
            </h3>
            {e.capacidade && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {e.capacidade}
              </span>
            )}
            {e.numero_identificacao && (
              <span className="text-xs text-gray-500">
                Nº {e.numero_identificacao}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            {e.localizacao && (
              <span>📍 {e.localizacao}</span>
            )}
            {e.data_validade && (
              <span>
                Validade:{" "}
                {new Date(e.data_validade + "T00:00:00").toLocaleDateString(
                  "pt-BR"
                )}
              </span>
            )}
          </div>

          {e.status && statusCor && (
            <span
              className={`mt-1.5 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusCor}`}
            >
              {e.status}
            </span>
          )}

          {e.observacoes && (
            <p className="mt-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700">
              <strong>Obs:</strong> {e.observacoes}
            </p>
          )}
        </div>

        {e.foto_url && (
          <a
            href={e.foto_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
            title="Ver foto"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={e.foto_url}
              alt="Foto do extintor"
              className="h-16 w-16 rounded-lg border border-gray-200 object-cover hover:opacity-90"
            />
          </a>
        )}

        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(e)}
              className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
              title="Editar"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(e)}
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
}
