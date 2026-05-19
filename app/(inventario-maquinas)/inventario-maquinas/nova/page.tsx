"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes } from "lucide-react";
import toast from "react-hot-toast";
import MaquinaForm from "@/components/inventario-maquinas/MaquinaForm";
import {
  useCriarMaquina,
  type MaquinaInput,
} from "@/lib/hooks/useInventarioMaquinas";
import { useRequireCreate } from "@/lib/hooks/useUsuario";
import { gerarId } from "@/lib/utils";

export default function NovaMaquinaPage() {
  useRequireCreate("/inventario-maquinas");
  const router = useRouter();
  const criar = useCriarMaquina();

  // ID estável da máquina pra upload da foto antes mesmo do insert.
  // useMemo garante mesmo ID entre re-renders.
  const idMaquina = useMemo(() => gerarId("MAQ"), []);

  async function handleSubmit(input: MaquinaInput) {
    try {
      const row = await criar.mutateAsync({ input, idMaquina });
      toast.success("Máquina cadastrada");
      router.push(`/inventario-maquinas/${row.id_maquina}`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao cadastrar máquina");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/inventario-maquinas"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
      >
        <ArrowLeft className="size-3.5" /> Voltar ao inventário
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Boxes className="size-5 text-blue-600" />
          Nova máquina / equipamento
        </h1>
        <p className="text-sm text-gray-600">
          Preencha os dados de identificação. Apenas o nome é obrigatório — os
          demais campos podem ser completados depois.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <MaquinaForm
          idMaquina={idMaquina}
          onSubmit={handleSubmit}
          submitLabel="Cadastrar máquina"
        />
      </div>
    </div>
  );
}
