"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Siren, Trash2, Pencil } from "lucide-react";
import {
  useInvestigacoesAcidente,
  useExcluirInvestigacao,
} from "@/lib/hooks/useInvestigacaoAcidente";
import { useCanCreate, useCanDelete } from "@/lib/hooks/useUsuario";
import { useUnidadeFiltro } from "@/lib/hooks/useUnidadeFiltro";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import type { InvestigacaoListItem } from "@/lib/hooks/useInvestigacaoAcidente";

const GRAV: Record<string, { cls: string; label: string }> = {
  LEVE: { cls: "bg-green-50 text-green-700", label: "Leve" },
  GRAVE: { cls: "bg-amber-50 text-amber-700", label: "Grave" },
  FATAL: { cls: "bg-red-50 text-red-700", label: "Fatal" },
};

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return d ? `${d}/${m}/${a}` : iso;
}

export default function InvestigacoesPage() {
  const { data: listaAll = [], isLoading } = useInvestigacoesAcidente();
  const canCreate = useCanCreate();
  const canDelete = useCanDelete();
  const excluir = useExcluirInvestigacao();
  const { inUnidade } = useUnidadeFiltro();
  const [busca, setBusca] = useState("");
  const [confirmDel, setConfirmDel] = useState<InvestigacaoListItem | null>(null);

  const lista = useMemo(() => listaAll.filter((i) => inUnidade(i.id_empresa)), [listaAll, inUnidade]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (i) =>
        i.empresaNome.toLowerCase().includes(q) ||
        (i.acidentado_nome ?? "").toLowerCase().includes(q),
    );
  }, [lista, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por empresa ou acidentado..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm transition focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
          />
        </div>
        {canCreate && (
          <Link
            href="/investigacao-acidente/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent active:scale-95"
          >
            <Plus className="size-4" /> Nova investigação
          </Link>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LoadingSkeleton rows={1} className="h-28" />
          <LoadingSkeleton rows={1} className="h-28" />
          <LoadingSkeleton rows={1} className="h-28" />
        </div>
      )}

      {!isLoading && filtradas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50">
            <Siren className="size-7 text-red-600" />
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-800">
            Nenhuma investigação {busca ? "encontrada" : "registrada"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {busca ? `Nenhum resultado para "${busca}"` : "Registre a primeira investigação de acidente"}
          </p>
        </div>
      )}

      {!isLoading && filtradas.length > 0 && (
        <div className="reveal-up grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((i) => {
            const g = i.gravidade ? GRAV[i.gravidade] : null;
            return (
              <div
                key={i.id_investigacao}
                className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link href={`/investigacao-acidente/${i.id_investigacao}`} className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-bold text-gray-900">{i.empresaNome}</p>
                    {g && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${g.cls}`}>
                        {g.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {i.acidentado_nome || "Acidentado não informado"}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    Acidente em {fmtData(i.data_acidente)}
                    {i.status === "RASCUNHO" && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-500">Rascunho</span>
                    )}
                  </p>
                </Link>
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-gray-100 pt-2">
                  <Link
                    href={`/investigacao-acidente/${i.id_investigacao}`}
                    className="flex size-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-verde-primary"
                    title="Editar"
                  >
                    <Pencil className="size-4" />
                  </Link>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDel(i)}
                      className="flex size-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDel}
        title="Excluir investigação?"
        description={
          confirmDel
            ? `A investigação de "${confirmDel.empresaNome}" será excluída.`
            : undefined
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() =>
          confirmDel &&
          excluir.mutate(confirmDel.id_investigacao, { onSuccess: () => setConfirmDel(null) })
        }
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
