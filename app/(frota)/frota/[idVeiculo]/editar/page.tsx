"use client";

import { use } from "react";
import Link from "next/link";
import VeiculoForm from "@/components/frota/VeiculoForm";
import { useFrotaVeiculo } from "@/lib/hooks/useFrotaVeiculos";

export default function EditarVeiculoPage({
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
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
        <p className="text-sm font-medium text-gray-700">Veículo não encontrado</p>
        <p className="mt-1 text-sm text-gray-500">
          Ele pode ter sido movido para a lixeira, ou estar em uma base fora do seu acesso.
        </p>
        <Link
          href="/frota"
          className="mt-4 inline-block rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Voltar para a frota
        </Link>
      </div>
    );
  }

  return <VeiculoForm veiculo={veiculo} />;
}
