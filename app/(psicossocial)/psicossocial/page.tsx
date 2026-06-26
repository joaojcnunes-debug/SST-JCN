"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, FileText, Trash2, ArrowRight, Building2, Pencil } from "lucide-react";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import EmpresaForm from "@/components/empresas/EmpresaForm";
import Badge from "@/components/ui/Badge";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  useDrpsExcluirRelatorio,
  useDrpsRelatorios,
} from "@/lib/hooks/useDrps";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useCanCreate, useCanDelete } from "@/lib/hooks/useUsuario";
import { fmtData } from "@/lib/utils";
import type { DrpsRelatorio, StatusRelatorio } from "@/lib/drps/types";

const STATUS_LABEL: Record<StatusRelatorio, string> = {
  RASCUNHO: "Rascunho",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  ENVIADO_CLIENTE: "Enviado para cliente",
  DELETADO: "Excluído",
};

const STATUS_VARIANT: Record<
  StatusRelatorio,
  "info" | "success" | "muted" | "warning" | "indigo"
> = {
  RASCUNHO: "muted",
  EM_ANDAMENTO: "info",
  CONCLUIDO: "success",
  ENVIADO_CLIENTE: "indigo",
  DELETADO: "warning",
};

export default function DrpsListaPage() {
  const canDelete = useCanDelete();
  const canCreate = useCanCreate();
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);
  const { data: empresa } = useEmpresa(idEmpresa);
  const { data: relatorios = [], isLoading } = useDrpsRelatorios(idEmpresa);
  const [confirmExcluir, setConfirmExcluir] = useState<DrpsRelatorio | null>(
    null
  );
  const [novaEmpresaOpen,   setNovaEmpresaOpen]   = useState(false);
  const [editarEmpresaOpen, setEditarEmpresaOpen] = useState(false);
  const excluir = useDrpsExcluirRelatorio();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Relatórios DRPS
        </h1>
        <p className="text-sm text-gray-600">
          Diagnósticos de Riscos Psicossociais. Cada empresa pode ter
          múltiplos relatórios (revisões sequenciais).
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Empresa
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <EmpresaSelect value={idEmpresa} onChange={setIdEmpresa} modulo="psicossocial" />
          </div>
          {idEmpresa && empresa && (
            <button
              type="button"
              onClick={() => setEditarEmpresaOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              title="Editar cadastro da empresa"
            >
              <Pencil className="size-4" /> Editar Empresa
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setNovaEmpresaOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-verde-primary bg-white px-3 py-2 text-sm font-semibold text-verde-primary shadow-sm hover:bg-verde-light"
            >
              <Building2 className="size-4" /> Nova Empresa
            </button>
          )}
        </div>
      </div>

      {!idEmpresa ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Selecione uma empresa para ver/criar relatórios DRPS.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <strong>{relatorios.length}</strong> relatório(s) de{" "}
              <strong>{empresa?.nome_empresa ?? "—"}</strong>
            </p>
            {canCreate && (
              <Link
                href={`/psicossocial/novo?empresa=${idEmpresa}`}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
              >
                <Plus className="size-4" /> Novo Relatório
              </Link>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm reveal-up card-hover">
            {isLoading ? (
              <div className="p-4">
                <LoadingSkeleton rows={4} />
              </div>
            ) : relatorios.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-500">
                Nenhum relatório DRPS para esta empresa. Clique em{" "}
                <strong>Novo Relatório</strong> para começar.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">
                      Revisão
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      Data Elaboração
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      Responsável Técnico
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">Registro</th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      Criado em
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {relatorios.map((r) => (
                    <tr key={r.id_relatorio} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/psicossocial/${r.id_relatorio}/dashboard`}
                          className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-verde-primary hover:underline"
                        >
                          <FileText className="size-4" /> Rev. {r.revisao}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {r.data_elaboracao
                          ? new Date(
                              r.data_elaboracao + "T00:00:00"
                            ).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {r.responsavel_tecnico ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {r.crp ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={STATUS_VARIANT[r.status]}>
                          {STATUS_LABEL[r.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {fmtData(r.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/psicossocial/${r.id_relatorio}/dashboard`}
                            className="rounded p-1.5 text-gray-500 hover:bg-verde-light hover:text-verde-primary"
                            title="Abrir"
                          >
                            <ArrowRight className="size-4" />
                          </Link>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setConfirmExcluir(r)}
                              className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-alert"
                              title="Excluir relatório"
                            >
                              <Trash2 className="size-4" />
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
        </>
      )}

      <EmpresaForm
        open={novaEmpresaOpen}
        onClose={() => setNovaEmpresaOpen(false)}
        onCreated={(id) => setIdEmpresa(id)}
      />

      <EmpresaForm
        open={editarEmpresaOpen}
        empresa={empresa}
        onClose={() => setEditarEmpresaOpen(false)}
      />

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir relatório DRPS?"
        description={
          confirmExcluir
            ? `O relatório Rev. ${confirmExcluir.revisao} e todos os respondentes/probabilidades/plano associados serão marcados como excluídos. Esta operação pode ser revertida no banco se necessário.`
            : undefined
        }
        variant="danger"
        loading={excluir.isPending}
        onConfirm={() => {
          if (!confirmExcluir) return;
          excluir.mutate(
            {
              id_relatorio: confirmExcluir.id_relatorio,
              id_empresa: confirmExcluir.id_empresa,
            },
            { onSuccess: () => setConfirmExcluir(null) }
          );
        }}
        onCancel={() => setConfirmExcluir(null)}
      />
    </div>
  );
}
