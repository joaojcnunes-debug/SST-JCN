"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import EquipamentoForm from "@/components/equipamentos/EquipamentoForm";
import { useEquipamento } from "@/lib/hooks/useEquipamentos";
import { LevarParaCampo } from "@/components/ui/LevarParaCampo";

export default function EquipamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: equipamento, isLoading } = useEquipamento(id);

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500">Carregando…</p>;
  }

  if (!equipamento) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
        <p className="text-sm font-medium text-gray-700">Equipamento não encontrado</p>
        <p className="mt-1 text-sm text-gray-500">
          Ele pode ter sido excluído, ou estar numa base que você não acessa.
        </p>
        <Link
          href="/equipamentos"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Voltar para a lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Levar para o campo — a decisão de copiar o equipamento para o aparelho
          é tomada ANTES de sair da base. Fica acima do formulário pelo mesmo
          motivo que na inspeção: no meio do preenchimento já é tarde. */}
      <LevarParaCampo
        idDocumento={equipamento.id_equipamento}
        dados={equipamento}
        rotulo="Equipamento"
      />
      <EquipamentoForm equipamento={equipamento} />
    </div>
  );
}
