"use client";

import { Construction } from "lucide-react";

export default function EmConstrucao({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
        <div className="flex items-start gap-3">
          <Construction className="size-6 shrink-0 text-purple-700" />
          <div>
            <h1 className="text-lg font-semibold text-purple-900">{titulo}</h1>
            <p className="mt-1 text-sm text-purple-800">{descricao}</p>
            <p className="mt-3 text-xs text-purple-700">
              Esta tela entra na Fase 2 do módulo Psicossocial.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
