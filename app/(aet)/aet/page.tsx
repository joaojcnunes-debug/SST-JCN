"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Plus, Trash2, Eye } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAetRelatorios, useExcluirAet } from "@/lib/hooks/useAet";
import { useCanCreate, useCanDelete } from "@/lib/hooks/useUsuario";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { cn } from "@/lib/utils";
import type { AetRelatorio } from "@/lib/supabase/types";

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  CONCLUIDO: "Concluído",
};
const STATUS_COLOR: Record<string, string> = {
  RASCUNHO: "bg-amber-100 text-amber-800",
  CONCLUIDO: "bg-green-100 text-green-800",
};

export default function AetListPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<AetRelatorio | null>(null);

  const { data: relatorios = [], isLoading } = useAetRelatorios(empresaId);
  const excluir = useExcluirAet();
  const canCreate = useCanCreate();
  const canDelete = useCanDelete();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <ClipboardCheck className="size-5 text-verde-primary" />
            Laudos AET
          </h1>
          <p className="text-sm text-gray-500">
            Análise Ergonômica do Trabalho — NR-17
          </p>
        </div>
        {canCreate && (
          <Link
            href="/aet/novo"
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
          >
            <Plus className="size-4" />
            Novo Laudo
          </Link>
        )}
      </div>

      <div className="max-w-sm">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
          Filtrar por empresa
        </label>
        <EmpresaSelect value={empresaId} onChange={setEmpresaId} modulo="sst" />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={5} />
          </div>
        ) : relatorios.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <ClipboardCheck className="size-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">
              Nenhum laudo AET encontrado
            </p>
            {canCreate && (
              <Link
                href="/aet/novo"
                className="mt-3 inline-flex items-center gap-1 text-sm text-verde-primary hover:underline"
              >
                <Plus className="size-4" /> Criar primeiro laudo
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                <th className="px-4 py-2.5 text-left font-medium">Setor(es)</th>
                <th className="px-4 py-2.5 text-left font-medium">Responsável</th>
                <th className="px-4 py-2.5 text-left font-medium">Data</th>
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {relatorios.map((r) => (
                <tr key={r.id_relatorio} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {r.empresas?.nome_empresa ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {r.setores.length === 0
                      ? "—"
                      : r.setores.map((s) => s.nome_setor || "Sem nome").join(", ")}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {r.responsavel_elaboracao || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {r.data_elaboracao
                      ? new Date(r.data_elaboracao + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"
                      )}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/aet/${r.id_relatorio}/dados`}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Eye className="size-3" /> Abrir
                      </Link>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setConfirmDel(r)}
                          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDel}
        title="Excluir laudo AET?"
        description={
          confirmDel
            ? `O laudo da empresa "${confirmDel.empresas?.nome_empresa ?? ""}" será excluído permanentemente.`
            : undefined
        }
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() => {
          if (confirmDel) {
            excluir.mutate(confirmDel.id_relatorio, {
              onSuccess: () => {
                toast.success("Laudo excluído");
                setConfirmDel(null);
              },
              onError: (e: Error) => toast.error(e.message),
            });
          }
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
