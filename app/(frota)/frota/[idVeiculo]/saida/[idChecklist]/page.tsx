"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ChecklistSaidaWizard from "@/components/frota/ChecklistSaidaWizard";
import DetalheViagem from "@/components/frota/DetalheViagem";
import { useFrotaVeiculo } from "@/lib/hooks/useFrotaVeiculos";
import { useChecklist } from "@/lib/hooks/useFrotaChecklists";
import { formatarKm } from "@/lib/frota/km";
import { formatarPlaca } from "@/lib/frota/placa";

/**
 * Uma saída específica. Rascunho abre o assistente para continuar de onde parou;
 * finalizada abre em leitura — saída finalizada é registro, não formulário.
 *
 * O corpo da leitura mora em components/frota/DetalheViagem.tsx, porque o modal
 * da Movimentação mostra exatamente o mesmo. Esta página é a moldura: o caminho
 * de volta para a ficha do veículo e o endereço que os alertas do painel guardam.
 */
export default function SaidaPage({
  params,
}: {
  params: Promise<{ idVeiculo: string; idChecklist: string }>;
}) {
  const { idVeiculo, idChecklist } = use(params);
  const { data: veiculo, isLoading: carregandoVeiculo } = useFrotaVeiculo(idVeiculo);
  const { data: checklist, isLoading: carregandoChecklist } = useChecklist(idChecklist);

  if (carregandoVeiculo || carregandoChecklist) {
    return <p className="py-12 text-center text-sm text-gray-500">Carregando…</p>;
  }

  if (!veiculo || !checklist) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
        <p className="text-sm font-medium text-gray-700">Saída não encontrada</p>
        <Link href={`/frota/${idVeiculo}`}
          className="mt-4 inline-block rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Voltar para a ficha
        </Link>
      </div>
    );
  }

  if (checklist.status === "RASCUNHO") {
    return <ChecklistSaidaWizard veiculo={veiculo} checklist={checklist} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/frota/${idVeiculo}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="size-4" />
        {formatarPlaca(veiculo.placa)}
      </Link>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{checklist.condutor_nome}</h1>
            <p className="text-sm text-gray-500">
              {new Date(checklist.data_saida).toLocaleString("pt-BR")} ·{" "}
              <span className="tabular-nums">{formatarKm(checklist.km_saida)} km</span>
            </p>
          </div>
          {checklist.data_retorno ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              Voltou
            </span>
          ) : (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
              Na rua
            </span>
          )}
        </div>
      </div>

      <DetalheViagem checklist={checklist} veiculo={veiculo} />
    </div>
  );
}
