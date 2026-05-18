"use client";

import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import AnaliseForm from "@/components/quimicos/AnaliseForm";
import { useRequireCreate } from "@/lib/hooks/useUsuario";

export default function NovaAnalisePage() {
  useRequireCreate("/analise-quimicos");
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/analise-quimicos"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
      >
        <ArrowLeft className="size-3.5" /> Voltar
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <FlaskConical className="size-5 text-sky-500" />
          Nova Análise de Químico
        </h1>
        <p className="text-sm text-gray-600">
          Envie a FDS/FISPQ em PDF ou preencha os dados do produto manualmente.
          A IA vai gerar parecer técnico em ~10-30 segundos.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <AnaliseForm />
      </div>
    </div>
  );
}
