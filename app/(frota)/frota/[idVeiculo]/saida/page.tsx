"use client";

import { use } from "react";
import Link from "next/link";
import ChecklistSaidaWizard from "@/components/frota/ChecklistSaidaWizard";
import { useFrotaVeiculo } from "@/lib/hooks/useFrotaVeiculos";

export default function NovaSaidaPage({
  params,
}: {
  params: Promise<{ idVeiculo: string }>;
}) {
  const { idVeiculo } = use(params);
  const { data: veiculo, isLoading } = useFrotaVeiculo(idVeiculo);

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500">Carregando…</p>;
  }

  if (!veiculo) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
        <p className="text-sm font-medium text-gray-700">Veículo não encontrado</p>
        <Link href="/frota"
          className="mt-4 inline-block rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Voltar para a frota
        </Link>
      </div>
    );
  }

  // Veículo fora de operação não sai do pátio. Barrar aqui é mais honesto do que
  // deixar registrar a saída e alguém descobrir depois.
  if (veiculo.status !== "ATIVO") {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Este veículo não está ativo</p>
          <p className="mt-1 text-sm text-amber-800">
            A situação atual não permite registrar saída. Se ele voltou a rodar, mude a situação
            para <strong>Ativo</strong> na ficha.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/frota/${veiculo.id_veiculo}`}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Ver ficha
          </Link>
          <Link href={`/frota/${veiculo.id_veiculo}/editar`}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Mudar situação
          </Link>
        </div>
      </div>
    );
  }

  return <ChecklistSaidaWizard veiculo={veiculo} />;
}
