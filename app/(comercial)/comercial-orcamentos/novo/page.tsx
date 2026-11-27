"use client";

// Comercial › Orçamentos › Novo (0.3.339). Vindo do cartão da empresa (?empresa=…), os dados e os itens das
// oportunidades a vender já vêm preenchidos.

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import OrcamentoEditor from "@/components/orcamentos/OrcamentoEditor";

export default function NovoOrcamentoPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const empresa = useSearchParams().get("empresa");
  return (
    <div className="space-y-4">
      <Link href="/comercial-orcamentos" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:underline"><ArrowLeft className="size-4" /> Orçamentos</Link>
      <h1 className="text-xl font-bold text-gray-900">Novo orçamento</h1>
      <OrcamentoEditor empresaInicial={empresa} />
    </div>
  );
}
