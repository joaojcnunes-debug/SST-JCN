"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardEdit, ArrowRight } from "lucide-react";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";

export default function FichaSelecionarPage() {
  const router = useRouter();
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);
  const [idInspecao, setIdInspecao] = useState<string>("");
  const { data: inspecoes = [], isLoading } = useInspecoesByEmpresa(
    idEmpresa ?? undefined
  );

  const podeGerar = !!idEmpresa && !!idInspecao;

  function gerar() {
    if (!podeGerar) return;
    router.push(`/inspecoes/${idInspecao}/ficha`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <ClipboardEdit className="size-5 text-verde-primary" />
          Ficha em Branco
        </h1>
        <p className="text-sm text-gray-600">
          Gere uma ficha de inspeção em branco com os itens de uma inspeção
          existente — para o técnico levar a campo, preencher manualmente e
          depois lançar no sistema.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Empresa
          </label>
          <EmpresaSelect
            value={idEmpresa}
            onChange={(v) => {
              setIdEmpresa(v);
              setIdInspecao("");
            }}
          />
        </div>

        {idEmpresa && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Inspeção
            </label>
            {isLoading ? (
              <LoadingSkeleton rows={2} />
            ) : inspecoes.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Nenhuma inspeção cadastrada nesta empresa. Crie uma em{" "}
                <strong>Nova Inspeção</strong> antes.
              </p>
            ) : (
              <select
                value={idInspecao}
                onChange={(e) => setIdInspecao(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              >
                <option value="">— Escolha uma inspeção —</option>
                {inspecoes.map((i) => (
                  <option key={i.id_inspecao} value={i.id_inspecao}>
                    {i.id_inspecao} · Revisão {i.revisao}
                    {i.data_inspecao
                      ? ` · ${new Date(
                          i.data_inspecao + "T00:00:00"
                        ).toLocaleDateString("pt-BR")}`
                      : ""}
                    {i.responsavel ? ` · ${i.responsavel}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="flex justify-end border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={gerar}
            disabled={!podeGerar}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
          >
            Gerar Ficha em Branco
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
