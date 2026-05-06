"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, ClipboardList, Building2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import EmpresaForm from "@/components/empresas/EmpresaForm";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { formatCNPJ } from "@/lib/utils";
import { GRAU_RISCO_CONFIG } from "@/lib/constants";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import { fmtData } from "@/lib/utils";
import { useCanEdit } from "@/lib/hooks/useUsuario";

interface Props {
  params: Promise<{ id: string }>;
}

export default function EmpresaDetalhePage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const canEdit = useCanEdit();
  const [editOpen, setEditOpen] = useState(false);

  const { data: empresa, isLoading } = useEmpresa(id);
  const { data: inspecoes = [] } = useInspecoesByEmpresa(id);

  if (isLoading) {
    return <LoadingSkeleton rows={6} />;
  }
  if (!empresa) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Empresa não encontrada.{" "}
        <Link href="/empresas" className="font-medium hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  const grauCfg =
    GRAU_RISCO_CONFIG[empresa.grau_risco ?? 1] ?? GRAU_RISCO_CONFIG[1];

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="size-4" /> Voltar
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-verde-light text-verde-primary">
              <Building2 className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {empresa.nome_empresa}
              </h1>
              {empresa.razao_social && (
                <p className="text-sm text-gray-600">{empresa.razao_social}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                CNPJ: {formatCNPJ(empresa.cnpj)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <span
              className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                color: grauCfg.cor,
                backgroundColor: grauCfg.bg,
              }}
            >
              {grauCfg.label}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="size-3.5" /> Editar
              </button>
            )}
          </div>
        </div>

        {empresa.observacao && (
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            {empresa.observacao}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Inspeções ({inspecoes.length})
          </h2>
          <Link
            href={`/inspecoes/nova?empresa=${empresa.id_empresa}`}
            className="rounded-md bg-verde-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-verde-accent"
          >
            + Nova
          </Link>
        </div>
        {inspecoes.length === 0 ? (
          <div className="flex flex-col items-center p-8 text-center text-sm text-gray-500">
            <ClipboardList className="size-8 text-gray-400" />
            <p className="mt-2">Nenhuma inspeção registrada para esta empresa.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {inspecoes.map((i) => (
              <li
                key={i.id_inspecao}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Rev. {i.revisao} ·{" "}
                    <span className="font-mono text-xs text-gray-500">
                      {i.id_inspecao}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {fmtData(i.data_inspecao)} · {i.responsavel ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={i.status} />
                  <Link
                    href={`/inspecoes/${i.id_inspecao}`}
                    className="text-xs font-medium text-verde-primary hover:underline"
                  >
                    Abrir →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EmpresaForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        empresa={empresa}
      />
    </div>
  );
}
