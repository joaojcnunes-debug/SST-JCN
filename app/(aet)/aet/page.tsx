"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  FileText,
  FilePlus,
  Printer,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { useAetRelatorios, useExcluirAet } from "@/lib/hooks/useAet";
import { useCanCreate, useCanDelete } from "@/lib/hooks/useUsuario";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { useUnidadeFiltro } from "@/lib/hooks/useUnidadeFiltro";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { cn } from "@/lib/utils";
import type { AetRelatorio, ClassificacaoRiscoAET } from "@/lib/supabase/types";

const CLASS_ORDER: ClassificacaoRiscoAET[] = [
  "Trivial",
  "De Atenção",
  "Moderado",
  "Alto",
  "Crítico",
];

const RISK_COLOR: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-gray-100 text-gray-700 border-gray-200",
  "De Atenção": "bg-blue-100 text-blue-700 border-blue-200",
  Moderado: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Alto: "bg-orange-100 text-orange-700 border-orange-200",
  Crítico: "bg-red-100 text-red-700 border-red-200",
};

const RISK_DOT: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-gray-400",
  "De Atenção": "bg-blue-500",
  Moderado: "bg-yellow-500",
  Alto: "bg-orange-500",
  Crítico: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  CONCLUIDO: "Concluído",
};

const STATUS_COLOR: Record<string, string> = {
  RASCUNHO: "bg-amber-100 text-amber-800 border-amber-200",
  CONCLUIDO: "bg-green-100 text-green-800 border-green-200",
};

function classificacaoMax(rel: AetRelatorio): ClassificacaoRiscoAET | null {
  const all = rel.setores.flatMap((s) => s.riscos.map((r) => r.classificacao_risco));
  return all.reduce<ClassificacaoRiscoAET | null>(
    (max, c) => (!max || CLASS_ORDER.indexOf(c) > CLASS_ORDER.indexOf(max) ? c : max),
    null,
  );
}

export default function AetListPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<AetRelatorio | null>(null);

  const { data: relatoriosAll = [], isLoading } = useAetRelatorios(empresaId);
  const { unidadeId, inUnidade } = useUnidadeFiltro();
  const relatorios = useMemo(() => relatoriosAll.filter((r) => inUnidade(r.id_empresa)), [relatoriosAll, inUnidade]);
  const excluir = useExcluirAet();
  const canCreate = useCanCreate();
  const canDelete = useCanDelete();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Cabeçalho documental */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-gray-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-white shadow-sm">
              <FileText className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Gestão de Laudos AET</h1>
              <p className="text-xs text-slate-500">
                Produção documental · Análise Ergonômica do Trabalho · NR-17
              </p>
            </div>
          </div>
          {canCreate && (
            <Link
              href="/aet/novo"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <FilePlus className="size-4" /> Novo Laudo
            </Link>
          )}
        </div>

        <div className="mt-4 max-w-sm">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
            Filtrar por empresa
          </label>
          <EmpresaSelect value={empresaId} onChange={setEmpresaId} modulo="sst" unidadeId={unidadeId} />
        </div>
      </div>

      {/* Tabela documental */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm reveal-up card-hover">
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
            <p className="mt-1 text-xs text-gray-400">
              {empresaId ? "Tente remover o filtro de empresa." : "Crie o primeiro laudo para começar."}
            </p>
            {canCreate && (
              <Link
                href="/aet/novo"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
              >
                <FilePlus className="size-4" /> Criar primeiro laudo
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Empresa</th>
                  <th className="px-4 py-3 text-left font-semibold">Risco Máx.</th>
                  <th className="px-4 py-3 text-center font-semibold">Setores</th>
                  <th className="px-4 py-3 text-left font-semibold">Responsável</th>
                  <th className="px-4 py-3 text-left font-semibold">Data</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Documentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {relatorios.map((r) => {
                  const riskMax = classificacaoMax(r);
                  return (
                    <tr key={r.id_relatorio} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {r.empresas?.nome_empresa ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {riskMax ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                              RISK_COLOR[riskMax],
                            )}
                          >
                            <span className={cn("size-1.5 rounded-full", RISK_DOT[riskMax])} />
                            {riskMax}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-700">
                        {r.setores.length}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.responsavel_elaboracao || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.data_elaboracao
                          ? new Date(r.data_elaboracao + "T00:00:00").toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                            STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                          )}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/aet/${r.id_relatorio}/setores`}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            title="Editar setores e riscos"
                          >
                            <ClipboardCheck className="size-3" /> Editar
                          </Link>
                          <Link
                            href={`/aet/${r.id_relatorio}/laudo`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            title="Ver e imprimir laudo PDF"
                          >
                            <Printer className="size-3" /> Laudo
                          </Link>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setConfirmDel(r)}
                              className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                              title="Excluir laudo"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-right text-xs text-gray-400">
              {relatorios.length} laudo{relatorios.length !== 1 ? "s" : ""} encontrado{relatorios.length !== 1 ? "s" : ""}
            </div>
          </div>
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
              onError: (e: Error) => toast.error(mensagemErro(e)),
            });
          }
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
