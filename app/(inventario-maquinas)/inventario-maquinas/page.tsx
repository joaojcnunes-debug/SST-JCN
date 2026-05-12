"use client";

import Link from "next/link";
import { Boxes, ArrowLeft, Construction } from "lucide-react";

export default function InventarioMaquinasPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-16 text-center">
      <div
        className="flex size-20 items-center justify-center rounded-2xl text-white shadow-md"
        style={{ backgroundColor: "#2563EB" }}
      >
        <Boxes className="size-10" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-gray-900">
        Inventário de Máquinas e Equipamentos
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Cadastro interno de máquinas e equipamentos da Chabra.
      </p>

      <div className="mt-8 flex w-full items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm text-blue-900">
        <Construction className="size-5 shrink-0" />
        <p>
          Em construção. Em breve esta área terá cadastro de máquinas,
          histórico de manutenção e controle de patrimônio.
        </p>
      </div>

      <Link
        href="/inicio"
        className="mt-8 inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent"
      >
        <ArrowLeft className="size-4" /> Voltar ao início
      </Link>
    </div>
  );
}
